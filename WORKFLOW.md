# 씬짜오베트남 CRM 워크플로우

## 시스템 구성

| 구성 요소 | 역할 |
|---|---|
| **React 앱** (Vercel 배포) | CRM UI — 파이프라인 관리, 상담일지, 수금 |
| **Firebase Firestore** | 상담일지, 단계 이동, 다음 일정, 수동 할 일 저장 |
| **Google Sheets** (광고 관리 통합) | 상담이력, 계약관리, 수금이력 원본 데이터 |
| **Google Apps Script (GAS)** | CRM → Google Sheets 데이터 전송 중계 |

---

## 전체 데이터 흐름

```
고객 문의 접수
      │
      ▼
┌─────────────────────────────────┐
│  CRM 앱 > "신규 광고 문의 접수"  │
│  (AddLeadForm / AddCustomerForm) │
└────────────────┬────────────────┘
                 │ HTTP POST (action: "CONSULT")
                 ▼
┌─────────────────────────────────┐
│  Google Apps Script (GAS)        │
│  URL: AKfycbw1rd5SbMD...exec    │
└────────────────┬────────────────┘
                 │ appendRow
                 ▼
┌─────────────────────────────────┐
│  광고 관리 통합 Sheet             │
│  탭: 상담이력                    │
│  컬럼: 날짜, 고객명, 담당자,      │
│         전화, 접촉방법, 상담내용   │
└─────────────────────────────────┘
                 │ (4초 후 자동 새로고침)
                 ▼
         파이프라인 목록에 표시
```

---

## 파이프라인 단계별 흐름

```
문의 수렴 (INQUIRY)
    │  고객 클릭 → 상담일지 작성 → 저장
    ▼
상담 (CONSULTATION)          ← Firestore에 stageOverride 저장
    │  계약 내용 확정
    ▼
계약 (CONTRACT)
    │  수금 버튼 클릭
    ▼
수금 (COLLECTION)
    │  완납 확인
    ▼
완료 (COMPLETED)

※ 언제든지 → 보류(ON_HOLD) 또는 취소(LOST) 가능
```

---

## 상담일지 저장 흐름

```
리드 클릭 → LeadDetailModal 열림
    │
    ├── 1~3회차 상담 내용 입력
    ├── 다음 단계 선택 (필수)
    └── "저장 및 단계 이동" 클릭
            │
            ├─→ Firestore > leadMeta > data > lead-{고객명}-{날짜}
            │     ├── stageOverride  (단계)
            │     ├── consultationLogs[]  (상담 기록)
            │     │     ├── date, content, type
            │     │     ├── nextActionDate  ← 할 일 현황 소스
            │     │     └── nextActionText
            │     └── infoOverride  (고객 기본정보 수정사항)
            │
            └─→ React state 업데이트 (화면 즉시 반영)
```

---

## 할 일 현황 데이터 소스

```
파이프라인 상단 "오늘의 할 일 / 금주의 할 일"
    │
    읽는 곳:
    ├── leadMeta[*].actions[]          (수동 등록 또는 handleSaveLog 저장분)
    └── leadMeta[*].consultationLogs[].nextActionDate  (소급 적용)
    
    필터:
    ├── 오늘 이전  → ⚠️ 지난 일정
    ├── 오늘       → 🔴 오늘의 할 일
    └── 이번주     → 📅 금주의 할 일
```

---

## 수금 흐름

```
"💰 수금 입력" 버튼 클릭
    │
    ├── 수금 모달 입력:
    │     ├── 수금일, 금액(USD)
    │     ├── 실시간 환율 자동 조회 (open.er-api.com)
    │     ├── VND 자동 계산
    │     └── 수금 방법
    │
    │ HTTP POST (action: "PAYMENT")
    ▼
Google Apps Script
    │
    ├─→ 수금이력 탭에 기록 (수금일, 고객명, USD, VND, 환율)
    └─→ 계약관리 탭 수금액 누적 업데이트 → 미수금 자동 계산
```

---

## Firebase Firestore 문서 구조

```
xinchao_crm/ (컬렉션)
  ├── leadMeta
  │     └── data
  │           ├── lead-0 ~ lead-183        (구형 index 기반 key)
  │           ├── lead-{고객명}-{날짜}      (신형 stable key)
  │           └── manual                   (수동 할 일 항목)
  │
  ├── manualLeads
  │     └── leads[]  (수동 등록 리드 목록)
  │
  ├── deletedIds
  │     └── ids[]    (삭제된 리드 ID 목록 — 파이프라인에서 제외)
  │
  └── trash
        └── items[]  (휴지통 항목)
```

---

## Google Sheets 탭 구조 및 앱 연결 관계

**Sheet 이름: 광고 관리 통합**
**Sheet ID**: `1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA`

```
광고 관리 통합 (Google Sheets)
 │
 ├── 📋 상담이력 탭
 │     ├── 역할: 모든 고객 문의/상담 원본 데이터
 │     ├── CRM이 읽는 방법: gviz API → 파이프라인 리드 목록 생성
 │     └── CRM이 쓰는 방법: GAS POST (action:"CONSULT") → 신규 행 추가
 │
 ├── 📑 계약관리 탭
 │     ├── 역할: 광고 계약 현황 및 수금 집계
 │     ├── CRM이 읽는 방법: (직접 읽지 않음 — Sheet에서 확인)
 │     └── CRM이 쓰는 방법: GAS POST (action:"PAYMENT") → 수금액 누적 업데이트
 │
 ├── 💰 수금이력 탭
 │     ├── 역할: 건별 수금 기록 (날짜, USD, VND, 환율)
 │     ├── CRM이 읽는 방법: (직접 읽지 않음 — Sheet에서 확인)
 │     └── CRM이 쓰는 방법: GAS POST (action:"PAYMENT") → 신규 행 추가
 │
 └── ⚙️ 설정 탭
       ├── 역할: 시스템 설정값 (담당자 목록 등)
       └── CRM과 연결: 없음 (직접 관리)
```

---

## 파이프라인 단계별 Sheet 사용 현황

| 단계 | CRM 화면 | 읽는 Sheet 탭 | 쓰는 Sheet 탭 | Firebase |
|---|---|---|---|---|
| **신규 접수** | 신규 광고 문의 접수 폼 | - | ✅ **상담이력** (GAS CONSULT) | - |
| **파이프라인 로드** | 파이프라인 목록 표시 | ✅ **상담이력** (gviz API) | - | ✅ leadMeta 읽기 |
| **문의 수렴** | 리드 카드 표시 | ✅ **상담이력** | - | ✅ stageOverride 읽기 |
| **상담** | 상담일지 작성/저장 | - | - | ✅ consultationLogs 쓰기 |
| **계약** | 단계 이동 표시 | - | - | ✅ stageOverride 쓰기 |
| **수금** | 수금 입력 모달 | - | ✅ **수금이력** + **계약관리** (GAS PAYMENT) | - |
| **완료** | 완료 표시 | - | - | ✅ stageOverride 쓰기 |
| **할 일 현황** | 오늘/금주 할 일 패널 | - | - | ✅ consultationLogs.nextActionDate 읽기 |

---

## Sheet ↔ Firebase 역할 분담

```
Google Sheets (상담이력 탭)          Firebase (Firestore)
─────────────────────────────        ──────────────────────────────
고객명, 전화번호, 접수일        ←→    단계(stageOverride)
광고 상품, 접수방법                   상담일지(consultationLogs)
담당자, 상담내용                      다음 일정(nextActionDate)
                                      기본정보 수정분(infoOverride)
                                      할 일(actions)

✅ Sheet = 원본 데이터 (읽기 전용으로 취급)
✅ Firebase = 앱에서 추가한 영업 관리 데이터
```

---

**CRM 앱이 Sheet 읽는 방법:**
```
Google Visualization API (gviz/tq)
URL: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={탭이름}
→ 앱 시작 시 상담이력 탭 전체를 읽어 리드 목록 생성
→ 신규 접수 후 4초 대기 후 자동 새로고침
```


---

## GAS 배포 정보

- **URL**: `https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec`
- **파일**: `GoogleAppsScript_광고문의자동등록.gs`
- **action 종류**:
  - `CONSULT` → 상담이력 탭에 신규 행 추가
  - `PAYMENT` → 수금이력 탭 기록 + 계약관리 탭 수금액 업데이트

---

## 주요 파일 위치

| 파일 | 역할 |
|---|---|
| `src/components/LeadPipeline.js` | 파이프라인 메인, 상담일지, 할 일 현황 |
| `src/components/AddCustomerForm.js` | 신규 광고 상담 접수 폼 (별도 컴포넌트) |
| `src/components/PaymentModal.js` | 수금 입력 모달 |
| `src/services/crmFirestore.js` | Firestore 읽기/쓰기 서비스 |
| `src/firebase.js` | Firebase 초기화 |
| `GoogleAppsScript_광고문의자동등록.gs` | GAS 스크립트 (참고용, 실제는 Google 서버에 배포) |
