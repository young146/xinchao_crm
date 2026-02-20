import React, { useState, useEffect } from "react";
import {
  getLatestSchedule,
  getCurrentVolume,
  getNextVolume,
  formatDate,
  formatDateSimple,
  analyzePublishingCycle,
} from "../utils/volumeSchedule";

/**
 * 볼륨 발행 일정 관리 컴포넌트
 */
const VolumeSchedule = () => {
  const [schedule, setSchedule] = useState({});
  const currentVol = getCurrentVolume();
  const nextVol = getNextVolume(currentVol);
  const [selectedMonth, setSelectedMonth] = useState(2); // 2월 기본

  // 초기 로드 및 업데이트 감지
  useEffect(() => {
    loadSchedule();

    const handleUpdate = () => {
      loadSchedule();
    };

    window.addEventListener("volumeScheduleUpdated", handleUpdate);

    return () => {
      window.removeEventListener("volumeScheduleUpdated", handleUpdate);
    };
  }, []);

  const loadSchedule = () => {
    setSchedule(getLatestSchedule());
  };

  // 월별 볼륨 필터링
  const getVolumesForMonth = (month) => {
    return Object.entries(schedule)
      .filter(([vol, info]) => {
        const date = new Date(info.date);
        return date.getFullYear() === 2026 && date.getMonth() + 1 === month;
      })
      .map(([vol, info]) => ({
        volume: parseInt(vol),
        ...info,
        cycle: analyzePublishingCycle(parseInt(vol)),
      }))
      .sort((a, b) => a.volume - b.volume);
  };

  const monthlyVolumes = getVolumesForMonth(selectedMonth);

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
        📅 볼륨 발행 일정 관리
      </h2>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        매거진 발행 일정을 관리하고 계약 기간을 날짜로 확인하세요
      </p>

      {/* 현재 및 다음 발행 정보 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        {/* 현재 발행 */}
        <div
          style={{
            backgroundColor: "#e8f5e9",
            padding: "20px",
            borderRadius: "10px",
            border: "3px solid #4caf50",
          }}
        >
          <h3 style={{ color: "#2e7d32", marginTop: 0 }}>
            📖 현재 발행 중
          </h3>
          <div style={{ fontSize: "48px", fontWeight: "bold", color: "#2e7d32" }}>
            Vol {currentVol}
          </div>
          <div style={{ fontSize: "16px", color: "#666", marginTop: "10px" }}>
            발행일: {formatDate(schedule[currentVol]?.date)}
          </div>
        </div>

        {/* 다음 발행 */}
        {nextVol && (
          <div
            style={{
              backgroundColor: "#e3f2fd",
              padding: "20px",
              borderRadius: "10px",
              border: "3px solid #2196F3",
            }}
          >
            <h3 style={{ color: "#1565c0", marginTop: 0 }}>
              📆 다음 발행 예정
            </h3>
            <div style={{ fontSize: "48px", fontWeight: "bold", color: "#1565c0" }}>
              Vol {nextVol.volume}
            </div>
            <div style={{ fontSize: "16px", color: "#666", marginTop: "10px" }}>
              {nextVol.daysUntil > 0
                ? `${nextVol.daysUntil}일 후 발행`
                : "오늘 발행"}
            </div>
            <div style={{ fontSize: "14px", color: "#999" }}>
              {formatDate(nextVol.date)}
            </div>
          </div>
        )}
      </div>

      {/* 월별 탭 */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "10px",
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
          <button
            key={month}
            onClick={() => setSelectedMonth(month)}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: selectedMonth === month ? "#d32f2f" : "#fff",
              color: selectedMonth === month ? "#fff" : "#333",
              border: "2px solid #d32f2f",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: selectedMonth === month ? "bold" : "normal",
              whiteSpace: "nowrap",
            }}
          >
            {month}월
          </button>
        ))}
      </div>

      {/* 월별 발행 일정 */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          📋 {selectedMonth}월 발행 일정
          <span
            style={{
              fontSize: "14px",
              color: "#666",
              fontWeight: "normal",
              marginLeft: "10px",
            }}
          >
            (총 {monthlyVolumes.length}개)
          </span>
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "15px",
          }}
        >
          {monthlyVolumes.map((volInfo) => {
            const isPublished = volInfo.status === "published";
            const isCurrent = volInfo.volume === currentVol;

            return (
              <div
                key={volInfo.volume}
                style={{
                  padding: "15px",
                  backgroundColor: isCurrent
                    ? "#fff3e0"
                    : isPublished
                      ? "#f5f5f5"
                      : "#e3f2fd",
                  border: isCurrent
                    ? "3px solid #ff9800"
                    : isPublished
                      ? "2px solid #ccc"
                      : "2px solid #2196F3",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: isCurrent ? "#e65100" : isPublished ? "#666" : "#1976d2",
                    }}
                  >
                    Vol {volInfo.volume}
                  </div>
                  <div
                    style={{
                      padding: "4px 10px",
                      backgroundColor: isCurrent
                        ? "#ff9800"
                        : isPublished
                          ? "#4caf50"
                          : "#2196F3",
                      color: "#fff",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {isCurrent ? "현재" : isPublished ? "발행됨" : "예정"}
                  </div>
                </div>

                <div style={{ fontSize: "14px", color: "#333", marginBottom: "8px" }}>
                  📅 {formatDateSimple(volInfo.date)}
                </div>

                {volInfo.cycle && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: volInfo.cycle.isRegular ? "#4caf50" : "#ff9800",
                      padding: "6px 10px",
                      backgroundColor: volInfo.cycle.isRegular
                        ? "#e8f5e9"
                        : "#fff3e0",
                      borderRadius: "5px",
                    }}
                  >
                    {volInfo.cycle.isRegular ? "📆" : "⚠️"} {volInfo.cycle.label}{" "}
                    ({volInfo.cycle.days}일)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {monthlyVolumes.length === 0 && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#999",
            }}
          >
            이 달에는 발행 일정이 없습니다.
          </div>
        )}
      </div>

      {/* 발행 주기 안내 */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#fff3e0",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ color: "#e65100", marginTop: 0 }}>📌 발행 주기 안내</h3>
        <ul style={{ lineHeight: "2" }}>
          <li>
            <strong>기본 주기:</strong> 한 달에 2번 (격주, 약 14일)
          </li>
          <li>
            <strong>예외 주기:</strong> 3개월에 한 번씩 3주 간격 (약 21일)
          </li>
          <li>
            <strong>휴일 조정:</strong> 신년, 구정, 노동절 등 연휴 시 일정 조정
          </li>
          <li>
            <strong>일정 업데이트:</strong> 실제 발행 후 status를 "published"로
            변경
          </li>
        </ul>
      </div>

      {/* 편집 가이드 */}
      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          backgroundColor: "#e8f5e9",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ color: "#2e7d32", marginTop: 0 }}>⚙️ 일정 수정 방법</h3>
        <p style={{ lineHeight: "1.8", color: "#666" }}>
          발행 일정을 수정하려면{" "}
          <code
            style={{
              backgroundColor: "#fff",
              padding: "2px 6px",
              borderRadius: "3px",
              fontFamily: "monospace",
            }}
          >
            src/utils/volumeSchedule.js
          </code>{" "}
          파일의 <code>VOLUME_SCHEDULE</code> 객체를 편집하세요.
        </p>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "15px",
            borderRadius: "5px",
            fontFamily: "monospace",
            fontSize: "13px",
            marginTop: "10px",
          }}
        >
          <div style={{ color: "#999" }}>{/* 예시: */}</div>
          <div>
            <span style={{ color: "#9c27b0" }}>554</span>: {"{"}{" "}
            <span style={{ color: "#1976d2" }}>date</span>:{" "}
            <span style={{ color: "#d32f2f" }}>"2026-02-20"</span>,{" "}
            <span style={{ color: "#1976d2" }}>status</span>:{" "}
            <span style={{ color: "#d32f2f" }}>"published"</span> {"}"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolumeSchedule;
