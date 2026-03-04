import React, { useState, useEffect } from "react";
import {
  DEFAULT_VOLUME_SCHEDULE,
  formatDateSimple,
  getCurrentVolume,
} from "../utils/volumeSchedule";
import { saveVolumeSchedule, listenVolumeSchedule } from "../services/crmFirestore";

const CHANGE_LOG_KEY = "crm_scheduleChangeLogs";

/**
 * 발행 일정 편집기 컴포넌트
 * - 2026년 호수만 표시
 * - 특정 호 날짜 수정 시 다른 호에 영향 없음
 * - 날짜 변경 이력(사유 포함) 저장 및 표시
 */
const VolumeScheduleEditor = () => {
  const [schedule, setSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem("volumeSchedule");
      const localOverrides = saved ? JSON.parse(saved) : {};
      return { ...DEFAULT_VOLUME_SCHEDULE, ...localOverrides };
    } catch {
      return { ...DEFAULT_VOLUME_SCHEDULE };
    }
  });
  const [editingVol, setEditingVol] = useState(null);
  const [editReason, setEditReason] = useState("");
  const [newVolume, setNewVolume] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [changeLogs, setChangeLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadChangeLogs();
    // Firestore 실시간 구독 - 다른 기기 변경시자동 새로고침
    const unsub = listenVolumeSchedule((firestoreOverrides) => {
      let localOverrides = {};
      try {
        const saved = localStorage.getItem("volumeSchedule");
        localOverrides = saved ? JSON.parse(saved) : {};
      } catch { /* ignore */ }
      // Firestore 우선으로 병합
      const allOverrides = { ...localOverrides, ...firestoreOverrides };
      localStorage.setItem("volumeSchedule", JSON.stringify(allOverrides));
      setSchedule({ ...DEFAULT_VOLUME_SCHEDULE, ...allOverrides });
    });
    return () => unsub();
  }, []);

  const loadChangeLogs = () => {
    try {
      const saved = localStorage.getItem(CHANGE_LOG_KEY);
      setChangeLogs(saved ? JSON.parse(saved) : []);
    } catch { setChangeLogs([]); }
  };

  /**
   * 핵심 수정: DEFAULT_VOLUME_SCHEDULE(하드코딩 기본값)과 비교하여 다른 것만 저장
   * 이렇게 해야 A호 수정 시 B호의 이전 오버라이드가 삭제되는 버그를 방지함
   */
  const saveSchedule = (updatedSchedule) => {
    try {
      const customSchedule = {};
      Object.entries(updatedSchedule).forEach(([vol, info]) => {
        const baseInfo = DEFAULT_VOLUME_SCHEDULE[vol];
        if (
          !baseInfo ||
          baseInfo.date !== info.date ||
          baseInfo.status !== info.status
        ) {
          customSchedule[vol] = info;
        }
      });
      // localStorage에 저장
      localStorage.setItem("volumeSchedule", JSON.stringify(customSchedule));
      setSchedule(updatedSchedule);
      window.dispatchEvent(new Event("volumeScheduleUpdated"));
      // Firestore에도 저장 (실시간 동기화)
      saveVolumeSchedule(customSchedule).catch(e => console.error("Firestore 저장 실패:", e));
      showMessage("일정이 저장되었습니다! (Firestore 동기화 중)", "success");
    } catch (error) {
      console.error("일정 저장 실패:", error);
      showMessage("저장에 실패했습니다.", "error");
    }
  };

  const addChangeLog = (vol, oldDate, newDate, reason) => {
    const newLog = {
      vol,
      oldDate,
      newDate,
      reason: reason || "(사유 미입력)",
      timestamp: new Date().toISOString(),
    };
    const updatedLogs = [newLog, ...changeLogs].slice(0, 50); // 최대 50건
    setChangeLogs(updatedLogs);
    localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(updatedLogs));
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const handleUpdateDate = (vol, newDate) => {
    const oldDate = schedule[vol]?.date;
    if (oldDate === newDate) {
      setEditingVol(null);
      return;
    }
    const updated = {
      ...schedule,
      [vol]: { ...schedule[vol], date: newDate },
    };
    saveSchedule(updated);
    addChangeLog(vol, oldDate, newDate, editReason);
    setEditingVol(null);
    setEditReason("");
    showMessage(`Vol ${vol} 날짜 변경: ${formatDateSimple(oldDate)} → ${formatDateSimple(newDate)}`, "success");
  };

  const handleUpdateStatus = (vol, newStatus) => {
    const updated = {
      ...schedule,
      [vol]: { ...schedule[vol], status: newStatus },
    };
    saveSchedule(updated);
  };

  const handleAddVolume = () => {
    if (!newVolume || !newDate) {
      showMessage("호수와 날짜를 입력하세요.", "error");
      return;
    }
    const volNum = parseInt(newVolume);
    if (isNaN(volNum) || volNum < 1) {
      showMessage("올바른 호수를 입력하세요.", "error");
      return;
    }
    if (schedule[volNum] && !window.confirm(`Vol ${volNum}이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
      return;
    }
    const updated = { ...schedule, [volNum]: { date: newDate, status: newStatus } };
    saveSchedule(updated);
    setNewVolume(""); setNewDate(""); setNewStatus("planned");
    showMessage(`Vol ${volNum} 추가됨!`, "success");
  };

  const handleDeleteVolume = (vol) => {
    if (!window.confirm(`Vol ${vol}을 삭제하시겠습니까?`)) return;
    const updated = { ...schedule };
    delete updated[vol];
    saveSchedule(updated);
    showMessage(`Vol ${vol} 삭제됨`, "success");
  };

  const handleQuickPublish = (vol) => {
    const updated = { ...schedule, [vol]: { ...schedule[vol], status: "published" } };
    saveSchedule(updated);
    showMessage(`Vol ${vol} 발행 완료!`, "success");
  };

  const handleResetToDefault = () => {
    if (!window.confirm("모든 사용자 설정을 초기화하고 기본 일정으로 되돌리시겠습니까?")) return;
    localStorage.removeItem("volumeSchedule");
    setSchedule({ ...DEFAULT_VOLUME_SCHEDULE });
    window.dispatchEvent(new Event("volumeScheduleUpdated"));
    showMessage("기본 일정으로 초기화되었습니다.", "success");
  };

  const handleExport = () => {
    const exportData = {
      schedule,
      changeLogs,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `volume-schedule-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    showMessage("일정이 파일로 내보내졌습니다!", "success");
  };

  // 2026년 호수만 필터링
  const currentYear = 2026;
  const sortedVolumes = Object.keys(schedule)
    .map(Number)
    .filter(vol => {
      const info = schedule[vol];
      if (!info?.date) return false;
      return new Date(info.date).getFullYear() === currentYear;
    })
    .sort((a, b) => a - b);

  const currentVol = getCurrentVolume();

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "#d32f2f", margin: 0 }}>⚙️ 발행 일정 관리 ({currentYear})</h2>
          <p style={{ color: "#888", fontSize: "13px", margin: "4px 0 0 0" }}>
            각 호수의 날짜를 수정해도 다른 호수에 영향을 주지 않습니다. 변경 이력이 자동 저장됩니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowLogs(!showLogs)}
            style={{ padding: "8px 14px", backgroundColor: showLogs ? "#ff9800" : "#607d8b", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>
            📋 변경 이력 {changeLogs.length > 0 && `(${changeLogs.length})`}
          </button>
          <button onClick={handleExport}
            style={{ padding: "8px 14px", backgroundColor: "#2196F3", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>
            📥 내보내기
          </button>
          <button onClick={handleResetToDefault}
            style={{ padding: "8px 14px", backgroundColor: "#f44336", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>
            🔄 초기화
          </button>
        </div>
      </div>

      {/* 메시지 */}
      {message.text && (
        <div style={{ padding: "12px 20px", marginBottom: "16px", backgroundColor: message.type === "success" ? "#e8f5e9" : "#ffebee", color: message.type === "success" ? "#2e7d32" : "#c62828", borderRadius: "5px", border: `2px solid ${message.type === "success" ? "#4caf50" : "#f44336"}`, fontWeight: "bold" }}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {/* 변경 이력 패널 */}
      {showLogs && (
        <div style={{ marginBottom: "20px", background: "#fff", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, color: "#607d8b" }}>📋 날짜 변경 이력</h3>
            {changeLogs.length > 0 && (
              <button onClick={() => { if (window.confirm("변경 이력을 모두 삭제하시겠습니까?")) { setChangeLogs([]); localStorage.removeItem(CHANGE_LOG_KEY); } }}
                style={{ padding: "4px 10px", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "4px", cursor: "pointer", fontSize: "12px", color: "#c62828" }}>
                전체 삭제
              </button>
            )}
          </div>
          {changeLogs.length === 0 ? (
            <div style={{ color: "#aaa", textAlign: "center", padding: "20px" }}>변경 이력이 없습니다.</div>
          ) : (
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {changeLogs.map((log, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", background: "#f9f9f9", borderRadius: "6px", marginBottom: "5px", border: "1px solid #eee" }}>
                  <span style={{ minWidth: "60px", fontSize: "13px", fontWeight: "bold", color: "#d32f2f" }}>Vol {log.vol}</span>
                  <span style={{ fontSize: "12px", color: "#888" }}>{formatDateSimple(log.oldDate)} → <strong style={{ color: "#1976d2" }}>{formatDateSimple(log.newDate)}</strong></span>
                  <span style={{ fontSize: "12px", color: "#555", flex: 1 }}>📝 {log.reason}</span>
                  <span style={{ fontSize: "11px", color: "#aaa", whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 새 호수 추가 */}
      <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
        <h3 style={{ marginTop: 0, color: "#333", fontSize: "15px" }}>➕ 새 호수 추가</h3>
        <div style={{ display: "grid", gridTemplateColumns: "130px 180px 130px 1fr auto", gap: "12px", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>호수 번호</label>
            <input type="number" value={newVolume} onChange={e => setNewVolume(e.target.value)} placeholder="예: 575"
              style={{ width: "100%", padding: "8px", fontSize: "14px", border: "2px solid #ddd", borderRadius: "5px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>발행 날짜</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{ width: "100%", padding: "8px", fontSize: "14px", border: "2px solid #ddd", borderRadius: "5px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>상태</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              style={{ width: "100%", padding: "8px", fontSize: "14px", border: "2px solid #ddd", borderRadius: "5px", boxSizing: "border-box" }}>
              <option value="planned">예정</option>
              <option value="published">발행됨</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
            <button onClick={handleAddVolume}
              style={{ padding: "9px 24px", backgroundColor: "#d32f2f", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap" }}>
              ➕ 추가
            </button>
          </div>
        </div>
      </div>

      {/* 일정 목록 - 2026년만 */}
      <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0, color: "#333" }}>
          📋 {currentYear}년 발행 일정
          <span style={{ fontSize: "13px", color: "#666", fontWeight: "normal", marginLeft: "10px" }}>
            (총 {sortedVolumes.length}개 호)
          </span>
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>호수</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>발행 날짜</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>상태</th>
                <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #ddd" }}>간격</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>기본값 대비</th>
                <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #ddd" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedVolumes.map((vol, index) => {
                const info = schedule[vol];
                const prevVol = sortedVolumes[index - 1];
                const prevInfo = prevVol ? schedule[prevVol] : null;

                let daysDiff = null;
                if (prevInfo) {
                  daysDiff = Math.round((new Date(info.date) - new Date(prevInfo.date)) / (1000 * 60 * 60 * 24));
                }

                const isEditing = editingVol === vol;
                const isCurrent = vol === currentVol;
                const isPublished = info.status === "published";
                const baseInfo = DEFAULT_VOLUME_SCHEDULE[vol];
                const isCustomized = baseInfo && baseInfo.date !== info.date;

                return (
                  <tr key={vol} style={{
                    backgroundColor: isCurrent ? "#fff3e0" : isPublished ? "#f9f9f9" : "#e3f2fd",
                    borderBottom: "1px solid #ddd",
                  }}>
                    <td style={{ padding: "10px 12px", fontWeight: isCurrent ? "bold" : "normal" }}>
                      {isCurrent && "🔵 "}Vol {vol}{isCurrent && " (현재)"}
                    </td>
                    <td style={{ padding: "10px 12px", minWidth: "280px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <input type="date" defaultValue={info.date} id={`date-input-${vol}`}
                            style={{ padding: "5px", border: "2px solid #2196F3", borderRadius: "4px", fontSize: "14px" }}
                            autoFocus />
                          <input type="text" placeholder="변경 사유 (예: 추석 연휴로 3주 간격)" value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            style={{ padding: "5px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "12px" }} />
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => {
                              const input = document.getElementById(`date-input-${vol}`);
                              handleUpdateDate(vol, input.value);
                            }} style={{ padding: "4px 12px", background: "#4caf50", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                              ✔ 저장
                            </button>
                            <button onClick={() => { setEditingVol(null); setEditReason(""); }}
                              style={{ padding: "4px 10px", background: "#9e9e9e", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span onClick={() => { setEditingVol(vol); setEditReason(""); }}
                          style={{ cursor: "pointer", padding: "4px 8px", borderRadius: "4px", background: "#fff", border: "1px solid #ddd", fontSize: "14px" }}
                          title="클릭하여 날짜 수정">
                          📅 {formatDateSimple(info.date)} ✏️
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <select value={info.status} onChange={e => handleUpdateStatus(vol, e.target.value)}
                        style={{ padding: "5px 10px", border: "2px solid #ddd", borderRadius: "5px", backgroundColor: isPublished ? "#e8f5e9" : "#fff", cursor: "pointer" }}>
                        <option value="planned">예정</option>
                        <option value="published">발행됨</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {daysDiff !== null ? (
                        <span style={{
                          padding: "3px 10px",
                          backgroundColor: daysDiff >= 19 ? "#fff3e0" : daysDiff <= 15 ? "#fce4ec" : "#e8f5e9",
                          borderRadius: "12px", fontSize: "12px", fontWeight: "bold",
                          color: daysDiff >= 19 ? "#e65100" : daysDiff <= 15 ? "#c62828" : "#2e7d32"
                        }}>
                          {daysDiff >= 19 ? "⚠️ 3주+" : daysDiff <= 15 ? "⚡" : "📆"} {daysDiff}일
                        </span>
                      ) : "-"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {isCustomized ? (
                        <span style={{ fontSize: "11px", color: "#1565c0", background: "#e3f2fd", padding: "2px 8px", borderRadius: "10px" }}>
                          🔧 수정됨 (원: {formatDateSimple(baseInfo.date)})
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#aaa" }}>기본값</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                        {!isPublished && (
                          <button onClick={() => handleQuickPublish(vol)}
                            style={{ padding: "4px 8px", backgroundColor: "#4caf50", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "11px" }}>
                            ✓ 발행
                          </button>
                        )}
                        <button onClick={() => handleDeleteVolume(vol)}
                          style={{ padding: "4px 8px", backgroundColor: "#f44336", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "11px" }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안내 */}
      <div style={{ marginTop: "16px", padding: "16px 20px", backgroundColor: "#e3f2fd", borderRadius: "10px" }}>
        <h4 style={{ marginTop: 0, color: "#1565c0", fontSize: "14px" }}>💡 주의사항</h4>
        <ul style={{ lineHeight: "1.8", color: "#333", fontSize: "13px", margin: 0 }}>
          <li>날짜를 클릭하면 해당 호수의 날짜만 수정됩니다. <strong>다른 호수에 영향 없음</strong></li>
          <li>베트남 공휴일로 3주 간격 발행 시 해당 호만 날짜 수정하세요</li>
          <li>사유를 입력하면 변경 이력에 기록됩니다 (상단 "변경 이력" 버튼)</li>
          <li>수정된 호는 "수정됨 (원: 기본날짜)" 형태로 표시됩니다</li>
        </ul>
      </div>
    </div>
  );
};

export default VolumeScheduleEditor;
