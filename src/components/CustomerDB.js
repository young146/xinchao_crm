import React, { useState, useEffect, useCallback } from "react";

/**
 * 고객DB 탭 컴포넌트
 * Google Sheets 고객DB 탭 데이터를 리스트로 표시
 * 더블클릭 → 개별 고객 카드 팝업 열기
 *
 * 고객DB 시트 컬럼 구조:
 *   A(0): 고객사명  B(1): 담당자  C(2): 직책  D(3): 연락처  E(4): 이메일
 *   F(5): 주소      G(6): AREA    H(7): CITY
 *   I(8): 가입출처  J(9): 현재상태  K(10): 영업단계  L(11): 최근상담일
 *   M(12): 상담횟수  N(13): 광고상품  O(14): 계약금액($)  P(15): 수금액($)
 *   Q(16): 미수금($)  R(17): 최종업데이트
 */

// 고객DB 탭을 포함하는 직원 구글 시트 ID
const SHEET_ID = "1Iue5sV2PE3c6rqLuVozrp14JiKciGyKvbP8bJheqWlA";
const SHEET_TAB = "고객DB";

const STATUS_COLOR = {
    "계약": "#c8e6c9",
    "상담중": "#e3f2fd",
    "완납": "#e8f5e9",
    "미수금": "#ffccbc",
    "종료": "#f5f5f5",
    "문의": "#fff9c4",
};
const STATUS_TEXT_COLOR = {
    "계약": "#2e7d32",
    "상담중": "#1565c0",
    "완납": "#1b5e20",
    "미수금": "#bf360c",
    "종료": "#616161",
    "문의": "#f57f17",
};

const CustomerDB = ({ onSelectCustomer, onCustomersLoaded }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

    const fetchCustomerDB = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("시트를 불러올 수 없습니다.");
            const text = await res.text();

            // CSV 파싱 (간단한 방식)
            const rows = text.split("\n").map((line) => {
                // 따옴표로 감싸진 셀 처리
                const result = [];
                let inQuote = false;
                let cell = "";
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') {
                        if (inQuote && line[i + 1] === '"') {
                            cell += '"';
                            i++;
                        } else {
                            inQuote = !inQuote;
                        }
                    } else if (ch === "," && !inQuote) {
                        result.push(cell);
                        cell = "";
                    } else {
                        cell += ch;
                    }
                }
                result.push(cell);
                return result;
            });

            // 첫 행은 헤더 → 제거
            const dataRows = rows.slice(1).filter(
                (row) => row[0] && row[0].trim() !== "" && row[0].trim() !== "고객사"
            );
            setCustomers(dataRows);
            if (onCustomersLoaded) onCustomersLoaded(dataRows);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomerDB();
    }, [fetchCustomerDB]);

    // 검색 필터
    const filtered = customers.filter((row) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (row[0] || "").toLowerCase().includes(term) || // 고객사명
            (row[1] || "").toLowerCase().includes(term) || // 담당자
            (row[3] || "").toLowerCase().includes(term) || // 연락처
            (row[4] || "").toLowerCase().includes(term) || // 이메일
            (row[5] || "").toLowerCase().includes(term)    // 주소
        );
    });

    // 정렬
    const sorted = [...filtered].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const idx = sortConfig.key;
        const aVal = (a[idx] || "").toLowerCase();
        const bVal = (b[idx] || "").toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        setSortConfig((prev) =>
            prev.key === key
                ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
                : { key, direction: "asc" }
        );
    };

    const sortIcon = (key) => {
        if (sortConfig.key !== key) return " ↕";
        return sortConfig.direction === "asc" ? " ↑" : " ↓";
    };

    if (loading) {
        return (
            <div style={{ padding: "60px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "16px" }}>⏳</div>
                <div style={{ color: "#666", fontSize: "16px" }}>
                    고객 DB를 불러오는 중...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: "30px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>❌</div>
                <div style={{ color: "#d32f2f", marginBottom: "12px" }}>{error}</div>
                <button
                    onClick={fetchCustomerDB}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px",
                    }}
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: "10px 0" }}>
            {/* 헤더 */}
            <div
                style={{
                    background: "#fff",
                    padding: "20px 24px",
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    marginBottom: "16px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0, color: "#333", fontSize: "18px" }}>
                            👥 고객 명단
                            <span
                                style={{
                                    marginLeft: "10px",
                                    fontSize: "14px",
                                    color: "#888",
                                    fontWeight: "normal",
                                }}
                            >
                                총 {filtered.length}명{" "}
                                {searchTerm && `(검색: "${searchTerm}")`}
                            </span>
                        </h3>
                        <div style={{ fontSize: "13px", color: "#2196F3", marginTop: "4px" }}>
                            💡 고객명을 <strong>더블클릭</strong>하면 상세 카드가 열립니다
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                            type="text"
                            placeholder="🔍 고객사명, 담당자, 연락처 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: "10px 15px",
                                fontSize: "14px",
                                border: "2px solid #ddd",
                                borderRadius: "8px",
                                width: "280px",
                                outline: "none",
                                transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => (e.target.style.borderColor = "#d32f2f")}
                            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
                        />
                        <button
                            onClick={fetchCustomerDB}
                            title="새로고침"
                            style={{
                                padding: "10px 14px",
                                backgroundColor: "#fff",
                                border: "2px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "16px",
                                transition: "border-color 0.2s",
                            }}
                            onMouseEnter={(e) => (e.target.style.borderColor = "#d32f2f")}
                            onMouseLeave={(e) => (e.target.style.borderColor = "#ddd")}
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </div>

            {/* 통계 요약 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "10px",
                    marginBottom: "16px",
                }}
            >
                {[
                    { label: "전체 고객", value: customers.length, color: "#333", bg: "#fff" },
                    {
                        label: "계약",
                        value: customers.filter((r) => r[9] === "계약" || r[10] === "계약").length,
                        color: "#2e7d32",
                        bg: "#e8f5e9",
                    },
                    {
                        label: "상담중",
                        value: customers.filter((r) => r[9] === "상담중" || r[10] === "상담").length,
                        color: "#1565c0",
                        bg: "#e3f2fd",
                    },
                    {
                        label: "완납",
                        value: customers.filter((r) => r[10] === "완납").length,
                        color: "#1b5e20",
                        bg: "#f1f8e9",
                    },
                    {
                        label: "미수금",
                        value: customers.filter((r) => {
                            const v = parseFloat(r[16]) || 0;
                            return v > 0;
                        }).length,
                        color: "#bf360c",
                        bg: "#fbe9e7",
                    },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        style={{
                            padding: "12px 16px",
                            background: stat.bg,
                            borderRadius: "10px",
                            border: `1px solid ${stat.color}22`,
                        }}
                    >
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                            {stat.label}
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: "bold", color: stat.color }}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* 테이블 */}
            <div
                style={{
                    background: "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                }}
            >
                <div style={{ overflowX: "auto", maxHeight: "550px", overflowY: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "13px",
                        }}
                    >
                        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                            <tr style={{ background: "#d32f2f", color: "#fff" }}>
                                <th style={thStyle}>#</th>
                                <th
                                    style={{ ...thStyle, cursor: "pointer", minWidth: "160px" }}
                                    onClick={() => handleSort(0)}
                                >
                                    고객사명{sortIcon(0)}
                                </th>
                                <th style={thStyle}>담당자</th>
                                <th style={thStyle}>연락처</th>
                                <th style={thStyle}>이메일</th>
                                <th style={{ ...thStyle, minWidth: "160px" }}>주소</th>
                                <th style={thStyle}>도시</th>
                                <th
                                    style={{ ...thStyle, cursor: "pointer" }}
                                    onClick={() => handleSort(9)}
                                >
                                    현재상태{sortIcon(9)}
                                </th>
                                <th
                                    style={{ ...thStyle, cursor: "pointer" }}
                                    onClick={() => handleSort(10)}
                                >
                                    영업단계{sortIcon(10)}
                                </th>
                                <th style={thStyle}>최근상담일</th>
                                <th style={thStyle}>상담횟수</th>
                                <th style={thStyle}>광고상품</th>
                                <th style={{ ...thStyle, textAlign: "right" }}>계약금액</th>
                                <th style={{ ...thStyle, textAlign: "right" }}>수금액</th>
                                <th style={{ ...thStyle, textAlign: "right" }}>미수금</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={15}
                                        style={{ padding: "40px", textAlign: "center", color: "#999" }}
                                    >
                                        {searchTerm
                                            ? `"${searchTerm}"에 해당하는 고객이 없습니다`
                                            : "고객 데이터가 없습니다"}
                                    </td>
                                </tr>
                            ) : (
                                sorted.map((row, i) => {
                                    const status = row[9] || "";
                                    const stage = row[10] || "";
                                    const unpaid = parseFloat(row[16]) || 0;
                                    const bgColor = unpaid > 0 ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafafa";

                                    return (
                                        <tr
                                            key={i}
                                            style={{
                                                backgroundColor: bgColor,
                                                borderBottom: "1px solid #f0f0f0",
                                                cursor: "pointer",
                                                transition: "background-color 0.15s",
                                            }}
                                            onMouseEnter={(e) =>
                                                (e.currentTarget.style.backgroundColor = "#e3f2fd")
                                            }
                                            onMouseLeave={(e) =>
                                                (e.currentTarget.style.backgroundColor = bgColor)
                                            }
                                            onDoubleClick={() => {
                                                if (onSelectCustomer) onSelectCustomer(row);
                                            }}
                                            title="더블클릭하면 고객 카드가 열립니다"
                                        >
                                            <td style={tdStyle}>{i + 1}</td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    fontWeight: "600",
                                                    color: "#1a237e",
                                                }}
                                            >
                                                {row[0]}
                                            </td>
                                            <td style={tdStyle}>{row[1]}</td>
                                            <td style={{ ...tdStyle, fontSize: "12px" }}>{row[3]}</td>
                                            <td style={{ ...tdStyle, fontSize: "11px", color: "#555" }}>
                                                {row[4]}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    fontSize: "11px",
                                                    color: "#666",
                                                    maxWidth: "200px",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={row[5]}
                                            >
                                                {row[5]}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: "12px" }}>{row[7]}</td>
                                            <td style={tdStyle}>
                                                {status && (
                                                    <span
                                                        style={{
                                                            padding: "3px 8px",
                                                            borderRadius: "10px",
                                                            fontSize: "11px",
                                                            fontWeight: "bold",
                                                            backgroundColor:
                                                                STATUS_COLOR[status] || "#f5f5f5",
                                                            color: STATUS_TEXT_COLOR[status] || "#333",
                                                        }}
                                                    >
                                                        {status}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                {stage && (
                                                    <span
                                                        style={{
                                                            padding: "3px 8px",
                                                            borderRadius: "10px",
                                                            fontSize: "11px",
                                                            backgroundColor:
                                                                STATUS_COLOR[stage] || "#f5f5f5",
                                                            color: STATUS_TEXT_COLOR[stage] || "#333",
                                                        }}
                                                    >
                                                        {stage}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: "12px", color: "#666" }}>
                                                {row[11]}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: "center" }}>
                                                {row[12] ? (
                                                    <span
                                                        style={{
                                                            padding: "2px 8px",
                                                            backgroundColor: "#e3f2fd",
                                                            borderRadius: "10px",
                                                            fontSize: "12px",
                                                            color: "#1565c0",
                                                        }}
                                                    >
                                                        {row[12]}회
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: "12px" }}>{row[13]}</td>
                                            <td style={{ ...tdStyle, textAlign: "right", color: "#1565c0", fontWeight: "500" }}>
                                                {row[14] ? `$${parseFloat(row[14]).toLocaleString()}` : "-"}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: "right", color: "#2e7d32", fontWeight: "500" }}>
                                                {row[15] ? `$${parseFloat(row[15]).toLocaleString()}` : "-"}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    textAlign: "right",
                                                    fontWeight: "bold",
                                                    color: unpaid > 0 ? "#c62828" : "#9e9e9e",
                                                }}
                                            >
                                                {unpaid > 0 ? `$${unpaid.toLocaleString()}` : "-"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "12px", color: "#bbb", fontSize: "12px" }}>
                마지막 업데이트: {new Date().toLocaleString("ko-KR")} · Google Sheets 고객DB 탭 연동
            </div>
        </div>
    );
};

const thStyle = {
    padding: "12px 10px",
    textAlign: "left",
    fontWeight: "600",
    fontSize: "12px",
    borderBottom: "2px solid rgba(255,255,255,0.3)",
    whiteSpace: "nowrap",
};

const tdStyle = {
    padding: "10px",
    verticalAlign: "middle",
};

export default CustomerDB;
