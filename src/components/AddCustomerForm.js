import React, { useState } from "react";

/**
 * 신규 광고 상담 접수 폼
 * 대상: 광고 관리 통합 Sheet > 상담이력 탭 (GAS action: CONSULT)
 *
 * 컬럼 매핑 (CONSULT_COL):
 *   DATE(1), CUSTOMER(2), CHARGER(3), TITLE(4), PHONE(5), EMAIL(6),
 *   METHOD(8), CONTENT(9), STATUS(13), PRODUCT(15), MEMO(20)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

const CONTACT_METHODS = ["전화", "이메일", "방문", "소개", "온라인문의", "기타"];
const AD_PRODUCTS = ["inside", "outside", "online", "Yellow Page", "Flea Market", "기타"];

const AddCustomerForm = ({ onClose, onAdd }) => {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    customerName: "",    // CUSTOMER(2)
    charger: "",         // CHARGER(3) - 담당자
    position: "",        // TITLE(4) - 직책
    phone: "",           // PHONE(5)
    email: "",           // EMAIL(6)
    contactMethod: "전화", // METHOD(8) - 접촉 방법
    content: "",         // CONTENT(9) - 상담 내용
    adType: "",          // PRODUCT(15) - 광고 상품
    memo: "",            // MEMO(20)
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (!formData.customerName.trim()) e.customerName = "업체명은 필수입니다";
    if (!formData.phone.trim()) e.phone = "전화번호는 필수입니다";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── GAS로 CONSULT 액션 전송 → 상담이력 탭에 기록 ───────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONSULT",          // ← 반드시 CONSULT 지정
          date: today,
          customerName: formData.customerName,
          charger: formData.charger,
          position: formData.position,
          phone: formData.phone,
          email: formData.email,
          contactMethod: formData.contactMethod,
          remark: formData.content,   // GAS의 CONTENT(9) 매핑
          adType: formData.adType,
          memo: formData.memo,
          source: "CRM",
        }),
      });

      alert(
        `✅ 상담 접수 완료!\n` +
        `고객사: ${formData.customerName}\n` +
        `→ 광고 관리 통합 Sheet > 상담이력 탭에 기록됩니다.\n` +
        `(Sheet 반영까지 수 초 소요, 파이프라인 새로고침 버튼을 누르세요)`
      );

      // 파이프라인 전체 새로고침 요청 (onAdd에 null 전달 → searchTerm 오염 방지)
      if (onAdd) onAdd(null);
      onClose();
    } catch (err) {
      alert("❌ 전송 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 9999, padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: "16px",
          maxWidth: "620px", width: "100%",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          background: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
          padding: "22px 28px", borderRadius: "16px 16px 0 0",
          color: "#fff", position: "relative",
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: "16px", right: "16px",
            background: "rgba(255,255,255,0.2)", border: "none",
            color: "#fff", fontSize: "22px", width: "36px", height: "36px",
            borderRadius: "50%", cursor: "pointer",
          }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px",
            }}>📋</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>신규 광고 상담 접수</h2>
              <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>
                📊 광고 관리 통합 Sheet → 상담이력 탭에 자동 저장
              </div>
            </div>
          </div>
        </div>

        {/* 폼 */}
        <div style={{ padding: "26px 28px" }}>

          {/* 업체 기본 정보 */}
          <SectionTitle>🏢 업체 정보</SectionTitle>

          <FormField label="업체명 *" error={errors.customerName}>
            <input
              value={formData.customerName}
              onChange={e => handleChange("customerName", e.target.value)}
              placeholder="예: Awesome Academy"
              style={inputStyle(errors.customerName)}
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="담당자">
              <input value={formData.charger}
                onChange={e => handleChange("charger", e.target.value)}
                placeholder="예: 홍길동" style={inputStyle()} />
            </FormField>
            <FormField label="직책">
              <input value={formData.position}
                onChange={e => handleChange("position", e.target.value)}
                placeholder="예: 대표" style={inputStyle()} />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="전화번호 *" error={errors.phone}>
              <input value={formData.phone}
                onChange={e => handleChange("phone", e.target.value)}
                placeholder="예: 090-123-4567" style={inputStyle(errors.phone)} />
            </FormField>
            <FormField label="이메일">
              <input value={formData.email} type="email"
                onChange={e => handleChange("email", e.target.value)}
                placeholder="예: info@company.com" style={inputStyle()} />
            </FormField>
          </div>

          {/* 상담 정보 */}
          <SectionTitle>📞 상담 정보</SectionTitle>

          <FormField label="접촉 방법">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {CONTACT_METHODS.map(m => (
                <button key={m} onClick={() => handleChange("contactMethod", m)}
                  style={{
                    padding: "7px 14px",
                    backgroundColor: formData.contactMethod === m ? "#d32f2f" : "#f5f5f5",
                    color: formData.contactMethod === m ? "#fff" : "#555",
                    border: `1px solid ${formData.contactMethod === m ? "#d32f2f" : "#ddd"}`,
                    borderRadius: "6px", cursor: "pointer", fontSize: "13px",
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="상담 내용">
            <textarea
              value={formData.content}
              onChange={e => handleChange("content", e.target.value)}
              placeholder="예: 잡지 광고 문의, 단가표 요청 등"
              rows={3}
              style={{ ...inputStyle(), resize: "vertical" }}
            />
          </FormField>

          {/* 광고 정보 */}
          <SectionTitle>📢 광고 정보</SectionTitle>

          <FormField label="광고 상품">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {AD_PRODUCTS.map(p => (
                <button key={p} onClick={() => handleChange("adType", p)}
                  style={{
                    padding: "7px 14px",
                    backgroundColor: formData.adType === p ? "#1976d2" : "#f5f5f5",
                    color: formData.adType === p ? "#fff" : "#555",
                    border: `1px solid ${formData.adType === p ? "#1976d2" : "#ddd"}`,
                    borderRadius: "6px", cursor: "pointer", fontSize: "13px",
                  }}>
                  {p}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="메모">
            <input value={formData.memo}
              onChange={e => handleChange("memo", e.target.value)}
              placeholder="내부 메모 (Sheet 메모 컬럼에 저장됩니다)"
              style={inputStyle()} />
          </FormField>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: "10px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
            <button onClick={onClose} style={btnStyle("#f5f5f5", "#666")}>
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={btnStyle(loading ? "#ef9a9a" : "#d32f2f", "#fff")}
            >
              {loading ? "저장 중..." : "✅ 상담이력 탭에 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 헬퍼 컴포넌트 ──────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <h3 style={{
    margin: "16px 0 12px", fontSize: "14px", fontWeight: "bold",
    color: "#555", borderBottom: "2px solid #eee", paddingBottom: "8px",
  }}>{children}</h3>
);

const FormField = ({ label, children, error }) => (
  <div style={{ marginBottom: "14px" }}>
    <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "13px", color: "#333" }}>
      {label}
    </label>
    {children}
    {error && <div style={{ color: "#f44336", fontSize: "12px", marginTop: "4px" }}>⚠️ {error}</div>}
  </div>
);

const inputStyle = (error) => ({
  width: "100%", padding: "10px 12px", fontSize: "14px",
  border: error ? "2px solid #f44336" : "2px solid #ddd",
  borderRadius: "8px", outline: "none", boxSizing: "border-box",
});

const btnStyle = (bg, color) => ({
  flex: 1, padding: "13px", backgroundColor: bg, color,
  border: "none", borderRadius: "8px", fontSize: "14px",
  fontWeight: "bold", cursor: "pointer",
});

export default AddCustomerForm;
