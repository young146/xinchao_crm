import React, { useState } from "react";
import {
  transformAllAdData,
  exportToCSV,
  logTransformSummary,
} from "../utils/dataTransformer";

/**
 * 데이터 변환 컴포넌트
 * ADVERTISEMENT DETAILS 시트를 읽어서 고객관리 시트 형식으로 변환
 */
const DataTransformer = () => {
  const [loading, setLoading] = useState(false);
  const [originalData, setOriginalData] = useState([]);
  const [transformedData, setTransformedData] = useState([]);
  const [error, setError] = useState(null);

  // Google Sheets를 CSV로 가져오기
  const fetchSheetData = async (sheetId) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(url);
    const text = await response.text();
    return text.split("\n").map((row) => row.split(","));
  };

  // 데이터 변환 실행
  const handleTransform = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. ADVERTISEMENT DETAILS 시트 읽기
      const adSheetId = "11W8Zf6OhO45L3F8Ulz63p3wCdF8PwJpsNlC18gSsLs0";
      const rawData = await fetchSheetData(adSheetId);
      setOriginalData(rawData);

      // 2. 데이터 변환
      const transformed = transformAllAdData(rawData);
      setTransformedData(transformed);

      // 3. 변환 결과 요약 출력
      logTransformSummary(rawData, transformed);

      alert(
        `변환 완료!\n원본: ${rawData.length}행\n변환: ${transformed.length}행`,
      );
    } catch (err) {
      console.error("변환 중 오류 발생:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CSV 파일로 다운로드
  const handleDownload = () => {
    if (transformedData.length === 0) {
      alert("먼저 데이터를 변환해주세요.");
      return;
    }

    const csvContent = exportToCSV(transformedData);
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    }); // UTF-8 BOM 추가
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `고객관리시트_변환_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // JSON으로 다운로드 (디버깅용)
  const handleDownloadJSON = () => {
    if (transformedData.length === 0) {
      alert("먼저 데이터를 변환해주세요.");
      return;
    }

    const jsonContent = JSON.stringify(transformedData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `고객관리시트_변환_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
        📊 데이터 변환 도구
      </h2>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        ADVERTISEMENT DETAILS 시트 → 고객관리 시트 형식으로 변환
      </p>

      {/* 변환 버튼 */}
      <div style={{ marginBottom: "20px" }}>
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
            marginRight: "10px",
          }}
        >
          {loading ? "변환 중..." : "🔄 데이터 변환 시작"}
        </button>

        {transformedData.length > 0 && (
          <>
            <button
              onClick={handleDownload}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              📥 CSV 다운로드
            </button>

            <button
              onClick={handleDownloadJSON}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              📥 JSON 다운로드 (디버깅용)
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
          <h3 style={{ color: "#2e7d32", marginTop: 0 }}>✅ 변환 완료</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <strong>원본 행 수:</strong> {originalData.length}
            </div>
            <div>
              <strong>변환된 행 수:</strong> {transformedData.length}
            </div>
            <div>
              <strong>미수금 있는 고객:</strong>{" "}
              {
                transformedData.filter((row) =>
                  row["누적 미수금"]?.includes("$") &&
                  parseFloat(row["누적 미수금"].replace(/[^0-9.-]/g, "")) > 0
                ).length
              }
              개
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
          </div>
        </div>
      )}

      {/* 변환된 데이터 미리보기 */}
      {transformedData.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "10px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3>📋 변환된 데이터 미리보기 (처음 10개)</h3>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={tableHeaderStyle}>고객 유형</th>
                  <th style={tableHeaderStyle}>업체명</th>
                  <th style={tableHeaderStyle}>주소</th>
                  <th style={tableHeaderStyle}>전화번호</th>
                  <th style={tableHeaderStyle}>광고 사이즈</th>
                  <th style={tableHeaderStyle}>단가</th>
                  <th style={tableHeaderStyle}>시작 호수</th>
                  <th style={tableHeaderStyle}>종료 호수</th>
                  <th style={tableHeaderStyle}>총 계약 금액</th>
                  <th style={tableHeaderStyle}>누적 미수금</th>
                  <th style={tableHeaderStyle}>비고</th>
                </tr>
              </thead>
              <tbody>
                {transformedData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tableCellStyle}>{row["고객 유형"]}</td>
                    <td style={tableCellStyle}>{row["업체명"]}</td>
                    <td style={{ ...tableCellStyle, maxWidth: "200px" }}>
                      {row["주소"]}
                    </td>
                    <td style={tableCellStyle}>{row["전화번호"]}</td>
                    <td style={tableCellStyle}>{row["광고 사이즈"]}</td>
                    <td style={tableCellStyle}>{row["단가"]}</td>
                    <td style={tableCellStyle}>{row["시작 호수"]}</td>
                    <td style={tableCellStyle}>{row["종료 호수"]}</td>
                    <td style={tableCellStyle}>{row["총 계약 금액"]}</td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color:
                          row["누적 미수금"] &&
                          parseFloat(
                            row["누적 미수금"].replace(/[^0-9.-]/g, ""),
                          ) > 0
                            ? "red"
                            : "green",
                        fontWeight: "bold",
                      }}
                    >
                      {row["누적 미수금"]}
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: "150px" }}>
                      {row["최종 상담 기록"]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 안내 사항 */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#fff3e0",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ color: "#e65100", marginTop: 0 }}>⚠️ 안내 사항</h3>
        <ul style={{ lineHeight: "2" }}>
          <li>
            <strong>자동 변환되는 항목:</strong> 업체명, 주소, 전화번호, 광고
            사이즈, 가격, 호수, 미수금
          </li>
          <li>
            <strong>수동 입력 필요:</strong> 업종, 대표자, 담당자, 이메일,
            카카오톡, 온라인 관련 정보
          </li>
          <li>
            <strong>Vol 컬럼:</strong> 계약 호수 범위(시작~종료)에 따라 자동으로
            채워집니다
          </li>
          <li>
            <strong>CSV 파일:</strong> 다운로드 후 Excel 또는 Google Sheets에
            임포트하세요
          </li>
          <li>
            <strong>데이터 검증:</strong> 변환 후 가격, 호수, 미수금 등 숫자 데이터를
            확인하세요
          </li>
        </ul>
      </div>
    </div>
  );
};

// 테이블 스타일
const tableHeaderStyle = {
  padding: "12px 8px",
  textAlign: "left",
  borderBottom: "2px solid #ddd",
  fontWeight: "bold",
  backgroundColor: "#f5f5f5",
};

const tableCellStyle = {
  padding: "10px 8px",
  textAlign: "left",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export default DataTransformer;
