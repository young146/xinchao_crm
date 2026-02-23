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
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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
export async function saveLeadMeta(data) { await setField("leadMeta", "data", data); }
export async function saveManualLeads(leads) { await setField("manualLeads", "leads", leads); }
export async function saveTrash(items) { await setField("trash", "items", items); }

// ── 1회 읽기 (마이그레이션 전용) ────────────────────────────────
export async function getManualLeads() { return getField("manualLeads", "leads", []); }

// ── localStorage → Firestore 최초 마이그레이션 ──────────────────
export async function migrateFromLocalStorage() {
    const mapping = [
        { docId: "deletedIds", field: "ids", lsKey: "crm_deletedIds" },
        { docId: "leadMeta", field: "data", lsKey: "crm_leadMeta" },
        { docId: "manualLeads", field: "leads", lsKey: "crm_manualLeads" },
        { docId: "trash", field: "items", lsKey: "crm_trash" },
    ];

    for (const { docId, field, lsKey } of mapping) {
        const lsRaw = localStorage.getItem(lsKey);
        if (!lsRaw) continue;
        const snap = await getDoc(ref(docId));
        if (snap.exists()) continue; // 이미 Firestore에 있으면 스킵
        try {
            const parsed = JSON.parse(lsRaw);
            await setField(docId, field, parsed);
            console.log(`[Migration] ✅ ${lsKey} → Firestore 완료`);
        } catch (e) {
            console.error(`[Migration] ❌ ${lsKey} 실패:`, e.message);
        }
    }
}
