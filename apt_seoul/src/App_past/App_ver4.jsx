import { useEffect, useMemo, useState } from "react";
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

export default function App() {
  const { rows, loading, err } = useCSV("/chunk_9_F.csv", mapRow);

  // 필터 상태
  const [budget, setBudget] = useState(4.0); // 보유 현금 (억)
  const [areaRange, setAreaRange] = useState([45, 90]);
  const [yearMin, setYearMin] = useState(2023);

  // My 패널 열림/닫힘
  const [showPanel, setShowPanel] = useState(false);

  // 대출 관련 상태
  const [loanIncome, setLoanIncome] = useState(7300); // 만원
  const [selectedLoan, setSelectedLoan] = useState(null); // "A" | "B" | null

  // 소득이 바뀌어서 자격이 사라지면 선택된 상품 자동 해제
  useEffect(() => {
    if (selectedLoan === "A" && loanIncome > 13000) {
      setSelectedLoan(null);
    }
    if (selectedLoan === "B" && loanIncome > 8500) {
      setSelectedLoan(null);
    }
  }, [loanIncome, selectedLoan]);

  // 현재 선택된 대출 상품
  const activeLoan =
    selectedLoan === "A"
      ? {
          id: "A",
          name: "A. 신생아",
          maxLoan: 4.0, // 억
          ltv: 0.7,
          maxIncome: 13000,
          maxPrice: 9.0,
          maxArea: 85,
        }
      : selectedLoan === "B"
      ? {
          id: "B",
          name: "B. 신혼부부",
          maxLoan: 3.2, // 억
          ltv: 0.7,
          maxIncome: 8500,
          maxPrice: 6.0,
          maxArea: 85,
        }
      : null;

  // 필터 적용 데이터
  const filtered = useMemo(
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

  const displayTotalBudget = activeLoan
    ? budget + activeLoan.maxLoan
    : budget;

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
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16,

        // 🔵 웹페이지에 스크롤 안 생기게: 화면 높이에 딱 맞추고 숨김
        height: "100vh",
        overflow: "hidden",
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
          flex: "0 0 auto",
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
              예산 <b>{budget.toFixed(1)}억</b>

              {activeLoan ? (
                <>
                  {" + "}
                  <b>{activeLoan.name}</b> {" 대출 반영,"}
                </>
              ) : (
                <>{" 기준,"}</>
              )}

              {" 구매 가능 매물 "}
              <b>{filtered.length}</b>개
            </>
          )}
        </div>
      </div>

      {/* 지도 카드 (화면 나머지 전부 차지) */}
      <div
        className="card"
        style={{
          position: "relative",
          padding: 0,
          borderRadius: 16,
          flex: "1 1 auto",    // 🔵 남은 공간 전부 사용
          overflow: "hidden",  // 🔵 카드 밖으로 안 나가게
          display: "flex",
        }}
      >
        {/* 지도: 카드 안을 꽉 채움, 별도 스크롤 없음 */}
        <div
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <MapView data={filtered} budget={budget} loanConfig={activeLoan} />
        </div>

        {/* My 버튼 + 팝업 (지도 위 오버레이) */}
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

          {/* 팝업: 카드 안에서만, 고정 크기 + 내부 스크롤 */}
          {showPanel && (
            <div
              style={{
                marginTop: 8,
                width: 320,
                // 🔵 카드 높이(=100%) 기준으로 최대 높이 제한
                maxHeight: "calc(100% - 40px)",
                background: "rgba(15,23,42,0.98)",
                borderRadius: 16,
                padding: "14px 16px",
                boxShadow: "0 16px 40px rgba(15,23,42,0.85)",
                overflowY: "auto",   // ✅ 여기만 스크롤
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
