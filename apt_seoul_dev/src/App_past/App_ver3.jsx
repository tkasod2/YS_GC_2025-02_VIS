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

export default function App() {
  const { rows, loading, err } = useCSV("/chunk_9_F.csv", mapRow);

  // 필터 상태
  const [budget, setBudget] = useState(4.0);
  const [areaRange, setAreaRange] = useState([45, 90]);
  const [yearMin, setYearMin] = useState(2022);

  // My 패널 열림/닫힘
  const [showPanel, setShowPanel] = useState(false);

  // 필터 적용 데이터
  const filtered = useMemo(() => {
    return rows.filter(
      (d) =>
        Number.isFinite(d.area) &&
        Number.isFinite(d.price) &&
        Number.isFinite(d.year) &&
        Number.isFinite(d.lat) &&
        Number.isFinite(d.lon) &&
        d.area >= areaRange[0] &&
        d.area <= areaRange[1] &&
        d.year >= yearMin
    );
  }, [rows, areaRange, yearMin]);

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
              예산 <b>{budget.toFixed(1)}억</b> 기준, 후보 {filtered.length}개
            </>
          )}
        </div>
      </div>

      {/* 지도 카드 + My 오버레이 */}
      <div
        className="card"
        style={{
          position: "relative",
          padding: 0,
          height: "620px",       // 🔥 여기서 지도 전체 높이 조절
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* 지도 자체 */}
        <MapView data={filtered} budget={budget} />

        {/* 오른쪽 상단 My 버튼 + 패널 (지도 위에 오버레이) */}
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
          {/* My 버튼 (지도 오른쪽 상단에 항상 보임) */}
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

          {/* 패널: 버튼 아래에, 지도 위로 겹치게 */}
          {showPanel && (
            <div
              style={{
                marginTop: 8,
                width: 320,
                maxHeight: "calc(100% - 40px)", // 지도 높이 안에 들어오게
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
