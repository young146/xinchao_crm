/**
 * Google Apps Script - 광고 문의 통합 접수 시스템 (v2)
 *
 * 📌 역할: 앱/웹폼/CRM 3곳에서 들어오는 문의를 모두 광고접수인덱스-2026에 저장
 *
 * 배포 정보:
 *   배포 ID: AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ
 *   URL: https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec
 *
 * 연결된 파일:
 *   - 앱:    components/AdInquiryModal.js (GAS_URL)
 *   - 웹폼:  xinchao_crm/광고문의폼_온라인.html (GOOGLE_APPS_SCRIPT_URL)
 *   - CRM:   src/components/AddCustomerForm.js (GAS_URL)
 *
 * 대상 시트:
 *   광고접수인덱스-2026 (1gbtZ7jTsYvN7IQ8gnpMNg2TVJHu-lo9o3UWIvJ7fsPo)
 *
 * 컬럼 구조 (A~O):
 *   A: No | B: Date | C: Customer | D: Charger | E: Position
 *   F: Phone No | G: E-Mail | H: AD Type | I: Size
 *   J: Start Date | K: Vol | L: Term | M: (빈칸) | N: Remark | O: Follow Up
 */

const SHEET_ID = "1gbtZ7jTsYvN7IQ8gnpMNg2TVJHu-lo9o3UWIvJ7fsPo";
const SHEET_NAME = "광고접수인덱스-2026";

/**
 * POST 요청 처리
 * source 필드로 경로 구분: "APP" | "ONLINE" | "OFFLINE" | "CRM"
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log("받은 데이터:", data);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("시트를 찾을 수 없습니다: " + SHEET_NAME);

    const today = new Date().toISOString().split("T")[0];

    sheet.appendRow([
      "",                                                   // A: No (수동 관리)
      data.date || today,                                   // B: Date
      data.customerName || "",                              // C: Customer
      data.contact || data.charger || "",                   // D: Charger 담당자
      data.position || "",                                  // E: Position 직책
      data.phone || "",                                     // F: Phone No
      data.email || "",                                     // G: E-Mail
      data.adType || "",                                    // H: AD Type
      data.size || "",                                      // I: Size
      data.startDate || "",                                 // J: Start Date
      data.vol || "",                                       // K: Vol
      data.term || "",                                      // L: Term
      "",                                                   // M: (빈칸)
      data.remark || "",                                    // N: Remark
      sourceLabel(data.source, data.contactMethod),        // O: Follow Up (접수 경로)
    ]);

    // 새 행 하이라이트
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 15).setBackground("#fff9e6");

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", message: "접수 완료", row: lastRow })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("에러:", error);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 접수 경로 레이블 생성
 */
function sourceLabel(source, contactMethod) {
  const map = {
    "APP": "앱 문의",
    "ONLINE": "온라인 폼",
    "OFFLINE": "오프라인 폼",
    "CRM": "CRM 수동 입력",
  };
  return map[source] || contactMethod || "기타";
}

/**
 * GET 테스트
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <h1>✅ 광고 문의 접수 시스템 작동 중</h1>
    <p><strong>대상 시트:</strong> ${SHEET_NAME}</p>
    <p><strong>Sheet ID:</strong> ${SHEET_ID}</p>
  `);
}

/**
 * 테스트 함수 (GAS 편집기에서 직접 실행)
 */
function testInquiry() {
  const testData = {
    date: new Date().toISOString().split("T")[0],
    customerName: "[TEST] 테스트 Company",
    contact: "홍길동",
    position: "대표",
    phone: "090-000-0000",
    email: "test@test.com",
    adType: "inside",
    size: "FC",
    remark: "테스트 데이터 - 확인 후 삭제",
    source: "APP",
  };
  doPost({ postData: { contents: JSON.stringify(testData) } });
  Logger.log("테스트 완료 - 광고접수인덱스-2026 시트를 확인하세요");
}
