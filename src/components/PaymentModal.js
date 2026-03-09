import React, { useState, useEffect } from "react";

// GAS 배포 URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

const PAYMENT_METHODS = ["이체", "현금", "카드", "기타"];

// 숫자를 VND 한국식 표기로 변환 (예: 12,345,678 동)
const formatVND = (num) => {
    if (!num || isNaN(num)) return "";
    return Math.round(num).toLocaleString("ko-KR") + " đ";
};

/**
 * 수금 입력 모달 (USD + VND 동시 표기)
 * - 모달 열릴 때 당일 USD/VND 환율 자동 조회
 * - USD 입력 → VND 실시간 환산 표시
 * - VND 직접 수정 가능 (역산으로 USD 업데이트)
 * - GAS PAYMENT action으로 USD, VND, 환율 모두 저장
 */
const PaymentModal = ({ lead, onClose, onSuccess }) => {
    const today = new Date().toISOString().split("T")[0];

    const [formData, setFormData] = useState({
        date: today,
        amountUSD: "",
        amountVND: "",
        method: "이체",
        memo: "",
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // 환율 상태
    const [exchangeRate, setExchangeRate] = useState(null); // USD → VND
    const [rateLoading, setRateLoading] = useState(true);
    const [rateError, setRateError] = useState(false);
    const [rateSource, setRateSource] = useState(""); // 환율 출처 표시

    // 모달 열릴 때 환율 자동 조회
    useEffect(() => {
        const fetchRate = async () => {
            setRateLoading(true);
            setRateError(false);
            try {
                // 무료 환율 API (CORS 허용, 하루 1,500회 무료)
                const res = await fetch("https://open.er-api.com/v6/latest/USD");
                if (!res.ok) throw new Error("API 응답 오류");
                const data = await res.json();
                const rate = data.rates?.VND;
                if (!rate) throw new Error("VND 환율 없음");
                setExchangeRate(Math.round(rate));
                // 업데이트 시각 표기
                const updatedAt = data.time_last_update_utc
                    ? new Date(data.time_last_update_utc).toLocaleDateString("ko-KR", { timeZone: "Asia/Ho_Chi_Minh" })
                    : "오늘";
                setRateSource(`환율 기준: ${updatedAt} • open.er-api.com`);
            } catch (err) {
                console.warn("[PaymentModal] 환율 조회 실패:", err.message);
                // 실패 시 기본값 (约 2024-2025 USD/VND 평균)
                setExchangeRate(25000);
                setRateError(true);
                setRateSource("환율 조회 실패 – 기본값 25,000 VND 적용 (수동 수정 가능)");
            } finally {
                setRateLoading(false);
            }
        };
        fetchRate();
    }, []);

    // USD 변경 → VND 자동 계산
    const handleUSDChange = (val) => {
        setFormData(prev => {
            const usdNum = parseFloat(val);
            const vnd = exchangeRate && !isNaN(usdNum) ? Math.round(usdNum * exchangeRate) : "";
            return { ...prev, amountUSD: val, amountVND: vnd !== "" ? String(vnd) : "" };
        });
        if (errors.amountUSD) setErrors(prev => ({ ...prev, amountUSD: null }));
    };

    // VND 변경 → USD 역산
    const handleVNDChange = (val) => {
        const vndNum = parseFloat(val.replace(/,/g, ""));
        setFormData(prev => {
            const usd = exchangeRate && !isNaN(vndNum) ? (vndNum / exchangeRate).toFixed(2) : "";
            return { ...prev, amountVND: val, amountUSD: usd !== "" ? String(usd) : "" };
        });
    };

    // 환율 직접 수정
    const handleRateChange = (val) => {
        const rate = parseInt(val.replace(/,/g, ""), 10);
        if (!isNaN(rate) && rate > 0) {
            setExchangeRate(rate);
            // 이미 입력된 USD가 있으면 VND 재계산
            const usdNum = parseFloat(formData.amountUSD);
            if (!isNaN(usdNum)) {
                setFormData(prev => ({ ...prev, amountVND: String(Math.round(usdNum * rate)) }));
            }
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const e = {};
        const usd = parseFloat(formData.amountUSD);
        if (!formData.amountUSD || isNaN(usd) || usd <= 0) {
            e.amountUSD = "올바른 USD 수금액을 입력해주세요";
        }
        if (!formData.date) e.date = "수금일을 입력해주세요";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        const usd = parseFloat(formData.amountUSD);
        const vnd = parseFloat(formData.amountVND) || Math.round(usd * (exchangeRate || 25000));

        try {
            await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "PAYMENT",
                    customerName: lead.customer,
                    date: formData.date,
                    amount: usd,
                    amountVND: vnd,
                    exchangeRate: exchangeRate || 25000,
                    method: formData.method,
                    memo: formData.memo,
                    contractId: lead.id || "",
                }),
            });

            alert(
                `✅ ${lead.customer} 수금 기록 완료!\n` +
                `💵 USD: $${usd.toLocaleString()}\n` +
                `🇻🇳 VND: ${Math.round(vnd).toLocaleString()} đ\n` +
                `📈 적용 환율: 1 USD = ${(exchangeRate || 25000).toLocaleString()} VND\n` +
                `수금방법: ${formData.method}`
            );
            if (onSuccess) onSuccess(formData);
            onClose();
        } catch (err) {
            alert("❌ 수금 기록 실패: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const usdNum = parseFloat(formData.amountUSD);
    const vndCalc = exchangeRate && !isNaN(usdNum) ? Math.round(usdNum * exchangeRate) : null;

    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                display: "flex", justifyContent: "center", alignItems: "center",
                zIndex: 10000, padding: "20px",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: "#fff", borderRadius: "16px",
                    maxWidth: "500px", width: "100%", maxHeight: "92vh", overflowY: "auto",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div style={{
                    background: "linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)",
                    padding: "22px 26px", borderRadius: "16px 16px 0 0",
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
                            backgroundColor: "rgba(255,255,255,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px",
                        }}>💰</div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>수금 입력</h2>
                            <div style={{ fontSize: "13px", marginTop: "3px", opacity: 0.9 }}>
                                USD 견적 → VND 실수금 자동 환산
                            </div>
                        </div>
                    </div>
                </div>

                {/* 폼 */}
                <div style={{ padding: "24px 26px" }}>

                    {/* 고객사 */}
                    <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#f5f5f5", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "18px" }}>🏢</span>
                        <div>
                            <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>고객사</div>
                            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>{lead.customer}</div>
                        </div>
                    </div>

                    {/* 환율 표시 박스 */}
                    <div style={{
                        marginBottom: "18px", padding: "12px 16px",
                        background: rateError ? "#fff3e0" : "#e0f7fa",
                        border: `1px solid ${rateError ? "#ffb74d" : "#80deea"}`,
                        borderRadius: "10px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "18px" }}>📈</span>
                                <div>
                                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                                        {rateLoading ? "환율 조회 중..." : rateError ? "⚠️ 환율 조회 실패 (수동 입력)" : "오늘의 USD/VND 환율"}
                                    </div>
                                    <div style={{ fontSize: "16px", fontWeight: "bold", color: rateError ? "#e65100" : "#00838f" }}>
                                        {rateLoading ? "—" : `1 USD = ${(exchangeRate || 0).toLocaleString()} VND`}
                                    </div>
                                    {!rateLoading && (
                                        <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>{rateSource}</div>
                                    )}
                                </div>
                            </div>
                            {/* 환율 직접 수정 입력 */}
                            {!rateLoading && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                                    <div style={{ fontSize: "10px", color: "#888" }}>환율 수동 조정</div>
                                    <input
                                        type="number"
                                        value={exchangeRate || ""}
                                        onChange={e => handleRateChange(e.target.value)}
                                        style={{
                                            width: "110px", padding: "6px 10px", fontSize: "13px",
                                            border: "1px solid #b2dfdb", borderRadius: "6px",
                                            outline: "none", textAlign: "right",
                                            background: "#fff",
                                        }}
                                        placeholder="예: 25000"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 수금일 */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", marginBottom: "7px", fontWeight: "600", color: "#333", fontSize: "14px" }}>
                            📅 수금일 *
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={e => handleChange("date", e.target.value)}
                            style={{
                                width: "100%", padding: "11px 14px", fontSize: "14px",
                                border: errors.date ? "2px solid #f44336" : "2px solid #ddd",
                                borderRadius: "8px", outline: "none", boxSizing: "border-box",
                            }}
                        />
                        {errors.date && <div style={{ color: "#f44336", fontSize: "12px", marginTop: "4px" }}>⚠️ {errors.date}</div>}
                    </div>

                    {/* USD / VND 동시 입력 */}
                    <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#333", fontSize: "14px" }}>
                            💰 수금액 *
                        </label>

                        {/* USD 입력 */}
                        <div style={{ marginBottom: "8px" }}>
                            <div style={{ position: "relative" }}>
                                <span style={{
                                    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                                    fontSize: "15px", fontWeight: "bold", color: "#4caf50",
                                }}>$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    placeholder="USD 금액 (예: 500)"
                                    value={formData.amountUSD}
                                    onChange={e => handleUSDChange(e.target.value)}
                                    style={{
                                        width: "100%", padding: "12px 14px 12px 30px", fontSize: "16px",
                                        border: errors.amountUSD ? "2px solid #f44336" : "2px solid #4caf50",
                                        borderRadius: "8px", outline: "none", boxSizing: "border-box",
                                        fontWeight: "bold",
                                    }}
                                />
                            </div>
                            {errors.amountUSD && <div style={{ color: "#f44336", fontSize: "12px", marginTop: "4px" }}>⚠️ {errors.amountUSD}</div>}
                        </div>

                        {/* 환산 화살표 */}
                        <div style={{ textAlign: "center", fontSize: "18px", color: "#aaa", margin: "4px 0" }}>⇅</div>

                        {/* VND 입력/표시 */}
                        <div>
                            <div style={{ position: "relative" }}>
                                <span style={{
                                    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                                    fontSize: "13px", fontWeight: "bold", color: "#e53935",
                                }}>₫</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="100000"
                                    placeholder={rateLoading ? "환율 조회 중..." : "VND 금액 (자동 계산 또는 직접 입력)"}
                                    value={formData.amountVND}
                                    onChange={e => handleVNDChange(e.target.value)}
                                    style={{
                                        width: "100%", padding: "12px 14px 12px 30px", fontSize: "16px",
                                        border: "2px solid #ef9a9a",
                                        borderRadius: "8px", outline: "none", boxSizing: "border-box",
                                        fontWeight: "bold",
                                        backgroundColor: formData.amountVND ? "#fff8f8" : "#fafafa",
                                    }}
                                />
                            </div>
                            {/* VND 텍스트 표기 */}
                            {vndCalc && (
                                <div style={{
                                    marginTop: "6px", padding: "8px 14px",
                                    background: "linear-gradient(90deg, #ffebee, #fff8f8)",
                                    borderRadius: "6px", border: "1px solid #ffcdd2",
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                }}>
                                    <span style={{ fontSize: "12px", color: "#888" }}>🇻🇳 실수금액</span>
                                    <span style={{ fontSize: "15px", fontWeight: "bold", color: "#c62828" }}>
                                        {formatVND(vndCalc)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 수금방법 */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", marginBottom: "7px", fontWeight: "600", color: "#333", fontSize: "14px" }}>
                            💳 수금방법
                        </label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m}
                                    onClick={() => handleChange("method", m)}
                                    style={{
                                        padding: "8px 18px",
                                        backgroundColor: formData.method === m ? "#00bcd4" : "#f5f5f5",
                                        color: formData.method === m ? "#fff" : "#555",
                                        border: `2px solid ${formData.method === m ? "#00bcd4" : "#ddd"}`,
                                        borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 비고 */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", marginBottom: "7px", fontWeight: "600", color: "#333", fontSize: "14px" }}>
                            📝 비고
                        </label>
                        <textarea
                            placeholder="예: 2월분 광고비 (이체 확인)"
                            value={formData.memo}
                            onChange={e => handleChange("memo", e.target.value)}
                            rows={2}
                            style={{
                                width: "100%", padding: "11px 14px", fontSize: "14px",
                                border: "2px solid #ddd", borderRadius: "8px", outline: "none",
                                boxSizing: "border-box", resize: "vertical",
                            }}
                        />
                    </div>

                    {/* 요약 박스 (금액 입력 후 표시) */}
                    {formData.amountUSD && !isNaN(usdNum) && usdNum > 0 && (
                        <div style={{
                            marginBottom: "16px", padding: "14px 16px",
                            background: "linear-gradient(135deg, #e8f5e9, #e0f2f1)",
                            border: "1px solid #a5d6a7",
                            borderRadius: "10px",
                        }}>
                            <div style={{ fontSize: "11px", color: "#555", marginBottom: "8px", fontWeight: "bold" }}>📋 수금 요약</div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontSize: "13px", color: "#555" }}>USD 금액</span>
                                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#2e7d32" }}>$ {usdNum.toLocaleString()}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontSize: "13px", color: "#555" }}>VND 환산</span>
                                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#c62828" }}>
                                    {formatVND(parseFloat(formData.amountVND) || vndCalc)}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "11px", color: "#888" }}>적용 환율</span>
                                <span style={{ fontSize: "11px", color: "#888" }}>1 USD = {(exchangeRate || 25000).toLocaleString()} VND</span>
                            </div>
                        </div>
                    )}

                    {/* 버튼 */}
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1, padding: "13px", backgroundColor: "#f5f5f5", color: "#666",
                                border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "bold", cursor: "pointer",
                            }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || rateLoading}
                            style={{
                                flex: 2, padding: "13px",
                                backgroundColor: (loading || rateLoading) ? "#b2ebf2" : "#00bcd4",
                                color: "#fff", border: "none", borderRadius: "8px",
                                fontSize: "14px", fontWeight: "bold",
                                cursor: (loading || rateLoading) ? "not-allowed" : "pointer",
                                transition: "background 0.2s",
                            }}
                        >
                            {rateLoading ? "환율 조회 중..." : loading ? "저장 중..." : "💰 수금 기록 저장"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
