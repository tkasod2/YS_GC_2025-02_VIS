import { useMemo, useState } from "react";
import "./styles/app.css";

import FilterPanel from "./components/FilterPanel";
import MapView from "./components/MapView";
import { useCSV } from "./hooks/useCSV";

/** CSV → 내부 모델 매핑 함수 */
function mapRow(r, i) {
  const price_uk = (r.dealAmount ?? 0) / 10000; // 만원 → 억원
  return {
    id: i + 1,
    dong: r.umdNm ?? r.dong ?? "",
    apt: r.aptNm ?? r.apt ?? "",
    area: Number(r.excluUseAr) || Number(r.area) || NaN,
    price: Number.isFinite(price_uk) ? price_uk : NaN,
    year: Number(r.dealYear) || Number(r.year) || NaN,
    lat: Number(r.Latitude),
    lon: Number(r.Longitude),
  };
}

/** 집 한 채에 대해 "내 예산 + 대출"로 실제 구매 가능 여부 계산 */
function canBuyWithLoan(d, budget, loanConfig) {
  const price = d.price;
  const area = d.area;

  if (!Number.isFinite(price)) return false;

  // 대출 안 쓰면 그냥 현금만 비교
  if (!loanConfig) {
    return price <= budget;
  }

  // 상품별 주택 요건: 가격 상한, 면적 상한
  if (price > loanConfig.maxPrice) return false;
  if (Number.isFinite(area) && area > loanConfig.maxArea) return false;

  // LTV 70% 안에서, 상품 최대 한도까지만 사용
  const maxLoanByLtv = loanConfig.ltv * price;
  const usableLoan = Math.min(loanConfig.maxLoan, maxLoanByLtv);

  // 실제 구매 가능 총액 = 현금 + 사용 가능한 대출
  const effectiveBudget = budget + usableLoan;
  return effectiveBudget >= price;
}

export default function App() {
  const { rows, loading, err } = useCSV("/df_cost_251124_F.csv", mapRow);

  // 필터 상태
  const [budget, setBudget] = useState(4.0); // 보유 현금 (억)
  const [areaRange, setAreaRange] = useState([45, 90]);
  const [yearMin, setYearMin] = useState(2022);

  // My 패널 열림/닫힘
  const [showPanel, setShowPanel] = useState(false);

  // 대출 관련 상태
  const [loanIncome, setLoanIncome] = useState(8000); // 부부합산 소득(만원)
  const [selectedLoan, setSelectedLoan] = useState(null); // "A" | "B" | null

  // 선택된 대출 상품 정의
  const activeLoan =
    selectedLoan === "A"
      ? {
          id: "A",
          name: "신생아",
          maxLoan: 4.0, // 억
          ltv: 0.7,
          maxIncome: 13000, // 만원
          maxPrice: 9.0, // 억
          maxArea: 85, // ㎡
        }
      : selectedLoan === "B"
      ? {
          id: "B",
          name: "신혼부부",
          maxLoan: 3.2, // 억
          ltv: 0.7,
          maxIncome: 8500, // 만원
          maxPrice: 6.0, // 억
          maxArea: 85, // ㎡
        }
      : null;

  // 1차 필터: 면적 / 연도 / 좌표 유효성
  const filteredBase = useMemo(
    () =>
      rows.filter(
        (d) =>
          Number.isFinite(d.area) &&
          Number.isFinite(d.price) &&
          Number.isFinite(d.year) &&
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lon) &&
          d.area >= areaRange[0] &&
          d.area <= areaRange[1] &&
          d.year >= yearMin
      ),
    [rows, areaRange, yearMin]
  );

  // 2차 필터: 예산 + 대출 조건을 반영한 "실제 구매 가능 매물"
  // + loanOnly 플래그 (대출 있어야만 살 수 있는 집)
  const purchasable = useMemo(
    () =>
      filteredBase
        .map((d) => {
          const canWithLoan = canBuyWithLoan(d, budget, activeLoan);
          if (!canWithLoan) return null; // 어차피 못 사는 집은 제외

          // 대출 없이 가능한지 (그냥 현금만으로)
          const canWithoutLoan = d.price <= budget;

          // 대출을 선택했고, 대출 없이는 못 사고, 대출 끼면 살 수 있는 집
          const loanOnly =
            !!activeLoan && canWithLoan && !canWithoutLoan;

          return { ...d, loanOnly };
        })
        .filter(Boolean),
    [filteredBase, budget, activeLoan]
  );

  if (err) {
    return (
      <div style={{ padding: 16, color: "tomato" }}>
        CSV 로딩 오류: {String(err)}
      </div>
    );
  }

  return (
    <div
      className="app"
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 24px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* 헤더 */}
      <div
        className="header"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: "clamp(22px, 2.6vw, 30px)",
            fontWeight: 700,
          }}
        >
          티끌모아 태산 💵🏠
        </div>
        <div style={{ fontSize: 14 }}>
          {loading ? (
            "데이터 로딩 중…"
          ) : (
            <>
              {activeLoan ? (
                <>
                  내 예산 (<b>{budget.toFixed(1)}억</b>) +{" "}
                  <b>{activeLoan.name}</b> 대출 적용 →
                </>
              ) : (
                <>
                  내 예산 (<b>{budget.toFixed(1)}억</b>) →
                </>
              )}{" "}
              구매 가능 매물 <b>{purchasable.length}</b>개
            </>
          )}
        </div>
      </div>

      {/* 지도 카드 */}
      <div
        className="card"
        style={{
          position: "relative",
          padding: 0,
          height: "620px", // 지도 + 팝업이 들어갈 고정 높이
          borderRadius: 16,
          overflow: "hidden", // 카드 밖으로는 안 나가게
        }}
      >
        {/* 지도 */}
        <MapView data={purchasable} budget={budget} loanConfig={activeLoan} />

        {/* 오른쪽 상단 My 버튼 + 팝업 */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          {/* My 버튼 */}
          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.4)",
              background: showPanel ? "#f97316" : "#111827",
              color: "#f9fafb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(15,23,42,0.4)",
            }}
          >
            {showPanel ? "My 닫기" : "My 설정"}
          </button>

          {/* 팝업: 카드 안에서 고정 크기 + 내부 스크롤 */}
          {showPanel && (
            <div
              style={{
                marginTop: 8,
                width: 320,
                maxHeight: 520, // 카드(620) 안에서만 보이게
                background: "rgba(15,23,42,0.98)",
                borderRadius: 16,
                padding: "14px 16px",
                boxShadow: "0 16px 40px rgba(15,23,42,0.85)",
                overflowY: "auto", // 🔥 여기만 스크롤
                color: "#f9fafb",
              }}
            >
              <FilterPanel
                budget={budget}
                setBudget={setBudget}
                areaRange={areaRange}
                setAreaRange={setAreaRange}
                yearMin={yearMin}
                setYearMin={setYearMin}
                loanIncome={loanIncome}
                setLoanIncome={setLoanIncome}
                selectedLoan={selectedLoan}
                setSelectedLoan={setSelectedLoan}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
