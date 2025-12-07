// 251207 신규작성 - Capacity 및 Loan 관련 설정

//----------------------------
// 1) 일반 대출 기준 최대 가능 원금(억) 계산 (DTI 기반)
// computeCustomLoanCapacity
//----------------------------

export function computeCustomLoanCapacity(loanIncome, loanYears, loanRate, loanExposure) {
  // loanIncome: 만원/년, loanExposure: 만원, loanRate: % (연)
  if (!loanIncome || loanIncome <= 0) return 0;
  if (!loanYears || loanYears <= 0) return 0;
  if (!loanRate || loanRate <= 0) return 0;

  const maxAnnualPayment = loanIncome * 0.4; // (a) 연간 상환 가능액 (만원)
  const M = maxAnnualPayment / 12; // (b) 월 상환 가능액 (만원)
  const N = loanYears * 12; // (c) 상환 횟수(개월)
  const r = loanRate / 100 / 12; // 월 이자율

  let P; // (d) 최대 원금 (만원)
  if (r <= 0) {
    P = M * N;
  } else {
    const factor = Math.pow(1 + r, N);
    P = M * (factor - 1) / (r * factor);
  }

  const PF = P - (loanExposure || 0); // (e) 기존 대출 차감
  const capacity_uk = PF / 10000; // 만원 → 억

  return capacity_uk > 0 ? capacity_uk : 0;
}

//----------------------------
// 2) 정책대출 계산(LTV + Max Loan)
// computePolicyLoan
//----------------------------
export function computePolicyLoan(price, loanConfig) {
  if (!loanConfig) return 0;
  const maxByLtv = loanConfig.ltv * price;
  return Math.min(loanConfig.maxLoan, maxByLtv);
}

// ----------------------------
// 3) 구매 가능 여부 판단 기준
// getEffectiveBudget
// ----------------------------
export function getEffectiveBudget(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  let finalBudget = budget;

  // 1. 매물가격 현금으로 커버 가능하면, 총 여력을 최대화
//   if (budget >= price) {
//     if (selectedLoan === "CUSTOM" && customLoanCapacity && customLoanCapacity > 0) {
//       return budget + customLoanCapacity;
//     }
//     return budget;
//   }
  // 2. 일반 대출 선택 시 → customLoanCapacity(억) 사용
  if (selectedLoan === "CUSTOM" && customLoanCapacity && customLoanCapacity > 0) {
    const ltvLimit = price * 0.7;
    const usableLoan = Math.min(customLoanCapacity, ltvLimit);
    finalBudget = budget + usableLoan; // LTV 제한된 금액을 더함
  }

  // 3. 정책 대출
  else if (loanConfig) {
    const maxLoanByLtv = loanConfig.ltv * price;
    const usableLoan = Math.min(loanConfig.maxLoan, maxLoanByLtv);
    finalBudget = budget + usableLoan;
  }

  // 대출 없음
  return finalBudget;
}

// ----------------------------
// 4) UI 메시지용 (MapView에서 사용)
// getBuyingPower
// ----------------------------
export function getBuyingPower(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  return getEffectiveBudget(
    price,
    budget,
    loanConfig,
    customLoanCapacity,
    selectedLoan
  );
}
// ----------------------------
// 5) 버블컬러 색상 추출용
// getBubbleColor
// ----------------------------
/* ---------------- Bubble Coloring ---------------- */
export function getBubbleColor(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  const eff = getEffectiveBudget(
    price,
    budget,
    loanConfig,
    customLoanCapacity,
    selectedLoan
  );
  const diff = eff - price;

  if (diff >= 2) return "#22c55e"; // 충분 여유
  if (diff >= 1) return "#fb923c"; // 안전
  if (diff >= 0) return "#ec5353"; // 아슬아슬
  return null; // 못 삼
}

// ----------------------------
// 6) 메시지용
// getAffordabilityMessage
// ----------------------------
export function getAffordabilityMessage(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  const eff = getBuyingPower(price, budget, loanConfig, customLoanCapacity, selectedLoan);
  const diff = eff - price;

  if (diff >= 2) return "구매에 충분한 여유가 있어요! 😊";
  if (diff >= 1) return "구매하기에 적당해요 🙂";
  if (diff >= 0) return "조금 빠듯하지만 구매 가능해요 😬";
  return "예산을 초과했어요 ❌";
}
