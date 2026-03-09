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
            const leadId = leadIdOrFullData;
            const sanitized = JSON.parse(JSON.stringify(singleMeta ?? null));

            // ✅ updateDoc + dot-notation: data 필드 내부의 단일 key만 업데이트
            // 다른 lead key들은 절대 건드리지 않음
            // (setDoc+merge:true는 중첩 Map을 통째로 교체하므로 사용 금지)
            try {
                await updateDoc(ref("leadMeta"), { [`data.${leadId}`]: sanitized });
                console.log(`[Firestore] ✅ leadMeta[${leadId}] 저장 완료`);
            } catch (innerErr) {
                if (innerErr.code === "not-found") {
                    // 문서가 없는 경우에만 setDoc으로 생성 (첫 실행 시)
                    await setDoc(ref("leadMeta"), { data: { [leadId]: sanitized } });
                    console.log(`[Firestore] ✅ leadMeta 신규 생성 후 저장: ${leadId}`);
                } else {
                    throw innerErr;
                }
            }
        } else {
            // 하위호환: 전체 data 교체 (마이그레이션 전용)
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

// ── 발행 일정 (실시간 동기화) ────────────────────────────────────
/**
 * 발행 일정 오버라이드를 Firestore에 저장
 * @param {Object} customOverrides - 기본값과 다른 항목만 저장 {vol: {date, status}}
 */
export async function saveVolumeSchedule(customOverrides) {
    await setField("settings", "volumeSchedule", customOverrides);
}

/**
 * 발행 일정 실시간 구독 (onSnapshot)
 * @param {Function} callback - 스케줄 변경 시 호출 { customOverrides }
 * @returns unsubscribe 함수
 */
export function listenVolumeSchedule(callback) {
    const unsub = onSnapshot(ref("settings"), (snap) => {
        if (snap.exists()) {
            const val = snap.data()["volumeSchedule"] ?? {};
            console.log("[Firestore] 🔄 발행일정 업데이트:", Object.keys(val).length + "개 항목");
            callback(val);
        } else {
            callback({});
        }
    }, (e) => {
        console.error("[Firestore] ❌ 발행일정 구독 실패:", e.code, e.message);
    });
    return unsub;
}

// ── localStorage → Firestore 자동 병합 마이그레이션 ─────────────
export async function migrateFromLocalStorage() {
    console.log('[Migration] 좀비 캐시 부활 방지를 위해 마이그레이션을 비활성화함.');
    localStorage.removeItem('crm_migrated_v2');
    localStorage.removeItem('crm_deletedIds');
    localStorage.removeItem('crm_leadMeta');
    localStorage.removeItem('crm_manualLeads');
    localStorage.removeItem('crm_trash');
}

