/**
 * 계약 상태 판단 유틸리티
 */

import { getCurrentVolume as getAutoVolume } from './volumeSchedule';

// 현재 진행 중인 호수 (자동 계산 또는 수동 설정)
export const CURRENT_VOLUME = getAutoVolume(); // volumeSchedule.js에서 자동 계산

// 수동으로 현재 호수를 강제 설정하려면:
// export const CURRENT_VOLUME = 553;

/**
 * 계약 상태 판단
 */
export const getContractStatus = (startVol, endVol, currentVol = CURRENT_VOLUME) => {
  if (!startVol || !endVol) {
    return {
      status: "UNKNOWN", // 호수 정보 없음
      label: "호수 정보 없음",
      color: "#9e9e9e",
      description: "계약 호수 정보가 없습니다"
    };
  }

  // 아직 시작 안 됨
  if (currentVol < startVol) {
    return {
      status: "UPCOMING",
      label: "계약 예정",
      color: "#2196F3",
      description: `Vol ${startVol}부터 시작 예정`
    };
  }

  // 진행 중
  if (currentVol >= startVol && currentVol <= endVol) {
    const remaining = endVol - currentVol;
    return {
      status: "ACTIVE",
      label: "광고 게재 중",
      color: "#4caf50",
      description: `${remaining + 1}개 호 남음 (현재 Vol ${currentVol})`
    };
  }

  // 만료됨
  if (currentVol > endVol) {
    const expiredIssues = currentVol - endVol;
    return {
      status: "EXPIRED",
      label: "계약 만료",
      color: "#f44336",
      description: `Vol ${endVol}에 종료 (${expiredIssues}개 호 전 만료)`
    };
  }

  return {
    status: "UNKNOWN",
    label: "상태 불명",
    color: "#9e9e9e",
    description: "계약 상태를 확인할 수 없습니다"
  };
};

/**
 * 수금 상태 판단 (전액선불/일부선불/매호정산/지연/연체)
 */
export const getPaymentStatus = (totalAmount, received, startVol, endVol, currentVol = CURRENT_VOLUME) => {
  if (totalAmount === 0) {
    return {
      status: "UNKNOWN",
      label: "수금 정보 없음",
      color: "#9e9e9e",
      icon: "❓",
      paymentType: "UNKNOWN"
    };
  }

  const unpaid = totalAmount - received;
  const paymentRate = (received / totalAmount) * 100;

  // 전액 수금 완료 (100% 이상)
  if (unpaid <= 0) {
    return {
      status: "PAID_IN_FULL",
      label: "전액 수금 완료",
      color: "#4caf50",
      icon: "✅",
      description: "전액 수금 완료",
      paymentType: paymentRate >= 100 ? "FULL_PREPAID" : "COMPLETED"
    };
  }

  // 계약 진행 중인 경우 상세 분석
  if (startVol && endVol && currentVol && currentVol >= startVol && currentVol <= endVol) {
    const totalIssues = endVol - startVol + 1;
    const publishedIssues = Math.max(0, Math.min(currentVol, endVol) - startVol + 1);
    const pricePerIssue = totalAmount / totalIssues;
    const expectedPayment = publishedIssues * pricePerIssue;

    // 게재 대비 수금 비율
    const collectionVsPublished = (received / expectedPayment) * 100;

    // 1. 전액 선불 (80% 이상 선불)
    if (paymentRate >= 80) {
      return {
        status: "FULL_PREPAID",
        label: "전액 선불",
        color: "#1565c0",
        icon: "💰💰",
        description: `${totalIssues}개 호 중 ${publishedIssues}개 게재, ${paymentRate.toFixed(0)}% 선수금`,
        paymentType: "FULL_PREPAID"
      };
    }

    // 2. 일부 선불 (게재분보다 많이 받았지만 전액은 아님)
    if (collectionVsPublished > 120) {
      const prepaidIssues = Math.floor(received / pricePerIssue);
      return {
        status: "PARTIAL_PREPAID",
        label: "일부 선불",
        color: "#2196F3",
        icon: "💰",
        description: `${totalIssues}개 호 중 ${prepaidIssues}개 호분 선불 (게재: ${publishedIssues}개)`,
        paymentType: "PARTIAL_PREPAID"
      };
    }

    // 3. 매호 정산 (게재분과 거의 일치)
    if (collectionVsPublished >= 80 && collectionVsPublished <= 120) {
      return {
        status: "PAY_PER_ISSUE",
        label: "매호 정산",
        color: "#4caf50",
        icon: "📅",
        description: `${publishedIssues}개 호 게재, ${publishedIssues}개 호분 수금 (정상)`,
        paymentType: "PAY_PER_ISSUE"
      };
    }

    // 4. 수금 지연 (게재분보다 적게 받음)
    if (collectionVsPublished < 80) {
      const delayedIssues = publishedIssues - Math.floor(received / pricePerIssue);
      return {
        status: "DELAYED",
        label: "수금 지연",
        color: "#ff9800",
        icon: "⏳",
        description: `${publishedIssues}개 호 게재, ${delayedIssues}개 호분 미수금`,
        paymentType: "DELAYED"
      };
    }
  }

  // 계약 만료 + 미수금 (연체)
  if (currentVol && endVol && currentVol > endVol && unpaid > 0) {
    const overdueMonths = currentVol - endVol;
    return {
      status: "OVERDUE",
      label: "연체",
      color: "#f44336",
      icon: "🚨",
      description: `계약 만료 ${overdueMonths}개 호 전, 미수금 $${unpaid.toLocaleString()}`,
      paymentType: "OVERDUE"
    };
  }

  // 계약 예정 (아직 시작 안 됨)
  if (currentVol && startVol && currentVol < startVol) {
    if (received > 0) {
      return {
        status: "PREPAID_BEFORE_START",
        label: "계약 전 선불",
        color: "#2196F3",
        icon: "💰",
        description: `계약 시작 전 $${received.toLocaleString()} 선수금`,
        paymentType: "PREPAID_BEFORE_START"
      };
    }
  }

  // 일반 진행 중 (호수 정보 없는 경우)
  if (paymentRate >= 50) {
    return {
      status: "IN_PROGRESS",
      label: "수금 진행 중",
      color: "#ff9800",
      icon: "⏳",
      description: `${paymentRate.toFixed(1)}% 수금`,
      paymentType: "IN_PROGRESS"
    };
  }

  // 수금률 낮음
  return {
    status: "LOW_COLLECTION",
    label: "수금 필요",
    color: "#f44336",
    icon: "🔴",
    description: `${paymentRate.toFixed(1)}% 수금 (미수금 많음)`,
    paymentType: "LOW_COLLECTION"
  };
};

/**
 * 계약 진행률 계산
 */
export const getContractProgress = (startVol, endVol, currentVol = CURRENT_VOLUME) => {
  if (!startVol || !endVol) {
    return 0;
  }

  const totalIssues = endVol - startVol + 1;
  const publishedIssues = Math.max(0, Math.min(currentVol, endVol) - startVol + 1);

  return Math.min(100, (publishedIssues / totalIssues) * 100);
};

/**
 * 다음 행동 제안
 */
export const getNextAction = (contractStatus, paymentStatus, unpaid) => {
  // 계약 만료 + 미수금
  if (contractStatus.status === "EXPIRED" && paymentStatus.status === "OVERDUE") {
    return {
      priority: "HIGH",
      action: "즉시 연락",
      message: "계약 만료 후 미수금이 있습니다. 즉시 수금 필요합니다.",
      icon: "🚨"
    };
  }

  // 계약 만료 예정 + 수금률 낮음
  if (contractStatus.status === "ACTIVE" && paymentStatus.status === "LOW_COLLECTION") {
    return {
      priority: "MEDIUM",
      action: "수금 독촉",
      message: "계약 진행 중이지만 수금률이 낮습니다. 수금 독촉이 필요합니다.",
      icon: "⚠️"
    };
  }

  // 계약 만료 예정 (재계약 제안)
  if (contractStatus.status === "ACTIVE") {
    const remainingIssues = contractStatus.description.match(/(\d+)개 호 남음/);
    if (remainingIssues && parseInt(remainingIssues[1]) <= 2) {
      return {
        priority: "MEDIUM",
        action: "재계약 제안",
        message: "계약 종료가 임박했습니다. 재계약을 제안하세요.",
        icon: "📞"
      };
    }
  }

  // 선불 + 계약 진행 중
  if (paymentStatus.status === "PREPAID" && contractStatus.status === "ACTIVE") {
    return {
      priority: "LOW",
      action: "정상 관리",
      message: "선불로 수금 완료. 계약이 정상 진행 중입니다.",
      icon: "✅"
    };
  }

  // 수금 완료
  if (paymentStatus.status === "PAID_IN_FULL") {
    return {
      priority: "LOW",
      action: "감사 인사",
      message: "전액 수금 완료. 감사 인사 및 재계약 논의",
      icon: "🎉"
    };
  }

  return {
    priority: "LOW",
    action: "정상 관리",
    message: "정상적으로 관리 중입니다.",
    icon: "✅"
  };
};

/**
 * 현재 호수 업데이트 (관리자용)
 */
export const updateCurrentVolume = (newVolume) => {
  // TODO: 실제로는 localStorage나 서버에 저장
  console.log(`현재 호수를 Vol ${newVolume}로 업데이트했습니다.`);
  return newVolume;
};
