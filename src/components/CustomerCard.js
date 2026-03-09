import React, { useState, useEffect } from "react";

/**
 * 고객 상세 카드 (모달)
 *
 * props:
 *   customer      - 고객 데이터 (배열 또는 객체)
 *   mode          - "sheet" | "legacy"
 *     "sheet"  → 고객DB 탭 기반: customer[0]=고객사명, customer[1]=담당자, ...
 *     "legacy" → 기존 정산 시트 기반: customer[1]=업체명, customer[2]=주소, ...
 *   onClose       - 모달 닫기 콜백
 *   onSave        - 저장 성공 후 목록 새로고침 콜백 (optional)
 */

// GAS 배포 URL
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

// ──────────────────────────────────────────────────────────────────────────────
// 고객DB 시트 기반 카드 (mode="sheet")
// 컬럼: 0=고객사명, 1=담당자, 2=직책, 3=연락처, 4=이메일, 5=주소
//       6=AREA, 7=CITY, 8=가입출처, 9=현재상태, 10=영업단계, 11=최근상담일
//       12=상담횟수, 13=광고상품, 14=계약금액, 15=수금액, 16=미수금, 17=최종업데이트
// ──────────────────────────────────────────────────────────────────────────────
const SheetCustomerCard = ({ customer, onClose, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // 편집 데이터 상태 (고객DB 컬럼 구조)
  const [editData, setEditData] = useState({
    customerName: customer[0] || "",
    manager: customer[1] || "",
    position: customer[2] || "",
    phone: customer[3] || "",
    email: customer[4] || "",
    address: customer[5] || "",
    area: customer[6] || "",
    city: customer[7] || "",
    source: customer[8] || "",
    status: customer[9] || "",
    stage: customer[10] || "",
    adProduct: customer[13] || "",
    memo: customer[17] || "",
  });

  // ESC 키 닫기
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isEditing]);

  const contractAmount = parseFloat(customer[14]) || 0;
  const received = parseFloat(customer[15]) || 0;
  const unpaid = parseFloat(customer[16]) || 0;
  const collectionRate =
    contractAmount > 0
      ? Math.min(100, ((received / contractAmount) * 100).toFixed(1))
      : 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "UPDATE_CUSTOMER",
          originalName: customer[0], // 기존 고객명 (식별용)
          ...editData,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setSaveMsg({ type: "ok", text: "✅ 저장 완료! 시트에 반영되었습니다." });
        setIsEditing(false);
        if (onSave) onSave(editData);
      } else {
        setSaveMsg({ type: "err", text: `❌ 저장 실패: ${json.message}` });
      }
    } catch (e) {
      setSaveMsg({ type: "err", text: `❌ 오류: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, opts = {}) => (
    <div style={{ gridColumn: opts.fullWidth ? "1 / -1" : "auto" }}>
      <div style={labelStyle}>{label}</div>
      {isEditing && !opts.readOnly ? (
        opts.select ? (
          <select
            value={editData[key]}
            onChange={(e) =>
              setEditData((prev) => ({ ...prev, [key]: e.target.value }))
            }
            style={inputStyle}
          >
            {opts.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={opts.type || "text"}
            value={editData[key]}
            onChange={(e) =>
              setEditData((prev) => ({ ...prev, [key]: e.target.value }))
            }
            style={inputStyle}
          />
        )
      ) : (
        <div style={valueStyle}>{editData[key] || customer[opts.col ?? 0] || "-"}</div>
      )}
    </div>
  );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={headerStyle}>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={avatarStyle}>👤</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px" }}>
                {isEditing ? editData.customerName : customer[0]}
              </h2>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                {customer[9] && (
                  <span style={badgeStyle}>{customer[9]}</span>
                )}
                {customer[10] && (
                  <span style={badgeStyle}>{customer[10]}</span>
                )}
                {customer[7] && (
                  <span style={badgeStyle}>📍 {customer[7]}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 저장 메시지 */}
        {saveMsg && (
          <div
            style={{
              padding: "12px 20px",
              backgroundColor:
                saveMsg.type === "ok" ? "#e8f5e9" : "#ffebee",
              borderLeft: `4px solid ${saveMsg.type === "ok" ? "#4caf50" : "#f44336"
                }`,
              fontSize: "14px",
              color: saveMsg.type === "ok" ? "#2e7d32" : "#c62828",
            }}
          >
            {saveMsg.text}
          </div>
        )}

        {/* 컨텐츠 */}
        <div style={{ padding: "24px 28px", overflowY: "auto" }}>

          {/* 수금 요약 카드 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            {[
              { label: "계약금액", value: `$${contractAmount.toLocaleString()}`, bg: "#e3f2fd", color: "#1565c0" },
              { label: "수금완료", value: `$${received.toLocaleString()}`, bg: "#e8f5e9", color: "#2e7d32" },
              {
                label: "미수금",
                value: unpaid > 0 ? `$${unpaid.toLocaleString()}` : "없음",
                bg: unpaid > 0 ? "#ffebee" : "#f5f5f5",
                color: unpaid > 0 ? "#c62828" : "#9e9e9e",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "16px",
                  backgroundColor: s.bg,
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* 수금률 바 */}
          {contractAmount > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#666" }}>수금률</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: collectionRate >= 100 ? "#4caf50" : "#ff9800" }}>
                  {collectionRate}%
                </span>
              </div>
              <div
                style={{
                  height: "12px",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${collectionRate}%`,
                    background:
                      collectionRate >= 100
                        ? "linear-gradient(90deg, #4caf50, #66bb6a)"
                        : "linear-gradient(90deg, #ff9800, #ffa726)",
                    borderRadius: "6px",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* 기본 정보 */}
          <section style={{ marginBottom: "24px" }}>
            <SectionTitle>📋 기본 정보</SectionTitle>
            <div style={gridStyle}>
              {field("고객사명", "customerName")}
              {field("담당자", "manager")}
              {field("직책", "position")}
              {field("연락처", "phone", { type: "tel" })}
              {field("이메일", "email", { type: "email" })}
              {field("주소", "address", { fullWidth: true })}
              {field("도시", "city")}
              {field("지역", "area")}
              {field("가입출처", "source")}
            </div>
          </section>

          {/* 영업 정보 */}
          <section style={{ marginBottom: "24px" }}>
            <SectionTitle>💼 영업 정보</SectionTitle>
            <div style={gridStyle}>
              {field("현재상태", "status", {
                select: true,
                options: ["", "상담중", "계약", "완납", "종료", "미수금", "문의"],
              })}
              {field("영업단계", "stage", {
                select: true,
                options: ["", "문의", "상담", "계약", "완납", "종료"],
              })}
              {field("광고상품", "adProduct")}
              <div>
                <div style={labelStyle}>최근 상담일</div>
                <div style={valueStyle}>{customer[11] || "-"}</div>
              </div>
              <div>
                <div style={labelStyle}>상담 횟수</div>
                <div style={valueStyle}>{customer[12] ? `${customer[12]}회` : "-"}</div>
              </div>
              <div>
                <div style={labelStyle}>최종업데이트</div>
                <div style={valueStyle}>{customer[17] || "-"}</div>
              </div>
            </div>
          </section>
        </div>

        {/* 하단 버튼 */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "16px 28px",
            borderTop: "1px solid #eee",
            backgroundColor: "#fafafa",
            borderRadius: "0 0 15px 15px",
          }}
        >
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...actionBtnStyle,
                  backgroundColor: saving ? "#ccc" : "#4caf50",
                  flex: 2,
                }}
              >
                {saving ? "저장 중..." : "💾 저장하기"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    customerName: customer[0] || "",
                    manager: customer[1] || "",
                    position: customer[2] || "",
                    phone: customer[3] || "",
                    email: customer[4] || "",
                    address: customer[5] || "",
                    area: customer[6] || "",
                    city: customer[7] || "",
                    source: customer[8] || "",
                    status: customer[9] || "",
                    stage: customer[10] || "",
                    adProduct: customer[13] || "",
                    memo: customer[17] || "",
                  });
                }}
                style={{ ...actionBtnStyle, backgroundColor: "#ef9a9a", color: "#c62828" }}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{ ...actionBtnStyle, backgroundColor: "#ff9800", flex: 1 }}
              >
                ✏️ 정보 수정
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `고객사: ${customer[0]}\n담당자: ${customer[1]}\n연락처: ${customer[3]}\n이메일: ${customer[4]}\n주소: ${customer[5]}`
                  );
                  setSaveMsg({ type: "ok", text: "📋 고객 정보가 클립보드에 복사되었습니다!" });
                  setTimeout(() => setSaveMsg(null), 3000);
                }}
                style={{ ...actionBtnStyle, backgroundColor: "#2196F3", flex: 1 }}
              >
                📋 정보 복사
              </button>
              {customer[3] && (
                <button
                  onClick={() => (window.location.href = `tel:${customer[3].replace(/\s/g, "")}`)}
                  style={{ ...actionBtnStyle, backgroundColor: "#4caf50", flex: 1 }}
                >
                  📞 전화
                </button>
              )}
              <button
                onClick={onClose}
                style={{ ...actionBtnStyle, backgroundColor: "#e0e0e0", color: "#333" }}
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// 기존 정산 시트 기반 카드 (legacy mode) - 기존 CustomerCard 로직
// ──────────────────────────────────────────────────────────────────────────────
import { parsePhoneNumbers, parseVolumeRange, parsePrice } from "../utils/dataTransformer";
import {
  getContractStatus,
  getPaymentStatus,
  getContractProgress,
  getNextAction,
} from "../utils/contractStatus";
import {
  getContractDates,
  getVolumeRangeDates,
  formatDateSimple,
} from "../utils/volumeSchedule";

const LegacyCustomerCard = ({ customer, onClose }) => {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!customer) return null;

  const { phone, mobile } = parsePhoneNumbers(customer[3]);
  const { startVol, endVol } = parseVolumeRange(customer[9]);
  const price = parsePrice(customer[6]);
  const received = parsePrice(customer[7]);

  const size = customer[5];
  let customerType = "기타";
  let typeColor = "#666";
  if (size === "FC") { customerType = "대형광고주"; typeColor = "#d32f2f"; }
  else if (size?.includes("1/2")) { customerType = "중형광고주"; typeColor = "#1976d2"; }
  else if (size?.includes("1/4")) { customerType = "소형광고주"; typeColor = "#388e3c"; }
  else if (size?.toLowerCase().includes("yellow")) { customerType = "옐로우페이지"; typeColor = "#f57c00"; }

  const volumeRange = [];
  if (startVol && endVol) {
    for (let vol = Math.max(550, startVol); vol <= Math.min(574, endVol); vol++) {
      volumeRange.push(vol);
    }
  }

  const totalAmount = startVol && endVol ? price * (endVol - startVol + 1) : price;
  const unpaid = totalAmount - received;
  const collectionRate = totalAmount > 0 ? ((received / totalAmount) * 100).toFixed(1) : 0;
  const contractStatus = getContractStatus(startVol, endVol);
  const paymentStatus = getPaymentStatus(totalAmount, received, startVol, endVol);
  const contractProgress = getContractProgress(startVol, endVol);
  const nextAction = getNextAction(contractStatus, paymentStatus, unpaid);
  const contractDates = getContractDates(startVol, endVol);
  const volumeDates = getVolumeRangeDates(startVol, endVol);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={headerStyle}>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={avatarStyle}>{customer[0]}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px" }}>{customer[1]}</h2>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                <span style={badgeStyle}>{customerType}</span>
                {contractStatus.status !== "UNKNOWN" && (
                  <span style={badgeStyle}>{contractStatus.label}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto" }}>
          {/* 중요 알림 */}
          {nextAction.priority !== "LOW" && (
            <div style={{
              padding: "14px 18px",
              backgroundColor: nextAction.priority === "HIGH" ? "#ffebee" : "#fff3e0",
              borderLeft: `4px solid ${nextAction.priority === "HIGH" ? "#f44336" : "#ff9800"}`,
              borderRadius: "8px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}>
              <div style={{ fontSize: "26px" }}>{nextAction.icon}</div>
              <div>
                <div style={{ fontWeight: "bold", color: nextAction.priority === "HIGH" ? "#c62828" : "#e65100" }}>
                  {nextAction.action}
                </div>
                <div style={{ fontSize: "13px", color: "#666" }}>{nextAction.message}</div>
              </div>
            </div>
          )}

          {/* 기본 정보 */}
          <section style={{ marginBottom: "24px" }}>
            <SectionTitle color="#d32f2f">📋 기본 정보</SectionTitle>
            <div style={gridStyle}>
              <InfoRow label="업체명" value={customer[1]} />
              <InfoRow label="고객 번호" value={`#${customer[0]}`} />
              <InfoRow label="주소" value={customer[2]} fullWidth />
              <InfoRow label="전화번호" value={phone} icon="📞" />
              <InfoRow label="모바일" value={mobile || "-"} icon="📱" />
              <InfoRow label="페이지 번호" value={customer[4]} />
              <InfoRow label="광고 사이즈" value={size} valueStyle={{ fontWeight: "bold", color: typeColor, fontSize: "16px" }} />
            </div>
          </section>

          {/* 계약 정보 */}
          <section style={{ marginBottom: "24px" }}>
            <SectionTitle color="#2196F3">📄 계약 정보</SectionTitle>
            {contractStatus.status !== "UNKNOWN" && (
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                {[contractStatus, paymentStatus].map((st) => (
                  <div key={st.label} style={{
                    padding: "10px 14px",
                    backgroundColor: st.color + "15",
                    border: `2px solid ${st.color}`,
                    borderRadius: "8px",
                    flex: 1,
                    minWidth: "180px",
                  }}>
                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>{st === contractStatus ? "계약 상태" : "수금 상태"}</div>
                    <div style={{ fontWeight: "bold", color: st.color, fontSize: "15px" }}>
                      {st.icon ? `${st.icon} ` : ""}{st.label}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{st.description}</div>
                  </div>
                ))}
              </div>
            )}
            {contractProgress > 0 && (
              <div style={{ backgroundColor: "#f5f5f5", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#666" }}>계약 진행률</span>
                  <span style={{ fontWeight: "bold", color: contractProgress >= 100 ? "#f44336" : "#4caf50" }}>
                    {contractProgress.toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: "14px", backgroundColor: "#e0e0e0", borderRadius: "7px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(contractProgress, 100)}%`,
                    background: contractProgress >= 100 ? "linear-gradient(90deg,#f44336,#ef5350)" : "linear-gradient(90deg,#4caf50,#66bb6a)",
                  }} />
                </div>
              </div>
            )}
            <div style={gridStyle}>
              <InfoRow label="호당 단가" value={`$${price.toLocaleString()}`} valueStyle={{ fontWeight: "bold", fontSize: "16px" }} />
              <InfoRow label="총 계약 금액" value={`$${totalAmount.toLocaleString()}`} valueStyle={{ fontWeight: "bold", fontSize: "16px", color: "#2196F3" }} />
              <InfoRow label="시작 (호수)" value={startVol ? `Vol ${startVol}` : "-"} />
              <InfoRow label="종료 (호수)" value={endVol ? `Vol ${endVol}` : "-"} />
              {contractDates.startDate && (
                <>
                  <InfoRow label="시작 날짜" value={formatDateSimple(contractDates.startDate)} icon="📅" />
                  <InfoRow label="종료 날짜" value={formatDateSimple(contractDates.endDate)} icon="📅" />
                </>
              )}
              <InfoRow label="계약 기간" value={
                startVol && endVol
                  ? `${endVol - startVol + 1}개 호${contractDates.duration ? ` (약 ${Math.round(contractDates.duration / 30)}개월)` : ""}`
                  : "-"
              } valueStyle={{ fontWeight: "bold" }} />
              <InfoRow label="비고" value={customer[9] || "-"} fullWidth />
            </div>
          </section>

          {/* 수금 현황 */}
          <section style={{ marginBottom: "24px" }}>
            <SectionTitle color="#4caf50">💰 수금 현황</SectionTitle>
            <div style={{ backgroundColor: "#f5f5f5", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#666" }}>수금률</span>
                <span style={{ fontWeight: "bold", fontSize: "18px", color: collectionRate >= 100 ? "#4caf50" : "#ff9800" }}>
                  {collectionRate}%
                </span>
              </div>
              <div style={{ height: "24px", backgroundColor: "#e0e0e0", borderRadius: "12px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(collectionRate, 100)}%`,
                  background: collectionRate >= 100 ? "linear-gradient(90deg,#4caf50,#66bb6a)" : "linear-gradient(90deg,#ff9800,#ffa726)",
                }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              {[
                { label: "총 계약 금액", value: `$${totalAmount.toLocaleString()}`, bg: "#e3f2fd", color: "#2196F3" },
                { label: "수금 완료", value: `$${received.toLocaleString()}`, bg: "#e8f5e9", color: "#4caf50" },
                { label: "미수금", value: `$${unpaid.toLocaleString()}`, bg: unpaid > 0 ? "#ffebee" : "#f5f5f5", color: unpaid > 0 ? "#f44336" : "#9e9e9e" },
              ].map((s) => (
                <div key={s.label} style={{ backgroundColor: s.bg, padding: "14px", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{s.label}</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Vol 호수별 현황 */}
          {volumeRange.length > 0 && (
            <section style={{ marginBottom: "16px" }}>
              <SectionTitle color="#9c27b0">📊 호수별 광고 현황 (Vol {startVol}~{endVol})</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px" }}>
                {(volumeDates.length > 0 ? volumeDates : volumeRange.map((v) => ({ volume: v, status: "scheduled" }))).map((vi) => {
                  const isPublished = vi.status === "published";
                  return (
                    <div key={vi.volume} style={{
                      padding: "10px 6px",
                      backgroundColor: isPublished ? "#e1bee7" : "#f3e5f5",
                      border: `2px solid ${isPublished ? "#7b1fa2" : "#9c27b0"}`,
                      borderRadius: "6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: isPublished ? "#4a148c" : "#9c27b0",
                      fontSize: "12px",
                    }}>
                      Vol {vi.volume}
                      {vi.dateString && <div style={{ fontSize: "10px", fontWeight: "normal" }}>{vi.dateString}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "flex", gap: "10px", padding: "16px 28px", borderTop: "1px solid #eee", backgroundColor: "#fafafa", borderRadius: "0 0 15px 15px" }}>
          {phone && (
            <button
              onClick={() => (window.location.href = `tel:${phone.replace(/\s/g, "")}`)}
              style={{ ...actionBtnStyle, backgroundColor: "#4caf50", flex: 1 }}
            >
              📞 전화 걸기
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `업체명: ${customer[1]}\n주소: ${customer[2]}\n전화: ${phone}\n모바일: ${mobile}\n광고: ${size}\n단가: $${price}`
              );
              alert("고객 정보가 클립보드에 복사되었습니다!");
            }}
            style={{ ...actionBtnStyle, backgroundColor: "#2196F3", flex: 1 }}
          >
            📋 정보 복사
          </button>
          <button onClick={onClose} style={{ ...actionBtnStyle, backgroundColor: "#e0e0e0", color: "#333" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// 메인 CustomerCard (mode에 따라 분기)
// ──────────────────────────────────────────────────────────────────────────────
const CustomerCard = ({ customer, onClose, onSave, mode }) => {
  if (!customer) return null;
  const resolvedMode = mode || "legacy";

  if (resolvedMode === "sheet") {
    return <SheetCustomerCard customer={customer} onClose={onClose} onSave={onSave} />;
  }
  return <LegacyCustomerCard customer={customer} onClose={onClose} />;
};

export default CustomerCard;

// ──────────────────────────────────────────────────────────────────────────────
// 공통 스타일
// ──────────────────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex", justifyContent: "center", alignItems: "center",
  zIndex: 9999, padding: "20px",
};

const modalStyle = {
  backgroundColor: "#fff",
  borderRadius: "15px",
  maxWidth: "860px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  background: "linear-gradient(135deg, #d32f2f 0%, #c62828 100%)",
  padding: "22px 28px",
  borderRadius: "15px 15px 0 0",
  color: "#fff",
  position: "relative",
  flexShrink: 0,
};

const closeBtnStyle = {
  position: "absolute", top: "16px", right: "16px",
  background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
  fontSize: "22px", width: "36px", height: "36px", borderRadius: "50%",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const avatarStyle = {
  width: "52px", height: "52px", borderRadius: "50%",
  backgroundColor: "rgba(255,255,255,0.2)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "22px", fontWeight: "bold",
};

const badgeStyle = {
  display: "inline-block", padding: "4px 10px",
  backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "12px",
  fontSize: "13px",
};

const gridStyle = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px",
};

const labelStyle = {
  fontSize: "11px", color: "#888", marginBottom: "4px", fontWeight: "500",
};

const valueStyle = {
  fontSize: "14px", color: "#333", wordBreak: "break-word",
};

const inputStyle = {
  width: "100%", padding: "8px 10px", fontSize: "14px",
  border: "2px solid #d32f2f", borderRadius: "6px",
  outline: "none", boxSizing: "border-box",
};

const actionBtnStyle = {
  padding: "12px",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background 0.2s",
};

// InfoRow 컴포넌트 (기존 카드용)
const InfoRow = ({ label, value, icon, valueStyle: vs, fullWidth }) => (
  <div style={{ gridColumn: fullWidth ? "1 / -1" : "auto", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
    <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px", fontWeight: "500" }}>
      {icon && <span style={{ marginRight: "4px" }}>{icon}</span>}{label}
    </div>
    <div style={{ fontSize: "14px", color: "#333", wordBreak: "break-word", ...vs }}>{value || "-"}</div>
  </div>
);

// SectionTitle 컴포넌트
const SectionTitle = ({ children, color = "#d32f2f" }) => (
  <h3 style={{ color: "#333", borderBottom: `2px solid ${color}`, paddingBottom: "8px", marginBottom: "16px", fontSize: "15px" }}>
    {children}
  </h3>
);
