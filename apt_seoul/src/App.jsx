import { useMemo, useState, useEffect } from "react";
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

/** 일반 대출 기준 최대 가능 원금(억) 계산 (DTI 기반) */
function computeCustomLoanCapacity(loanIncome, loanYears, loanRate, loanExposure) {
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

function getBuyingPower(price, budget, selectedLoan, activeLoan, customLoanCapacity) {
  
  // 1) 일반 대출이 선택된 경우 → 일반 대출 우선
  if (selectedLoan === "CUSTOM") {
    if (customLoanCapacity && customLoanCapacity > 0) {
      const ltvLimit = price * 0.7;
      const usableLoan = Math.min(customLoanCapacity, ltvLimit);
      return budget + usableLoan;
    }
    return budget;
  }

  // 2) 정책 대출 (A, B)
  if (activeLoan) {
    const maxLoanByLtv = activeLoan.ltv * price;
    const usableLoan = Math.min(activeLoan.maxLoan, maxLoanByLtv);
    return budget + usableLoan;
  }

  // 3) 대출 없음
  return budget;
}

function getEffectiveBudget(price, budget, activeLoan, selectedLoan, customLoanCapacity) {
  return getBuyingPower(price, budget, selectedLoan, activeLoan, customLoanCapacity);
}

export default function App() {
  // const { rows, loading, err } = useCSV("/chunk_9_F.csv", mapRow);
  const { rows, loading, err } = useCSV("/df_cost_251130_F.csv", mapRow);//251130 추가(금리,정책 반영)

  // 필터 상태
  const [budget, setBudget] = useState(4.0); // 보유 현금 (억)
  const [areaRange, setAreaRange] = useState([45, 90]);
  const [yearMin, setYearMin] = useState(2022);

  // My 패널 열림/닫힘
  const [showPanel, setShowPanel] = useState(false);

  // 대출 관련 상태
  const [loanIncome, setLoanIncome] = useState(8000); // 부부합산 소득(만원)
  const [selectedLoan, setSelectedLoan] = useState(null); // "A" | "B" | "CUSTOM" | null

  // 일반 대출 입력값
  const [loanYears, setLoanYears] = useState(30);    // 1~30년
  const [loanRate, setLoanRate] = useState(4.5);     // %
  const [loanExposure, setLoanExposure] = useState(0); // 기존 대출(만원)

  // 즐겨찾기(관심 매물 기능) (localStorage Persist)
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favorites") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  // 선택된 정책 대출 상품(A/B) 정의
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

  // 일반 대출 최대 가능 원금(억)
  const customLoanCapacity = useMemo(
    () =>
      selectedLoan === "CUSTOM"
        ? computeCustomLoanCapacity(
            loanIncome,
            loanYears,
            loanRate,
            loanExposure
          )
        : 0,
    [selectedLoan, loanIncome, loanYears, loanRate, loanExposure]
  );

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

  // 2차 필터: 예산 + (정책/일반) 대출 조건 반영
  const purchasable = useMemo(
    () =>
      filteredBase
        .map((d) => {
          const price = d.price;
          const area = d.area;

          if (!Number.isFinite(price)) return null;

          // 정책 대출 선택 시 → 주택 요건 필터
          if (activeLoan && (selectedLoan === "A" || selectedLoan === "B")) {
            if (price > activeLoan.maxPrice) return null;
            if (Number.isFinite(area) && area > activeLoan.maxArea) return null;
          }

          // 실제 가용 예산(억)
          const effBudget = getEffectiveBudget(
            price,
            budget,
            activeLoan,
            selectedLoan,
            customLoanCapacity
          );

          if (effBudget < price) return null;

          const canWithoutLoan = price <= budget;
          const loanOnly = !!selectedLoan && effBudget >= price && !canWithoutLoan;

          return { ...d, loanOnly };
        })
        .filter(Boolean),
    [filteredBase, budget, activeLoan, selectedLoan, customLoanCapacity, loanYears, loanRate, loanExposure]
  );

  if (err) {
    return (
      <div style={{ padding: 16, color: "tomato" }}>
        CSV 로딩 오류: {String(err)}
      </div>
    );
  }

  const loanHeaderLabel =
    selectedLoan === "A"
      ? "신생아 특례 대출"
      : selectedLoan === "B"
      ? "신혼부부 특례 대출"
      : selectedLoan === "CUSTOM"
      ? "시중 은행 대출"
      : null;

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
        <div className="title-text">
          영혼까지 끌어모은다면 어디까지 갈 수 있을까? 👻
        </div>

        <div
          style={{
            fontSize: "14px",
            background: "white",
            padding: "3px 18px",
            borderRadius: "999px",
            color: "#111",
            fontWeight: 600,
            textAlign: "center",
            boxShadow: "0px 4px 12px rgba(0,0,0,0.07)",
            border: "1px solid rgba(0,0,0,0.08)",
            marginTop: "8px",
            letterSpacing: "0.5px"
          }}
        >
          {loading ? (
            "데이터 로딩 중…"
          ) : (
            <>
              내 예산 <b style={{ color: "#2563eb" }}>{budget.toFixed(1)}억</b>
              {loanHeaderLabel ? (
                <>
                  {" + "}
                  <b style={{ color: "#2563eb" }}>{loanHeaderLabel}</b> 적용 →
                </>
              ) : (
                " →"
              )}{" "}
              구매 가능 매물{" "}
              <b style={{ color: "#dc2626" }}>{purchasable.length}</b>개
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
          height: "620px",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* 지도 */}
        <MapView
          data={purchasable}
          budget={budget}
          loanConfig={activeLoan}
          selectedLoan={selectedLoan}
          customLoanCapacity={customLoanCapacity}
          favorites={favorites}
          setFavorites={setFavorites}
        />

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
                maxHeight: 520,
                background: "rgba(15,23,42,0.98)",
                borderRadius: 16,
                padding: "14px 16px",
                boxShadow: "0 16px 40px rgba(15,23,42,0.85)",
                overflowY: "auto",
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
                loanYears={loanYears}
                setLoanYears={setLoanYears}
                loanRate={loanRate}
                setLoanRate={setLoanRate}
                loanExposure={loanExposure}
                setLoanExposure={setLoanExposure}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
