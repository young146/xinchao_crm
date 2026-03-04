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
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } from "firebase/firestore";

// 새 컬렉션 구조 (기존 단일 문서 병목 해결)
const COLS = {
    deletedIds: "crm_deleted_ids",
    leadMeta: "crm_leads_meta",
    manualLeads: "crm_manual_leads",
    trash: "crm_trash"
};

// ── 실시간 리스너 (onSnapshot) ──────────────────────────────────
/**
 * 4개의 Firestore 컬렉션을 실시간 구독합니다.
 * @param {Object} callbacks { onDeletedIds, onLeadMeta, onManualLeads, onTrash }
 * @returns unsubscribe 함수 
 */
export function subscribeAll({ onDeletedIds, onLeadMeta, onManualLeads, onTrash }) {
    const unsubFns = [];

    // deletedIds 컬렉션 구독 (각 문서의 id가 곧 삭제된 리드 id)
    const unsubDeleted = onSnapshot(collection(db, COLS.deletedIds), (snap) => {
        const ids = snap.docs.map(doc => doc.id);
        onDeletedIds(ids);
    }, (e) => console.error(`[Firestore] ❌ deletedIds 구독 실패:`, e));
    unsubFns.push(unsubDeleted);

    // leadMeta 컬렉션 구독 (각 문서가 한 고객의 메타데이터)
    const unsubMeta = onSnapshot(collection(db, COLS.leadMeta), (snap) => {
        const metaObj = {};
        snap.forEach(doc => { metaObj[doc.id] = doc.data(); });
        onLeadMeta(metaObj);
    }, (e) => console.error(`[Firestore] ❌ leadMeta 구독 실패:`, e));
    unsubFns.push(unsubMeta);

    // manualLeads 구독 
    const unsubManual = onSnapshot(collection(db, COLS.manualLeads), (snap) => {
        const leads = snap.docs.map(doc => doc.data());
        onManualLeads(leads);
    }, (e) => console.error(`[Firestore] ❌ manualLeads 구독 실패:`, e));
    unsubFns.push(unsubManual);

    // trash 구독
    const unsubTrash = onSnapshot(collection(db, COLS.trash), (snap) => {
        const items = snap.docs.map(doc => doc.data());
        onTrash(items);
    }, (e) => console.error(`[Firestore] ❌ trash 구독 실패:`, e));
    unsubFns.push(unsubTrash);

    return () => unsubFns.forEach(fn => fn());
}

// ── 저장 함수들 (개별 문서 단위 저장) ──────────────────────────

export async function saveDeletedIds(ids) {
    // Pipeline에서 넘겨주는 ids 배열 대신, 추가/삭제 시 개별 호출을 권장하지만 
    // 기존 호환성을 위해 ids 배열을 받아 컬렉션을 동기화합니다. (주의: 전체 목록 교체)
    // 안전을 위해, 새로 추가된 것만 setDoc 처리하는 구조 추천
    // 본래는 단일 setDoc을 위해 ids를 던졌음
    // 여기서는 간단히 전체 덮어쓰기 로직 대신 에러 방지만 해둠 (Pipeline.js에서 활용 로직 변경 필요)
}

// 개별 삭제/작성용 헬퍼
export async function addDeletedId(leadId) {
    await setDoc(doc(db, COLS.deletedIds, leadId), { deletedAt: new Date().toISOString() });
}
export async function removeDeletedId(leadId) {
    await deleteDoc(doc(db, COLS.deletedIds, leadId));
}

// Trash
export async function addTrashItem(item) {
    const sanitized = JSON.parse(JSON.stringify(item ?? null));
    await setDoc(doc(db, COLS.trash, item.id), sanitized);
}
export async function removeTrashItem(itemId) {
    await deleteDoc(doc(db, COLS.trash, itemId));
}
export async function clearAllTrash(currentTrashItems) {
    // 모든 항목 개별 삭제
    const promises = currentTrashItems.map(item => deleteDoc(doc(db, COLS.trash, item.id)));
    await Promise.all(promises);
}
// 하위호환
export async function saveTrash(items) {
    // 더이상 한방에 여러 개를 저장하는 함수 사용 지양
}

// Manual Leads
export async function saveManualLead(lead) {
    const sanitized = JSON.parse(JSON.stringify(lead ?? null));
    await setDoc(doc(db, COLS.manualLeads, lead.id), sanitized);
}
export async function deleteManualLead(leadId) {
    await deleteDoc(doc(db, COLS.manualLeads, leadId));
}
export async function saveManualLeads(leads) {
    // 하위 호환용 껍데기
}

/**
 * saveLeadMeta - 리드 메타 개별 컬렉션 저장
 */
export async function saveLeadMeta(leadId, metaObject) {
    if (!leadId) return;
    try {
        const sanitized = JSON.parse(JSON.stringify(metaObject ?? {}));
        await setDoc(doc(db, COLS.leadMeta, leadId), sanitized, { merge: true });
        console.log(`[Firestore] ✅ leadMeta[${leadId}] 개별 저장 완료`);
    } catch (e) {
        console.error(`[Firestore] ❌ leadMeta 저장 실패:`, e.code, e.message);
    }
}

// ── 1회 읽기 (마이그레이션 전용) ────────────────────────────────
export async function getManualLeads() {
    const snap = await getDocs(collection(db, COLS.manualLeads));
    return snap.docs.map(d => d.data());
}
export async function getLeadMeta() {
    const snap = await getDocs(collection(db, COLS.leadMeta));
    const meta = {};
    snap.forEach(d => { meta[d.id] = d.data(); });
    // 구버전 문서 호환 병합
    try {
        const oldSnap = await getDoc(doc(db, 'xinchao_crm', 'leadMeta'));
        if (oldSnap.exists() && oldSnap.data().data) {
            return { ...oldSnap.data().data, ...meta }; // 새 문서가 우선
        }
    } catch (e) { }
    return meta;
}

// ── localStorage → Firestore 자동 병합 마이그레이션 ─────────────
// ── 좀비 데이터 방지용 무효화 ─────────────────────────────────────
export async function migrateFromLocalStorage() {
    // 2월 27일 코드로 인해 과거 데이터가 최신 DB를 덮어쓰는 재앙 확인. 
    // 이제 마이그레이션 코드를 완전히 제거. 
    console.log('[Migration] 좀비화 방지를 위해 마이그레이션 완전 불능화.');
    localStorage.removeItem('crm_deletedIds');
    localStorage.removeItem('crm_leadMeta');
    localStorage.removeItem('crm_manualLeads');
    localStorage.removeItem('crm_trash');
}
