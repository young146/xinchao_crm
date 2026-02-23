/**
 * Firestore 연동 서비스
 * 컬렉션: xinchao_crm
 *   ├── deletedIds  { ids: [...] }
 *   ├── leadMeta    { data: { leadId: {...} } }
 *   ├── manualLeads { leads: [...] }
 *   └── trash       { items: [...] }
 */

import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const COL = "xinchao_crm";

// 단순 경로: xinchao_crm/{docId}
const ref = (docId) => doc(db, COL, docId);

// ── 공통 get/set ───────────────────────────────────────────────
async function getField(docId, field, fallback) {
    try {
        const snap = await getDoc(ref(docId));
        if (snap.exists()) {
            console.log(`[Firestore] getField(${docId}) 성공:`, snap.data()[field]);
            return snap.data()[field] ?? fallback;
        }
        console.log(`[Firestore] getField(${docId}): 문서 없음 → 기본값 사용`);
        return fallback;
    } catch (e) {
        console.error(`[Firestore] getField(${docId}) 실패:`, e.code, e.message);
        return fallback;
    }
}

async function setField(docId, field, value) {
    try {
        await setDoc(ref(docId), { [field]: value }, { merge: true });
        console.log(`[Firestore] setField(${docId}) 저장 완료`);
    } catch (e) {
        console.error(`[Firestore] setField(${docId}) 실패:`, e.code, e.message);
    }
}

// ── deletedIds ─────────────────────────────────────────────────
export async function getDeletedIds() {
    return getField("deletedIds", "ids", []);
}
export async function saveDeletedIds(ids) {
    await setField("deletedIds", "ids", ids);
}

// ── leadMeta ───────────────────────────────────────────────────
export async function getLeadMeta() {
    return getField("leadMeta", "data", {});
}
export async function saveLeadMeta(data) {
    await setField("leadMeta", "data", data);
}

// ── manualLeads ────────────────────────────────────────────────
export async function getManualLeads() {
    return getField("manualLeads", "leads", []);
}
export async function saveManualLeads(leads) {
    await setField("manualLeads", "leads", leads);
}

// ── trash ──────────────────────────────────────────────────────
export async function getTrash() {
    return getField("trash", "items", []);
}
export async function saveTrash(items) {
    await setField("trash", "items", items);
}

// ── localStorage → Firestore 최초 마이그레이션 ─────────────────
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
            console.log(`[Migration] ${lsKey} → Firestore(${docId}) 완료`);
        } catch (e) {
            console.error(`[Migration] ${lsKey} 실패:`, e.message);
        }
    }
}
