import React, { useState, useEffect } from "react";
import DataTransformer from "./components/DataTransformer";
import DataFiller from "./components/DataFiller";
import CustomerCard from "./components/CustomerCard";
import CustomerDB from "./components/CustomerDB";
import AddCustomerForm from "./components/AddCustomerForm";
import VolumeSchedule from "./components/VolumeSchedule";
import VolumeScheduleEditor from "./components/VolumeScheduleEditor";
import LeadPipeline from "./components/LeadPipeline";
import { getContractStatus, getPaymentStatus, CURRENT_VOLUME } from "./utils/contractStatus";
import { parseVolumeRange, parsePrice } from "./utils/dataTransformer";

const Dashboard = () => {
  const [inquiries, setInquiries] = useState([]);
  const [activeAds, setActiveAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard', 'filler', 'transformer', 'schedule', 'schedule-edit', 'pipeline', 'customerdb'
  const [selectedDBCustomer, setSelectedDBCustomer] = useState(null); // 고객명단 탭에서 선택된 고객
  const [searchTerm, setSearchTerm] = useState(""); // 검색어
  const [selectedCustomer, setSelectedCustomer] = useState(null); // 선택된 고객
  const [showAddForm, setShowAddForm] = useState(false); // 새 고객 추가 폼 표시 여부
  const [newInquiryCount, setNewInquiryCount] = useState(0); // 오늘 신규 문의 건수
  const [showAlarmDismissed, setShowAlarmDismissed] = useState(false); // 알람 닫기

  // 구글 시트를 TSV 형태로 읽어오는 함수 (쉼표 문제 해결)
  const fetchSheetData = async (sheetId) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=tsv`;
    const response = await fetch(url);
    const text = await response.text();
    return text.split("\n").map((row) => row.split("\t"));
  };

  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 1. 광고접수인덱스 시트 읽기
        const inquiryData = await fetchSheetData(
          "1gbtZ7jTsYvN7IQ8gnpMNg2TVJHu-lo9o3UWIvJ7fsPo",
        );
        const rows = inquiryData.slice(1); // 헤더 제외
        setInquiries(rows);

        // 오늘 신규 문의 건수 계산 (A컬럼=접수번호, B컬럼=접수일)
        const todayStr = new Date().toISOString().split("T")[0]; // "2026-02-20"
        const todayCount = rows.filter(
          (row) => row[1] && row[1].trim() === todayStr
        ).length;
        setNewInquiryCount(todayCount);

        // 2. 정산 상세 시트 읽기 (ADVERTISEMENT DETAILS)
        const adData = await fetchSheetData(
          "11W8Zf6OhO45L3F8Ulz63p3wCdF8PwJpsNlC18gSsLs0",
        );

        console.log("원본 데이터 샘플 (처음 10행):", adData.slice(0, 10));

        // 헤더/타이틀 행 제외하고 실제 데이터만 필터링
        // 6번째 행부터 시작, 업체명(B컬럼, index 1)이 있는 행만 추출
        const filteredData = adData
          .slice(6) // 처음 6행은 헤더
          .filter(row => row[1] && row[1].trim() !== "" && row[1] !== "CUSTOMER"); // 업체명이 있는 행만

        console.log("필터링된 데이터 개수:", filteredData.length);
        console.log("필터링된 데이터 샘플 (처음 3개):", filteredData.slice(0, 3));

        setActiveAds(filteredData);

        setLoading(false);
      } catch (e) {
        console.error("데이터 로딩 실패", e);
        setLoading(false);
      }
    };

    loadAllData();

    // 발행 일정 업데이트 이벤트 - 페이지 새로고침 없이 리렌더만 유도
    // (VolumeScheduleEditor/VolumeSchedule 컴포넌트가 자체적으로 이벤트를 받아 상태 업데이트)
    const handleScheduleUpdate = () => {
      // reload 제거: 현재 탭에 그대로 남아있도록 함
    };

    window.addEventListener("volumeScheduleUpdated", handleScheduleUpdate);

    return () => {
      window.removeEventListener("volumeScheduleUpdated", handleScheduleUpdate);
    };
  }, []);

  if (loading)
    return (
      <div style={{ padding: "50px" }}>
        데이터를 실시간으로 불러오는 중입니다...
      </div>
    );

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "sans-serif",
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
      }}
    >
      <header
        style={{ borderBottom: "3px solid #d32f2f", marginBottom: "20px" }}
      >
        <h1 style={{ color: "#d32f2f" }}>
          Xinchao Vietnam 영업 통합 관제탑 (2026)
        </h1>

        {/* 🔔 신규 광고 문의 알람 배너 */}
        {newInquiryCount > 0 && !showAlarmDismissed && (
          <div
            style={{
              background: "linear-gradient(135deg, #d32f2f, #ff5722)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "8px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(211,47,47,0.35)",
              cursor: "pointer",
            }}
            onClick={() => {
              setActiveTab("pipeline");
              setShowAlarmDismissed(true);
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>🔔</span>
              <div>
                <strong style={{ fontSize: "16px" }}>
                  오늘 새 광고 문의 {newInquiryCount}건
                </strong>
                <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "2px" }}>
                  클릭하면 영업 파이프라인에서 확인 가능합니다
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span
                style={{
                  background: "rgba(255,255,255,0.25)",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                확인하기 →
              </span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: "20px",
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAlarmDismissed(true);
                }}
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* 탭 네비게이션 */}
        <div style={{ display: "flex", gap: "10px", marginTop: "15px", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("dashboard")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "dashboard" ? "#d32f2f" : "#fff",
              color: activeTab === "dashboard" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "dashboard" ? "bold" : "normal",
            }}
          >
            📊 고객 관리
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "pipeline" ? "#d32f2f" : "#fff",
              color: activeTab === "pipeline" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "pipeline" ? "bold" : "normal",
            }}
          >
            💼 영업 파이프라인
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "schedule" ? "#d32f2f" : "#fff",
              color: activeTab === "schedule" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "schedule" ? "bold" : "normal",
            }}
          >
            📅 발행 일정
          </button>
          <button
            onClick={() => setActiveTab("customerdb")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "customerdb" ? "#d32f2f" : "#fff",
              color: activeTab === "customerdb" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "customerdb" ? "bold" : "normal",
            }}
          >
            👥 고객명단
          </button>
          <button
            onClick={() => setActiveTab("filler")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "filler" ? "#d32f2f" : "#fff",
              color: activeTab === "filler" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "filler" ? "bold" : "normal",
            }}
          >
            📝 시트 채우기
          </button>
          <button
            onClick={() => setActiveTab("transformer")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: activeTab === "transformer" ? "#d32f2f" : "#fff",
              color: activeTab === "transformer" ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px 5px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === "transformer" ? "bold" : "normal",
            }}
          >
            🔄 CSV 다운로드
          </button>
        </div>
      </header>

      {/* 탭 컨텐츠 */}
      {activeTab === "pipeline" && <LeadPipeline />}

      {/* 고객명단 탭 */}
      {activeTab === "customerdb" && (
        <>
          <CustomerDB
            onSelectCustomer={(row) => setSelectedDBCustomer(row)}
          />
          {selectedDBCustomer && (
            <CustomerCard
              customer={selectedDBCustomer}
              mode="sheet"
              onClose={() => setSelectedDBCustomer(null)}
              onSave={() => {
                setSelectedDBCustomer(null);
              }}
            />
          )}
        </>
      )}

      {activeTab === "schedule" && (
        <div>
          <div style={{ textAlign: "right", marginBottom: "20px", padding: "0 30px" }}>
            <button
              onClick={() => setActiveTab("schedule-edit")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ⚙️ 일정 편집 모드
            </button>
          </div>
          <VolumeSchedule />
        </div>
      )}

      {activeTab === "schedule-edit" && (
        <div>
          <div style={{ textAlign: "right", marginBottom: "20px", padding: "0 30px" }}>
            <button
              onClick={() => setActiveTab("schedule")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#2196F3",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ← 보기 모드로 돌아가기
            </button>
          </div>
          <VolumeScheduleEditor />
        </div>
      )}

      {activeTab === "filler" && <DataFiller />}

      {activeTab === "dashboard" && (<>
        {/* 재계약 알림 패널 - 발행호 기준 4호 이내 만료 또는 만료+미수금 고객 */}
        <div style={{ marginBottom: "30px" }}>
          {(() => {
            const renewals = activeAds
              .map(row => {
                const { startVol, endVol } = parseVolumeRange(row[9]);
                const remaining = endVol ? endVol - CURRENT_VOLUME : null;
                return { name: row[1], startVol, endVol, remaining, row };
              })
              .filter(c => c.endVol && c.remaining !== null && c.remaining >= 0 && c.remaining <= 3)
              .sort((a, b) => a.remaining - b.remaining);

            const expiredUnpaid = activeAds
              .map(row => {
                const { startVol, endVol } = parseVolumeRange(row[9]);
                const price = parsePrice(row[6]);
                const received = parsePrice(row[7]);
                const totalAmount = startVol && endVol ? price * (endVol - startVol + 1) : price;
                const unpaid = totalAmount - received;
                return { name: row[1], endVol, unpaid };
              })
              .filter(c => c.endVol && CURRENT_VOLUME > c.endVol && c.unpaid > 0);

            if (renewals.length === 0 && expiredUnpaid.length === 0) return null;

            return (
              <div style={{ background: "#fff", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", borderLeft: "5px solid #e67e22" }}>
                <h3 style={{ color: "#e67e22", margin: "0 0 4px 0" }}>📢 재계약 대상 고객 (Vol {CURRENT_VOLUME} 기준)</h3>
                <p style={{ color: "#888", fontSize: "13px", margin: "0 0 14px 0" }}>4호 이내 계약 만료 또는 만료+미수금 고객에게 재계약을 제안하세요.</p>
                {renewals.length > 0 && (
                  <div style={{ marginBottom: expiredUnpaid.length > 0 ? "14px" : 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: "#e65100", marginBottom: "8px" }}>⚠️ 계약 종료 임박</div>
                    {renewals.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: c.remaining === 0 ? "#ffebee" : "#fff8f0", borderRadius: "6px", marginBottom: "5px", border: `1px solid ${c.remaining === 0 ? "#ef9a9a" : "#ffcc80"}` }}>
                        <div>
                          <strong style={{ color: c.remaining === 0 ? "#c62828" : "#e65100" }}>{c.name}</strong>
                          <span style={{ fontSize: "12px", color: "#888", marginLeft: "8px" }}>Vol {c.startVol}~{c.endVol}</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "bold", background: c.remaining === 0 ? "#f44336" : "#ff9800", color: "#fff", padding: "2px 10px", borderRadius: "10px" }}>
                          {c.remaining === 0 ? "🔴 이번호 마감" : `⚠️ ${c.remaining}호 남음`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {expiredUnpaid.length > 0 && (
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: "#c62828", marginBottom: "8px" }}>🚨 만료 + 미수금</div>
                    {expiredUnpaid.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#ffebee", borderRadius: "6px", marginBottom: "5px", border: "1px solid #ef9a9a" }}>
                        <div>
                          <strong style={{ color: "#c62828" }}>{c.name}</strong>
                          <span style={{ fontSize: "12px", color: "#888", marginLeft: "8px" }}>Vol {c.endVol} 종료</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#f44336" }}>미수금 ${c.unpaid.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 전체 DB 테이블 */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "10px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px"
          }}>
            <div>
              <h3 style={{ margin: 0, marginBottom: "5px" }}>
                📊 통합 광고주 현황
                <span style={{
                  color: "#666",
                  fontSize: "14px",
                  fontWeight: "normal",
                  marginLeft: "10px"
                }}>
                  (총 {activeAds.filter(row =>
                    row[1]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row[2]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row[3]?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length}개)
                </span>
              </h3>
              <div style={{
                fontSize: "13px",
                color: "#2196F3",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}>
                <span>💡</span>
                <span>고객을 클릭하면 상세 정보를 확인할 수 있습니다</span>
              </div>
            </div>

            {/* 검색 바 및 추가 버튼 */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="🔍 업체명, 주소, 연락처 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: "10px 15px",
                  fontSize: "14px",
                  border: "2px solid #ddd",
                  borderRadius: "5px",
                  width: "300px",
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = "#d32f2f"}
                onBlur={(e) => e.target.style.borderColor = "#ddd"}
              />

              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4caf50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  transition: "background 0.2s",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#45a049"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#4caf50"}
              >
                <span style={{ fontSize: "16px" }}>➕</span>
                <span>새 고객 추가</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead style={{ position: "sticky", top: 0, backgroundColor: "#f5f5f5", zIndex: 1 }}>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "40px" }}>#</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "60px" }}>상태</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", minWidth: "200px" }}>업체명</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", minWidth: "250px" }}>주소</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", minWidth: "150px" }}>연락처</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "80px" }}>사이즈</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "80px" }}>단가</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "80px" }}>수금완료</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", width: "80px" }}>미수금</th>
                  <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd", minWidth: "100px" }}>계약기간</th>
                </tr>
              </thead>
              <tbody>
                {activeAds
                  .filter(row =>
                    row[1]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row[2]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row[3]?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((row, i) => {
                    const unpaid = parseFloat(row[8]?.toString().replace(/[^0-9.-]/g, '')) || 0;
                    const price = row[6];
                    const size = row[5];

                    // 호수 및 금액 파싱
                    const { startVol, endVol } = parseVolumeRange(row[9]);
                    const priceNum = parsePrice(row[6]);
                    const received = parsePrice(row[7]);
                    const totalAmount = startVol && endVol ? priceNum * (endVol - startVol + 1) : priceNum;

                    // 계약 및 수금 상태
                    const contractStatus = getContractStatus(startVol, endVol);
                    const paymentStatus = getPaymentStatus(totalAmount, received, startVol, endVol);

                    // 고객 유형에 따른 배경색
                    let bgColor = "#fff";
                    if (size === "FC") bgColor = "#fff3e0"; // 대형광고주 - 오렌지 톤
                    else if (size?.includes("yellow")) bgColor = "#fff9c4"; // 옐로우페이지 - 노란색 톤

                    // 연체나 만료된 경우 배경색 변경
                    if (contractStatus.status === "EXPIRED" && unpaid > 0) {
                      bgColor = "#ffebee"; // 연체 - 빨간색 톤
                    }

                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #eee",
                          backgroundColor: bgColor,
                          transition: "background-color 0.2s",
                          cursor: "pointer"
                        }}
                        onClick={() => setSelectedCustomer(row)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e3f2fd";
                          e.currentTarget.style.transform = "scale(1.01)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = bgColor;
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        <td style={{ padding: "10px", color: "#999", fontSize: "12px" }}>{i + 1}</td>
                        <td style={{
                          padding: "10px",
                          textAlign: "center",
                          fontSize: "20px"
                        }}>
                          <span
                            title={`${contractStatus.label} / ${paymentStatus.label}\n${paymentStatus.description || ""}`}
                            style={{ cursor: "help" }}
                          >
                            {contractStatus.status === "EXPIRED" && unpaid > 0 ? "🚨" :
                              contractStatus.status === "EXPIRED" ? "✅" :
                                paymentStatus.status === "FULL_PREPAID" ? "💰💰" :
                                  paymentStatus.status === "PARTIAL_PREPAID" ? "💰" :
                                    paymentStatus.status === "PAY_PER_ISSUE" ? "📅" :
                                      paymentStatus.status === "DELAYED" ? "⏳" :
                                        paymentStatus.status === "OVERDUE" ? "🚨" :
                                          contractStatus.status === "ACTIVE" ? "▶️" :
                                            contractStatus.status === "UPCOMING" ? "⏳" : "❓"}
                          </span>
                        </td>
                        <td style={{ padding: "10px", fontWeight: "500" }}>{row[1]}</td>
                        <td style={{ padding: "10px", fontSize: "12px", color: "#666" }}>{row[2]}</td>
                        <td style={{ padding: "10px", fontSize: "12px" }}>{row[3]}</td>
                        <td style={{
                          padding: "10px",
                          textAlign: "center",
                          fontWeight: size === "FC" ? "bold" : "normal",
                          color: size === "FC" ? "#d32f2f" : "#333"
                        }}>
                          {size}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: "500" }}>{price}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "#4caf50" }}>{row[7]}</td>
                        <td
                          style={{
                            padding: "10px",
                            textAlign: "right",
                            color: unpaid > 0 ? "#f44336" : "#4caf50",
                            fontWeight: "bold",
                          }}
                        >
                          {row[8]}
                        </td>
                        <td style={{ padding: "10px", fontSize: "12px", color: "#666" }}>
                          {startVol && endVol ? (
                            <span style={{
                              padding: "4px 8px",
                              backgroundColor: contractStatus.status === "EXPIRED" ? "#ffcdd2" :
                                contractStatus.status === "ACTIVE" ? "#c8e6c9" : "#e3f2fd",
                              borderRadius: "4px",
                              fontSize: "11px",
                              whiteSpace: "nowrap"
                            }}>
                              {startVol}~{endVol}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* 통계 요약 */}
          <div style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "10px",
          }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#333" }}>📊 통계 요약</h4>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px"
            }}>
              <div style={{
                padding: "12px",
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "2px solid #e0e0e0"
              }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>전체 고객</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>
                  {activeAds.length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#e8f5e9",
                borderRadius: "8px",
                border: "2px solid #4caf50"
              }}>
                <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "5px" }}>
                  ▶️ 광고 게재 중
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2e7d32" }}>
                  {activeAds.filter(row => {
                    const { startVol, endVol } = parseVolumeRange(row[9]);
                    const status = getContractStatus(startVol, endVol);
                    return status.status === "ACTIVE";
                  }).length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#ffebee",
                borderRadius: "8px",
                border: "2px solid #f44336"
              }}>
                <div style={{ fontSize: "12px", color: "#c62828", marginBottom: "5px" }}>
                  🚨 연체 (만료+미수금)
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#c62828" }}>
                  {activeAds.filter(row => {
                    const { startVol, endVol } = parseVolumeRange(row[9]);
                    const unpaid = parseFloat(row[8]?.toString().replace(/[^0-9.-]/g, '')) || 0;
                    const contractStatus = getContractStatus(startVol, endVol);
                    return contractStatus.status === "EXPIRED" && unpaid > 0;
                  }).length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                border: "2px solid #2196F3"
              }}>
                <div style={{ fontSize: "12px", color: "#1565c0", marginBottom: "5px" }}>
                  💰 선불 고객 (전액+일부)
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1565c0" }}>
                  {activeAds.filter(row => {
                    const { startVol, endVol } = parseVolumeRange(row[9]);
                    const priceNum = parsePrice(row[6]);
                    const received = parsePrice(row[7]);
                    const totalAmount = startVol && endVol ? priceNum * (endVol - startVol + 1) : priceNum;
                    const paymentStatus = getPaymentStatus(totalAmount, received, startVol, endVol);
                    return paymentStatus.status === "FULL_PREPAID" || paymentStatus.status === "PARTIAL_PREPAID";
                  }).length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#e8f5e9",
                borderRadius: "8px",
                border: "2px solid #4caf50"
              }}>
                <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "5px" }}>
                  📅 매호 정산
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2e7d32" }}>
                  {activeAds.filter(row => {
                    const { startVol, endVol } = parseVolumeRange(row[9]);
                    const priceNum = parsePrice(row[6]);
                    const received = parsePrice(row[7]);
                    const totalAmount = startVol && endVol ? priceNum * (endVol - startVol + 1) : priceNum;
                    const paymentStatus = getPaymentStatus(totalAmount, received, startVol, endVol);
                    return paymentStatus.status === "PAY_PER_ISSUE";
                  }).length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#fff3e0",
                borderRadius: "8px",
                border: "2px solid #ff9800"
              }}>
                <div style={{ fontSize: "12px", color: "#e65100", marginBottom: "5px" }}>
                  미수금 있는 고객
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e65100" }}>
                  {activeAds.filter(row => {
                    const unpaid = parseFloat(row[8]?.toString().replace(/[^0-9.-]/g, '')) || 0;
                    return unpaid > 0;
                  }).length}
                </div>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#fce4ec",
                borderRadius: "8px",
                border: "2px solid #d32f2f"
              }}>
                <div style={{ fontSize: "12px", color: "#d32f2f", marginBottom: "5px" }}>
                  대형광고주 (FC)
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d32f2f" }}>
                  {activeAds.filter(row => row[5] === "FC").length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
      )
      }

      {/* 데이터 변환 도구 탭 */}
      {activeTab === "transformer" && <DataTransformer />}

      {/* 고객 상세 카드 모달 */}
      {
        selectedCustomer && (
          <CustomerCard
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
          />
        )
      }

      {/* 새 고객 추가 폼 모달 */}
      {
        showAddForm && (
          <AddCustomerForm
            onClose={() => setShowAddForm(false)}
            onAdd={(newCustomer) => {
              console.log("새 고객 추가됨:", newCustomer);
              // 필요시 로컬 상태 업데이트 (실제로는 Google Sheets 리프레시 필요)
            }}
          />
        )
      }
    </div >
  );
};

export default Dashboard;
