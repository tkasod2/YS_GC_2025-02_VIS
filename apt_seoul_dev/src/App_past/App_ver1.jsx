import { useMemo, useState } from "react";
import "./styles/app.css";

import FilterPanel from "./components/FilterPanel";
import MapView from "./components/MapView";
import SummaryBars from "./components/SummaryBars";
import { useCSV } from "./hooks/useCSV";

/** CSV → 내부 모델 매핑 함수
 *  CSV 컬럼 예: umdNm, aptNm, excluUseAr, dealAmount(만원), dealYear, Latitude, Longitude
 */
function mapRow(r, i) {
  const price_uk = (r.dealAmount ?? 0) / 10000; // 만원 → 억원
  return {
    id: i + 1,
    dong: r.umdNm ?? r.dong ?? "",
    apt: r.aptNm ?? r.apt ?? "",
    area: Number(r.excluUseAr) || Number(r.area) || NaN,
    price: Number.isFinite(price_uk) ? price_uk : NaN,
    year: Number(r.dealYear) || Number(r.year) || NaN,
    lat: Number(r.Latitude),   // ✅ 대문자 컬럼
    lon: Number(r.Longitude),  // ✅ 대문자 컬럼
  };
}

export default function App() {
  // 실제 파일: public/chunk_9_F.csv
  const { rows, loading, err } = useCSV("/chunk_9_F.csv", mapRow);

  // 필터 상태
  const [budget, setBudget] = useState(4.0);     // 억
  const [areaRange, setAreaRange] = useState([45, 90]); // ㎡
  const [yearMin, setYearMin] = useState(2022);

  // 필터 적용 데이터
  const filtered = useMemo(() => {
    return rows.filter(d =>
      Number.isFinite(d.area) &&
      Number.isFinite(d.price) &&
      Number.isFinite(d.year) &&
      Number.isFinite(d.lat) &&
      Number.isFinite(d.lon) &&
      d.area >= areaRange[0] && d.area <= areaRange[1] &&
      d.year >= yearMin
    );
  }, [rows, areaRange, yearMin]);

  if (err) {
    return <div style={{ padding: 16, color: "tomato" }}>CSV 로딩 오류: {String(err)}</div>;
  }

  return (
    <div
      className="app"
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr) 340px", // 좌·중·우
        gridTemplateRows: "auto minmax(0, 1fr)",           // 헤더, 그 아래 전체
        gap: "16px",
        height: "100vh",
      }}
    >
      {/* 헤더: 전체 너비 */}
      <div className="header" style={{ gridColumn: "1 / 4", gridRow: "1" }}>
        <div style={{ fontSize: "clamp(18px,2.2vw,26px)", fontWeight: 700 }}>
          실구매력 기반 서울시 아파트 탐색
        </div>
        <div>
          {loading
            ? "데이터 로딩 중…"
            : <>예산 <b>{budget.toFixed(1)}억</b> 기준, 후보 {filtered.length}개</>}
        </div>
      </div>

      {/* 좌측: 필터 */}
      <div style={{ gridColumn: "1", gridRow: "2" }}>
        <div className="card">
          <FilterPanel
            budget={budget} setBudget={setBudget}
            areaRange={areaRange} setAreaRange={setAreaRange}
            yearMin={yearMin} setYearMin={setYearMin}
          />
        </div>
      </div>

      {/* 가운데: 지도 -> 카드 높이 100%로 크게 */}
      <div style={{ gridColumn: "2", gridRow: "2" }}>
        <div className="card" style={{ height: "100%", minHeight: "500px" }}>
          <MapView data={filtered} budget={budget} />
        </div>
      </div>

      {/* 우측: 요약 막대 */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <div className="card">
          <SummaryBars data={filtered} budget={budget} />
        </div>
      </div>
    </div>
  );
}
