/**
 * Firestore 연동 서비스
 * crm_deletedIds / crm_leadMeta / crm_manualLeads / crm_trash 를
 * localStorage → Firestore 로 마이그레이션
 *
 * 컬렉션 구조:
 *   xinchao_crm/meta/deletedIds   → { ids: [...] }
 *   xinchao_crm/meta/leadMeta     → { data: { leadId: {...} } }
 *   xinchao_crm/meta/manualLeads  → { leads: [...] }
 *   xinchao_crm/meta/trash        → { items: [...] }
 */

import { db } from "../firebase";
import {
    doc,
    getDoc,
    setDoc,
} from "firebase/firestore";

const COL = "xinchao_crm";
const META = "meta";

const ref = (docId) => doc(db, COL, META, "docs", docId);

// ── 공통 get/set ──────────────────────────────────────────────
async function getField(docId, field, fallback) {
    try {
        const snap = await getDoc(ref(docId));
        if (snap.exists()) return snap.data()[field] ?? fallback;
        return fallback;
    } catch (e) {
        console.warn(`[Firestore] getField(${docId}) 실패, localStorage 폴백:`, e.message);
        return fallback;
    }
}

async function setField(docId, field, value) {
    try {
        await setDoc(ref(docId), { [field]: value }, { merge: true });
    } catch (e) {
        console.warn(`[Firestore] setField(${docId}) 실패:`, e.message);
    }
}

// ── deletedIds ────────────────────────────────────────────────
export async function getDeletedIds() {
    return getField("deletedIds", "ids", []);
}
export async function saveDeletedIds(ids) {
    await setField("deletedIds", "ids", ids);
}

// ── leadMeta ──────────────────────────────────────────────────
export async function getLeadMeta() {
    return getField("leadMeta", "data", {});
}
export async function saveLeadMeta(data) {
    await setField("leadMeta", "data", data);
}

// ── manualLeads ───────────────────────────────────────────────
export async function getManualLeads() {
    return getField("manualLeads", "leads", []);
}
export async function saveManualLeads(leads) {
    await setField("manualLeads", "leads", leads);
}

// ── trash ─────────────────────────────────────────────────────
export async function getTrash() {
    return getField("trash", "items", []);
}
export async function saveTrash(items) {
    await setField("trash", "items", items);
}

// ── localStorage → Firestore 최초 마이그레이션 ────────────────
export async function migrateFromLocalStorage() {
    const keys = {
        deletedIds: "ids",
        leadMeta: "data",
        manualLeads: "leads",
        trash: "items",
    };
    const lsKeys = {
        deletedIds: "crm_deletedIds",
        leadMeta: "crm_leadMeta",
        manualLeads: "crm_manualLeads",
        trash: "crm_trash",
    };

    let migrated = false;
    for (const [docId, field] of Object.entries(keys)) {
        const lsKey = lsKeys[docId];
        const lsRaw = localStorage.getItem(lsKey);
        if (!lsRaw) continue;

        // Firestore에 이미 데이터가 있으면 스킵
        const snap = await getDoc(ref(docId));
        if (snap.exists()) continue;

        try {
            const parsed = JSON.parse(lsRaw);
            await setField(docId, field, parsed);
            console.log(`[Migration] ${lsKey} → Firestore(${docId}) 완료`);
            migrated = true;
        } catch (e) {
            console.warn(`[Migration] ${lsKey} 마이그레이션 실패:`, e.message);
        }
    }
    if (migrated) console.log("[Migration] localStorage → Firestore 마이그레이션 완료!");
}
