import React, { useState } from "react";

export default function FilterPanel({
  budget,
  setBudget,
  income,
  setIncome,
  loanProduct,
  setLoanProduct
}) {
  const [popupOpen, setPopupOpen] = useState(false);

  const loanOptions = [
    {
      id: "A",
      label: "A. 디딤돌 (신생아 특례)",
      maxLoan: 4.0,
      ltv: 0.7,
      incomeLimit: 13000,
      priceLimit: 9,
      sizeLimit: 85
    },
    {
      id: "B",
      label: "B. 신혼부부 특례",
      maxLoan: 3.2,
      ltv: 0.7,
      incomeLimit: 8500,
      priceLimit: 6,
      sizeLimit: 85
    }
  ];

  const availableLoans = loanOptions.map(option => ({
    ...option,
    disabled: income > option.incomeLimit
  }));

  return (
    <div
      style={{
        width: 320,
        background: "white",
        height: "100%",
        padding: "20px",
        overflow: "hidden",
        borderRight: "1px solid #e5e7eb"
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>필터</h2>

      {/* 예산 */}
      <label style={{ display: "block", marginBottom: 4 }}>보유 현금 (억)</label>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={budget}
        onChange={e => setBudget(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ fontSize: 14, marginBottom: 20 }}>{budget.toFixed(1)}억</div>

      {/* 소득 슬라이더 - 대출 조건 활성화용 */}
      <label style={{ display: "block", marginBottom: 4 }}>부부합산 소득 (만원)</label>
      <input
        type="range"
        min={3000}
        max={15000}
        step={500}
        value={income}
        onChange={e => {
          setIncome(Number(e.target.value));
          if (loanProduct) {
            const selectedOp = loanOptions.find(o => o.id === loanProduct);
            if (selectedOp && income > selectedOp.incomeLimit) {
              setLoanProduct(null);
            }
          }
        }}
        style={{ width: "100%" }}
      />
      <div style={{ fontSize: 14, marginBottom: 20 }}>{income.toLocaleString()}만원</div>

      {/* 대출 선택 패널 */}
      <button
        style={{
          width: "100%",
          padding: "10px 16px",
          borderRadius: 8,
          background: "#f1f5f9",
          border: "1px solid #cbd5e1",
          cursor: "pointer",
          fontWeight: 600
        }}
        onClick={() => setPopupOpen(true)}
      >
        대출 상품 선택
      </button>

      {loanProduct && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            padding: "8px 10px",
            background: "#e0f2fe",
            borderRadius: 8,
            fontWeight: 600,
            color: "#0369a1"
          }}
        >
          선택됨: {loanOptions.find(o => o.id === loanProduct)?.label}
        </div>
      )}

      {/* 팝업 */}
      {popupOpen && (
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 10,
            top: 10,
            background: "white",
            borderRadius: 14,
            boxShadow: "0 6px 30px rgba(0,0,0,0.25)",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            zIndex: 999
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            대출 상품 선택
          </h3>

          {availableLoans.map(option => (
            <button
              key={option.id}
              disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) {
                  setLoanProduct(option.id);
                  setPopupOpen(false);
                }
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "12px",
                borderRadius: 10,
                marginBottom: 10,
                background: option.disabled ? "#f1f5f9" : "#dbeafe",
                cursor: option.disabled ? "not-allowed" : "pointer",
                opacity: option.disabled ? 0.4 : 1,
                border: "1px solid #93c5fd",
                fontWeight: 600
              }}
            >
              {option.label}
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                최대 {option.maxLoan}억 · LTV {option.ltv * 100}%
              </div>
            </button>
          ))}

          <button
            style={{
              marginTop: "auto",
              padding: "10px",
              borderRadius: 10,
              background: "#94a3b8",
              color: "white",
              cursor: "pointer",
              fontWeight: 600
            }}
            onClick={() => setPopupOpen(false)}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
