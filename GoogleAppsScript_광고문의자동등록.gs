/**
 * Google Apps Script - 씬짜오베트남 광고 영업 통합 시스템 (v3)
 *
 * 📌 대상 Sheet: 광고 관리 통합
 *   ID: 1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA
 *
 * 📌 배포 URL (기존과 동일):
 *   https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec
 *
 * 📌 action 종류:
 *   "CONSULT"  → 상담이력 탭에 신규 상담 접수 추가
 *   "PAYMENT"  → 수금이력 탭에 수금 추가 + 계약관리 수금액 업데이트
 */

const SHEET_ID   = "1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA"; // 직원 Sheet
const SETTINGS_SHEET = "설정";
const CONSULT_SHEET  = "상담이력";
const CONTRACT_SHEET = "계약관리";
const PAYMENT_SHEET  = "수금이력";

// 상담이력 컬럼 인덱스 (0-based)
const CONSULT_COL = {
  NO: 0, DATE: 1, CUSTOMER: 2, CHARGER: 3, TITLE: 4,
  PHONE: 5, EMAIL: 6, COUNT: 7, METHOD: 8, CONTENT: 9,
  REACTION: 10, NEXT_STEP: 11, NEXT_DATE: 12, STATUS: 13,
  CATEGORY: 14, PRODUCT: 15, PRICE: 16, START_VOL: 17, END_VOL: 18,
  RECEIVED: 19, MEMO: 20
};

// 계약관리 컬럼 인덱스 (0-based)
const CONTRACT_COL = {
  NO: 0, DATE: 1, CUSTOMER: 2, CHARGER: 3, TITLE: 4,
  PHONE: 5, EMAIL: 6, CATEGORY: 7, PRODUCT: 8, PRICE: 9,
  START_VOL: 10, END_VOL: 11, COUNT: 12, TOTAL: 13,
  RECEIVED: 14, UNPAID: 15, PAY_STATUS: 16, REMAINING: 17, STATUS: 18, MEMO: 19
};

// ────────────────────────────────────────────────────────────
// POST 요청 처리
// ────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log("받은 데이터:", data);

    const action = data.action || "CONSULT";

    if (action === "PAYMENT") {
      return handlePayment(data);
    } else if (action === "UPDATE_CUSTOMER") {
      return handleUpdateCustomer(data);
    } else {
      return handleConsult(data);
    }

  } catch (error) {
    Logger.log("에러:", error);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ────────────────────────────────────────────────────────────
// 상담 접수 → 상담이력 탭 저장
// ────────────────────────────────────────────────────────────
function handleConsult(data) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(CONSULT_SHEET);
  if (!sheet) throw new Error("시트 없음: " + CONSULT_SHEET);

  const today    = new Date().toISOString().split("T")[0];
  const lastRow  = sheet.getLastRow();
  const newRow   = lastRow + 1;
  const newNo    = lastRow - 2; // 헤더 3행 제외

  // 접수 경로 레이블
  const methodLabel = {
    "APP": "앱 문의", "ONLINE": "온라인폼", "OFFLINE": "전화/면담", "CRM": "CRM 직접입력"
  }[data.source] || data.contactMethod || "기타";

  const row = new Array(21).fill("");
  row[CONSULT_COL.NO]       = newNo;
  row[CONSULT_COL.DATE]     = data.date || today;
  row[CONSULT_COL.CUSTOMER] = data.customerName || "";
  row[CONSULT_COL.CHARGER]  = data.contact || data.charger || "";
  row[CONSULT_COL.TITLE]    = data.position || "";
  row[CONSULT_COL.PHONE]    = data.phone || "";
  row[CONSULT_COL.EMAIL]    = data.email || "";
  row[CONSULT_COL.METHOD]   = methodLabel;
  row[CONSULT_COL.CONTENT]  = data.remark || "";
  row[CONSULT_COL.STATUS]   = "진행중";
  row[CONSULT_COL.PRODUCT]  = data.adType || "";
  row[CONSULT_COL.PRICE]    = data.size || ""; // 광고 사이즈를 임시로 PRICE 열에
  row[CONSULT_COL.MEMO]     = data.salesman ? "담당: " + data.salesman : "";

  sheet.appendRow(row);

  // 신규 상담 접수 후 고객DB 자동 갱신
  try { buildCustomerDB(); } catch(e) { Logger.log("DB 갱신 실패(non-critical): " + e.message); }

  // 신규 행 하이라이트
  sheet.getRange(newRow, 1, 1, 21).setBackground("#fff9e6");

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "상담 접수 완료", row: newRow })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// 수금 입력 → 수금이력 탭 + 계약관리 탭 업데이트
// ────────────────────────────────────────────────────────────
function handlePayment(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 1) 수금이력 탭에 기록
  let paySheet = ss.getSheetByName(PAYMENT_SHEET);
  if (!paySheet) {
    // 수금이력 탭이 없으면 자동 생성
    paySheet = ss.insertSheet(PAYMENT_SHEET);
    paySheet.appendRow(["No", "수금일", "고객사", "계약ID", "수금액($)", "수금방법", "비고", "등록일시"]);
    paySheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#E8F5E9");
  }

  const today    = new Date().toISOString().split("T")[0];
  const newPayNo = paySheet.getLastRow(); // 헤더 1행 포함
  const amount   = parseFloat(data.amount) || 0;

  paySheet.appendRow([
    newPayNo,
    data.date || today,
    data.customerName || "",
    data.contractId   || "",
    amount,
    data.method       || "이체",
    data.memo         || "",
    new Date().toISOString()
  ]);

  // 수금이력 새 행 녹색 하이라이트
  paySheet.getRange(paySheet.getLastRow(), 1, 1, 8).setBackground("#C8E6C9");

  // 2) 계약관리 탭에서 해당 고객의 수금액 업데이트
  let updated = false;
  const contractSheet = ss.getSheetByName(CONTRACT_SHEET);
  if (contractSheet && data.customerName) {
    const contractData = contractSheet.getDataRange().getValues();
    // 헤더 3행 제외, 고객명 일치하는 가장 최근 계약 행 업데이트
    for (let i = contractData.length - 1; i >= 3; i--) {
      if (contractData[i][CONTRACT_COL.CUSTOMER] === data.customerName) {
        const prevReceived = parseFloat(contractData[i][CONTRACT_COL.RECEIVED]) || 0;
        const newReceived  = prevReceived + amount;
        const total        = parseFloat(contractData[i][CONTRACT_COL.TOTAL]) || 0;
        const newUnpaid    = total - newReceived;
        const newPayStatus = newUnpaid <= 0 ? "완납" : "미수금";

        contractSheet.getRange(i + 1, CONTRACT_COL.RECEIVED + 1).setValue(newReceived);
        contractSheet.getRange(i + 1, CONTRACT_COL.UNPAID + 1).setValue(newUnpaid);
        contractSheet.getRange(i + 1, CONTRACT_COL.PAY_STATUS + 1).setValue(newPayStatus);
        updated = true;
        break;
      }
    }
  }

  // 수금 후 고객DB 자동 갱신
  try { buildCustomerDB(); } catch(e) { Logger.log("DB 갱신 실패(non-critical): " + e.message); }

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "수금 기록 완료",
      contractUpdated: updated,
      amount: amount
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// GET 테스트
// ────────────────────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <h1>✅ 씬짜오 광고 영업 시스템 작동 중 (v3)</h1>
    <p><strong>대상 Sheet:</strong> 광고 관리 통합</p>
    <p><strong>상담이력 탭:</strong> ${CONSULT_SHEET}</p>
    <p><strong>수금이력 탭:</strong> ${PAYMENT_SHEET}</p>
    <p><strong>action 종류:</strong> CONSULT (기본) | PAYMENT (수금)</p>
  `);
}

// ────────────────────────────────────────────────────────────
// 테스트 함수 (GAS 편집기에서 직접 실행)
// ────────────────────────────────────────────────────────────
function testConsult() {
  doPost({ postData: { contents: JSON.stringify({
    action: "CONSULT",
    date: new Date().toISOString().split("T")[0],
    customerName: "[TEST] 테스트 Company",
    contact: "홍길동", position: "대표",
    phone: "090-000-0000", email: "test@test.com",
    adType: "inside", remark: "테스트 접수",
    source: "APP"
  })}});
  Logger.log("테스트 완료 - 상담이력 탭 확인");
}


function testPayment() {
  doPost({ postData: { contents: JSON.stringify({
    action: "PAYMENT",
    customerName: "[TEST] 테스트 Company",
    date: new Date().toISOString().split("T")[0],
    amount: 500,
    method: "이체",
    memo: "테스트 수금"
  })}});
  Logger.log("수금 테스트 완료 - 수금이력 탭 확인");
}

// ────────────────────────────────────────────────────────────
// CRM 앱에서 고객 정보 수정 → 고객DB 탭 업데이트
// action: "UPDATE_CUSTOMER"
// ────────────────────────────────────────────────────────────
function handleUpdateCustomer(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const dbSheet = ss.getSheetByName(CUSTOMER_DB_SHEET || "고객DB");
  if (!dbSheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "고객DB 탭을 찾을 수 없습니다" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const originalName = (data.originalName || "").trim();
  if (!originalName) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "originalName이 필요합니다" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const lastRow = dbSheet.getLastRow();
  const allData = lastRow >= 2 ? dbSheet.getRange(2, 1, lastRow - 1, 18).getValues() : [];

  let targetRow = -1;
  for (let i = 0; i < allData.length; i++) {
    if (String(allData[i][0] || "").trim() === originalName) {
      targetRow = i + 2; // 시트 행 번호 (1-based, 헤더 1행)
      break;
    }
  }

  if (targetRow === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "고객을 찾을 수 없습니다: " + originalName })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // 고객DB 컬럼 구조:
  // A(1)=고객사명, B(2)=담당자, C(3)=직책, D(4)=연락처, E(5)=이메일
  // F(6)=주소, G(7)=AREA, H(8)=CITY, I(9)=가입출처
  // J(10)=현재상태, K(11)=영업단계, N(14)=광고상품
  const updates = [
    [1, data.customerName || originalName],  // A: 고객사명
    [2, data.manager || ""],                  // B: 담당자
    [3, data.position || ""],                 // C: 직책
    [4, data.phone || ""],                    // D: 연락처
    [5, data.email || ""],                    // E: 이메일
    [6, data.address || ""],                  // F: 주소
    [7, data.area || ""],                     // G: AREA
    [8, data.city || ""],                     // H: CITY
    [9, data.source || ""],                   // I: 가입출처
    [10, data.status || ""],                  // J: 현재상태
    [11, data.stage || ""],                   // K: 영업단계
    [14, data.adProduct || ""],               // N: 광고상품
    [18, new Date().toISOString().split("T")[0]], // R: 최종업데이트
  ];

  updates.forEach(([col, val]) => {
    dbSheet.getRange(targetRow, col).setValue(val);
  });

  Logger.log("✅ 고객 정보 업데이트 완료: " + originalName + " (행 " + targetRow + ")");

  return ContentService.createTextOutput(
    JSON.stringify({
      status: "success",
      message: "고객 정보 업데이트 완료",
      customerName: data.customerName || originalName,
      row: targetRow
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// 고객 DB 자동 업데이트
// GAS 편집기에서 buildCustomerDB() 를 실행하거나
// Sheet 메뉴 "씬짜오 CRM > 고객 DB 업데이트" 를 클릭하세요.
// ────────────────────────────────────────────────────────────

const CUSTOMER_DB_SHEET = "고객DB"; // 실제 탭 이름

// 업데이트할 컬럼 시작 위치 (기존 A-I 컬럼 보존, J부터 시작)
const DB_STATUS_COL   = 10; // J: 현재 상태
const DB_STAGE_COL    = 11; // K: 영업 단계
const DB_CONSULT_COL  = 12; // L: 최근 상담일
const DB_CNT_COL      = 13; // M: 상담 횟수
const DB_ADTYPE_COL   = 14; // N: 광고 상품
const DB_CONTRACT_COL = 15; // O: 계약금액($)
const DB_PAID_COL     = 16; // P: 수금액($)
const DB_UNPAID_COL   = 17; // Q: 미수금($)
const DB_UPDATED_COL  = 18; // R: 최종 업데이트

function buildCustomerDB() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 1) 필요한 탭 가져오기
  const dbSheet = ss.getSheetByName(CUSTOMER_DB_SHEET);
  if (!dbSheet) {
    Logger.log("❌ 고객 DB 탭이 없습니다. 탭 이름을 확인하세요: " + CUSTOMER_DB_SHEET);
    return;
  }

  const consultSheet   = ss.getSheetByName(CONSULT_SHEET);
  const contractSheet  = ss.getSheetByName(CONTRACT_SHEET);
  const paymentSheet   = ss.getSheetByName(PAYMENT_SHEET);

  // 2) 상담이력 읽기 (헤더 3행 제외)
  const consultData = consultSheet ? consultSheet.getDataRange().getValues() : [];
  // 계약관리 읽기
  const contractData = contractSheet ? contractSheet.getDataRange().getValues() : [];
  // 수금이력 읽기
  const paymentData = paymentSheet ? paymentSheet.getDataRange().getValues() : [];

  // 3) 고객 DB 헤더 행 쓰기 (J열 이후)
  const headerRow = dbSheet.getRange(1, DB_STATUS_COL, 1, 9);
  headerRow.setValues([[
    "현재상태", "영업단계", "최근상담일", "상담횟수", "광고상품",
    "계약금액($)", "수금액($)", "미수금($)", "최종업데이트"
  ]]);
  headerRow.setFontWeight("bold").setBackground("#E3F2FD");

  // 4) 고객 DB의 A열(고객사 이름) 읽기 (2행부터)
  const lastRow = dbSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("고객 DB 탭에 데이터가 없습니다.");
    return;
  }

  const customerNames = dbSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const today = new Date().toISOString().split("T")[0];

  // 5) 각 고객별로 상담/계약/수금 데이터 집계
  customerNames.forEach(([rawName], idx) => {
    const row = idx + 2; // 실제 Sheet 행 번호
    const name = String(rawName || "").trim();
    if (!name) return;

    // ── 상담이력에서 해당 고객 검색 ──
    const consultRows = consultData.filter(r =>
      String(r[CONSULT_COL.CUSTOMER] || "").trim() === name
    );

    let recentConsultDate = "";
    let consultCount = consultRows.length;
    let adType = "";
    let status = "상담중";

    if (consultRows.length > 0) {
      // 날짜 최신순 정렬
      consultRows.sort((a, b) => String(b[CONSULT_COL.DATE]).localeCompare(String(a[CONSULT_COL.DATE])));
      recentConsultDate = String(consultRows[0][CONSULT_COL.DATE] || "");
      adType = String(consultRows[0][CONSULT_COL.PRODUCT] || "");
      status = String(consultRows[0][CONSULT_COL.STATUS] || "상담중");
    }

    // ── 계약관리에서 해당 고객 검색 ──
    let contractTotal = 0;
    let contractReceived = 0;
    let salesStage = consultCount > 0 ? "상담" : "문의";

    const contractRows = contractData.filter(r =>
      String(r[CONTRACT_COL.CUSTOMER] || "").trim() === name
    );
    if (contractRows.length > 0) {
      contractRows.forEach(r => {
        contractTotal    += parseFloat(r[CONTRACT_COL.TOTAL]    || 0);
        contractReceived += parseFloat(r[CONTRACT_COL.RECEIVED] || 0);
      });
      salesStage = "계약";
      // 완납 여부
      if (contractTotal > 0 && contractReceived >= contractTotal) {
        salesStage = "완납";
      }
    }

    // ── 수금이력에서 해당 고객 검색 ──
    let totalPaid = 0;
    if (paymentSheet) {
      const payRows = paymentData.filter(r =>
        String(r[1] || "").trim() === name // 수금이력 B열 = 고객사
      );
      payRows.forEach(r => { totalPaid += parseFloat(r[4] || 0); }); // E열 = 수금액($)
    }

    const unpaid = Math.max(0, contractTotal - Math.max(contractReceived, totalPaid));

    // ── 고객 DB J-R열 업데이트 ──
    dbSheet.getRange(row, DB_STATUS_COL, 1, 9).setValues([[
      status,
      salesStage,
      recentConsultDate,
      consultCount,
      adType,
      contractTotal || "",
      totalPaid || contractReceived || "",
      unpaid || "",
      today
    ]]);
  });

  // 6) 완료 메시지
  Logger.log("✅ 고객 DB 업데이트 완료: " + (lastRow - 1) + "개 고객 상태 갱신");
}

// Sheet 상단 메뉴에 "씬짜오 CRM" 메뉴 추가
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("씬짜오 CRM")
    .addItem("📊 고객 DB 업데이트", "buildCustomerDB")
    .addToUi();
}
