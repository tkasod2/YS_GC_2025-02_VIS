// src/components/FilterPanel.jsx

export default function FilterPanel({
  budget,
  setBudget,
  areaRange,
  setAreaRange,
  yearMin,
  setYearMin,
  loanIncome,
  setLoanIncome,
  selectedLoan,
  setSelectedLoan,
}) {
  // 소득 표시용 라벨
  const incomeLabel =
    loanIncome >= 10000
      ? `${(loanIncome / 10000).toFixed(2)}억`
      : `${loanIncome.toLocaleString()}만원`;

  // 소득 요건에 따른 대출 가능 여부
  const isAEligible = loanIncome <= 13000; // 1억 3천 이하
  const isBEligible = loanIncome <= 8500;  // 8,500만원 이하

  return (
    <div className="card">
      {/* 🔵 프로필 블록 전체 */}
      <div className="profile-block">
        <div className="profile-avatar">
          <img src="/image.png" alt="프로필" />
        </div>

        <div className="profile-name">예비신부 님</div>
        <div className="profile-sub">나의 영끌 예산을 입력하세요.</div>
      </div>

      <div className="field">
        <label>예산 ({budget.toFixed(1)}억)</label>
        <input
          type="range"
          min={0}
          max={14}
          step={0.1}
          value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>0억</span>
          <span>14억</span>
        </div>
      </div>

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

      <div className="field">
        <label>거래 연도 (최소: {yearMin})</label>
        <input
          type="range"
          min={2022}
          max={2024}
          step={1}
          value={yearMin}
          onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>2022</span>
          <span>2024</span>
        </div>
      </div>

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
          onChange={(e) => setLoanIncome(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>4,000만</span>
          <span>1억 5,000만</span>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 11,
            color: "#d1d5db",
          }}
        >

        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={!isAEligible}
            onClick={() =>
              setSelectedLoan((prev) => (prev === "A" ? null : "A"))
            }
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 999,
              border: "1px solid rgba(248,250,252,0.4)",
              cursor: isAEligible ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              background: selectedLoan === "A" ? "#f97316" : "transparent",
              color: isAEligible ? "#f9fafb" : "#6b7280",
              opacity: isAEligible ? 1 : 0.4,
            }}
          >
            A. 신생아
          </button>

          <button
            type="button"
            disabled={!isBEligible}
            onClick={() =>
              setSelectedLoan((prev) => (prev === "B" ? null : "B"))
            }
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 999,
              border: "1px solid rgba(248,250,252,0.4)",
              cursor: isBEligible ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              background: selectedLoan === "B" ? "#f97316" : "transparent",
              color: isBEligible ? "#f9fafb" : "#6b7280",
              opacity: isBEligible ? 1 : 0.4,
            }}
          >
            B. 신혼부부
          </button>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
        * 소득 요건 미충족시, 해당 대출 상품 자동 비활성화
        </div>
      </div>
    </div>
  );
}
