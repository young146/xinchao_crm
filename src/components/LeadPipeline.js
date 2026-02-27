import React, { useState, useEffect, useRef } from "react";
import {
  saveDeletedIds,
  saveLeadMeta as fsaveLeadMeta,
  getManualLeads, saveManualLeads,
  saveTrash,
  migrateFromLocalStorage,
  subscribeAll,
  getLeadMeta,
} from "../services/crmFirestore";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import PaymentModal from "./PaymentModal";

/**
 * 영업 파이프라인 관리 시스템
 * 문의 수렴 → 상담 → 진행 → 계약 → 수금
 */

// 영업 단계 정의 (진행 단계 제거, 상담 → 계약)
const SALES_STAGES = {
  INQUIRY: {
    id: "INQUIRY",
    label: "문의 수렴",
    color: "#2196F3",
    icon: "📞",
    description: "고객 문의 접수 단계",
    documents: ["단가표", "회사소개서", "광고 샘플"],
    nextActions: ["단가표 발송", "상담 일정 잡기", "회사 소개"]
  },
  CONSULTATION: {
    id: "CONSULTATION",
    label: "상담",
    color: "#ff9800",
    icon: "🤝",
    description: "고객 상담 진행 중",
    documents: ["상담일지", "미팅메모", "견적서", "제안서"],
    nextActions: ["견적서 준비", "제안서 작성", "팔로업 전화"]
  },
  CONTRACT: {
    id: "CONTRACT",
    label: "계약",
    color: "#4caf50",
    icon: "📝",
    description: "계약 체결 단계",
    documents: ["계약서", "사업자등록증", "통장사본", "입금 확인"],
    nextActions: ["계약서 발송", "서명 확인", "입금 요청"]
  },
  COLLECTION: {
    id: "COLLECTION",
    label: "수금",
    color: "#00bcd4",
    icon: "💰",
    description: "대금 수금 단계",
    documents: ["세금계산서", "입금 확인서", "수금 확인서", "영수증"],
    nextActions: ["세금계산서 발행", "입금 확인", "광고 제작 시작"]
  },
  COMPLETED: {
    id: "COMPLETED",
    label: "완료",
    color: "#8bc34a",
    icon: "✅",
    description: "계약 완료 (고객 관리로 이동)",
    documents: ["완료 보고서", "광고 결과물"],
    nextActions: ["고객 관리 탭으로 이동", "만족도 조사"]
  },
  ON_HOLD: {
    id: "ON_HOLD",
    label: "보류",
    color: "#9e9e9e",
    icon: "⏸️",
    description: "일시 보류",
    documents: ["보류 사유서"],
    nextActions: ["정기 팔로업", "상황 확인"]
  },
  LOST: {
    id: "LOST",
    label: "취소",
    color: "#f44336",
    icon: "❌",
    description: "계약 불발",
    documents: ["취소 사유서"],
    nextActions: ["사유 분석", "6개월 후 재접촉"]
  }
};

// 우선순위
const PRIORITIES = {
  HIGH: { label: "높음", color: "#f44336", icon: "🔴" },
  MEDIUM: { label: "보통", color: "#ff9800", icon: "🟡" },
  LOW: { label: "낮음", color: "#4caf50", icon: "🟢" }
};

const LeadPipeline = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  // Firestore 기반 – 삭제 목록 & 리드별 메타데이터(다음일정, ToDo)
  const [deletedIds, setDeletedIds] = useState([]);
  const [leadMeta, setLeadMeta] = useState({});
  // 휴지통: 삭제된 리드 전체 스냅샷 저장
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  // 수금 입력 모달
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  // 🆕 온라인 신규 문의 알림
  const [onlineAlerts, setOnlineAlerts] = useState([]);  // { id, customer, phone, date, contactMethod }
  const seenLeadIdsRef = useRef(new Set());              // 이미 확인된 lead ID 추적

  // 리드 → 휴지통으로 이동 (삭제)
  const deleteLead = async (lead, e) => {
    e.stopPropagation();
    if (!window.confirm(`"${lead.customer}"를 휴지통으로 이동할까요?\n(휴지통에서 복원할 수 있습니다)`)) return;
    // 휴지통에 스냅샷 저장
    const trashedItem = { ...lead, deletedAt: new Date().toISOString() };
    const nextTrash = [trashedItem, ...trash];
    setTrash(nextTrash);
    await saveTrash(nextTrash);
    // deletedIds에도 추가 (화면 필터용)
    const next = [...deletedIds, lead.id];
    setDeletedIds(next);
    await saveDeletedIds(next);
    // leads state에서도 제거
    setLeads(prev => prev.filter(l => l.id !== lead.id));
  };

  // 휴지통에서 복원
  const restoreFromTrash = async (item) => {
    const nextTrash = trash.filter(t => t.id !== item.id);
    setTrash(nextTrash);
    await saveTrash(nextTrash);
    // deletedIds에서 제거
    const nextDeleted = deletedIds.filter(id => id !== item.id);
    setDeletedIds(nextDeleted);
    await saveDeletedIds(nextDeleted);
    // 복원할 리드 준비
    const restoredLead = { ...item };
    delete restoredLead.deletedAt;
    // 수동 추가 리드는 manualLeads에도 복원
    if (item.id.startsWith('manual-')) {
      const prevManual = await getManualLeads();
      await saveManualLeads([restoredLead, ...prevManual]);
    }
    setLeads(prev => [restoredLead, ...prev]);
  };

  // 휴지통에서 영구 삭제
  const permanentDelete = async (item) => {
    if (!window.confirm(`"${item.customer}"를 영구 삭제할까요?\n복원이 불가능합니다.`)) return;
    const nextTrash = trash.filter(t => t.id !== item.id);
    setTrash(nextTrash);
    await saveTrash(nextTrash);
    // 수동 추가 리드면 manualLeads에서도 제거
    if (item.id.startsWith('manual-')) {
      const prevManual = await getManualLeads();
      await saveManualLeads(prevManual.filter(l => l.id !== item.id));
    }
  };

  // 휴지통 전체 비우기
  const emptyTrash = async () => {
    if (!window.confirm(`휴지통의 ${trash.length}개 항목을 모두 영구 삭제할까요?`)) return;
    // 수동 추가 리드 manualLeads에서 제거
    const manualTrashIds = new Set(trash.filter(t => t.id.startsWith('manual-')).map(t => t.id));
    if (manualTrashIds.size > 0) {
      const prevManual = await getManualLeads();
      await saveManualLeads(prevManual.filter(l => !manualTrashIds.has(l.id)));
    }
    setTrash([]);
    await saveTrash([]);
  };

  // 리드 메타 저장 (다음일정, ToDo) → Firestore
  // ✅ 안전한 개별 key merge: 다른 리드 데이터를 덮어쓰지 않음
  const saveLeadMeta = async (leadId, meta) => {
    // state는 낙관적 업데이트
    setLeadMeta(prev => ({ ...prev, [leadId]: meta }));
    // Firestore는 해당 leadId key만 업데이트 (fsaveLeadMeta가 개별 merge 처리)
    await fsaveLeadMeta(leadId, meta);
  };

  // Firestore 실시간 구독 (onSnapshot) + 마이그레이션
  // manualLeads는 loadLeadsFromSheet에서 필요하므로 ref로 관리
  const manualLeadsRef = useRef([]);
  const sheetsLoadedRef = useRef(false); // Sheets 로드 최초 1회 완료 여부

  // 🔔 App.js 30초 폴링 → 신규 온라인 문의 이벤트 수신 (즉각 알림)
  useEffect(() => {
    const handleNewOnline = (e) => {
      const entries = e.detail || [];
      if (entries.length > 0) {
        setOnlineAlerts(prev => [
          ...entries.map(item => ({ id: item.date + item.customer, ...item })),
          ...prev,
        ]);
      }
    };
    window.addEventListener('newOnlineInquiry', handleNewOnline);
    return () => window.removeEventListener('newOnlineInquiry', handleNewOnline);
  }, []);

  // 🔥 Firestore onlineAlerts 컬렉션 실시간 구독
  // GAS가 온라인 문의 저장 시 즉시(0초) 알림 수신
  useEffect(() => {
    const seenDocIds = new Set();
    let isFirstSnapshot = true;
    const q = query(
      collection(db, 'onlineAlerts'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (isFirstSnapshot) {
            seenDocIds.add(docId); // 기존 문서는 알림 제외
            return;
          }
          if (!seenDocIds.has(docId)) {
            seenDocIds.add(docId);
            const d = change.doc.data();
            setOnlineAlerts(prev => [
              {
                id: docId,
                customer: d.customer || '',
                phone: d.phone || '',
                date: d.date || '',
                contactMethod: d.contactMethod || ''
              },
              ...prev.filter(a => a.id !== docId),
            ]);
          }
        }
      });
      isFirstSnapshot = false;
    }, (err) => {
      console.warn('[LeadPipeline] onlineAlerts 구독 오류:', err.message);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 1) localStorage → Firestore 마이그레이션 (최초 1회)
    migrateFromLocalStorage();

    // 2) Firestore 실시간 구독
    const unsubscribe = subscribeAll({
      onDeletedIds: (ids) => {
        setDeletedIds(ids);
      },
      onLeadMeta: (meta) => {
        setLeadMeta(meta);
      },
      onManualLeads: (manual) => {
        manualLeadsRef.current = manual;
        // Sheets 로드가 완료된 후에만 leads 업데이트
        if (sheetsLoadedRef.current) {
          setLeads(prev => {
            const sheetLeads = prev.filter(l => !l.id.startsWith('manual-'));
            return [...manual, ...sheetLeads];
          });
        }
      },
      onTrash: (items) => {
        setTrash(items);
      },
    });

    // 3) Google Sheets 초기 로드
    loadLeadsFromSheet();

    // 4) 5분마다 자동 새로고침 → 신규 온라인 문의 감지
    const refreshInterval = setInterval(() => {
      loadLeadsFromSheet();
    }, 5 * 60 * 1000);

    return () => { unsubscribe(); clearInterval(refreshInterval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // CSV 파싱 (gviz 응답용 - 따옴표 포함 필드 처리)
  const parseCSV = (text) => {
    return text.split("\n").map(line => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    });
  };

  const loadLeadsFromSheet = async () => {
    try {
      // ✅ 직원 Sheet (광고 관리 통합) - 상담이력 탭
      const sheetId = "1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA";

      const fetchTab = async (tabName) => {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&v=${Date.now()}`;
        try {
          const res = await fetch(url);
          console.log(`[LeadPipeline] ${tabName}탭 응답 상태:`, res.status, res.ok);
          if (!res.ok) {
            console.warn(`[LeadPipeline] ${tabName}탭 로드 실패 (status ${res.status})`);
            return [];
          }
          const text = await res.text();
          const isError = text.includes("google.visualization") || text.includes("<!DOCTYPE");
          console.log(`[LeadPipeline] ${tabName}탭 응답 첫 200자:`, text.slice(0, 200));
          if (isError) {
            console.warn(`[LeadPipeline] ${tabName}탭: gviz 오류 응답 (시트 이름 확인 필요)`);
            return [];
          }
          // 상담이력 탭: 헤더 3행 (Row1~3), 실제 데이터는 Row4부터 → slice(3)
          const parsed = parseCSV(text).slice(3);
          console.log(`[LeadPipeline] ${tabName}탭: ${parsed.length}행 파싱됨`);
          return parsed;
        } catch (e) {
          console.error(`[LeadPipeline] ${tabName}탭 fetch 오류:`, e);
          return [];
        }
      };

      // 상담이력 단일 탭만 사용
      const consultRows = await fetchTab("상담이력");

      // ─── 상담이력 컬럼 구조 (0-based) ───
      // Col 0: No, Col 1: 접촉일(DATE), Col 2: 고객사(CUSTOMER)
      // Col 3: 담당자(CHARGER), Col 4: 직책(TITLE), Col 5: 연락처(PHONE)
      // Col 6: 이메일(EMAIL), Col 7: 회차(COUNT), Col 8: 접촉방법(METHOD)
      // Col 9: 상담내용(CONTENT), Col 10: 고객반응(REACTION)
      // Col 11: 다음단계(NEXT_STEP), Col 12: Next Date(NEXT_DATE)
      // Col 13: Status ← stage 판단 핵심 컬럼
      // Col 14: 상품분류(CATEGORY), Col 15: 상품(PRODUCT), Col 16: 단가(PRICE)
      // Col 17: 시작Vol, Col 18: 종료Vol, Col 19: 수금액(RECEIVED), Col 20: 메모(MEMO)

      const parsedLeads = consultRows
        .filter(row => row[2] && row[2].trim() !== "")  // 고객사 있는 행만
        .map((row, index) => {
          // Status 컬럼(N열, index 13) 기반 stage 판단
          const statusVal = (row[13] || "").trim();
          let stage = "INQUIRY";
          if (statusVal === "계약완료") stage = "CONTRACT";
          else if (statusVal === "거절") stage = "LOST";
          else if (statusVal === "보류") stage = "ON_HOLD";
          else if (
            statusVal === "견적검토중" ||
            statusVal === "계약협의중" ||
            statusVal === "서명 후 회신" ||
            statusVal === "자료검토중"
          ) stage = "CONSULTATION";
          // "진행중" 또는 기타 → INQUIRY

          const dateVal = (row[1] || "").trim();
          const memoVal = (row[20] || "").trim();

          // ── 안정적 ID 생성 (Sheet 교체·행 순서 변경에도 불변) ──
          // 고객사명 + 날짜를 조합 → 같은 고객이면 항상 동일 ID
          // prefix를 'lead-'로 유지하여 기존 Firestore 데이터와 하위 호환
          const customerKey = (row[2] || "unknown").trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9가-힣_]/g, "");
          const dateKey = dateVal.replace(/-/g, "").slice(0, 8) || "nodate";
          const stableId = `lead-${customerKey}-${dateKey}`;

          return {
            id: stableId,
            date: dateVal,
            customer: row[2] || "",
            contact: row[3] || "",
            position: row[4] || "",
            phone: row[5] || "",
            email: row[6] || "",
            contactMethod: row[8] || "",
            remark: row[9] || "",         // 상담내용
            reaction: row[10] || "",      // 고객반응
            nextStep: row[11] || "",      // 다음단계
            nextDate: row[12] || "",      // Next Date
            status: statusVal,
            category: row[14] || "",      // 상품분류
            adType: row[15] || "",        // 상품
            price: row[16] || "",         // 단가
            startVol: row[17] || "",      // 시작Vol
            endVol: row[18] || "",        // 종료Vol
            received: row[19] || "",      // 수금액
            memo: memoVal,
            followUp: row[11] || "",      // 다음단계를 followUp으로도 노출
            stage,
            priority: memoVal.includes("긴급") || statusVal.includes("계약") ? "HIGH" : "MEDIUM",
            documents: [],
            consultationLogs: [],
            history: [],
            nextFollowUpDate: row[12] || null,
            estimatedValue: parseFloat(row[19]) || 0,
          };
        });

      // ── Firestore 메타 오버라이드 적용 ──────────────────────────
      // ⚠️ leadMeta state는 Sheet 파싱 시점에 아직 비어있을 수 있으므로
      //    Firestore에서 직접 읽어 타이밍 문제 해결
      const freshMeta = await getLeadMeta();
      // state도 업데이트 (onSnapshot보다 먼저 도착했을 때를 위해)
      const storedMeta = Object.keys(freshMeta).length > 0 ? freshMeta : (leadMeta || {});

      // 구 형식 키들에서 고객명을 역방향 추출 → 고객명 → 메타 매핑
      // (stageOverride, consultationLogs, actions 등 포함된 것만)
      const customerNameToOldMeta = {};
      Object.entries(storedMeta).forEach(([key, meta]) => {
        // 구 형식 키 판별: "lead-숫자" 또는 "consult-숫자" 패턴
        const isOldKey = /^(lead|consult)-\d+$/.test(key);
        if (isOldKey && meta) {
          // meta 안에 infoOverride.customer 또는 actions[*].customer가 있으면 추출
          const customerFromInfo = meta.infoOverride?.customer;
          const customerFromAction = meta.actions?.[0]?.customer;
          const customerName = customerFromInfo || customerFromAction;
          if (customerName && !customerNameToOldMeta[customerName]) {
            customerNameToOldMeta[customerName] = meta;
          }
        }
      });

      const mergedLeads = parsedLeads.map(lead => {
        // 1) 새 형식 ID로 직접 매칭 (우선)
        let m = storedMeta[lead.id] || {};
        // 2) 구 형식 ID 데이터를 고객명으로 역방향 매핑 (병합)
        const oldMeta = customerNameToOldMeta[lead.customer] || {};
        // 상담 로그 병합: 구 데이터 + 새 데이터 (중복 제거)
        const mergedLogs = [
          ...(oldMeta.consultationLogs || []),
          ...(m.consultationLogs || []),
        ].filter((log, idx, arr) =>
          // 날짜+내용 기준 중복 제거
          arr.findIndex(l => l.date === log.date && l.content === log.content) === idx
        );
        const mergedActions = [
          ...(oldMeta.actions || []),
          ...(m.actions || []),
        ].filter((a, idx, arr) =>
          arr.findIndex(x => x.date === a.date && x.text === a.text) === idx
        );

        return {
          ...lead,
          // stage: 새 ID 우선, 없으면 구 ID 데이터 사용
          ...((m.stageOverride || oldMeta.stageOverride) ? { stage: m.stageOverride || oldMeta.stageOverride } : {}),
          consultationLogs: mergedLogs.length > 0 ? mergedLogs : (lead.consultationLogs || []),
          ...(m.infoOverride || oldMeta.infoOverride || {}),
          ...(mergedActions.length > 0 ? {} : {}), // actions는 leadMeta 레벨에서 관리
        };
      });

      // 수동 추가 리드(Firestore manualLeads) 병합
      const deletedSet = new Set(deletedIds || []);
      const manualLeads = (manualLeadsRef.current || []).filter(l => !deletedSet.has(l.id));
      sheetsLoadedRef.current = true;
      setLeads([...manualLeads, ...mergedLeads]);
      setLoading(false);

      // 🔔 오늘 온라인/앱 문의 알림 (항상 표시, 닫은 것만 localStorage에 기억)
      const todayStr = new Date().toISOString().split('T')[0];
      // localStorage에서 이미 닫은 알림 ID 목록 로드
      const dismissedRaw = localStorage.getItem('dismissedOnlineAlerts_' + todayStr) || '[]';
      const dismissed = new Set(JSON.parse(dismissedRaw));

      const todayOnline = mergedLeads.filter(l => {
        const method = (l.contactMethod || '').toLowerCase();
        const isOnline = method.includes('온라인') || method.includes('online') ||
          method.includes('앱') || method.includes('app');
        const isToday = (l.date || '').startsWith(todayStr);
        return isOnline && isToday && !dismissed.has(l.id);
      });

      if (todayOnline.length > 0) {
        setOnlineAlerts(
          todayOnline.map(l => ({
            id: l.id,
            customer: l.customer,
            phone: l.phone,
            date: l.date,
            contactMethod: l.contactMethod,
          }))
        );
      }
    } catch (error) {
      console.error("리드 데이터 로드 실패:", error);
      setLoading(false);
    }
  };

  // 필터링된 리드
  const filteredLeads = leads.filter(lead => {
    const matchesStage = filter === "ALL" || lead.stage === filter;
    const matchesSearch = !searchTerm ||
      lead.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    return matchesStage && matchesSearch;
  });

  // 단계 이동 함수
  // eslint-disable-next-line no-unused-vars
  const moveToNextStage = (lead, newStage) => {
    const updatedLead = { ...lead, stage: newStage };
    setLeads(leads.map(l => l.id === lead.id ? updatedLead : l));

    // 성공 메시지
    const stageName = SALES_STAGES[newStage].label;
    alert(`✅ ${lead.customer}를 "${stageName}" 단계로 이동했습니다!`);
  };

  // 상담 기록 추가 및 자동 단계 이동
  const addConsultationLog = (lead, logData) => {
    const updatedLead = { ...lead };

    // 상담 기록 추가
    if (!updatedLead.consultationLogs) {
      updatedLead.consultationLogs = [];
    }
    updatedLead.consultationLogs.push({
      date: new Date().toISOString(),
      ...logData
    });

    // 다음 연락 예정일 업데이트
    if (logData.nextDate) {
      updatedLead.nextFollowUpDate = logData.nextDate;
    }

    // 단계 이동 로직
    const consultationCount = updatedLead.consultationLogs.length;
    const currentStage = lead.stage;
    let newStage = currentStage;
    let moveReason = "";

    // 우선순위 1: 사용자가 직접 선택한 다음 단계
    if (logData.nextStage && logData.nextStage !== "STAY") {
      newStage = logData.nextStage;
      moveReason = `사용자가 직접 "${SALES_STAGES[newStage].label}" 단계를 선택했습니다`;
    }
    // 우선순위 2: 상담 횟수 기반 자동 이동 (진행 단계 제거)
    else if (currentStage === "INQUIRY" && consultationCount === 1) {
      newStage = "CONSULTATION";
      moveReason = `첫 상담 기록이 작성되어`;
    }
    else if (currentStage === "CONSULTATION" && consultationCount >= 2) {
      // 2회 이상 상담 시 CONTRACT로 이동 가능하도록 (명시적 선택 권장)
      newStage = currentStage; // 유지
      moveReason = "";
    }
    // 우선순위 3: 키워드 감지
    else if (
      currentStage === "CONSULTATION" &&
      (logData.content?.toLowerCase().includes("계약") ||
        logData.content?.toLowerCase().includes("contract") ||
        logData.content?.toLowerCase().includes("okay") ||
        logData.content?.toLowerCase().includes("ok"))
    ) {
      newStage = "CONTRACT";
      moveReason = `"계약" 키워드가 감지되어`;
    }
    else if (
      currentStage === "CONTRACT" &&
      (logData.content?.toLowerCase().includes("입금") ||
        logData.content?.toLowerCase().includes("수금") ||
        logData.content?.toLowerCase().includes("payment"))
    ) {
      newStage = "COLLECTION";
      moveReason = `"입금" 키워드가 감지되어`;
    }
    else if (
      currentStage === "COLLECTION" &&
      (logData.content?.toLowerCase().includes("완료") ||
        logData.content?.toLowerCase().includes("complete"))
    ) {
      newStage = "COMPLETED";
      moveReason = `"완료" 키워드가 감지되어`;
    }

    updatedLead.stage = newStage;

    // 알림 메시지
    if (newStage !== currentStage) {
      alert(`✅ ${moveReason} "${lead.customer}"를 "${SALES_STAGES[newStage].label}" 단계로 이동했습니다!`);
    } else {
      alert(`✅ 상담 기록이 저장되었습니다. (${consultationCount}회차)`);
    }

    setLeads(leads.map(l => l.id === lead.id ? updatedLead : l));
    setShowConsultationForm(null);

    // ✅ Firestore 저장 (이전에 빠져있던 부분)
    const prevMeta = leadMeta[lead.id] || {};
    saveLeadMeta(lead.id, {
      ...prevMeta,
      stageOverride: newStage,
      consultationLogs: updatedLead.consultationLogs,
    });
  };

  // 날짜 파서: "2026. 1. 5" 과 "2026-02-20" 두 형식 모두 지원
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr);
    const m = dateStr.match(/(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    return new Date(0);
  };

  const today = new Date().toISOString().split('T')[0];

  // deletedIds 제외 + 날짜 내림차순
  const sortedLeads = [...filteredLeads]
    .filter(l => !deletedIds.includes(l.id))
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));


  if (loading) {
    return <div style={{ padding: "50px", textAlign: "center" }}>영업 파이프라인 데이터를 불러오는 중...</div>;
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", backgroundColor: "#f8f9fa", minHeight: "100vh" }}>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", background: "#fff", padding: "16px 20px", borderRadius: "10px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
        <div>
          <h2 style={{ color: "#d32f2f", margin: 0, fontSize: "20px" }}>💼 영업 파이프라인</h2>
          <span style={{ fontSize: "13px", color: "#888" }}>2026년 문의 {leads.length}건 · 표시 {sortedLeads.length}건</span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* 휴지통 버튼 */}
          <button
            onClick={() => setShowTrash(t => !t)}
            style={{
              padding: "8px 16px",
              backgroundColor: showTrash ? "#616161" : "#eeeeee",
              color: showTrash ? "#fff" : "#555",
              border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
              position: "relative",
            }}
          >
            🗑️ 휴지통
            {trash.length > 0 && (
              <span style={{
                position: "absolute", top: "-6px", right: "-6px",
                background: "#f44336", color: "#fff",
                borderRadius: "50%", width: "18px", height: "18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: "bold",
              }}>{trash.length}</span>
            )}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            style={{ padding: "10px 20px", backgroundColor: "#d32f2f", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
          >
            ➕ 신규 광고 문의 접수
          </button>
        </div>
      </div>

      {/* 단계별 카운터 탭 */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilter("ALL")}
          style={{ padding: "8px 16px", backgroundColor: filter === "ALL" ? "#333" : "#fff", color: filter === "ALL" ? "#fff" : "#333", border: "2px solid #ddd", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
        >
          전체 ({leads.length})
        </button>
        {Object.entries(SALES_STAGES).map(([stageId, stage]) => {
          const count = leads.filter(l => l.stage === stageId).length;
          return (
            <button
              key={stageId}
              onClick={() => setFilter(stageId)}
              style={{
                padding: "8px 14px",
                backgroundColor: filter === stageId ? stage.color : "#fff",
                color: filter === stageId ? "#fff" : "#555",
                border: `2px solid ${stage.color}`,
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: filter === stageId ? "bold" : "normal",
              }}
            >
              {stage.icon} {stage.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 고객명, 담당자, 전화번호 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", fontSize: "14px", border: "2px solid #ddd", borderRadius: "8px", boxSizing: "border-box", outline: "none" }}
          onFocus={e => e.target.style.borderColor = "#d32f2f"}
          onBlur={e => e.target.style.borderColor = "#ddd"}
        />
      </div>

      {/* 🗓️ 오늘의 할 일 + 금주의 할 일 패널 (항상 표시) */}
      {(() => {
        const allActions = Object.entries(leadMeta)
          .flatMap(([leadId, m]) => {
            // 1) 명시적으로 저장된 actions 배열
            const savedActions = (m.actions || [])
              .filter(a => !a.done)
              .map(a => ({ ...a, leadId: a.leadId || leadId }));

            // logActions에서 이미 done 처리된 것 제거
            const doneLogActions = (leadMeta['manual']?.doneLogActions || []);
            const logActions = (m.consultationLogs || [])
              .filter(log => log.nextActionDate && log.nextActionText?.trim())
              .map(log => ({
                date: log.nextActionDate,
                text: log.nextActionText.trim(),
                done: false,
                customer: m.infoOverride?.customer || leadId,
                leadId: leadId,
                fromLog: true,
              }))
              .filter(la => !savedActions.find(sa => sa.date === la.date && sa.text === la.text))
              .filter(la => !doneLogActions.some(d => d.date === la.date && d.text === la.text && d.leadId === la.leadId));

            // 2) 상담이력 시트 nextStep/nextFollowUpDate 로 직접 등록된 할일
            //    (GAS 수동 문의 접수 시 NEXT_STEP/NEXT_DATE 컬럼에 저장된 것)
            const sheetActions = (() => {
              try {
                const lead = leads.find(l => l.id === leadId);
                if (!lead?.nextStep?.trim() || !lead?.nextFollowUpDate?.trim()) return [];
                const text = lead.nextStep.trim();
                const date = lead.nextFollowUpDate.trim();
                // 이미 savedActions/logActions/doneLogActions에 있으면 중복 제거
                if (savedActions.find(sa => sa.date === date && sa.text === text)) return [];
                if (logActions.find(la => la.date === date && la.text === text)) return [];
                if (doneLogActions.some(d => d.date === date && d.text === text && d.leadId === leadId)) return [];
                return [{ date, text, customer: lead.customer, leadId, fromLog: true }];
              } catch (e) { return []; }
            })();

            return [...savedActions, ...logActions, ...sheetActions];
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        const endOfWeek = new Date();
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const weekEnd = endOfWeek.toISOString().split('T')[0];

        const overdueActions = allActions.filter(a => a.date < today);
        const todayOnlyActions = allActions.filter(a => a.date === today);
        const weekActions = allActions.filter(a => a.date > today && a.date <= weekEnd);

        const markDone = async (action) => {
          // 1) actions 배열에 있는 경우 (일반적 경우)
          const metaKey = Object.keys(leadMeta).find(k =>
            (leadMeta[k].actions || []).some(a => a.date === action.date && a.text === action.text && a.customer === action.customer)
          );
          if (metaKey) {
            const updatedKeyMeta = {
              ...leadMeta[metaKey],
              actions: leadMeta[metaKey].actions.map(a =>
                (a.date === action.date && a.text === action.text && a.customer === action.customer) ? { ...a, done: true } : a
              )
            };
            setLeadMeta(prev => ({ ...prev, [metaKey]: updatedKeyMeta }));
            await saveLeadMeta(metaKey, updatedKeyMeta);
            return;
          }

          // 2) fromLog=true 인 경우: consultationLogs에서 온 액션 → 'manual' 키에 done 기록 추가
          //    (consultationLogs 자체를 수정하기 어려우므로 manual.doneLogActions 에 기록)
          if (action.fromLog) {
            const manualKey = 'manual';
            const prev = leadMeta[manualKey] || {};
            const doneLogActions = prev.doneLogActions || [];
            // 이미 done 처리된 것은 패스
            const alreadyDone = doneLogActions.some(d => d.date === action.date && d.text === action.text && d.leadId === action.leadId);
            if (!alreadyDone) {
              const updated = { ...prev, doneLogActions: [...doneLogActions, { date: action.date, text: action.text, leadId: action.leadId }] };
              setLeadMeta(p => ({ ...p, [manualKey]: updated }));
              await saveLeadMeta(manualKey, updated);
            }
          }
        };

        const addManualAction = async (date, customer, text) => {
          const manualKey = 'manual';
          const prev = leadMeta[manualKey] || {};
          const prevActions = prev.actions || [];
          const newAction = { date, text: text.trim(), done: false, customer: customer.trim(), leadId: null };
          const updatedManual = { ...prev, actions: [...prevActions, newAction] };
          // state 낙관적 업데이트
          setLeadMeta(p => ({ ...p, [manualKey]: updatedManual }));
          // Firestore: manual key만 업데이트
          await saveLeadMeta(manualKey, updatedManual);
        };

        const ActionItem = ({ action, badge, badgeColor }) => {
          const relatedLead = leads.find(l => l.id === action.leadId);
          return (
            <div
              onClick={() => relatedLead && setSelectedLead(relatedLead)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "#fff", borderRadius: "6px", marginBottom: "5px", cursor: relatedLead ? "pointer" : "default", border: "1px solid #eee" }}
            >
              <div>
                <strong style={{ fontSize: "13px" }}>{action.customer}</strong>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "8px" }}>{action.text}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: badgeColor, fontWeight: "bold", background: badgeColor + "18", padding: "2px 8px", borderRadius: "10px" }}>{badge} {action.date}</span>
                <button
                  onClick={e => { e.stopPropagation(); markDone(action); }}
                  style={{ padding: "2px 8px", background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "4px", fontSize: "11px", cursor: "pointer", color: "#2e7d32" }}
                >완료</button>
              </div>
            </div>
          );
        };

        const ManualAddForm = () => {
          const [showForm, setShowForm] = React.useState(false);
          const [fDate, setFDate] = React.useState(today);
          const [fCustomer, setFCustomer] = React.useState("");
          const [fText, setFText] = React.useState("");
          const [showSuggestions, setShowSuggestions] = React.useState(false);

          // 기존 leads에서 고객명 중복 제거 목록
          const uniqueCustomers = React.useMemo(() => {
            const names = leads.map(l => l.customer).filter(Boolean);
            return [...new Set(names)].sort();
          }, []);

          const suggestions = fCustomer.trim()
            ? uniqueCustomers.filter(n => n.toLowerCase().includes(fCustomer.toLowerCase()))
            : uniqueCustomers;

          const handleCustomerChange = (val) => {
            setFCustomer(val);
            setShowSuggestions(true);
          };

          const handleSelectCustomer = (name) => {
            setFCustomer(name);
            setShowSuggestions(false);
          };

          const openNewLeadForm = () => {
            // 신규 고객 → 기존 신규 광고 문의 접수 팝업 열기
            setShowSuggestions(false);
            setShowForm(false);
            setFCustomer("");
            setFText("");
            setShowAddForm(true);
          };

          const handleAdd = () => {
            if (!fDate || !fCustomer.trim() || !fText.trim()) {
              alert("날짜, 고객명, 내용을 모두 입력하세요.");
              return;
            }
            addManualAction(fDate, fCustomer, fText);
            setFCustomer("");
            setFText("");
            setFDate(today);
            setShowForm(false);
          };

          return (
            <div style={{ marginTop: "12px", borderTop: "1px dashed #ffd180", paddingTop: "12px" }}>
              {showForm ? (
                <div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>
                    {/* 날짜 */}
                    <input
                      type="date"
                      value={fDate}
                      onChange={e => setFDate(e.target.value)}
                      style={{ padding: "6px 10px", border: "1px solid #ffc107", borderRadius: "6px", fontSize: "13px", outline: "none" }}
                    />

                    {/* 고객명 자동완성 */}
                    <div style={{ position: "relative", width: "200px" }}>
                      <input
                        type="text"
                        placeholder="고객명 검색 또는 입력"
                        value={fCustomer}
                        onChange={e => handleCustomerChange(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        style={{
                          padding: "6px 10px", border: "1px solid #ffc107",
                          borderRadius: "6px", fontSize: "13px", width: "100%", outline: "none", boxSizing: "border-box"
                        }}
                      />
                      {showSuggestions && (
                        <div style={{
                          position: "absolute", top: "36px", left: 0, right: 0,
                          background: "#fff", border: "1px solid #ffc107", borderRadius: "6px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 999, maxHeight: "220px", overflowY: "auto"
                        }}>
                          {/* 신규 고객 접수 버튼 - 항상 최상단 표시 */}
                          <div
                            onMouseDown={openNewLeadForm}
                            style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "2px solid #e8f5e9", background: "#f1f8e9", display: "flex", alignItems: "center", gap: "8px" }}
                          >
                            <span style={{ fontSize: "12px", background: "#d32f2f", color: "#fff", padding: "2px 7px", borderRadius: "4px", whiteSpace: "nowrap" }}>신규</span>
                            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#1b5e20" }}>📞 신규 광고 문의 접수하기</span>
                          </div>
                          {/* 기존 고객 목록 */}
                          {suggestions.length === 0 && fCustomer.trim() && (
                            <div style={{ padding: "8px 12px", color: "#aaa", fontSize: "12px" }}>일치하는 기존 고객 없음</div>
                          )}
                          {!fCustomer.trim() && suggestions.length === 0 && (
                            <div style={{ padding: "8px 12px", color: "#bbb", fontSize: "12px" }}>고객명을 입력하면 검색됩니다</div>
                          )}
                          {suggestions.map((name, idx) => (
                            <div
                              key={idx}
                              onMouseDown={() => handleSelectCustomer(name)}
                              style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f5f5f5" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#fff3e0"}
                              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 할 일 내용 */}
                    <input
                      type="text"
                      placeholder="할 일 내용"
                      value={fText}
                      onChange={e => setFText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAdd()}
                      style={{ padding: "6px 10px", border: "1px solid #ffc107", borderRadius: "6px", fontSize: "13px", flex: 1, minWidth: "160px", outline: "none" }}
                    />

                    <button
                      onClick={handleAdd}
                      style={{ padding: "6px 14px", background: "#ff9800", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "bold" }}
                    >추가</button>
                    <button
                      onClick={() => { setShowForm(false); setFCustomer(""); setFText(""); }}
                      style={{ padding: "6px 14px", background: "#eee", color: "#555", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                    >취소</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  style={{ padding: "6px 14px", background: "#fff3e0", color: "#e65100", border: "1px dashed #ffb74d", borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "bold" }}
                >➕ 할 일 수동 추가</button>
              )}
            </div>
          );
        };

        return (
          <div style={{ marginBottom: "16px", background: "#fff", border: "2px solid #ff9800", borderRadius: "10px", padding: "16px" }}>

            {/* 🔴 온라인 신규 문의 알림 */}
            {onlineAlerts.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                {onlineAlerts.map((alert, i) => (
                  <div key={alert.id + i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", marginBottom: "6px",
                    background: "#ffebee", border: "2px solid #f44336",
                    borderRadius: "8px", cursor: "pointer",
                  }}
                    onClick={() => {
                      // 해당 고객의 lead를 찾아서 상세 모달 열기
                      const target = leads.find(l => l.id === alert.id || l.customer === alert.customer);
                      if (target) setSelectedLead(target);
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "16px", marginRight: "6px" }}>🔴</span>
                      <strong style={{ color: "#c62828", fontSize: "14px" }}>신규 온라인 광고 문의!</strong>
                      <span style={{ marginLeft: "10px", fontSize: "13px", color: "#555" }}>
                        {alert.customer} {alert.phone ? `· ${alert.phone}` : ""} {alert.date ? `· ${alert.date}` : ""}
                      </span>
                      <span style={{ marginLeft: "10px", fontSize: "11px", color: "#999" }}>▶ 클릭하면 상담일지 열림</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // 부모 클릭(모달열기) 방지
                        const todayKey = 'dismissedOnlineAlerts_' + new Date().toISOString().split('T')[0];
                        const prev = JSON.parse(localStorage.getItem(todayKey) || '[]');
                        if (alert.id && !prev.includes(alert.id)) {
                          localStorage.setItem(todayKey, JSON.stringify([...prev, alert.id]));
                        }
                        setOnlineAlerts(p => p.filter((_, idx) => idx !== i));
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#f44336", fontWeight: "bold", padding: "0 4px", flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <h4 style={{ margin: 0, color: "#e65100", fontSize: "15px" }}>🗓️ 할 일 현황</h4>
              {overdueActions.length > 0 && <span style={{ fontSize: "12px", background: "#ffebee", color: "#c62828", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>⚠️ 기한 초과 {overdueActions.length}건</span>}
              {todayOnlyActions.length > 0 && <span style={{ fontSize: "12px", background: "#fff3e0", color: "#e65100", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>📅 오늘 {todayOnlyActions.length}건</span>}
              {weekActions.length > 0 && <span style={{ fontSize: "12px", background: "#e3f2fd", color: "#1565c0", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>📆 이번 주 {weekActions.length}건</span>}
            </div>

            {overdueActions.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#c62828", marginBottom: "5px" }}>⚠️ 기한 초과</div>
                {overdueActions.map((a, i) => <ActionItem key={`o${i}`} action={a} badge="지남" badgeColor="#f44336" />)}
              </div>
            )}
            {todayOnlyActions.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#e65100", marginBottom: "5px" }}>📅 오늘의 할 일</div>
                {todayOnlyActions.map((a, i) => <ActionItem key={`t${i}`} action={a} badge="오늘" badgeColor="#ff9800" />)}
              </div>
            )}
            {weekActions.length > 0 && (() => {
              const DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];
              // 날짜별 그룹핑
              const byDate = weekActions.reduce((acc, a) => {
                if (!acc[a.date]) acc[a.date] = [];
                acc[a.date].push(a);
                return acc;
              }, {});
              const sortedDates = Object.keys(byDate).sort();
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];

              return (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: "#1565c0", marginBottom: "8px" }}>📆 금주의 할 일 ({weekActions.length}건)</div>
                  {sortedDates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const dayLabel = DAY_KR[d.getDay()];
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isTomorrow = date === tomorrowStr;
                    const [, mm, dd] = date.split('-');
                    return (
                      <div key={date} style={{ marginBottom: "10px" }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          fontSize: "12px", fontWeight: "bold",
                          color: isWeekend ? "#e53935" : "#1565c0",
                          marginBottom: "4px",
                          borderLeft: "3px solid " + (isWeekend ? "#e53935" : "#1976d2"),
                          paddingLeft: "6px",
                        }}>
                          {mm}/{dd} ({dayLabel})
                          {isTomorrow && <span style={{ fontSize: "10px", background: "#ff9800", color: "#fff", padding: "1px 6px", borderRadius: "8px" }}>내일</span>}
                          <span style={{ fontSize: "11px", color: "#999", fontWeight: "normal" }}>{byDate[date].length}건</span>
                        </div>
                        {byDate[date].map((a, i) => (
                          <ActionItem key={`w${date}${i}`} action={a} badge="" badgeColor="#1976d2" />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {overdueActions.length === 0 && todayOnlyActions.length === 0 && weekActions.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>
                📭 등록된 할 일이 없습니다. 아래에서 직접 추가해 보세요.
              </div>
            )}

            <ManualAddForm />
          </div>
        );
      })()}

      {/* 리스트 뷰 */}
      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        {/* 리스트 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 100px 140px 100px 100px 40px", gap: "0", padding: "10px 16px", backgroundColor: "#f5f5f5", borderBottom: "2px solid #e0e0e0", fontSize: "12px", fontWeight: "bold", color: "#666" }}>
          <span>접수일</span>
          <span>고객명 / 담당자</span>
          <span>연락처</span>
          <span>광고</span>
          <span>접수경로</span>
          <span style={{ textAlign: "center" }}>단계</span>
          <span></span>
        </div>

        {sortedLeads.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#aaa", fontSize: "15px" }}>
            {filter !== "ALL" ? `"${SALES_STAGES[filter]?.label}" 단계의 리드가 없습니다` : "등록된 문의가 없습니다"}
          </div>
        ) : (
          sortedLeads.map((lead, i) => {
            const stage = SALES_STAGES[lead.stage] || SALES_STAGES.INQUIRY;
            const isUrgent = lead.priority === "HIGH";
            const hasTodo = (leadMeta[lead.id]?.todos || []).some(t => !t.done);
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 100px 140px 100px 100px 40px",
                  gap: "0",
                  padding: "10px 16px",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
                  transition: "background 0.15s",
                  alignItems: "center",
                  borderLeft: `4px solid ${stage.color}`,
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#e3f2fd"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#fff" : "#fafafa"}
              >
                {/* 날짜 */}
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {lead.date || "-"}
                </div>

                {/* 고객명 / 담당자 / 상담내용 */}
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", color: "#222" }}>
                    {isUrgent && <span style={{ color: "#f44336", marginRight: "4px" }}>🔴</span>}
                    {lead.customer}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>
                    {lead.contact}{lead.position ? ` (${lead.position})` : ""}
                  </div>
                  {lead.remark && (
                    <div
                      title={lead.remark}
                      style={{
                        fontSize: "11px", color: "#aaa", marginTop: "2px",
                        maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}
                    >
                      💬 {lead.remark}
                    </div>
                  )}
                </div>

                {/* 전화 */}
                <div style={{ fontSize: "12px", color: "#555" }}>{lead.phone || "-"}</div>

                {/* 광고 유형/크기 */}
                <div style={{ fontSize: "12px", color: "#555" }}>
                  {[lead.adType, lead.size].filter(Boolean).join(" / ") || "-"}
                </div>

                {/* 접수 경로 */}
                <div style={{ fontSize: "12px", color: "#777" }}>{lead.contactMethod || "-"}</div>

                {/* 단계 배지 */}
                <div style={{ textAlign: "center" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    backgroundColor: stage.color,
                    color: "#fff",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}>
                    {stage.icon} {stage.label}
                  </span>
                  {hasTodo && <span title="미완료 ToDo 있음" style={{ marginLeft: "4px", fontSize: "10px" }}>📌</span>}
                </div>

                {/* 삭제 버튼 */}
                <div style={{ textAlign: "center", display: "flex", gap: "4px", justifyContent: "center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); setShowPaymentModal(lead); }}
                    title="수금 입력"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#aaa", padding: "4px", borderRadius: "4px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#00bcd4"}
                    onMouseLeave={e => e.currentTarget.style.color = "#aaa"}
                  >💰</button>
                  <button
                    onClick={e => deleteLead(lead, e)}
                    title="목록에서 삭제"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#ccc", padding: "4px", borderRadius: "4px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#f44336"}
                    onMouseLeave={e => e.currentTarget.style.color = "#ccc"}
                  >🗑️</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 리드 상세 모달 */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          meta={leadMeta[selectedLead.id] || {}}
          onSaveMeta={meta => saveLeadMeta(selectedLead.id, meta)}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updatedLead) => {
            // Firestore에 단계·상담일지·수정 정보 영속 저장
            const prevMeta = leadMeta[updatedLead.id] || {};
            // 기존 consultationLogs와 새 logs 누적 (중복리 없이 merge)
            const existingLogs = prevMeta.consultationLogs || [];
            const newLogs = updatedLead.consultationLogs || [];
            const mergedLogs = [
              ...existingLogs.filter(e =>
                !newLogs.find(n => n.date === e.date && n.content === e.content)
              ),
              ...newLogs,
            ];
            saveLeadMeta(updatedLead.id, {
              ...prevMeta,
              stageOverride: updatedLead.stage,
              consultationLogs: mergedLogs,
              infoOverride: {
                customer: updatedLead.customer,
                contact: updatedLead.contact,
                position: updatedLead.position,
                phone: updatedLead.phone,
                email: updatedLead.email,
                adType: updatedLead.adType,
                size: updatedLead.size,
                remark: updatedLead.remark,
              },
            });
            setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
            setSelectedLead(null);
          }}
        />
      )}

      {/* 💰 수금 입력 모달 */}
      {showPaymentModal && (
        <PaymentModal
          lead={showPaymentModal}
          onClose={() => setShowPaymentModal(null)}
          onSuccess={() => setShowPaymentModal(null)}
        />
      )}

      {/* 🗑️ 휴지통 모달 (fixed 오버레이) */}
      {showTrash && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 9000, padding: "20px",
          }}
          onClick={() => setShowTrash(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: "12px", padding: "24px",
              maxWidth: "560px", width: "100%", maxHeight: "80vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: "#616161", fontSize: "17px" }}>🗑️ 휴지통 ({trash.length}건)</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {trash.length > 0 && (
                  <button
                    onClick={emptyTrash}
                    style={{ padding: "6px 14px", background: "#f44336", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}
                  >🔥 전체 영구삭제</button>
                )}
                <button
                  onClick={() => setShowTrash(false)}
                  style={{ padding: "6px 14px", background: "#eee", color: "#555", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >✕ 닫기</button>
              </div>
            </div>

            {/* 목록 */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {trash.length === 0 ? (
                <div style={{ textAlign: "center", color: "#bbb", padding: "40px 0", fontSize: "14px" }}>📭 휴지통이 비어 있습니다</div>
              ) : (
                trash.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: "#fafafa", borderRadius: "8px",
                      marginBottom: "8px", border: "1px solid #e0e0e0",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#444" }}>{item.customer}</strong>
                      <span style={{ fontSize: "12px", color: "#999", marginLeft: "8px" }}>
                        {item.contact} · {SALES_STAGES[item.stage]?.label || item.stage}
                      </span>
                      <div style={{ fontSize: "11px", color: "#bbb", marginTop: "3px" }}>
                        삭제: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('ko-KR') : "-"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        onClick={() => restoreFromTrash(item)}
                        style={{ padding: "5px 12px", background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: "5px", fontSize: "12px", cursor: "pointer" }}
                      >↩ 복원</button>
                      <button
                        onClick={() => permanentDelete(item)}
                        style={{ padding: "5px 12px", background: "#ffebee", color: "#c62828", border: "1px solid #ef9a9a", borderRadius: "5px", fontSize: "12px", cursor: "pointer" }}
                      >✕ 영구삭제</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 신규 접수 폼 */}
      {showAddForm && (
        <AddLeadForm
          onClose={() => setShowAddForm(false)}
          onAdd={() => {
            // GAS가 상담이력 탭에 저장 완료 → 4초 후 Sheet 새로고침
            setShowAddForm(false);
            sheetsLoadedRef.current = false; // 재로드 허용
            setTimeout(() => {
              loadLeadsFromSheet();
            }, 4000);
          }}
        />
      )}

      {/* 상담 기록 폼 */}
      {showConsultationForm && (
        <ConsultationLogForm
          lead={showConsultationForm}
          onClose={() => setShowConsultationForm(null)}
          onSave={(logData) => addConsultationLog(showConsultationForm, logData)}
        />
      )}
    </div>
  );
};
const LeadDetailModal = ({ lead, onClose, onUpdate, meta = {}, onSaveMeta }) => {
  const [editedLead, setEditedLead] = useState({ ...lead });
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const [consultation1, setConsultation1] = useState({ date: "", type: "PHONE", content: "", nextActionDate: "", nextActionText: "" });
  const [consultation2, setConsultation2] = useState({ date: "", type: "PHONE", content: "", nextActionDate: "", nextActionText: "" });
  const [consultation3, setConsultation3] = useState({ date: "", type: "PHONE", content: "", nextActionDate: "", nextActionText: "" });
  const [nextStage, setNextStage] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  // 문서 자료 보관함
  const DEFAULT_DOCS = [
    { id: "price", label: "가격표", icon: "💰", url: "", note: "" },
    { id: "company", label: "회사 소개서", icon: "🏢", url: "", note: "" },
    { id: "sample", label: "광고 샘플", icon: "🖼️", url: "", note: "" },
    { id: "contract", label: "계약서", icon: "📄", url: "", note: "" },
    { id: "etc1", label: "기타 자료 1", icon: "📎", url: "", note: "" },
  ];
  const [docLinks, setDocLinks] = useState(DEFAULT_DOCS);
  const [docEditMode, setDocEditMode] = useState(false);
  const [docSaving, setDocSaving] = useState(false);

  const stage = SALES_STAGES[lead.stage];
  const consultationLogs = lead.consultationLogs || [];

  // 개별 클라이언트 doc 링크 및 기본 자료 소소 로드
  useEffect(() => {
    if (consultationLogs[0]) setConsultation1({ ...consultationLogs[0], nextActionDate: consultationLogs[0].nextActionDate || "", nextActionText: consultationLogs[0].nextActionText || consultationLogs[0].nextAction || "" });
    if (consultationLogs[1]) setConsultation2({ ...consultationLogs[1], nextActionDate: consultationLogs[1].nextActionDate || "", nextActionText: consultationLogs[1].nextActionText || consultationLogs[1].nextAction || "" });
    if (consultationLogs[2]) setConsultation3({ ...consultationLogs[2], nextActionDate: consultationLogs[2].nextActionDate || "", nextActionText: consultationLogs[2].nextActionText || consultationLogs[2].nextAction || "" });
    // meta에서 docLinks 구구
    if (meta?.docLinks && meta.docLinks.length > 0) {
      setDocLinks(DEFAULT_DOCS.map(d => {
        const saved = meta.docLinks.find(s => s.id === d.id);
        return saved ? { ...d, ...saved } : d;
      }));
    }
  }, [lead]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveDocs = async () => {
    setDocSaving(true);
    try {
      await onSaveMeta({ ...meta, docLinks });
    } finally {
      setDocSaving(false);
      setDocEditMode(false);
    }
  };

  const handleEmailWithDocs = async () => {
    const filledDocs = docLinks.filter(d => d.url?.trim());
    if (!lead.email) { alert("이메일 주소가 없습니다."); return; }
    if (filledDocs.length === 0) { alert("보낼 자료가 없습니다. 먼저 ✏️ 편집에서 자료 링크를 등록하세요."); return; }
    const subject = encodeURIComponent(`[씬짜오 베트남] ${lead.customer} 광고 관련 자료 안내`);
    const bodyLines = [
      `안녕하세요, ${lead.contact || lead.customer} 님.`,
      `씬짜오 베트남 광고 관련 자료를 안내드립니다.`,
      "",
      ...filledDocs.map(d => `[${d.icon} ${d.label}]${d.note ? ` (${d.note})` : ""}\n${d.url}`),
      "",
      "감사합니다.",
    ];
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`);

    // ── 발송 이력 기록 ──
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const sentAtKR = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const newEntry = {
      sentAt: now.toISOString(),
      sentAtKR,
      toEmail: lead.email,
      docs: filledDocs.map(d => ({ id: d.id, label: d.label, icon: d.icon })),
    };
    const updatedMeta = {
      ...meta,
      docLinks,
      docSentHistory: [newEntry, ...(meta?.docSentHistory || [])],
    };
    await onSaveMeta(updatedMeta);
  };

  // 현재 단계에서 이동 가능한 다음 단계들 (진행 단계 제거)
  const getAvailableNextStages = () => {
    const stages = [];

    if (lead.stage === "INQUIRY") {
      stages.push("CONSULTATION", "CONTRACT");
    } else if (lead.stage === "CONSULTATION") {
      stages.push("CONTRACT", "COLLECTION");
    } else if (lead.stage === "CONTRACT") {
      stages.push("COLLECTION", "COMPLETED");
    } else if (lead.stage === "COLLECTION") {
      stages.push("COMPLETED");
    }

    // 공통: 보류, 취소는 항상 가능
    stages.push("ON_HOLD", "LOST");

    return stages;
  };

  const handleSaveLog = () => {
    const logs = [];
    if (consultation1.content?.trim()) logs.push({ ...consultation1, logNumber: 1 });
    if (consultation2.content?.trim()) logs.push({ ...consultation2, logNumber: 2 });
    if (consultation3.content?.trim()) logs.push({ ...consultation3, logNumber: 3 });

    if (logs.length === 0) { alert("❌ 최소 1회차 상담 내용을 입력하세요!"); return; }
    if (!nextStage) { alert("❌ 다음 단계를 선택하세요!"); return; }

    // 날짜 있는 다음 액션을 leadMeta.actions에 저장 → 파이프라인 상단 "오늘의 할 일" 로 연결
    const newActions = [consultation1, consultation2, consultation3]
      .filter(c => c.nextActionDate && c.nextActionText?.trim())
      .map(c => ({ date: c.nextActionDate, text: c.nextActionText.trim(), done: false, customer: lead.customer, leadId: lead.id }));
    if (newActions.length > 0) {
      const prevActions = (meta?.actions || []).filter(a => a.date > new Date().toISOString().split('T')[0] || !a.done);
      const merged = [...prevActions.filter(a => !newActions.find(n => n.text === a.text)), ...newActions];
      onSaveMeta && onSaveMeta({ ...meta, actions: merged });
    }

    const updatedLead = {
      ...editedLead,
      consultationLogs: logs,
      nextFollowUpDate: nextFollowUpDate || editedLead.nextFollowUpDate
    };
    if (nextStage !== "STAY") {
      updatedLead.stage = nextStage;
      alert(`✅ "${lead.customer}" → "${SALES_STAGES[nextStage].label}" 단계로 이동했습니다!`);
    } else {
      alert(`✅ 상담일지가 저장되었습니다.`);
    }
    onUpdate(updatedLead);
  };

  const handleSaveInfo = () => {
    onUpdate(editedLead);
    setIsEditingInfo(false);
    alert("✅ 고객 정보가 수정되었습니다!");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          maxWidth: "900px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "30px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, color: "#333" }}>
            {stage.icon} {lead.customer}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "5px 15px",
              backgroundColor: "#f44336",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            ✕ 닫기
          </button>
        </div>

        {/* 기본 정보 - 수정 가능 */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ color: "#666", borderBottom: "2px solid #ddd", paddingBottom: "10px", margin: 0 }}>
              📋 기본 정보
            </h3>
            <button
              onClick={() => setIsEditingInfo(!isEditingInfo)}
              style={{
                padding: "5px 15px",
                backgroundColor: isEditingInfo ? "#4caf50" : "#2196F3",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {isEditingInfo ? "✅ 저장" : "✏️ 수정"}
            </button>
          </div>

          {isEditingInfo ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "15px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>고객사명</label>
                <input
                  type="text"
                  value={editedLead.customer}
                  onChange={(e) => setEditedLead({ ...editedLead, customer: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>담당자</label>
                <input
                  type="text"
                  value={editedLead.contact}
                  onChange={(e) => setEditedLead({ ...editedLead, contact: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>연락처</label>
                <input
                  type="text"
                  value={editedLead.phone}
                  onChange={(e) => setEditedLead({ ...editedLead, phone: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>이메일</label>
                <input
                  type="email"
                  value={editedLead.email || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, email: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>광고 타입</label>
                <input
                  type="text"
                  value={editedLead.adType || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, adType: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "5px" }}>사이즈</label>
                <input
                  type="text"
                  value={editedLead.size || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, size: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <button
                onClick={handleSaveInfo}
                style={{
                  gridColumn: "1 / -1",
                  padding: "10px",
                  backgroundColor: "#4caf50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✅ 고객 정보 저장
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "15px" }}>
              <InfoRow label="고객사명" value={lead.customer} />
              <InfoRow label="담당자" value={`${lead.contact} ${lead.position ? `(${lead.position})` : ""}`} />
              <InfoRow label="연락처" value={lead.phone} />
              <InfoRow label="이메일" value={lead.email} />
              <InfoRow label="문의일" value={lead.date} />
              <InfoRow label="광고 타입" value={lead.adType} />
              <InfoRow label="사이즈" value={lead.size} />
            </div>
          )}
        </div>

        {/* 현재 단계 */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "#666", borderBottom: "2px solid #ddd", paddingBottom: "10px" }}>
            📍 현재 단계
          </h3>
          <div
            style={{
              padding: "15px",
              backgroundColor: stage.color,
              color: "#fff",
              borderRadius: "8px",
              marginTop: "15px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "5px" }}>
              {stage.icon} {stage.label}
            </div>
            <div style={{ fontSize: "14px", opacity: 0.9 }}>
              {stage.description}
            </div>
          </div>
        </div>

        {/* 이전 상담 기록 */}
        {consultationLogs.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#666", borderBottom: "2px solid #ddd", paddingBottom: "10px" }}>
              📚 상담 히스토리 ({consultationLogs.length}회)
            </h3>
            <div style={{ marginTop: "15px", maxHeight: "250px", overflowY: "auto" }}>
              {consultationLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    padding: "12px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "5px",
                    marginBottom: "10px",
                    borderLeft: "4px solid #2196F3",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "bold", color: "#333" }}>
                      {log.logNumber || index + 1}회차 상담
                    </span>
                    <span style={{ fontSize: "12px", color: "#999" }}>
                      📅 {log.date || "날짜 미기록"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                    {log.type === "PHONE" && "📞 전화"}
                    {log.type === "EMAIL" && "📧 이메일"}
                    {log.type === "MEETING" && "🤝 대면"}
                    {log.type === "VIDEO" && "📹 화상"}
                    {log.type === "OTHER" && "기타"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#333", whiteSpace: "pre-wrap" }}>
                    {log.content}
                  </div>
                  {log.nextAction && (
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                      📌 {log.nextAction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 📁 자료 보관함 */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ color: "#1565c0", borderBottom: "3px solid #1976d2", paddingBottom: "8px", margin: 0, flex: 1, paddingRight: "16px" }}>
              📁 영업 자료 보관함
            </h3>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              {lead.email && (
                <button
                  onClick={handleEmailWithDocs}
                  title="자료 링크를 이메일로 발송"
                  style={{ padding: "6px 14px", background: "#1976d2", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}
                >
                  📧 이메일로 자료 발송
                </button>
              )}
              <button
                onClick={() => docEditMode ? handleSaveDocs() : setDocEditMode(true)}
                style={{ padding: "6px 14px", background: docEditMode ? "#4caf50" : "#ff9800", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}
              >
                {docSaving ? "저장 중..." : docEditMode ? "💾 저장" : "✏️ 편집"}
              </button>
              {docEditMode && (
                <button
                  onClick={() => setDocEditMode(false)}
                  style={{ padding: "6px 14px", background: "#eee", color: "#555", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >
                  취소
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px", marginTop: "8px" }}>
            {docLinks.map((doc, idx) => (
              <div
                key={doc.id}
                style={{
                  padding: "12px 14px",
                  backgroundColor: doc.url ? "#e3f2fd" : "#f5f5f5",
                  borderRadius: "8px",
                  border: `1px solid ${doc.url ? "#90caf9" : "#e0e0e0"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: docEditMode ? "8px" : "4px" }}>
                  <span style={{ fontSize: "16px" }}>{doc.icon}</span>
                  <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1a237e" }}>{doc.label}</span>
                  {!docEditMode && doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: "auto", fontSize: "11px", color: "#1976d2", textDecoration: "none", background: "#bbdefb", padding: "2px 8px", borderRadius: "10px" }}
                    >
                      열기 →
                    </a>
                  )}
                </div>
                {docEditMode ? (
                  <>
                    <input
                      type="url"
                      placeholder="URL 또는 구글드라이브 링크"
                      value={doc.url}
                      onChange={e => setDocLinks(prev => prev.map((d, i) => i === idx ? { ...d, url: e.target.value } : d))}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #90caf9", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box", marginBottom: "4px" }}
                    />
                    <input
                      type="text"
                      placeholder="메모 (예: 2026년 1월 버전)"
                      value={doc.note}
                      onChange={e => setDocLinks(prev => prev.map((d, i) => i === idx ? { ...d, note: e.target.value } : d))}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #e0e0e0", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }}
                    />
                  </>
                ) : (
                  <div style={{ fontSize: "11px", color: doc.url ? "#555" : "#bbb", wordBreak: "break-all" }}>
                    {doc.url ? (
                      <>
                        <div style={{ color: "#1976d2", marginBottom: "2px" }}>{doc.url.slice(0, 50)}{doc.url.length > 50 ? "..." : ""}</div>
                        {doc.note && <div style={{ color: "#888" }}>📝 {doc.note}</div>}
                      </>
                    ) : "링크 없음 (편집 버튼으로 추가)"}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!lead.email && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#bbb" }}>💡 이메일 주소를 등록하면 자료를 이메일로 바로 발송할 수 있습니다.</div>
          )}

          {/* 📬 자료 발송 이력 */}
          {(meta?.docSentHistory || []).length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>📬 자료 발송 이력</div>
              <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {(meta.docSentHistory).map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "10px",
                      padding: "8px 12px",
                      background: "#f8f9fa",
                      borderRadius: "6px",
                      border: "1px solid #e8eaf6",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#1976d2", minWidth: "120px", flexShrink: 0 }}>📅 {entry.sentAtKR}</span>
                    <span style={{ color: "#555", minWidth: "110px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      ✉️ {entry.toEmail}
                    </span>
                    <span style={{ color: "#388e3c", flex: 1 }}>
                      {entry.docs.map(d => `${d.icon} ${d.label}`).join("  ·  ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 상담일지 작성 - 1회차, 2회차, 3회차 */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "#ff9800", borderBottom: "3px solid #ff9800", paddingBottom: "10px" }}>
            📝 상담일지 작성
          </h3>

          {/* 1회차 상담 */}
          <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#fff3e0", borderRadius: "8px", border: "2px solid #ff9800" }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#e65100" }}>1️⃣ 1회차 상담</h4>
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>
                    📅 상담일 <span style={{ color: "#f44336" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={consultation1.date}
                    onChange={(e) => setConsultation1({ ...consultation1, date: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📞 상담 방식</label>
                  <select
                    value={consultation1.type}
                    onChange={(e) => setConsultation1({ ...consultation1, type: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                  >
                    <option value="PHONE">📞 전화</option>
                    <option value="EMAIL">📧 이메일</option>
                    <option value="MEETING">🤝 대면</option>
                    <option value="VIDEO">📹 화상</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>💬 상담 내용</label>
                <textarea
                  value={consultation1.content}
                  onChange={(e) => setConsultation1({ ...consultation1, content: e.target.value })}
                  placeholder="예: 단가표 발송, Full 광고 관심, 견적 요청"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", minHeight: "60px", fontFamily: "sans-serif", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📌 다음 액션</label>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px" }}>
                  <input type="date" value={consultation1.nextActionDate} onChange={e => setConsultation1({ ...consultation1, nextActionDate: e.target.value })} style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                  <input type="text" value={consultation1.nextActionText} onChange={e => setConsultation1({ ...consultation1, nextActionText: e.target.value })} placeholder="예: 견적서 발송" style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                </div>
              </div>
            </div>
          </div>

          {/* 2회차 상담 */}
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#e8f5e9", borderRadius: "8px", border: "2px solid #4caf50" }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#2e7d32" }}>2️⃣ 2회차 상담 (선택)</h4>
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📅 상담일</label>
                  <input
                    type="date"
                    value={consultation2.date}
                    onChange={(e) => setConsultation2({ ...consultation2, date: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📞 상담 방식</label>
                  <select
                    value={consultation2.type}
                    onChange={(e) => setConsultation2({ ...consultation2, type: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                  >
                    <option value="PHONE">📞 전화</option>
                    <option value="EMAIL">📧 이메일</option>
                    <option value="MEETING">🤝 대면</option>
                    <option value="VIDEO">📹 화상</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>💬 상담 내용</label>
                <textarea
                  value={consultation2.content}
                  onChange={(e) => setConsultation2({ ...consultation2, content: e.target.value })}
                  placeholder="예: 견적서 검토 중, 조건 협의"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", minHeight: "60px", fontFamily: "sans-serif", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📌 다음 액션</label>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px" }}>
                  <input type="date" value={consultation2.nextActionDate} onChange={e => setConsultation2({ ...consultation2, nextActionDate: e.target.value })} style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                  <input type="text" value={consultation2.nextActionText} onChange={e => setConsultation2({ ...consultation2, nextActionText: e.target.value })} placeholder="예: 수정 견적 발송" style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                </div>
              </div>
            </div>
          </div>

          {/* 3회차 상담 */}
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#e3f2fd", borderRadius: "8px", border: "2px solid #2196F3" }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#1565c0" }}>3️⃣ 3회차 상담 (선택)</h4>
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📅 상담일</label>
                  <input
                    type="date"
                    value={consultation3.date}
                    onChange={(e) => setConsultation3({ ...consultation3, date: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📞 상담 방식</label>
                  <select
                    value={consultation3.type}
                    onChange={(e) => setConsultation3({ ...consultation3, type: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                  >
                    <option value="PHONE">📞 전화</option>
                    <option value="EMAIL">📧 이메일</option>
                    <option value="MEETING">🤝 대면</option>
                    <option value="VIDEO">📹 화상</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>💬 상담 내용</label>
                <textarea
                  value={consultation3.content}
                  onChange={(e) => setConsultation3({ ...consultation3, content: e.target.value })}
                  placeholder="예: 계약 합의, Vol 556~561 확정"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", minHeight: "60px", fontFamily: "sans-serif", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>📌 다음 액션</label>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px" }}>
                  <input type="date" value={consultation3.nextActionDate} onChange={e => setConsultation3({ ...consultation3, nextActionDate: e.target.value })} style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                  <input type="text" value={consultation3.nextActionText} onChange={e => setConsultation3({ ...consultation3, nextActionText: e.target.value })} placeholder="예: 계약서 발송" style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                </div>
              </div>
            </div>
          </div>

          {/* 다음 단계 선택 + 저장 */}
          <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#fff9c4", borderRadius: "8px", border: "3px solid #fbc02d" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold", fontSize: "16px", color: "#f57f17" }}>
              🎯 다음 단계 선택 <span style={{ color: "#f44336" }}>*</span>
            </label>
            <select
              value={nextStage}
              onChange={(e) => setNextStage(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "3px solid #fbc02d",
                borderRadius: "5px",
                fontSize: "15px",
                fontWeight: "bold",
                backgroundColor: "#fff",
                marginBottom: "15px",
              }}
            >
              <option value="">-- 다음 단계를 선택하세요 --</option>
              <option value="STAY" style={{ backgroundColor: "#e3f2fd" }}>
                ⏸️ 현재 단계 유지 ({stage.label})
              </option>
              {getAvailableNextStages().map(stageId => {
                const s = SALES_STAGES[stageId];
                return (
                  <option key={stageId} value={stageId}>
                    {s.icon} {s.label}
                  </option>
                );
              })}
            </select>

            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              📅 다음 연락 예정일 (선택)
            </label>
            <input
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "2px solid #ddd",
                borderRadius: "5px",
                fontSize: "14px",
                boxSizing: "border-box",
                marginBottom: "15px",
              }}
            />


            <button
              onClick={handleSaveLog}
              style={{
                width: "100%",
                padding: "15px",
                backgroundColor: "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              ✅ 상담일지 저장 및 단계 이동
            </button>
          </div>
        </div>

        {/* 필요 서류 */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "#666", borderBottom: "2px solid #ddd", paddingBottom: "10px" }}>
            📄 필요 서류 ({stage.label} 단계)
          </h3>
          <div style={{ marginTop: "15px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {stage.documents.map((doc, index) => (
              <div
                key={index}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "5px",
                  fontSize: "13px",
                  border: "1px solid #ddd",
                }}
              >
                📎 {doc}
              </div>
            ))}
          </div>
        </div>

        {/* 비고 */}
        {lead.remark && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ color: "#666", borderBottom: "2px solid #ddd", paddingBottom: "10px" }}>
              💬 초기 메모
            </h3>
            <div
              style={{
                padding: "15px",
                backgroundColor: "#f5f5f5",
                borderRadius: "5px",
                marginTop: "15px",
              }}
            >
              {lead.remark}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 상담 기록 폼
const ConsultationLogForm = ({ lead, onClose, onSave }) => {
  const [logData, setLogData] = useState({
    type: "PHONE", // PHONE, EMAIL, MEETING, OTHER
    content: "",
    nextStage: "", // 다음 단계 직접 선택
    nextAction: "",
    nextDate: ""
  });

  const consultationCount = (lead.consultationLogs || []).length + 1;
  const currentStage = SALES_STAGES[lead.stage];

  // 현재 단계에서 이동 가능한 다음 단계들 (진행 단계 제거)
  const getAvailableNextStages = () => {
    const stages = [];

    if (lead.stage === "INQUIRY") {
      stages.push("CONSULTATION", "CONTRACT");
    } else if (lead.stage === "CONSULTATION") {
      stages.push("CONTRACT", "COLLECTION");
    } else if (lead.stage === "CONTRACT") {
      stages.push("COLLECTION", "COMPLETED");
    } else if (lead.stage === "COLLECTION") {
      stages.push("COMPLETED");
    }

    // 공통: 보류, 취소는 항상 가능
    stages.push("ON_HOLD", "LOST");

    return stages;
  };

  const handleSubmit = () => {
    if (!logData.content) {
      alert("❌ 상담 내용은 필수입니다!");
      return;
    }

    onSave(logData);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "30px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: "#ff9800" }}>
          📝 {lead.customer} - 상담 기록 {consultationCount}회차
        </h2>

        <div
          style={{
            padding: "12px 15px",
            backgroundColor: "#e3f2fd",
            borderRadius: "5px",
            marginBottom: "20px",
            fontSize: "13px",
            border: "2px solid #2196F3",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px", color: "#1565c0" }}>
            📍 현재 단계: {currentStage.icon} {currentStage.label}
          </div>
          <div style={{ color: "#666" }}>
            ↓ 아래 "다음 단계"에서 이동할 단계를 선택하세요
          </div>
        </div>

        <div style={{ display: "grid", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              📞 상담 방식
            </label>
            <select
              value={logData.type}
              onChange={(e) => setLogData({ ...logData, type: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                border: "2px solid #ddd",
                borderRadius: "5px",
                fontSize: "14px",
              }}
            >
              <option value="PHONE">📞 전화 상담</option>
              <option value="EMAIL">📧 이메일</option>
              <option value="MEETING">🤝 대면 미팅</option>
              <option value="VIDEO">📹 화상 회의</option>
              <option value="OTHER">기타</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              💬 상담 내용 <span style={{ color: "#f44336" }}>*</span>
            </label>
            <textarea
              value={logData.content}
              onChange={(e) => setLogData({ ...logData, content: e.target.value })}
              placeholder="상담 내용을 자세히 기록하세요.
              
예시:
- 단가표 발송 완료, Full 광고 관심
- 견적서 요청, 3개월 계약 희망
- 계약 진행 합의, Vol 556~561
- 입금 확인, $3,000 전액"
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #ddd",
                borderRadius: "5px",
                fontSize: "14px",
                minHeight: "120px",
                fontFamily: "sans-serif",
                boxSizing: "border-box",
              }}
              autoFocus
            />
          </div>

          <div
            style={{
              padding: "15px",
              backgroundColor: "#fff3e0",
              borderRadius: "5px",
              border: "2px solid #ff9800",
            }}
          >
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold", color: "#e65100" }}>
              🎯 다음 단계 선택 (필수)
            </label>
            <select
              value={logData.nextStage}
              onChange={(e) => setLogData({ ...logData, nextStage: e.target.value })}
              style={{
                width: "100%",
                padding: "12px",
                border: "3px solid #ff9800",
                borderRadius: "5px",
                fontSize: "15px",
                fontWeight: "bold",
                backgroundColor: "#fff",
              }}
            >
              <option value="">-- 다음 단계를 선택하세요 --</option>
              <option value="STAY" style={{ backgroundColor: "#e3f2fd" }}>
                ⏸️ 현재 단계 유지 ({currentStage.label})
              </option>
              {getAvailableNextStages().map(stageId => {
                const stage = SALES_STAGES[stageId];
                return (
                  <option key={stageId} value={stageId} style={{ backgroundColor: stage.color + "20" }}>
                    {stage.icon} {stage.label}
                  </option>
                );
              })}
            </select>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
              💡 상담 후 이동할 단계를 선택하면 자동으로 이동합니다
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              📌 다음 액션
            </label>
            <input
              type="text"
              value={logData.nextAction}
              onChange={(e) => setLogData({ ...logData, nextAction: e.target.value })}
              placeholder="예: 견적서 발송, 계약서 작성, 입금 확인 등"
              style={{
                width: "100%",
                padding: "10px",
                border: "2px solid #ddd",
                borderRadius: "5px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              📅 다음 연락 예정일
            </label>
            <input
              type="date"
              value={logData.nextDate}
              onChange={(e) => setLogData({ ...logData, nextDate: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                border: "2px solid #ddd",
                borderRadius: "5px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          <button
            onClick={handleSubmit}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "#ff9800",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            ✅ 저장 및 단계 이동
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "#f44336",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            ✕ 취소
          </button>
        </div>
      </div>
    </div>
  );
};

// 신규 고객 접수 폼 (오프라인 광고문의 폼과 동일)
const AddLeadForm = ({ onClose, onAdd }) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    contactMethod: "PHONE",   // 접수경로
    customer: "",             // 회사명
    contact: "",              // 담당자명
    position: "",             // 직책
    phone: "",                // 전화
    email: "",                // 이메일
    adType: "",               // 광고 유형
    size: "",                 // 광고 크기
    startDate: "",            // 예상 시작 시기
    remark: "",               // 문의 내용
    salesman: "",             // 입력 담당자 (영업사원)
    nextActionDate: tomorrow, // 다음 할일 날짜
    nextActionText: "",       // 다음 할일 내용
  });

  const [loading, setLoading] = useState(false);
  const set = (field, val) => setFormData(prev => ({ ...prev, [field]: val }));

  const contactMethodLabels = {
    PHONE: "전화", MEETING: "면담", EMAIL: "이메일", OTHER: "기타"
  };

  const handleSubmit = async () => {
    if (!formData.customer.trim()) { alert("❌ 회사명은 필수입니다!"); return; }
    if (!formData.contact.trim()) { alert("❌ 담당자명은 필수입니다!"); return; }
    if (!formData.phone.trim()) { alert("❌ 전화번호는 필수입니다!"); return; }
    if (!formData.salesman.trim()) { alert("❌ 입력 담당자를 꼭 입력해주세요!"); return; }

    setLoading(true);

    // ① Google Sheets(광고 관리 통합 > 상담이력) 저장
    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "CONSULT",            // ← 반드시 CONSULT: 상담이력 탭에 기록
          date: formData.date,
          customerName: formData.customer,
          charger: formData.contact,
          position: formData.position,
          phone: formData.phone,
          email: formData.email,
          contactMethod: contactMethodLabels[formData.contactMethod] + " 문의",
          remark: formData.remark,
          adType: formData.adType,
          memo: formData.salesman ? "담당: " + formData.salesman : "",
          source: "OFFLINE",
          nextActionText: formData.nextActionText, // NEXT_STEP(11) 저장
          nextActionDate: formData.nextActionDate, // NEXT_DATE(12) 저장
        }),
      });
      console.log("[AddLeadForm] GAS CONSULT 전송 완료 →", formData.customer);
    } catch (err) {
      console.warn("[AddLeadForm] GAS 전송 실패:", err);
    }

    setLoading(false);
    alert(
      `✅ ${formData.customer} 접수 완료!\n` +
      `→ 광고 관리 통합 Sheet > 상담이력 탭에 저장됩니다.\n` +
      `(파이프라인 새로고침 후 목록에서 확인하세요)`
    );

    // ② 폼 닫고 파이프라인 새로고침 요청 (onAdd(null) → loadLeadsFromSheet 트리거)
    onAdd(null);
  };

  const inputStyle = {
    width: "100%", padding: "10px", border: "2px solid #ddd",
    borderRadius: "5px", fontSize: "14px", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" };
  const sectionStyle = {
    borderBottom: "2px solid #f0f0f0", paddingBottom: "10px",
    marginBottom: "14px", color: "#555", fontWeight: "bold", fontSize: "13px",
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        zIndex: 9999,
        overflowY: "auto",
        padding: "24px 16px 40px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          maxWidth: "520px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 (고정) */}
        <div style={{ background: "linear-gradient(135deg,#d32f2f,#b71c1c)", padding: "18px 22px", borderRadius: "10px 10px 0 0", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>📞 신규 광고 문의 접수</div>
            <div style={{ fontSize: "12px", marginTop: "3px", opacity: 0.85 }}>전화·면담·이메일 문의 → 상담이력 탭 자동 저장</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "18px", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer" }}>×</button>
        </div>

        {/* 스크롤 가능한 본문 */}
        <div style={{ padding: "22px", overflowY: "auto" }}>
          {/* 접수 경로 */}
          <div style={sectionStyle}>📍 접수 경로</div>
          <div style={{ display: "flex", gap: "16px", marginBottom: "18px", flexWrap: "wrap" }}>
            {[["PHONE", "📞 전화"], ["MEETING", "🤝 면담"], ["EMAIL", "📧 이메일"], ["OTHER", "❓ 기타"]].map(([val, lbl]) => (
              <label key={val} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "14px" }}>
                <input type="radio" value={val} checked={formData.contactMethod === val} onChange={() => set("contactMethod", val)} />
                <strong>{lbl}</strong>
              </label>
            ))}
          </div>

          {/* 회사 정보 */}
          <div style={sectionStyle}>📋 회사 정보</div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>회사명 <span style={{ color: "#f44336" }}>*</span></label>
            <input style={inputStyle} value={formData.customer} onChange={e => set("customer", e.target.value)} placeholder="예: 삼성전자" autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={labelStyle}>담당자명 <span style={{ color: "#f44336" }}>*</span></label>
              <input style={inputStyle} value={formData.contact} onChange={e => set("contact", e.target.value)} placeholder="예: 박영수" />
            </div>
            <div>
              <label style={labelStyle}>직책</label>
              <input style={inputStyle} value={formData.position} onChange={e => set("position", e.target.value)} placeholder="예: 마케팅팀장" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            <div>
              <label style={labelStyle}>전화 <span style={{ color: "#f44336" }}>*</span></label>
              <input style={inputStyle} type="tel" value={formData.phone} onChange={e => set("phone", e.target.value)} placeholder="090-000-0000" />
            </div>
            <div>
              <label style={labelStyle}>이메일</label>
              <input style={inputStyle} type="email" value={formData.email} onChange={e => set("email", e.target.value)} placeholder="contact@co.com" />
            </div>
          </div>

          {/* 광고 정보 */}
          <div style={sectionStyle}>📰 광고 정보</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            <div>
              <label style={labelStyle}>광고 유형</label>
              <select style={inputStyle} value={formData.adType} onChange={e => set("adType", e.target.value)}>
                <option value="">선택하세요</option>
                <option value="잡지 지면 광고">잡지 지면 광고</option>
                <option value="온라인 광고">온라인 광고</option>
                <option value="양쪽 다">양쪽 다 (지면 + 온라인)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>광고 크기</label>
              <select style={inputStyle} value={formData.size} onChange={e => set("size", e.target.value)}>
                <option value="">선택하세요</option>
                <option value="FC">FC (Full Color)</option>
                <option value="1/2">1/2 Page</option>
                <option value="1/4">1/4 Page</option>
                <option value="옐로페이지">옐로페이지</option>
                <option value="온라인 포함">온라인 포함</option>
              </select>
            </div>
          </div>

          {/* 기타 */}
          <div style={sectionStyle}>💬 기타 정보</div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>예상 시작 시기</label>
            <input type="date" style={inputStyle} value={formData.startDate} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>문의 내용</label>
            <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical", fontFamily: "sans-serif" }}
              value={formData.remark} onChange={e => set("remark", e.target.value)}
              placeholder="문의 내용, 예산, 기간, 특이사항 등" />
          </div>

          {/* 담당 영업사원 */}
          <div style={sectionStyle}>👤 입력 담당자</div>
          <div style={{ marginBottom: "8px" }}>
            <label style={labelStyle}>담당자 이름 <span style={{ color: "#f44336" }}>*</span></label>
            <input style={inputStyle} value={formData.salesman} onChange={e => set("salesman", e.target.value)} placeholder="예: 이순신" />
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>이 문의를 입력하는 영업담당자의 이름을 적어주세요</div>
          </div>

          {/* 다음 할일 */}
          <div style={{ marginTop: "6px", padding: "14px", background: "#fff3e0", border: "2px solid #ff9800", borderRadius: "8px" }}>
            <div style={{ ...sectionStyle, borderBottom: "none", marginBottom: "10px", color: "#e65100" }}>📌 다음 할일 (할일현황에 자동 등록)</div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "10px" }}>
              <div>
                <label style={labelStyle}>날짜</label>
                <input type="date" style={inputStyle} value={formData.nextActionDate}
                  onChange={e => set("nextActionDate", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>할일 내용</label>
                <input type="text" style={inputStyle} value={formData.nextActionText}
                  onChange={e => set("nextActionText", e.target.value)}
                  placeholder="예: 견적서 발송, 재연락, 명함 보내기" />
              </div>
            </div>
          </div>
        </div>

        {/* 저장 버튼 (하단 고정) */}
        <div style={{
          padding: "16px 22px",
          borderTop: "2px solid #f0f0f0",
          display: "flex", gap: "10px",
          flexShrink: 0,
          background: "#fff",
          borderRadius: "0 0 10px 10px",
        }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "12px", backgroundColor: "#f5f5f5", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "15px" }}
          >취소</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2, padding: "12px",
              backgroundColor: loading ? "#aaa" : "#4caf50",
              color: "#fff", border: "none", borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "15px", fontWeight: "bold",
            }}
          >
            {loading ? "저장 중..." : "✅ 접수하기"}
          </button>
        </div>
      </div>
    </div>
  );
};

// 헬퍼 컴포넌트
const InfoRow = ({ label, value }) => (
  <div>
    <div style={{ fontSize: "12px", color: "#999", marginBottom: "5px" }}>
      {label}
    </div>
    <div style={{ fontSize: "14px", fontWeight: "bold" }}>
      {value || "-"}
    </div>
  </div>
);


export default LeadPipeline;
