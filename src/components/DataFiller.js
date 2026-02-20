import React, { useState } from "react";
import {
  transformAllAdData,
  logTransformSummary,
} from "../utils/dataTransformer";

/**
 * 두 번째 파일(고객관리 시트)을 채우기 위한 컴포넌트
 */
const DataFiller = () => {
  const [loading, setLoading] = useState(false);
  const [transformedData, setTransformedData] = useState([]);
  const [error, setError] = useState(null);

  // Google Sheets를 TSV로 가져오기
  const fetchSheetData = async (sheetId) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=tsv`;
    const response = await fetch(url);
    const text = await response.text();
    return text.split("\n").map((row) => row.split("\t"));
  };

  // 데이터 변환 실행
  const handleTransform = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. ADVERTISEMENT DETAILS 시트 읽기
      const adSheetId = "11W8Zf6OhO45L3F8Ulz63p3wCdF8PwJpsNlC18gSsLs0";
      const rawData = await fetchSheetData(adSheetId);
      
      console.log("원본 데이터:", rawData.slice(0, 10));

      // 2. 데이터 변환
      const transformed = transformAllAdData(rawData);
      setTransformedData(transformed);

      // 3. 변환 결과 요약 출력
      logTransformSummary(rawData, transformed);

      alert(
        `✅ 변환 완료!\n\n원본: ${rawData.length}행\n변환: ${transformed.length}행\n\n아래 "Google Sheets에 복사" 버튼을 클릭하세요.`,
      );
    } catch (err) {
      console.error("변환 중 오류 발생:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // TSV 형식으로 클립보드에 복사 (Google Sheets에 바로 붙여넣기 가능)
  const copyToClipboard = () => {
    if (transformedData.length === 0) {
      alert("먼저 데이터를 변환해주세요.");
      return;
    }

    // 헤더 생성
    const headers = Object.keys(transformedData[0]);
    const headerRow = headers.join("\t");

    // 데이터 행 생성 (TSV 형식)
    const dataRows = transformedData.map((row) => {
      return headers.map((header) => row[header] || "").join("\t");
    });

    const tsvContent = [headerRow, ...dataRows].join("\n");

    // 클립보드에 복사
    navigator.clipboard
      .writeText(tsvContent)
      .then(() => {
        alert(
          "✅ 클립보드에 복사되었습니다!\n\n다음 단계:\n1. 두 번째 파일(고객관리 시트) 열기\n2. A2 셀 선택 (헤더 아래)\n3. Ctrl+V로 붙여넣기",
        );
      })
      .catch((err) => {
        console.error("복사 실패:", err);
        alert("복사 실패. 수동으로 다운로드하세요.");
      });
  };

  // Google Apps Script 코드 생성
  const generateAppsScript = () => {
    if (transformedData.length === 0) {
      alert("먼저 데이터를 변환해주세요.");
      return;
    }

    const scriptCode = `
/**
 * Google Apps Script - 고객관리 시트 자동 채우기
 * 
 * 사용 방법:
 * 1. 두 번째 파일(고객관리 시트)을 엽니다
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 아래 코드를 붙여넣고 저장
 * 4. fillCustomerData 함수 실행
 */

function fillCustomerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  // 변환된 데이터 (여기에 실제 데이터가 들어갑니다)
  const data = ${JSON.stringify(transformedData, null, 2)};
  
  // 헤더 설정 (2행에 헤더가 있다고 가정)
  const headers = Object.keys(data[0]);
  
  // 데이터 행 생성
  const rows = data.map(row => headers.map(h => row[h] || ""));
  
  // 시트에 쓰기 (3행부터 시작 - 1행은 그룹 헤더, 2행은 컬럼 헤더)
  const startRow = 3;
  const startCol = 1; // A 컬럼
  
  sheet.getRange(startRow, startCol, rows.length, headers.length).setValues(rows);
  
  SpreadsheetApp.getUi().alert('✅ ' + rows.length + '개 행이 추가되었습니다!');
}
`;

    // 클립보드에 복사
    navigator.clipboard
      .writeText(scriptCode)
      .then(() => {
        alert(
          "✅ Apps Script 코드가 클립보드에 복사되었습니다!\n\n" +
            "다음 단계:\n" +
            "1. 두 번째 파일(고객관리 시트) 열기\n" +
            "2. 확장 프로그램 > Apps Script\n" +
            "3. 코드 붙여넣기 (Ctrl+V)\n" +
            "4. 저장 후 fillCustomerData 함수 실행",
        );
      })
      .catch((err) => {
        console.error("복사 실패:", err);
        // 텍스트 영역에 표시
        const textarea = document.createElement("textarea");
        textarea.value = scriptCode;
        textarea.style.cssText =
          "position:fixed;top:50%;left:50%;width:80%;height:80%;z-index:9999;";
        document.body.appendChild(textarea);
        textarea.select();
        alert(
          "아래 코드를 복사하세요 (Ctrl+C):\n\n" +
            "그 다음 이 팝업을 닫고 Apps Script에 붙여넣으세요.",
        );
      });
  };

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ color: "#d32f2f", borderBottom: "3px solid #d32f2f" }}>
        📝 고객관리 시트 채우기
      </h2>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        첫 번째 파일(ADVERTISEMENT DETAILS)을 읽어서 두 번째 파일(고객관리
        시트)에 채워넣습니다
      </p>

      {/* 단계별 가이드 */}
      <div
        style={{
          backgroundColor: "#e3f2fd",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "30px",
        }}
      >
        <h3 style={{ color: "#1976d2", marginTop: 0 }}>📋 사용 방법</h3>
        <ol style={{ lineHeight: "2", paddingLeft: "20px" }}>
          <li>
            <strong>1단계:</strong> "🔄 데이터 변환 시작" 버튼 클릭
          </li>
          <li>
            <strong>2단계:</strong> 변환 완료 후 방법 선택:
            <ul style={{ marginTop: "10px" }}>
              <li>
                <strong>방법 A (추천):</strong> "📋 Google Sheets에 복사" →
                시트에 붙여넣기
              </li>
              <li>
                <strong>방법 B (자동):</strong> "⚙️ Apps Script 생성" → 자동
                실행
              </li>
            </ul>
          </li>
        </ol>
      </div>

      {/* 버튼 영역 */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={handleTransform}
          disabled={loading}
          style={{
            padding: "15px 30px",
            fontSize: "16px",
            backgroundColor: loading ? "#ccc" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "변환 중..." : "🔄 데이터 변환 시작"}
        </button>

        {transformedData.length > 0 && (
          <>
            <button
              onClick={copyToClipboard}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📋 Google Sheets에 복사 (방법 A)
            </button>

            <button
              onClick={generateAppsScript}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ⚙️ Apps Script 생성 (방법 B)
            </button>
          </>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#ffebee",
            color: "#c62828",
            borderRadius: "5px",
            marginBottom: "20px",
          }}
        >
          <strong>오류:</strong> {error}
        </div>
      )}

      {/* 변환 결과 요약 */}
      {transformedData.length > 0 && (
        <div
          style={{
            backgroundColor: "#e8f5e9",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "30px",
          }}
        >
          <h3 style={{ color: "#2e7d32", marginTop: 0 }}>✅ 변환 완료!</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
            }}
          >
            <div>
              <strong>변환된 행 수:</strong> {transformedData.length}개
            </div>
            <div>
              <strong>컬럼 수:</strong>{" "}
              {Object.keys(transformedData[0]).length}개
            </div>
            <div>
              <strong>대형광고주:</strong>{" "}
              {
                transformedData.filter(
                  (row) => row["고객 유형"] === "대형광고주",
                ).length
              }
              개
            </div>
            <div>
              <strong>미수금 있는 고객:</strong>{" "}
              {
                transformedData.filter((row) => {
                  const unpaid = parseFloat(
                    row["누적 미수금"]?.replace(/[^0-9.-]/g, "") || "0",
                  );
                  return unpaid > 0;
                }).length
              }
              개
            </div>
          </div>
        </div>
      )}

      {/* 데이터 미리보기 */}
      {transformedData.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "10px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3>👀 데이터 미리보기 (처음 5개)</h3>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={tableHeaderStyle}>고객 유형</th>
                  <th style={tableHeaderStyle}>업체명</th>
                  <th style={tableHeaderStyle}>주소</th>
                  <th style={tableHeaderStyle}>전화번호</th>
                  <th style={tableHeaderStyle}>모바일</th>
                  <th style={tableHeaderStyle}>광고 사이즈</th>
                  <th style={tableHeaderStyle}>단가</th>
                  <th style={tableHeaderStyle}>시작 호수</th>
                  <th style={tableHeaderStyle}>종료 호수</th>
                  <th style={tableHeaderStyle}>총 계약 금액</th>
                  <th style={tableHeaderStyle}>누적 미수금</th>
                </tr>
              </thead>
              <tbody>
                {transformedData.slice(0, 5).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tableCellStyle}>{row["고객 유형"]}</td>
                    <td style={tableCellStyle}>{row["업체명"]}</td>
                    <td style={{ ...tableCellStyle, maxWidth: "200px" }}>
                      {row["주소"]}
                    </td>
                    <td style={tableCellStyle}>{row["전화번호"]}</td>
                    <td style={tableCellStyle}>{row["모바일"]}</td>
                    <td style={tableCellStyle}>{row["광고 사이즈"]}</td>
                    <td style={tableCellStyle}>{row["단가"]}</td>
                    <td style={tableCellStyle}>{row["시작 호수"]}</td>
                    <td style={tableCellStyle}>{row["종료 호수"]}</td>
                    <td style={tableCellStyle}>{row["총 계약 금액"]}</td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color:
                          parseFloat(
                            row["누적 미수금"]?.replace(/[^0-9.-]/g, "") || "0",
                          ) > 0
                            ? "red"
                            : "green",
                        fontWeight: "bold",
                      }}
                    >
                      {row["누적 미수금"]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#fff3e0",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ color: "#e65100", marginTop: 0 }}>💡 팁</h3>
        <ul style={{ lineHeight: "2" }}>
          <li>
            <strong>방법 A (간단):</strong> 클립보드 복사 후 시트에 바로
            붙여넣기
          </li>
          <li>
            <strong>방법 B (자동):</strong> Apps Script로 자동 실행 (한 번만
            설정)
          </li>
          <li>
            <strong>주의:</strong> 기존 데이터가 있다면 백업 후 진행하세요
          </li>
          <li>
            <strong>수동 입력 필요:</strong> 업종, 대표자, 담당자, 이메일 등은
            나중에 입력
          </li>
        </ul>
      </div>
    </div>
  );
};

// 테이블 스타일
const tableHeaderStyle = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "2px solid #ddd",
  fontWeight: "bold",
  backgroundColor: "#f5f5f5",
  whiteSpace: "nowrap",
};

const tableCellStyle = {
  padding: "8px",
  textAlign: "left",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "150px",
};

export default DataFiller;
