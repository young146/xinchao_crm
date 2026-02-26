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
