import React, { useState } from "react";

// ⚠️ 자동추가.gs 배포 후 URL을 여기에 붙여넣으세요
const GAS_URL = "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

const AD_TYPES = ["inside", "outside", "online", "Yellow Page", "Flea Market"];
const AD_SIZES = ["FC", "1/2", "1/4", "옐로페이지", "온라인 포함"];

/**
 * 새 고객 문의 추가 폼 (광고접수인덱스 연동)
 * 컬럼: No, Date, Customer, Charger, Position, Phone, Email, AD Type, Size, Start Date, Vol, Term, Remark, Follow Up
 */
const AddCustomerForm = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    customerName: "",
    charger: "",       // 담당자
    position: "",      // 직책
    phone: "",
    email: "",
    adType: "",        // AD Type
    size: "FC",        // Size
    startDate: "",     // Start Date
    remark: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = "업체명은 필수입니다";
    if (!formData.phone.trim()) newErrors.phone = "전화번호는 필수입니다";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // GAS로 자동 등록
  const handleAutoAdd = async () => {
    if (!validate()) return;
    if (!GAS_URL) {
      alert("⚠️ GAS URL이 설정되지 않았습니다.\nAddCustomerForm.js 상단의 GAS_URL에 배포 URL을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          date: new Date().toISOString().split("T")[0],
          source: "CRM",
          followUp: "CRM 수동 입력",
        }),
      });

      alert("✅ 광고접수인덱스에 자동 추가되었습니다!");
      if (onAdd) onAdd(formData);
      onClose();
    } catch (err) {
      alert("❌ 전송 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 클립보드 복사 (GAS 미설정 시 대안)
  const handleCopy = () => {
    if (!validate()) return;
    const row = [
      "",                     // No (자동)
      new Date().toISOString().split("T")[0], // Date
      formData.customerName,
      formData.charger,
      formData.position,
      formData.phone,
      formData.email,
      formData.adType,
      formData.size,
      formData.startDate,
      "", "", "",              // Vol, Term, blank
      formData.remark,
      "CRM 수동 입력",         // Follow Up
    ].join("\t");

    navigator.clipboard.writeText(row).then(() => {
      alert("✅ 클립보드에 복사됐습니다!\n광고접수인덱스 시트에 붙여넣기(Ctrl+V) 하세요.");
      if (onAdd) onAdd(formData);
      onClose();
    }).catch(() => {
      alert("복사 실패. 수동으로 입력하세요:\n" + row);
    });
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 9999, padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: "15px",
          maxWidth: "680px", width: "100%",
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
          padding: "25px 30px", borderRadius: "15px 15px 0 0",
          color: "#fff", position: "relative",
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: "20px", right: "20px",
            background: "rgba(255,255,255,0.2)", border: "none",
            color: "#fff", fontSize: "24px", width: "40px", height: "40px",
            borderRadius: "50%", cursor: "pointer",
          }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px",
            }}>➕</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>새 광고 문의 접수</h2>
              <div style={{ fontSize: "13px", marginTop: "4px", opacity: 0.9 }}>
                📊 광고접수인덱스-2026에 자동 저장됩니다
              </div>
            </div>
          </div>
        </div>

        {/* 폼 */}
        <div style={{ padding: "30px" }}>
          {/* 기본 정보 */}
          <Section title="📋 업체 정보" color="#4caf50">
            <FormField label="업체명 *" value={formData.customerName}
              onChange={(v) => handleChange("customerName", v)}
              placeholder="예: Awesome Academy" error={errors.customerName} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <FormField label="담당자" value={formData.charger}
                onChange={(v) => handleChange("charger", v)} placeholder="예: 홍길동" />
              <FormField label="직책" value={formData.position}
                onChange={(v) => handleChange("position", v)} placeholder="예: 대표" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <FormField label="전화번호 *" value={formData.phone}
                onChange={(v) => handleChange("phone", v)}
                placeholder="예: 090-123-4567" error={errors.phone} />
              <FormField label="이메일" value={formData.email}
                onChange={(v) => handleChange("email", v)} placeholder="예: info@company.com" />
            </div>
          </Section>

          {/* 광고 정보 */}
          <Section title="📄 광고 문의 정보" color="#2196F3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#333" }}>
                  광고 유형
                </label>
                <select value={formData.adType}
                  onChange={(e) => handleChange("adType", e.target.value)}
                  style={{ width: "100%", padding: "12px", border: "2px solid #ddd", borderRadius: "8px", fontSize: "14px" }}>
                  <option value="">선택하세요</option>
                  {AD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#333" }}>
                  광고 사이즈
                </label>
                <select value={formData.size}
                  onChange={(e) => handleChange("size", e.target.value)}
                  style={{ width: "100%", padding: "12px", border: "2px solid #ddd", borderRadius: "8px", fontSize: "14px" }}>
                  {AD_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <FormField label="희망 시작일" value={formData.startDate}
              onChange={(v) => handleChange("startDate", v)}
              placeholder="예: 2026-03-01" type="date" />

            <FormField label="비고 / 메모" value={formData.remark}
              onChange={(v) => handleChange("remark", v)}
              placeholder="예: 이메일 문의, 단가표 요청 등" multiline />
          </Section>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: "10px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
            <button onClick={onClose} style={btnStyle("#f5f5f5", "#666")}>취소</button>

            <button onClick={handleCopy} style={btnStyle("#ff9800", "#fff")} disabled={loading}>
              📋 클립보드 복사
            </button>

            <button onClick={handleAutoAdd} style={btnStyle("#4caf50", "#fff")} disabled={loading}>
              {loading ? "저장 중..." : "✅ 광고접수인덱스 자동 저장"}
            </button>
          </div>

          {!GAS_URL && (
            <div style={{
              marginTop: "12px", padding: "10px", backgroundColor: "#fff3e0",
              border: "1px solid #ff9800", borderRadius: "6px", fontSize: "12px", color: "#e65100"
            }}>
              ⚠️ GAS URL 미설정 — 현재는 클립보드 복사만 가능합니다.
              자동추가.gs 배포 후 AddCustomerForm.js 상단의 GAS_URL에 입력해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 섹션 래퍼
const Section = ({ title, color, children }) => (
  <section style={{ marginBottom: "25px" }}>
    <h3 style={{ color: "#333", borderBottom: `2px solid ${color}`, paddingBottom: "10px", marginBottom: "20px" }}>
      {title}
    </h3>
    {children}
  </section>
);

// 버튼 스타일
const btnStyle = (bg, color) => ({
  flex: 1, padding: "14px", backgroundColor: bg, color,
  border: "none", borderRadius: "8px", fontSize: "15px",
  fontWeight: "bold", cursor: "pointer",
});

// 폼 필드
const FormField = ({ label, value, onChange, placeholder, type = "text", error, multiline = false }) => {
  const inputStyle = {
    width: "100%", padding: "12px",
    border: error ? "2px solid #f44336" : "2px solid #ddd",
    borderRadius: "8px", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: "15px" }}>
      <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#333" }}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle} />
      )}
      {error && <div style={{ color: "#f44336", fontSize: "12px", marginTop: "5px" }}>⚠️ {error}</div>}
    </div>
  );
};

export default AddCustomerForm;
