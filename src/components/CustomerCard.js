import React from "react";
import { parsePhoneNumbers, parseVolumeRange, parsePrice } from "../utils/dataTransformer";
import { 
  getContractStatus, 
  getPaymentStatus, 
  getContractProgress,
  getNextAction 
} from "../utils/contractStatus";
import {
  getContractDates,
  getVolumeRangeDates,
  formatDate,
  formatDateSimple,
  getLatestSchedule,
} from "../utils/volumeSchedule";

/**
 * 고객 상세 정보 카드 (모달)
 */
const CustomerCard = ({ customer, onClose }) => {
  // ESC 키로 모달 닫기 (Hooks는 항상 최상위에 배치)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Early return은 Hooks 이후에 배치
  if (!customer) return null;

  // 데이터 파싱
  const { phone, mobile } = parsePhoneNumbers(customer[3]);
  const { startVol, endVol } = parseVolumeRange(customer[9]);
  const price = parsePrice(customer[6]);
  const received = parsePrice(customer[7]);
  // const unpaid = parsePrice(customer[8]); // 원본 시트 값 (사용 안 함)
  
  // 고객 유형 판단
  const size = customer[5];
  let customerType = "기타";
  let typeColor = "#666";
  if (size === "FC") {
    customerType = "대형광고주";
    typeColor = "#d32f2f";
  } else if (size?.includes("1/2")) {
    customerType = "중형광고주";
    typeColor = "#1976d2";
  } else if (size?.includes("1/4")) {
    customerType = "소형광고주";
    typeColor = "#388e3c";
  } else if (size?.toLowerCase().includes("yellow")) {
    customerType = "옐로우페이지";
    typeColor = "#f57c00";
  }

  // 계약 호수 범위 생성
  const volumeRange = [];
  if (startVol && endVol) {
    for (let vol = Math.max(550, startVol); vol <= Math.min(574, endVol); vol++) {
      volumeRange.push(vol);
    }
  }

  // 총 계약 금액 계산
  const totalAmount = startVol && endVol ? price * (endVol - startVol + 1) : price;

  // ✅ 미수금 = 총 계약 금액 - 수금 완료 (올바른 계산)
  const unpaid = totalAmount - received;

  // 수금률 계산
  const collectionRate = totalAmount > 0 ? ((received / totalAmount) * 100).toFixed(1) : 0;

  // 계약 상태 판단
  const contractStatus = getContractStatus(startVol, endVol);
  const paymentStatus = getPaymentStatus(totalAmount, received, startVol, endVol);
  const contractProgress = getContractProgress(startVol, endVol);
  const nextAction = getNextAction(contractStatus, paymentStatus, unpaid);
  
  // 계약 날짜 정보
  const contractDates = getContractDates(startVol, endVol);
  const volumeDates = getVolumeRangeDates(startVol, endVol);

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
          borderRadius: "15px",
          maxWidth: "900px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            background: "linear-gradient(135deg, #d32f2f 0%, #c62828 100%)",
            padding: "25px 30px",
            borderRadius: "15px 15px 0 0",
            color: "#fff",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              fontSize: "24px",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.3)"}
            onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.2)"}
          >
            ×
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              {customer[0]}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>
                {customer[1]}
              </h2>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "5px 12px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: "15px",
                    fontSize: "14px",
                  }}
                >
                  {customerType}
                </div>
                {contractStatus.status !== "UNKNOWN" && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "5px 12px",
                      backgroundColor: "rgba(255,255,255,0.2)",
                      borderRadius: "15px",
                      fontSize: "14px",
                    }}
                  >
                    {contractStatus.label}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div style={{ padding: "30px" }}>
          {/* 중요 알림 (연체, 재계약 등) */}
          {nextAction.priority !== "LOW" && (
            <div
              style={{
                padding: "15px 20px",
                backgroundColor: 
                  nextAction.priority === "HIGH" ? "#ffebee" : 
                  nextAction.priority === "MEDIUM" ? "#fff3e0" : "#e8f5e9",
                borderLeft: `4px solid ${
                  nextAction.priority === "HIGH" ? "#f44336" : 
                  nextAction.priority === "MEDIUM" ? "#ff9800" : "#4caf50"
                }`,
                borderRadius: "8px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "15px"
              }}
            >
              <div style={{ fontSize: "28px" }}>{nextAction.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: "bold", 
                  fontSize: "16px",
                  color: nextAction.priority === "HIGH" ? "#c62828" : 
                         nextAction.priority === "MEDIUM" ? "#e65100" : "#2e7d32",
                  marginBottom: "5px"
                }}>
                  {nextAction.action}
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  {nextAction.message}
                </div>
              </div>
            </div>
          )}
          {/* 기본 정보 */}
          <section style={{ marginBottom: "30px" }}>
            <h3 style={{ 
              color: "#333", 
              borderBottom: "2px solid #d32f2f",
              paddingBottom: "10px",
              marginBottom: "20px"
            }}>
              📋 기본 정보
            </h3>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(2, 1fr)", 
              gap: "15px" 
            }}>
              <InfoRow label="업체명" value={customer[1]} />
              <InfoRow label="고객 번호" value={`#${customer[0]}`} />
              <InfoRow 
                label="주소" 
                value={customer[2]} 
                fullWidth 
              />
              <InfoRow label="전화번호" value={phone} icon="📞" />
              <InfoRow label="모바일" value={mobile || "-"} icon="📱" />
              <InfoRow label="페이지 번호" value={customer[4]} />
              <InfoRow 
                label="광고 사이즈" 
                value={size}
                valueStyle={{ 
                  fontWeight: "bold", 
                  color: typeColor,
                  fontSize: "16px"
                }}
              />
            </div>
          </section>

          {/* 계약 정보 */}
          <section style={{ marginBottom: "30px" }}>
            <h3 style={{ 
              color: "#333", 
              borderBottom: "2px solid #2196F3",
              paddingBottom: "10px",
              marginBottom: "20px"
            }}>
              📄 계약 정보
            </h3>

            {/* 계약 상태 배지 */}
            {contractStatus.status !== "UNKNOWN" && (
              <div style={{ 
                display: "flex", 
                gap: "15px", 
                marginBottom: "20px",
                flexWrap: "wrap"
              }}>
                <div style={{
                  padding: "10px 15px",
                  backgroundColor: contractStatus.color + "15",
                  border: `2px solid ${contractStatus.color}`,
                  borderRadius: "8px",
                  flex: 1,
                  minWidth: "200px"
                }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                    계약 상태
                  </div>
                  <div style={{ 
                    fontWeight: "bold", 
                    color: contractStatus.color,
                    fontSize: "16px",
                    marginBottom: "3px"
                  }}>
                    {contractStatus.label}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    {contractStatus.description}
                  </div>
                </div>

                <div style={{
                  padding: "10px 15px",
                  backgroundColor: paymentStatus.color + "15",
                  border: `2px solid ${paymentStatus.color}`,
                  borderRadius: "8px",
                  flex: 1,
                  minWidth: "200px"
                }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                    수금 상태 (결제 패턴)
                  </div>
                  <div style={{ 
                    fontWeight: "bold", 
                    color: paymentStatus.color,
                    fontSize: "16px",
                    marginBottom: "3px"
                  }}>
                    {paymentStatus.icon} {paymentStatus.label}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    {paymentStatus.description || "-"}
                  </div>
                  {paymentStatus.paymentType && (
                    <div style={{ 
                      fontSize: "11px", 
                      color: paymentStatus.color,
                      marginTop: "5px",
                      fontWeight: "500"
                    }}>
                      {paymentStatus.paymentType === "FULL_PREPAID" && "신뢰도: ⭐⭐⭐⭐⭐"}
                      {paymentStatus.paymentType === "PARTIAL_PREPAID" && "신뢰도: ⭐⭐⭐⭐"}
                      {paymentStatus.paymentType === "PAY_PER_ISSUE" && "신뢰도: ⭐⭐⭐"}
                      {paymentStatus.paymentType === "DELAYED" && "신뢰도: ⭐⭐"}
                      {paymentStatus.paymentType === "OVERDUE" && "신뢰도: ⭐"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 계약 진행률 */}
            {contractProgress > 0 && (
              <div style={{ 
                backgroundColor: "#f5f5f5", 
                borderRadius: "10px", 
                padding: "15px",
                marginBottom: "20px"
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  marginBottom: "8px" 
                }}>
                  <span style={{ fontWeight: "bold", color: "#666", fontSize: "14px" }}>
                    계약 진행률
                  </span>
                  <span style={{ 
                    fontWeight: "bold", 
                    fontSize: "16px",
                    color: contractProgress >= 100 ? "#f44336" : contractProgress >= 80 ? "#ff9800" : "#4caf50"
                  }}>
                    {contractProgress.toFixed(0)}%
                  </span>
                </div>
                <div style={{ 
                  height: "20px", 
                  backgroundColor: "#e0e0e0", 
                  borderRadius: "10px",
                  overflow: "hidden"
                }}>
                  <div style={{ 
                    height: "100%", 
                    width: `${Math.min(contractProgress, 100)}%`,
                    background: contractProgress >= 100 
                      ? "linear-gradient(90deg, #f44336, #ef5350)"
                      : contractProgress >= 80
                      ? "linear-gradient(90deg, #ff9800, #ffa726)"
                      : "linear-gradient(90deg, #4caf50, #66bb6a)",
                    transition: "width 0.5s ease"
                  }}></div>
                </div>
              </div>
            )}

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(2, 1fr)", 
              gap: "15px" 
            }}>
              <InfoRow 
                label="호당 단가" 
                value={`$${price.toLocaleString()}`}
                valueStyle={{ fontWeight: "bold", fontSize: "18px" }}
              />
              <InfoRow 
                label="총 계약 금액" 
                value={`$${totalAmount.toLocaleString()}`}
                valueStyle={{ fontWeight: "bold", fontSize: "18px", color: "#2196F3" }}
              />
              <InfoRow 
                label="시작 (호수)" 
                value={startVol ? `Vol ${startVol}` : "-"}
              />
              <InfoRow 
                label="종료 (호수)" 
                value={endVol ? `Vol ${endVol}` : "-"}
              />
              {contractDates.startDate && (
                <>
                  <InfoRow 
                    label="시작 날짜" 
                    value={formatDateSimple(contractDates.startDate)}
                    icon="📅"
                  />
                  <InfoRow 
                    label="종료 날짜" 
                    value={formatDateSimple(contractDates.endDate)}
                    icon="📅"
                  />
                </>
              )}
              <InfoRow 
                label="계약 기간" 
                value={
                  startVol && endVol 
                    ? `${endVol - startVol + 1}개 호` + 
                      (contractDates.duration ? ` (약 ${Math.round(contractDates.duration / 30)}개월)` : "")
                    : "-"
                }
                valueStyle={{ fontWeight: "bold" }}
              />
              <InfoRow 
                label="비고" 
                value={customer[9] || "-"}
                fullWidth
              />
            </div>
          </section>

          {/* 수금 현황 */}
          <section style={{ marginBottom: "30px" }}>
            <h3 style={{ 
              color: "#333", 
              borderBottom: "2px solid #4caf50",
              paddingBottom: "10px",
              marginBottom: "20px"
            }}>
              💰 수금 현황
            </h3>
            
            {/* 수금률 프로그레스 바 */}
            <div style={{ 
              backgroundColor: "#f5f5f5", 
              borderRadius: "10px", 
              padding: "20px",
              marginBottom: "20px"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                marginBottom: "10px" 
              }}>
                <span style={{ fontWeight: "bold", color: "#666" }}>수금률</span>
                <span style={{ 
                  fontWeight: "bold", 
                  fontSize: "20px",
                  color: collectionRate >= 100 ? "#4caf50" : collectionRate >= 50 ? "#ff9800" : "#f44336"
                }}>
                  {collectionRate}%
                </span>
              </div>
              <div style={{ 
                height: "30px", 
                backgroundColor: "#e0e0e0", 
                borderRadius: "15px",
                overflow: "hidden"
              }}>
                <div style={{ 
                  height: "100%", 
                  width: `${Math.min(collectionRate, 100)}%`,
                  background: collectionRate >= 100 
                    ? "linear-gradient(90deg, #4caf50, #66bb6a)"
                    : collectionRate >= 50
                    ? "linear-gradient(90deg, #ff9800, #ffa726)"
                    : "linear-gradient(90deg, #f44336, #ef5350)",
                  transition: "width 0.5s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: "10px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}>
                  {collectionRate > 10 && `${collectionRate}%`}
                </div>
              </div>
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "15px" 
            }}>
              <div style={{
                backgroundColor: "#e3f2fd",
                padding: "15px",
                borderRadius: "10px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                  총 계약 금액
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#2196F3" }}>
                  ${totalAmount.toLocaleString()}
                </div>
              </div>

              <div style={{
                backgroundColor: "#e8f5e9",
                padding: "15px",
                borderRadius: "10px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                  수금 완료
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4caf50" }}>
                  ${received.toLocaleString()}
                </div>
              </div>

              <div style={{
                backgroundColor: unpaid > 0 ? "#ffebee" : "#f5f5f5",
                padding: "15px",
                borderRadius: "10px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                  미수금
                </div>
                <div style={{ 
                  fontSize: "20px", 
                  fontWeight: "bold", 
                  color: unpaid > 0 ? "#f44336" : "#9e9e9e"
                }}>
                  ${unpaid.toLocaleString()}
                </div>
              </div>
            </div>
          </section>

          {/* Vol 호수별 현황 */}
          {volumeRange.length > 0 && (
            <section style={{ marginBottom: "20px" }}>
              <h3 style={{ 
                color: "#333", 
                borderBottom: "2px solid #9c27b0",
                paddingBottom: "10px",
                marginBottom: "20px"
              }}>
                📊 호수별 광고 현황 (Vol {startVol}~{endVol})
              </h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", 
                gap: "10px" 
              }}>
                {volumeDates.length > 0 ? volumeDates.map(volInfo => {
                  const isPublished = volInfo.status === "published";
                  return (
                    <div
                      key={volInfo.volume}
                      style={{
                        padding: "12px 8px",
                        backgroundColor: isPublished ? "#e1bee7" : "#f3e5f5",
                        border: `2px solid ${isPublished ? "#7b1fa2" : "#9c27b0"}`,
                        borderRadius: "8px",
                        textAlign: "center",
                        fontWeight: "bold",
                        color: isPublished ? "#4a148c" : "#9c27b0",
                        fontSize: "13px",
                        position: "relative"
                      }}
                    >
                      <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                        Vol {volInfo.volume}
                      </div>
                      <div style={{ 
                        fontSize: "10px", 
                        fontWeight: "normal",
                        color: isPublished ? "#6a1b9a" : "#ba68c8"
                      }}>
                        {volInfo.dateString}
                      </div>
                      {isPublished && (
                        <div style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          fontSize: "12px"
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                  );
                }) : volumeRange.map(vol => (
                  <div
                    key={vol}
                    style={{
                      padding: "12px 8px",
                      backgroundColor: "#f3e5f5",
                      border: "2px solid #9c27b0",
                      borderRadius: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: "#9c27b0",
                      fontSize: "14px"
                    }}
                  >
                    Vol<br/>{vol}
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: "15px", 
                padding: "12px", 
                backgroundColor: "#fff3e0",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#e65100"
              }}>
                💡 총 <strong>{volumeRange.length}개 호</strong>에 광고 게재
                {contractDates.startDate && contractDates.endDate && (
                  <div style={{ marginTop: "5px", fontSize: "13px" }}>
                    📅 {formatDateSimple(contractDates.startDate)} ~ {formatDateSimple(contractDates.endDate)}
                    {contractDates.duration && (
                      <span style={{ marginLeft: "10px" }}>
                        (약 {Math.round(contractDates.duration / 30)}개월)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 액션 버튼 */}
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            marginTop: "30px",
            paddingTop: "20px",
            borderTop: "1px solid #eee"
          }}>
            <button
              onClick={() => {
                if (phone) {
                  window.location.href = `tel:${phone.replace(/\s/g, "")}`;
                } else {
                  alert("전화번호가 없습니다.");
                }
              }}
              style={{
                flex: 1,
                padding: "15px",
                backgroundColor: "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: phone ? "pointer" : "not-allowed",
                transition: "background 0.2s",
                opacity: phone ? 1 : 0.5
              }}
              onMouseEnter={(e) => phone && (e.target.style.backgroundColor = "#45a049")}
              onMouseLeave={(e) => phone && (e.target.style.backgroundColor = "#4caf50")}
            >
              📞 전화 걸기
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `업체명: ${customer[1]}\n주소: ${customer[2]}\n전화: ${phone}\n모바일: ${mobile}\n광고: ${size}\n단가: $${price}`
                );
                alert("고객 정보가 클립보드에 복사되었습니다!");
              }}
              style={{
                flex: 1,
                padding: "15px",
                backgroundColor: "#2196F3",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#1976d2"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#2196F3"}
            >
              📋 정보 복사
            </button>
            <button
              onClick={() => {
                alert("정보 수정 기능은 준비 중입니다.\n\n현재는 Google Sheets에서 직접 수정해주세요.");
              }}
              style={{
                flex: 1,
                padding: "15px",
                backgroundColor: "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f57c00"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#ff9800"}
            >
              ✏️ 정보 수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 정보 행 컴포넌트
const InfoRow = ({ label, value, icon, valueStyle, fullWidth }) => (
  <div style={{ 
    gridColumn: fullWidth ? "1 / -1" : "auto",
    padding: "12px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px"
  }}>
    <div style={{ 
      fontSize: "12px", 
      color: "#666", 
      marginBottom: "5px",
      fontWeight: "500"
    }}>
      {icon && <span style={{ marginRight: "5px" }}>{icon}</span>}
      {label}
    </div>
    <div style={{ 
      fontSize: "15px", 
      color: "#333",
      wordBreak: "break-word",
      ...valueStyle
    }}>
      {value || "-"}
    </div>
  </div>
);

export default CustomerCard;
