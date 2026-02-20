/**
 * 볼륨(호수) 발행 일정 관리
 * 
 * 기본 원칙:
 * - 한 달에 2번 (격주) 발행
 * - 3개월에 한 번씩 3주 간격으로 발행되는 예외 있음
 */

/**
 * localStorage에서 사용자 설정 가져오기
 */
const getUserSchedule = () => {
  try {
    const saved = localStorage.getItem("volumeSchedule");
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("사용자 일정 로드 실패:", error);
    return {};
  }
};

/**
 * 2026년 볼륨 발행 일정 (기본값)
 * 실제 발행일을 수동으로 관리 (발행 후 업데이트)
 */
export const DEFAULT_VOLUME_SCHEDULE = {
  // 2025년 하반기 (참고용)
  540: { date: "2025-07-15", status: "published" },
  541: { date: "2025-08-01", status: "published" },
  542: { date: "2025-08-15", status: "published" },
  543: { date: "2025-09-01", status: "published" },
  544: { date: "2025-09-15", status: "published" },
  545: { date: "2025-10-01", status: "published" },
  546: { date: "2025-10-15", status: "published" },
  547: { date: "2025-11-01", status: "published" },
  548: { date: "2025-11-15", status: "published" },
  549: { date: "2025-12-01", status: "published" },
  550: { date: "2025-12-15", status: "published" },

  // 2026년
  551: { date: "2026-01-05", status: "published" },  // 신년 휴가로 지연
  552: { date: "2026-01-20", status: "published" },  // 3주 간격 (예외)
  553: { date: "2026-02-05", status: "published" },  // 구정 연휴 고려
  554: { date: "2026-02-20", status: "planned" },    // 격주 복귀
  555: { date: "2026-03-05", status: "planned" },
  556: { date: "2026-03-19", status: "planned" },
  557: { date: "2026-04-02", status: "planned" },
  558: { date: "2026-04-16", status: "planned" },
  559: { date: "2026-05-07", status: "planned" },    // 노동절 연휴로 지연
  560: { date: "2026-05-21", status: "planned" },    // 3주 간격 (예외)
  561: { date: "2026-06-04", status: "planned" },
  562: { date: "2026-06-18", status: "planned" },
  563: { date: "2026-07-02", status: "planned" },
  564: { date: "2026-07-16", status: "planned" },
  565: { date: "2026-08-06", status: "planned" },
  566: { date: "2026-08-20", status: "planned" },
  567: { date: "2026-09-03", status: "planned" },
  568: { date: "2026-09-17", status: "planned" },
  569: { date: "2026-10-01", status: "planned" },
  570: { date: "2026-10-15", status: "planned" },
  571: { date: "2026-11-05", status: "planned" },
  572: { date: "2026-11-19", status: "planned" },
  573: { date: "2026-12-03", status: "planned" },
  574: { date: "2026-12-17", status: "planned" },
};

/**
 * 실제 사용되는 발행 일정 (기본값 + 사용자 설정 병합)
 */
export const VOLUME_SCHEDULE = (() => {
  const userSchedule = getUserSchedule();
  return { ...DEFAULT_VOLUME_SCHEDULE, ...userSchedule };
})();

/**
 * 현재 발행 중인 볼륨 가져오기 (오늘 날짜 기준)
 */
export const getCurrentVolume = () => {
  const today = new Date();

  // 최신 일정 가져오기 (localStorage 포함)
  const schedule = getLatestSchedule();

  // 오늘 날짜와 가장 가까운 이전 발행일 찾기
  let currentVol = null;
  let closestDate = null;

  Object.entries(schedule).forEach(([vol, info]) => {
    const volDate = new Date(info.date);
    if (volDate <= today && info.status === "published") {
      if (!closestDate || volDate > closestDate) {
        closestDate = volDate;
        currentVol = parseInt(vol);
      }
    }
  });

  return currentVol || 553; // 기본값
};

/**
 * 최신 일정 가져오기 (실시간 업데이트 반영)
 */
export const getLatestSchedule = () => {
  const userSchedule = getUserSchedule();
  return { ...DEFAULT_VOLUME_SCHEDULE, ...userSchedule };
};

/**
 * 볼륨 번호로 발행 날짜 가져오기
 */
export const getVolumeDate = (volumeNumber) => {
  const info = VOLUME_SCHEDULE[volumeNumber];
  if (!info) return null;

  return new Date(info.date);
};

/**
 * 볼륨 범위의 시작/종료 날짜 가져오기
 */
export const getContractDates = (startVol, endVol) => {
  if (!startVol || !endVol) {
    return { startDate: null, endDate: null };
  }

  const startDate = getVolumeDate(startVol);
  const endDate = getVolumeDate(endVol);

  return {
    startDate,
    endDate,
    duration: startDate && endDate
      ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      : null
  };
};

/**
 * 날짜를 한국어 형식으로 포맷
 */
export const formatDate = (date) => {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  return `${year}년 ${month}월 ${day}일`;
};

/**
 * 날짜를 간단 형식으로 포맷 (2026.02.05)
 */
export const formatDateSimple = (date) => {
  if (!date) return "-";

  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
};

/**
 * 다음 발행 예정 볼륨 가져오기
 */
export const getNextVolume = (currentVol = getCurrentVolume()) => {
  const nextVol = currentVol + 1;
  const info = VOLUME_SCHEDULE[nextVol];

  if (!info) return null;

  const today = new Date();
  const publishDate = new Date(info.date);
  const daysUntil = Math.ceil((publishDate - today) / (1000 * 60 * 60 * 24));

  return {
    volume: nextVol,
    date: publishDate,
    daysUntil,
    status: info.status
  };
};

/**
 * 볼륨 범위의 모든 발행일 가져오기
 */
export const getVolumeRangeDates = (startVol, endVol) => {
  if (!startVol || !endVol) return [];

  const dates = [];
  for (let vol = startVol; vol <= endVol; vol++) {
    const info = VOLUME_SCHEDULE[vol];
    if (info) {
      dates.push({
        volume: vol,
        date: new Date(info.date),
        dateString: formatDateSimple(info.date),
        status: info.status
      });
    }
  }

  return dates;
};

/**
 * 계약 상태를 날짜 기준으로 판단
 */
export const getContractStatusByDate = (startVol, endVol) => {
  if (!startVol || !endVol) {
    return {
      status: "UNKNOWN",
      label: "정보 없음",
      color: "#9e9e9e"
    };
  }

  const today = new Date();
  const startDate = getVolumeDate(startVol);
  const endDate = getVolumeDate(endVol);

  if (!startDate || !endDate) {
    return {
      status: "UNKNOWN",
      label: "일정 미정",
      color: "#9e9e9e"
    };
  }

  // 아직 시작 안 됨
  if (today < startDate) {
    const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
    return {
      status: "UPCOMING",
      label: "계약 예정",
      color: "#2196F3",
      description: `${daysUntil}일 후 시작 (${formatDateSimple(startDate)})`
    };
  }

  // 진행 중
  if (today >= startDate && today <= endDate) {
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    return {
      status: "ACTIVE",
      label: "광고 게재 중",
      color: "#4caf50",
      description: `${daysRemaining}일 남음 (${formatDateSimple(endDate)}까지)`
    };
  }

  // 만료됨
  if (today > endDate) {
    const daysExpired = Math.ceil((today - endDate) / (1000 * 60 * 60 * 24));
    return {
      status: "EXPIRED",
      label: "계약 만료",
      color: "#f44336",
      description: `${daysExpired}일 전 만료 (${formatDateSimple(endDate)})`
    };
  }
};

/**
 * 발행 주기 분석 (격주 vs 3주)
 */
export const analyzePublishingCycle = (volumeNumber) => {
  const current = VOLUME_SCHEDULE[volumeNumber];
  const previous = VOLUME_SCHEDULE[volumeNumber - 1];

  if (!current || !previous) return null;

  const currentDate = new Date(current.date);
  const previousDate = new Date(previous.date);
  const daysDiff = Math.ceil((currentDate - previousDate) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 16) {
    return {
      cycle: "biweekly",
      label: "격주 발행",
      days: daysDiff,
      isRegular: true
    };
  } else {
    return {
      cycle: "triweekly",
      label: "3주 간격 발행",
      days: daysDiff,
      isRegular: false,
      reason: "휴일 또는 특별 일정"
    };
  }
};

/**
 * 현재 Vol 자동 업데이트 (관리자용)
 */
export const updateVolumeStatus = (volumeNumber, status = "published") => {
  // TODO: 실제로는 서버나 localStorage에 저장
  console.log(`Vol ${volumeNumber} 상태를 "${status}"로 업데이트했습니다.`);
  return {
    volume: volumeNumber,
    status,
    date: VOLUME_SCHEDULE[volumeNumber]?.date
  };
};
