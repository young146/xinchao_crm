/**
 * Firestore 실시간 연동 서비스
 * onSnapshot 으로 다른 기기 변경사항을 자동 감지
 *
 * 컬렉션: xinchao_crm
 *   ├── deletedIds  { ids: [...] }
 *   ├── leadMeta    { data: { leadId: {...} } }
 *   ├── manualLeads { leads: [...] }
 *   └── trash       { items: [...] }
 */

import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

const COL = "xinchao_crm";
const ref = (docId) => doc(db, COL, docId);

// ── 쓰기 (변경 시 저장) ─────────────────────────────────────────
async function setField(docId, field, value) {
    try {
        // Firestore는 undefined를 허용하지 않으므로 JSON으로 sanitize
        const sanitized = JSON.parse(JSON.stringify(value ?? null));
        await setDoc(ref(docId), { [field]: sanitized }, { merge: true });
        console.log(`[Firestore] ✅ ${docId} 저장 완료`);
    } catch (e) {
        console.error(`[Firestore] ❌ ${docId} 저장 실패:`, e.code, e.message);
    }
}

// ── 읽기 (1회용, 초기 마이그레이션용) ──────────────────────────
async function getField(docId, field, fallback) {
    try {
        const snap = await getDoc(ref(docId));
        if (snap.exists()) return snap.data()[field] ?? fallback;
        return fallback;
    } catch (e) {
        console.error(`[Firestore] ❌ ${docId} 읽기 실패:`, e.code, e.message);
        return fallback;
    }
}

// ── 실시간 리스너 (onSnapshot) ──────────────────────────────────
/**
 * 4개의 Firestore 문서를 실시간 구독합니다.
 * 다른 기기에서 변경하면 자동으로 콜백이 실행됩니다.
 *
 * @param {Object} callbacks
 *   { onDeletedIds, onLeadMeta, onManualLeads, onTrash }
 * @returns unsubscribe 함수 (컴포넌트 unmount 시 호출)
 */
export function subscribeAll({ onDeletedIds, onLeadMeta, onManualLeads, onTrash }) {
    const unsubFns = [];

    const subscribe = (docId, field, fallback, callback) => {
        const unsub = onSnapshot(ref(docId), (snap) => {
            if (snap.exists()) {
                const val = snap.data()[field] ?? fallback;
                console.log(`[Firestore] 🔄 ${docId} 업데이트:`, val);
                callback(val);
            } else {
                callback(fallback);
            }
        }, (e) => {
            console.error(`[Firestore] ❌ ${docId} 구독 실패:`, e.code, e.message);
        });
        unsubFns.push(unsub);
    };

    subscribe("deletedIds", "ids", [], onDeletedIds);
    subscribe("leadMeta", "data", {}, onLeadMeta);
    subscribe("manualLeads", "leads", [], onManualLeads);
    subscribe("trash", "items", [], onTrash);

    // 전체 구독 해제 함수 반환
    return () => unsubFns.forEach(fn => fn());
}

// ── 저장 함수들 ─────────────────────────────────────────────────
export async function saveDeletedIds(ids) { await setField("deletedIds", "ids", ids); }

/**
 * saveLeadMeta - 리드 메타 안전 저장
 *
 * 호출 방식 A: saveLeadMeta(leadId, singleMeta)
 *   → Firestore의 leadMeta.data[leadId] 만 업데이트 (다른 리드 데이터 보존)
 *   → dot-notation 필드 경로 사용: { "data.lead-xx": singleMeta }
 *
 * 호출 방식 B: saveLeadMeta(fullDataObject)  (하위 호환, fullData는 객체)
 *   → 전체 data 필드 덮어쓰기 (가급적 사용 자제)
 */
export async function saveLeadMeta(leadIdOrFullData, singleMeta) {
    try {
        if (typeof leadIdOrFullData === "string" && singleMeta !== undefined) {
            // ✅ 안전한 방식: 해당 리드 key만 업데이트 (다른 리드 데이터 보존)
            const leadId = leadIdOrFullData;
            const sanitized = JSON.parse(JSON.stringify(singleMeta ?? null));
            // updateDoc + dot-notation: data.lead-xx 만 업데이트, 나머지 key 보존
            await updateDoc(ref("leadMeta"), { [`data.${leadId}`]: sanitized });
            console.log(`[Firestore] ✅ leadMeta[${leadId}] 저장 완료 (안전 merge)`);
        } else {
            // 하위호환: 전체 data 교체 (마이그레이션 전용, 가급적 사용 자제)
            const sanitized = JSON.parse(JSON.stringify(leadIdOrFullData ?? {}));
            await setDoc(ref("leadMeta"), { data: sanitized }, { merge: true });
            console.log(`[Firestore] ✅ leadMeta 전체 저장 완료`);
        }
    } catch (e) {
        console.error(`[Firestore] ❌ leadMeta 저장 실패:`, e.code, e.message);
    }
}

export async function saveManualLeads(leads) { await setField("manualLeads", "leads", leads); }
export async function saveTrash(items) { await setField("trash", "items", items); }

// ── 1회 읽기 (마이그레이션 전용) ────────────────────────────────
export async function getManualLeads() { return getField("manualLeads", "leads", []); }
export async function getLeadMeta() { return getField("leadMeta", "data", {}); }

// ── localStorage → Firestore 자동 병합 마이그레이션 ─────────────
// 각 컴퓨터가 앱을 열 때마다 localStorage 데이터를 Firestore에 병합하고 삭제합니다.
// 사용자가 아무것도 할 필요 없습니다.
export async function migrateFromLocalStorage() {
    // 이미 이 브라우저에서 마이그레이션 완료했으면 스킵
    if (localStorage.getItem('crm_migrated_v2') === 'done') return;

    console.log('[Migration] localStorage → Firestore 병합 시작...');

    try {
        // 1) deletedIds 병합: localStorage + Firestore 합집합
        const lsIds = JSON.parse(localStorage.getItem('crm_deletedIds') || '[]');
        if (lsIds.length > 0) {
            const snap = await getDoc(ref('deletedIds'));
            const fsIds = snap.exists() ? (snap.data().ids || []) : [];
            const merged = [...new Set([...fsIds, ...lsIds])]; // 중복 제거 합집합
            await setField('deletedIds', 'ids', merged);
            console.log(`[Migration] deletedIds 병합: ${fsIds.length}개 + ${lsIds.length}개 → ${merged.length}개`);
        }

        // 2) trash 병합: localStorage + Firestore 합집합 (id 기준 중복 제거)
        const lsTrash = JSON.parse(localStorage.getItem('crm_trash') || '[]');
        if (lsTrash.length > 0) {
            const snap = await getDoc(ref('trash'));
            const fsTrash = snap.exists() ? (snap.data().items || []) : [];
            const trashMap = new Map();
            [...fsTrash, ...lsTrash].forEach(item => trashMap.set(item.id, item));
            const merged = [...trashMap.values()];
            await setField('trash', 'items', merged);
            console.log(`[Migration] trash 병합: ${fsTrash.length}개 + ${lsTrash.length}개 → ${merged.length}개`);
        }

        // 3) leadMeta 병합: Firestore 우선, localStorage로 보완
        const lsMeta = JSON.parse(localStorage.getItem('crm_leadMeta') || '{}');
        if (Object.keys(lsMeta).length > 0) {
            const snap = await getDoc(ref('leadMeta'));
            const fsMeta = snap.exists() ? (snap.data().data || {}) : {};
            const merged = { ...lsMeta, ...fsMeta }; // Firestore 값 우선
            await setField('leadMeta', 'data', merged);
            console.log(`[Migration] leadMeta 병합 완료`);
        }

        // 4) manualLeads 병합
        const lsManual = JSON.parse(localStorage.getItem('crm_manualLeads') || '[]');
        if (lsManual.length > 0) {
            const snap = await getDoc(ref('manualLeads'));
            const fsManual = snap.exists() ? (snap.data().leads || []) : [];
            const manualMap = new Map();
            [...lsManual, ...fsManual].forEach(l => manualMap.set(l.id, l));
            const merged = [...manualMap.values()];
            await setField('manualLeads', 'leads', merged);
            console.log(`[Migration] manualLeads 병합 완료`);
        }

        // 마이그레이션 완료 표시 (이 브라우저에서 다시 안 함)
        localStorage.setItem('crm_migrated_v2', 'done');
        // 구 localStorage 데이터 삭제
        localStorage.removeItem('crm_deletedIds');
        localStorage.removeItem('crm_leadMeta');
        localStorage.removeItem('crm_manualLeads');
        localStorage.removeItem('crm_trash');
        console.log('[Migration] ✅ 완료 - localStorage 정리됨');

    } catch (e) {
        console.error('[Migration] ❌ 실패:', e.message);
    }
}
