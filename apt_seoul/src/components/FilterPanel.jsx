import { useState } from "react";

// src/components/FilterPanel.jsx
export default function FilterPanel({
  budget,
  setBudget,
  areaRange,
  setAreaRange,
  yearMin,
  setYearMin,        // UI 내 미사용
  loanIncome,
  setLoanIncome,
  selectedLoan,
  setSelectedLoan,
  loanYears,
  setLoanYears,
  loanRate,
  setLoanRate,
  loanExposure,
  setLoanExposure,
}) {
  const [showTipA, setShowTipA] = useState(false);
  const [showTipB, setShowTipB] = useState(false);

  const incomeLabel =
    loanIncome >= 10000
      ? `${(loanIncome / 10000).toFixed(2)}억`
      : `${loanIncome.toLocaleString()}만원`;

  const isAEligible = loanIncome <= 13000; 
  const isBEligible = loanIncome <= 8500;  

  const handleIncomeChange = (e) => {
    const v = parseInt(e.target.value, 10);
    setLoanIncome(v);

    // 소득 요건 안 맞으면 선택 해제
    if (v > 13000 && selectedLoan === "A") setSelectedLoan(null);
    if (v > 8500 && selectedLoan === "B") setSelectedLoan(null);
  };

  const isCustomSelected = selectedLoan === "CUSTOM";

  return (
    <div className="card">
      {/* 프로필 블록 */}
      <div className="profile-block">
        <div className="profile-avatar">
          <img src="/image.png" alt="프로필" />
        </div>
        <div className="profile-name">예비신부 님</div>
        <div className="profile-sub">나의 영끌 예산을 입력하세요.</div>
      </div>

      {/* 예산 */}
      <div className="field">
        <label>예산 ({budget.toFixed(1)}억)</label>
        <input
          type="range"
          min={0}
          max={15}
          step={0.1}
          value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>0억</span>
          <span>15억</span>
        </div>
      </div>

      {/* 면적 */}
      <div className="field">
        <label>면적 ({areaRange[0]}㎡ ~ {areaRange[1]}㎡)</label>
        <div className="dual">
          <input
            type="range"
            min={30}
            max={120}
            value={areaRange[0]}
            onChange={(e) =>
              setAreaRange([
                Math.min(+e.target.value, areaRange[1]),
                areaRange[1],
              ])
            }
          />
          <input
            type="range"
            min={30}
            max={120}
            value={areaRange[1]}
            onChange={(e) =>
              setAreaRange([
                areaRange[0],
                Math.max(+e.target.value, areaRange[0]),
              ])
            }
          />
        </div>
        <div className="scale">
          <span>30㎡</span>
          <span>120㎡</span>
        </div>
      </div>

      {/* 소득 + 대출 영역 */}
      <div
        className="field"
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <label style={{ display: "block", marginBottom: 4 }}>
          부부합산 소득 (연): {incomeLabel}
        </label>

        <input
          type="range"
          min={4000}
          max={15000}
          step={100}
          value={loanIncome}
          onChange={handleIncomeChange}
          style={{ width: "100%" }}
        />

        <div className="scale">
          <span>4,000만</span>
          <span>1억 5,000만</span>
        </div>

        {/* 정책 대출 버튼 + Tooltip */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* A 버튼 */}
          <div style={{ position: "relative", flex: 1 }}>
            <button
              type="button"
              disabled={!isAEligible}
              onMouseEnter={() => setShowTipA(true)}
              onMouseLeave={() => setShowTipA(false)}
              onClick={() =>
                setSelectedLoan((prev) => (prev === "A" ? null : "A"))
              }
              style={{
                padding: "6px 8px",
                borderRadius: 999,
                border: "1px solid rgba(248,250,252,0.4)",
                cursor: isAEligible ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 600,
                background:
                  selectedLoan === "A" ? "#f97316" : "transparent",
                color: isAEligible ? "#f9fafb" : "#6b7280",
                opacity: isAEligible ? 1 : 0.4,
                width: "100%",
              }}
            >
              A. 디딤돌<br />(신생아 특례)
            </button>

            {showTipA && (
              <div
                style={{
                  position: "absolute",
                  top: -120,
                  left: 0,
                  width: 200,
                  padding: "10px",
                  background: "white",
                  color: "#111",
                  borderRadius: 12,
                  fontSize: 11,
                  lineHeight: "1.5",
                  boxShadow: "0px 6px 18px rgba(0,0,0,0.3)",
                  zIndex: 100,
                }}
              >
                <b>🍼 신생아 특례 조건</b>
                <br /> 최근 2년 내 출산/입양 
                <br />
                - 연소득: 1억 3천만원 이하
                <br />
                - 전용 85㎡ 이하
                <br />
                - 가격 9억 이하
                <br />
                - 최대 대출: 4억
                <br />
                - LTV: 70%
              </div>
            )}
          </div>

          {/* B 버튼 */}
          <div style={{ position: "relative", flex: 1 }}>
            <button
              type="button"
              disabled={!isBEligible}
              onMouseEnter={() => setShowTipB(true)}
              onMouseLeave={() => setShowTipB(false)}
              onClick={() =>
                setSelectedLoan((prev) => (prev === "B" ? null : "B"))
              }
              style={{
                padding: "6px 8px",
                borderRadius: 999,
                border: "1px solid rgba(248,250,252,0.4)",
                cursor: isBEligible ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 600,
                background:
                  selectedLoan === "B" ? "#f97316" : "transparent",
                color: isBEligible ? "#f9fafb" : "#6b7280",
                opacity: isBEligible ? 1 : 0.4,
                width: "100%",
              }}
            >
              B. 디딤돌<br />(신혼부부)
            </button>

            {showTipB && (
              <div
                style={{
                  position: "absolute",
                  top: -120,
                  right: 0,
                  width: 200,
                  padding: "10px",
                  background: "white",
                  color: "#111",
                  borderRadius: 12,
                  fontSize: 11,
                  lineHeight: "1.5",
                  boxShadow: "0px 6px 18px rgba(0,0,0,0.3)",
                  zIndex: 100,
                }}
              >
                <b>💍 신혼부부 조건</b>
                <br /> 혼인 7년 이내 또는 3개월 내 예비신혼
                <br />
                - 연소득: 8,500만원 이하
                <br />
                - 전용 85㎡ 이하
                <br />
                - 가격 6억 이하
                <br />
                - 최대 대출: 3.2억
                <br />
                - LTV: 70%
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
          💡 소득 요건 미충족 상품은 자동 비활성화
        </div>

        {/* 일반 대출 토글 */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(148,163,184,0.5)",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setSelectedLoan((prev) =>
                prev === "CUSTOM" ? null : "CUSTOM"
              )
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.8)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              background: isCustomSelected ? "#16a34a" : "transparent",
              color: "#f9fafb",
            }}
          >
            시중 은행 대출 {isCustomSelected ? "사용 중" : "사용하기"}
          </button>

          {isCustomSelected && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 11,
                color: "#e5e7eb",
              }}
            >
          {/* 상환기간 슬라이더 */}
              <div style={{ width: "100%" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#f9fafb",
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span>상환기간</span>
                  <span>{loanYears}년</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={loanYears}
                  onChange={(e) => setLoanYears(Number(e.target.value))}
                  style={{
                    width: "100%",
                    appearance: "none",
                    height: 6,
                    background: "#475569",
                    borderRadius: 999,
                    cursor: "pointer",
                  }}
                />
              </div>
    

              {/* 금리 + 기존대출 한 줄 */}
              <div style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
              }}>

                {/* 금리 */}
                <div style={{ textAlign: "center" }}>
                  <label style={{ fontSize: 11 }}>금리 (%)</label>
                  <input
                    type="number"
                    value={loanRate}
                    onChange={(e) => setLoanRate(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px",
                      borderRadius: 6,
                      border: "1px solid rgba(248,250,252,0.3)",
                      background: "rgba(255,255,255,0.05)",
                      color: "white",
                    }}
                  />
                </div>

                {/* 기존 대출 */}
                <div style={{ textAlign: "center" }}>
                  <label style={{ fontSize: 11 }}>기대출 (만원)</label>
                  <input
                    type="number"
                    value={loanExposure}
                    onChange={(e) => setLoanExposure(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px",
                      borderRadius: 6,
                      border: "1px solid rgba(248,250,252,0.3)",
                      background: "rgba(255,255,255,0.05)",
                      color: "white",
                    }}
                  />
                </div>
              </div>

              

              <div style={{ textAlign: "center", fontSize: 10, color: "#9ca3af" }}>
                📌 <b>원리금균등상환</b> 기준으로, 최대 원금을 계산해요.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
