import { useMemo, useState } from "react";
import "./styles/app.css";

import FilterPanel from "./components/FilterPanel";
import MapView from "./components/MapView";
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
    lat: Number(r.Latitude),
    lon: Number(r.Longitude),
  };
}

export default function App() {
  // 실제 파일: public/chunk_9_F.csv
  const { rows, loading, err } = useCSV("/chunk_9_F.csv", mapRow);

  // 필터 상태
  const [budget, setBudget] = useState(4.0);          // 억
  const [areaRange, setAreaRange] = useState([45, 90]); // ㎡
  const [yearMin, setYearMin] = useState(2022);

  // 왼쪽 필터 패널 열림 여부
  const [showPanel, setShowPanel] = useState(false);

  // 필터 적용 데이터
  const filtered = useMemo(() => {
    return rows.filter((d) =>
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
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: "clamp(20px, 2.4vw, 28px)",
            fontWeight: 700,
          }}
        >
          실구매력 기반 서울시 아파트 탐색
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
          }}
        >
          <div>
            {loading
              ? "데이터 로딩 중…"
              : <>예산 <b>{budget.toFixed(1)}억</b> 기준, 후보 {filtered.length}개</>}
          </div>

          {/* 🔘 My 버튼: 필터 패널 열고 닫기 */}
          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid rgba(248, 250, 252, 0.3)",
              background: showPanel ? "#f97316" : "#111827",
              color: "#f9fafb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showPanel ? "My 닫기" : "My 설정"}
          </button>
        </div>
      </div>

      {/* 메인 영역: 왼쪽 패널(옵션) + 지도(항상) */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "stretch",
          minHeight: "520px",
        }}
      >
        {/* 왼쪽 My 패널: showPanel 이 true일 때만 렌더링 */}
        {showPanel && (
          <div style={{ flex: "0 0 320px" }}>
            <div className="card" style={{ height: "100%" }}>
              <FilterPanel
                budget={budget}
                setBudget={setBudget}
                areaRange={areaRange}
                setAreaRange={setAreaRange}
                yearMin={yearMin}
                setYearMin={setYearMin}
              />
            </div>
          </div>
        )}

        {/* 가운데 지도: 패널이 없으면 전체 폭 사용, 있으면 남은 공간 모두 */}
        <div style={{ flex: 1 }}>
          <div
            className="card"
            style={{
              padding: 0,
              height: "100%",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <MapView data={filtered} budget={budget} />
          </div>
        </div>
      </div>
    </div>
  );
}
