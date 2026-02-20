/**
 * ADVERTISEMENT DETAILS → 고객관리 시트 데이터 변환 유틸리티
 */

/**
 * 전화번호 문자열을 파싱하여 전화번호와 모바일로 분리
 */
export const parsePhoneNumbers = (telString) => {
  if (!telString) return { phone: "", mobile: "" };
  
  const phones = telString.split(/[;\/,]/).map(p => p.trim()).filter(p => p);
  return {
    phone: phones[0] || "",
    mobile: phones[1] || ""
  };
};

/**
 * 광고 사이즈를 기반으로 고객 유형 판단
 */
export const determineCustomerType = (size) => {
  if (!size) return "";
  
  const sizeUpper = size.toUpperCase().trim();
  
  if (sizeUpper === "FC") return "대형광고주";
  if (sizeUpper.includes("1/2")) return "중형광고주";
  if (sizeUpper.includes("1/4")) return "소형광고주";
  if (sizeUpper.includes("YELLOW")) return "옐로우페이지";
  if (sizeUpper.includes("FLEA")) return "프리마켓";
  
  return "기타";
};

/**
 * Remarks 필드에서 호수 범위 추출
 * 예: "552~557", "549~560", "monthly~Jul'26"
 */
export const parseVolumeRange = (remarks) => {
  if (!remarks) return { startVol: null, endVol: null };
  
  // 숫자~숫자 패턴 찾기
  const match = remarks.match(/(\d+)\s*~\s*(\d+)/);
  if (match) {
    return {
      startVol: parseInt(match[1]),
      endVol: parseInt(match[2])
    };
  }
  
  // 단일 숫자 찾기 (예: "553!")
  const singleMatch = remarks.match(/(\d{3})/);
  if (singleMatch) {
    const vol = parseInt(singleMatch[1]);
    return {
      startVol: vol,
      endVol: vol
    };
  }
  
  return { startVol: null, endVol: null };
};

/**
 * 가격 문자열을 숫자로 변환
 */
export const parsePrice = (priceString) => {
  if (!priceString) return 0;
  
  // $, 쉼표 등 제거하고 숫자만 추출
  const cleaned = priceString.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * 호수 범위에 따라 Vol 550 ~ Vol 574 컬럼 생성
 */
export const generateVolumeColumns = (startVol, endVol, price) => {
  const volumes = {};
  
  for (let vol = 550; vol <= 574; vol++) {
    const key = `Vol ${vol}`;
    // 범위 내에 있으면 가격 입력, 아니면 빈 문자열
    if (startVol && endVol && vol >= startVol && vol <= endVol) {
      volumes[key] = price;
    } else {
      volumes[key] = "";
    }
  }
  
  return volumes;
};

/**
 * 계약 총액 계산
 */
export const calculateTotalAmount = (startVol, endVol, pricePerIssue) => {
  if (!startVol || !endVol || !pricePerIssue) return 0;
  
  const issueCount = endVol - startVol + 1;
  return pricePerIssue * issueCount;
};

/**
 * ADVERTISEMENT DETAILS 행 데이터를 고객관리 시트 형식으로 변환
 * @param {Array} row - [No, CUSTOMER, Address, Tel, PageNo, Size, Price, Received, HaveCollect, Remarks]
 * @returns {Object} 고객관리 시트 형식 객체
 */
export const transformAdRow = (row) => {
  // 원본 데이터 추출
  const [
    no,           // 0
    customer,     // 1
    address,      // 2
    tel,          // 3
    pageNo,       // 4
    size,         // 5
    price,        // 6
    received,     // 7
    haveCollect,  // 8
    remarks       // 9
  ] = row;
  
  // 데이터 파싱
  const { phone, mobile } = parsePhoneNumbers(tel);
  const customerType = determineCustomerType(size);
  const { startVol, endVol } = parseVolumeRange(remarks);
  
  const priceNum = parsePrice(price);
  const receivedNum = parsePrice(received);
  const unpaidNum = parsePrice(haveCollect);
  
  const totalAmount = calculateTotalAmount(startVol, endVol, priceNum);
  const volumeColumns = generateVolumeColumns(startVol, endVol, `$${priceNum}`);
  
  // 고객관리 시트 형식으로 변환
  return {
    "고객 유형": customerType,
    "업체명": customer || "",
    "업종": "", // 원본에 없음 - 수동 입력 필요
    "주소": address || "",
    "대표자": "", // 원본에 없음
    "담당자": "", // 원본에 없음
    "이메일": "", // 원본에 없음
    "전화번호": phone,
    "모바일": mobile,
    "카카오톡": "", // 원본에 없음
    "광고 사이즈": size || "",
    "지면 계약 총액": totalAmount > 0 ? `$${totalAmount}` : "",
    "시작 호수": startVol || "",
    "종료 호수": endVol || "",
    "단가": priceNum > 0 ? `$${priceNum}` : "",
    "온라인 병행 단가": "", // 원본에 없음
    "온라인 기간": "", // 원본에 없음
    "온라인 총액": "", // 원본에 없음
    "시작일": "", // 원본에 없음
    "종료일": "", // 원본에 없음
    "총 계약 금액": totalAmount > 0 ? `$${totalAmount}` : "",
    "온라인 포함 호당 단가": "", // 원본에 없음
    ...volumeColumns,
    "계산서 발행": "", // 원본에 없음
    "누적 미수금": unpaidNum !== 0 ? `$${unpaidNum}` : "$0",
    "최종 상담 기록": remarks || "",
    "추가 상담": "" // 원본에 없음
  };
};

/**
 * 전체 ADVERTISEMENT DETAILS 데이터를 일괄 변환
 * @param {Array} adRows - CSV에서 읽은 행 배열
 * @returns {Array} 변환된 객체 배열
 */
export const transformAllAdData = (adRows) => {
  // 헤더 행 제외 (보통 처음 5-6행은 헤더/설명)
  const dataRows = adRows.slice(6); // 실제 데이터가 시작되는 행부터
  
  return dataRows
    .filter(row => row[1] && row[1].trim()) // 업체명이 있는 행만
    .map(row => transformAdRow(row));
};

/**
 * 변환된 데이터를 CSV 형식 문자열로 내보내기
 */
export const exportToCSV = (transformedData) => {
  if (!transformedData || transformedData.length === 0) return "";
  
  // 헤더 생성
  const headers = Object.keys(transformedData[0]);
  const headerRow = headers.join(",");
  
  // 데이터 행 생성
  const dataRows = transformedData.map(row => {
    return headers.map(header => {
      const value = row[header] || "";
      // 쉼표나 따옴표가 있으면 따옴표로 감싸기
      if (value.includes(",") || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",");
  });
  
  return [headerRow, ...dataRows].join("\n");
};

/**
 * 변환된 데이터를 TSV 형식 문자열로 내보내기 (Google Sheets 붙여넣기용)
 */
export const exportToTSV = (transformedData) => {
  if (!transformedData || transformedData.length === 0) return "";
  
  // 헤더 생성
  const headers = Object.keys(transformedData[0]);
  const headerRow = headers.join("\t");
  
  // 데이터 행 생성 (탭으로 구분)
  const dataRows = transformedData.map(row => {
    return headers.map(header => row[header] || "").join("\t");
  });
  
  return [headerRow, ...dataRows].join("\n");
};

/**
 * 변환 결과를 콘솔에 요약 출력
 */
export const logTransformSummary = (originalData, transformedData) => {
  console.log("=== 데이터 변환 완료 ===");
  console.log(`원본 행 수: ${originalData.length}`);
  console.log(`변환된 행 수: ${transformedData.length}`);
  
  // 고객 유형별 통계
  const typeStats = {};
  transformedData.forEach(row => {
    const type = row["고객 유형"];
    typeStats[type] = (typeStats[type] || 0) + 1;
  });
  
  console.log("\n고객 유형별 통계:");
  Object.entries(typeStats).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}개`);
  });
  
  // 미수금 통계
  const unpaidCustomers = transformedData.filter(row => {
    const unpaid = parsePrice(row["누적 미수금"]);
    return unpaid > 0;
  });
  
  console.log(`\n미수금 있는 고객: ${unpaidCustomers.length}개`);
  
  console.log("\n[수동 입력 필요 항목]");
  console.log("- 업종");
  console.log("- 대표자");
  console.log("- 담당자");
  console.log("- 이메일");
  console.log("- 카카오톡");
  console.log("- 온라인 관련 정보");
  console.log("====================\n");
};
