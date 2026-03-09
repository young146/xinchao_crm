/**
 * Google Apps Script - 씬짜오베트남 광고 영업 통합 시스템 (v4)
 *
 * 📌 대상 Sheet: 광고 관리 통합
 *   ID: 1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA
 *
 * 📌 배포 URL (기존과 동일):
 *   https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec
 *
 * 📌 v3 → v4 변경 사항:
 *   온라인/오프라인/앱 폼 접수 시, 광고접수인덱스-2026 시트에도 동시 저장
 *   → CRM 영업 파이프라인에 🆕 신규 문의로 자동 표시
 *
 * 📌 action 종류:
 *   "CONSULT"         → 상담이력 탭에 신규 상담 접수 추가
 *   "PAYMENT"         → 수금이력 탭에 수금 추가 + 계약관리 수금액 업데이트
 *   "UPDATE_CUSTOMER" → 고객DB 탭 특정 고객 정보 업데이트
 */

const SHEET_ID       = "1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA"; // 광고 관리 통합
const SETTINGS_SHEET = "설정";
const CONSULT_SHEET  = "상담이력";
const CONTRACT_SHEET = "계약관리";
const PAYMENT_SHEET  = "수금이력";

// 📌 영업 파이프라인 연동용 (광고접수인덱스-2026 시트)
const INDEX_SHEET_ID   = "1gbtZ7jTsYvN7IQ8gnpMNg2TVJHu-lo9o3UWIvJ7fsPo";
const INDEX_SHEET_NAME = "2026";

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
  const newNo    = lastRow - 2;

  const methodLabel = {
    "APP": "앱 문의", "ONLINE": "온라인폼", "OFFLINE": "전화/면담", "CRM": "CRM 직접입력"
  }[data.source] || data.contactMethod || "기타";

  const row = new Array(21).fill("");
  row[CONSULT_COL.NO]        = newNo;
  row[CONSULT_COL.DATE]      = data.date || today;
  row[CONSULT_COL.CUSTOMER]  = data.customerName || "";
  row[CONSULT_COL.CHARGER]   = data.contact || data.charger || "";
  row[CONSULT_COL.TITLE]     = data.position || "";
  row[CONSULT_COL.PHONE]     = data.phone || "";
  row[CONSULT_COL.EMAIL]     = data.email || "";
  row[CONSULT_COL.METHOD]    = methodLabel;
  row[CONSULT_COL.CONTENT]   = data.remark || "";
  row[CONSULT_COL.NEXT_STEP] = data.nextActionText || "";
  row[CONSULT_COL.NEXT_DATE] = data.nextActionDate || "";
  row[CONSULT_COL.STATUS]    = "진행중";
  row[CONSULT_COL.PRODUCT]   = data.adType || "";
  row[CONSULT_COL.PRICE]     = data.size || "";
  row[CONSULT_COL.MEMO]      = data.salesman ? "담당: " + data.salesman : "";

  sheet.appendRow(row);
  sheet.getRange(newRow, 1, 1, 21).setBackground("#fff9e6");

  // ✅ [v4 추가] 온라인/오프라인/앱 폼 접수 → 영업 파이프라인 인덱스에도 저장
  const isFormSource = ["APP", "ONLINE", "OFFLINE"].includes(data.source);
  if (isFormSource) {
    try {
      appendToIndexSheet(data, methodLabel);
      Logger.log("✅ 파이프라인 인덱스 저장 완료");
    } catch(e) {
      Logger.log("⚠️ 파이프라인 인덱스 저장 실패(비중요): " + e.message);
    }
  }

  // 🔔 온라인/앱 문의 → Firestore onlineAlerts 즉시 저장
  const isOnline = data.source === "ONLINE" || data.source === "APP" ||
                   (data.contactMethod || "").toLowerCase().includes("온라인");
  if (isOnline) {
    try {
      writeToFirestore({
        customer:      data.customerName || "",
        phone:         data.phone || "",
        date:          data.date || today,
        contactMethod: methodLabel,
        createdAt:     new Date().toISOString(),
      });
    } catch(e) { Logger.log("Firestore 저장 실패(비중요): " + e.message); }
  }

  try { buildCustomerDB(); } catch(e) { Logger.log("DB 갱신 실패(non-critical): " + e.message); }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "상담 접수 완료", row: newRow })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// [v4 신규] 영업 파이프라인 인덱스 시트에 동시 저장
// 광고접수인덱스-2026 시트의 2026 탭
// 컬럼: A=No, B=Date, C=Customer, D=Charger, E=Position,
//        F=Phone, G=Email, H=AdType, I=Size, J=StartDate,
//        K=Vol, L=Term, M=(빈칸), N=Remark, O=접수경로
// ────────────────────────────────────────────────────────────
function appendToIndexSheet(data, methodLabel) {
  const ss = SpreadsheetApp.openById(INDEX_SHEET_ID);
  const sheet = ss.getSheetByName(INDEX_SHEET_NAME);
  if (!sheet) {
    Logger.log("⚠️ 인덱스 시트 탭 없음: " + INDEX_SHEET_NAME);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const label = methodLabel || ({
    "APP": "앱 문의", "ONLINE": "온라인 폼", "OFFLINE": "오프라인 폼"
  }[data.source] || "기타");

  sheet.appendRow([
    "",                              // A: No (수동 관리)
    data.date || today,              // B: Date
    data.customerName || "",         // C: Customer
    data.contact || data.charger || "", // D: Charger
    data.position || "",             // E: Position
    data.phone || "",                // F: Phone No
    data.email || "",                // G: E-Mail
    data.adType || "",               // H: AD Type
    data.size || "",                 // I: Size
    data.startDate || "",            // J: Start Date
    data.vol || "",                  // K: Vol
    data.term || "",                 // L: Term
    "",                              // M: (빈칸)
    data.remark || "",               // N: Remark
    label,                           // O: 접수경로 ("온라인 폼" / "오프라인 폼" / "앱 문의")
  ]);

  // 새 행 파란색 하이라이트 (파이프라인에서 🆕 감지용)
  sheet.getRange(sheet.getLastRow(), 1, 1, 15).setBackground("#e3f2fd");
}

// ────────────────────────────────────────────────────────────
// 수금 입력 → 수금이력 탭 + 계약관리 탭 업데이트
// ────────────────────────────────────────────────────────────
function handlePayment(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let paySheet = ss.getSheetByName(PAYMENT_SHEET);
  if (!paySheet) {
    paySheet = ss.insertSheet(PAYMENT_SHEET);
    paySheet.appendRow(["No", "수금일", "고객사", "계약ID", "수금액($)", "수금방법", "비고", "등록일시"]);
    paySheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#E8F5E9");
  }

  const today    = new Date().toISOString().split("T")[0];
  const newPayNo = paySheet.getLastRow();
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
  paySheet.getRange(paySheet.getLastRow(), 1, 1, 8).setBackground("#C8E6C9");

  let updated = false;
  const contractSheet = ss.getSheetByName(CONTRACT_SHEET);
  if (contractSheet && data.customerName) {
    const contractData = contractSheet.getDataRange().getValues();
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

  try { buildCustomerDB(); } catch(e) { Logger.log("DB 갱신 실패(non-critical): " + e.message); }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "수금 기록 완료", contractUpdated: updated, amount })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// GET 테스트
// ────────────────────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <h1>✅ 씬짜오 광고 영업 시스템 작동 중 (v4)</h1>
    <p><strong>대상 Sheet:</strong> 광고 관리 통합</p>
    <p><strong>상담이력 탭:</strong> ${CONSULT_SHEET}</p>
    <p><strong>수금이력 탭:</strong> ${PAYMENT_SHEET}</p>
    <p><strong>파이프라인 인덱스:</strong> 광고접수인덱스-2026 → ${INDEX_SHEET_NAME}탭</p>
    <p><strong>action 종류:</strong> CONSULT (기본) | PAYMENT (수금) | UPDATE_CUSTOMER</p>
  `);
}

// ────────────────────────────────────────────────────────────
// 테스트 함수
// ────────────────────────────────────────────────────────────
function testConsult() {
  doPost({ postData: { contents: JSON.stringify({
    action: "CONSULT",
    date: new Date().toISOString().split("T")[0],
    customerName: "[TEST] 테스트 Company",
    contact: "홍길동", position: "대표",
    phone: "090-000-0000", email: "test@test.com",
    adType: "inside", remark: "테스트 접수",
    source: "ONLINE"  // 온라인폼으로 테스트 → 파이프라인에도 저장됨
  })}});
  Logger.log("테스트 완료 - 상담이력 탭 + 광고접수인덱스-2026 탭 확인");
}

function testPayment() {
  doPost({ postData: { contents: JSON.stringify({
    action: "PAYMENT",
    customerName: "[TEST] 테스트 Company",
    date: new Date().toISOString().split("T")[0],
    amount: 500, method: "이체", memo: "테스트 수금"
  })}});
  Logger.log("수금 테스트 완료");
}

// ────────────────────────────────────────────────────────────
// CRM 앱에서 고객 정보 수정
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
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow === -1) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "고객을 찾을 수 없습니다: " + originalName })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const updates = [
    [1, data.customerName || originalName],
    [2, data.manager || ""],
    [3, data.position || ""],
    [4, data.phone || ""],
    [5, data.email || ""],
    [6, data.address || ""],
    [7, data.area || ""],
    [8, data.city || ""],
    [9, data.source || ""],
    [10, data.status || ""],
    [11, data.stage || ""],
    [14, data.adProduct || ""],
    [18, new Date().toISOString().split("T")[0]],
  ];
  updates.forEach(([col, val]) => dbSheet.getRange(targetRow, col).setValue(val));

  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "고객 정보 업데이트 완료", row: targetRow })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
// 고객 DB 자동 업데이트
// ────────────────────────────────────────────────────────────
const CUSTOMER_DB_SHEET = "고객DB";
const DB_STATUS_COL   = 10;
const DB_STAGE_COL    = 11;
const DB_CONSULT_COL  = 12;
const DB_CNT_COL      = 13;
const DB_ADTYPE_COL   = 14;
const DB_CONTRACT_COL = 15;
const DB_PAID_COL     = 16;
const DB_UNPAID_COL   = 17;
const DB_UPDATED_COL  = 18;

function buildCustomerDB() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const dbSheet       = ss.getSheetByName(CUSTOMER_DB_SHEET);
  const consultSheet  = ss.getSheetByName(CONSULT_SHEET);
  const contractSheet = ss.getSheetByName(CONTRACT_SHEET);
  const paymentSheet  = ss.getSheetByName(PAYMENT_SHEET);

  if (!dbSheet)      { Logger.log("❌ 고객DB 탭 없음"); return; }
  if (!consultSheet) { Logger.log("❌ 상담이력 탭 없음"); return; }

  const consultAll  = consultSheet.getDataRange().getValues();
  const contractAll = contractSheet ? contractSheet.getDataRange().getValues() : [];
  const paymentAll  = paymentSheet  ? paymentSheet.getDataRange().getValues()  : [];

  const consultData = consultAll.slice(3).filter(r => {
    const name = String(r[CONSULT_COL.CUSTOMER] || "").trim();
    return name.length > 0 && name !== "고객사";
  });

  const dbLastRow = dbSheet.getLastRow();
  let existingNames = new Set();
  let dbLastDataRow = 1;
  if (dbLastRow >= 2) {
    const dbNames = dbSheet.getRange(2, 1, dbLastRow - 1, 1).getValues();
    dbNames.forEach(([n]) => {
      const normalized = String(n).trim().replace(/\s+/g, " ").toLowerCase();
      if (normalized) existingNames.add(normalized);
    });
    dbLastDataRow = dbLastRow;
  }

  const customerMap = new Map();
  consultData.forEach(r => {
    const rawName = String(r[CONSULT_COL.CUSTOMER] || "").trim().replace(/\s+/g, " ");
    if (!rawName) return;
    const date = String(r[CONSULT_COL.DATE] || "");
    const existing = customerMap.get(rawName);
    if (!existing || date > (existing.latestDate || "")) {
      customerMap.set(rawName, {
        contact:    String(r[CONSULT_COL.CHARGER] || ""),
        position:   String(r[CONSULT_COL.TITLE]   || ""),
        phone:      String(r[CONSULT_COL.PHONE]    || ""),
        email:      String(r[CONSULT_COL.EMAIL]    || ""),
        adType:     String(r[CONSULT_COL.PRODUCT]  || ""),
        source:     String(r[CONSULT_COL.METHOD]   || ""),
        latestDate: date,
      });
    }
  });

  let addedCount = 0;
  customerMap.forEach((info, name) => {
    const normalized = name.toLowerCase();
    if (!existingNames.has(normalized)) {
      dbLastDataRow++;
      dbSheet.getRange(dbLastDataRow, 1, 1, 9).setValues([[
        name, info.contact, info.position, info.phone, info.email,
        "", "", "", info.source,
      ]]);
      existingNames.add(normalized);
      addedCount++;
    }
  });

  dbSheet.getRange(1, DB_STATUS_COL, 1, 9).setValues([[
    "현재상태", "영업단계", "최근상담일", "상담횟수", "광고상품",
    "계약금액($)", "수금액($)", "미수금($)", "최종업데이트"
  ]]).setFontWeight("bold").setBackground("#E3F2FD");

  const finalLastRow = dbSheet.getLastRow();
  if (finalLastRow < 2) return;

  const allDbNames = dbSheet.getRange(2, 1, finalLastRow - 1, 1).getValues();
  const today = new Date().toISOString().split("T")[0];

  allDbNames.forEach(([rawName], idx) => {
    const row  = idx + 2;
    const name = String(rawName || "").trim();
    if (!name) return;

    const consultRows = consultData.filter(r =>
      String(r[CONSULT_COL.CUSTOMER] || "").trim() === name
    );
    let recentDate = "", adType = "", status = "문의";
    const consultCount = consultRows.length;

    if (consultRows.length > 0) {
      consultRows.sort((a, b) =>
        String(b[CONSULT_COL.DATE]).localeCompare(String(a[CONSULT_COL.DATE]))
      );
      recentDate = String(consultRows[0][CONSULT_COL.DATE] || "");
      adType     = String(consultRows[0][CONSULT_COL.PRODUCT] || "");
      status     = String(consultRows[0][CONSULT_COL.STATUS] || "상담중");
      if (consultCount > 0 && status === "문의") status = "상담중";
    }

    const contractRows = contractAll.filter(r =>
      String(r[CONTRACT_COL.CUSTOMER] || "").trim() === name
    );
    let contractTotal = 0, contractReceived = 0;
    let salesStage = consultCount > 0 ? "상담" : "문의";

    if (contractRows.length > 0) {
      contractRows.forEach(r => {
        contractTotal    += parseFloat(r[CONTRACT_COL.TOTAL]    || 0);
        contractReceived += parseFloat(r[CONTRACT_COL.RECEIVED] || 0);
      });
      salesStage = "계약";
      if (contractTotal > 0 && contractReceived >= contractTotal) salesStage = "완납";
    }

    let totalPaid = 0;
    if (paymentSheet) {
      paymentAll.filter(r => String(r[1] || "").trim() === name)
                .forEach(r => { totalPaid += parseFloat(r[4] || 0); });
    }
    const unpaid = Math.max(0, contractTotal - Math.max(contractReceived, totalPaid));

    dbSheet.getRange(row, DB_STATUS_COL, 1, 9).setValues([[
      status, salesStage, recentDate, consultCount, adType,
      contractTotal || "", totalPaid || contractReceived || "", unpaid || "", today
    ]]);
  });

  SpreadsheetApp.flush();
  Logger.log("✅ 고객DB 업데이트 완료 – 총 " + (finalLastRow - 1) + "명 (신규 " + addedCount + "명)");
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("씬짜오 CRM")
    .addItem("📊 고객 DB 업데이트", "buildCustomerDB")
    .addToUi();
}

// ────────────────────────────────────────────────────────────
// Firestore REST API: onlineAlerts 컬렉션에 문서 추가
// ────────────────────────────────────────────────────────────
function writeToFirestore(doc) {
  const PROJECT_ID = "chaovietnam-login";
  const API_KEY    = "AIzaSyB5av2Ye0MqCb_vQMJkj9fw5HMSGnwqnlw";
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
              "/databases/(default)/documents/onlineAlerts?key=" + API_KEY;

  const payload = {
    fields: {
      customer:      { stringValue: doc.customer      || "" },
      phone:         { stringValue: doc.phone         || "" },
      date:          { stringValue: doc.date          || "" },
      contactMethod: { stringValue: doc.contactMethod || "" },
      createdAt:     { stringValue: doc.createdAt     || new Date().toISOString() },
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  Logger.log("Firestore 저장: " + res.getResponseCode() + " " + res.getContentText().slice(0, 120));
}
