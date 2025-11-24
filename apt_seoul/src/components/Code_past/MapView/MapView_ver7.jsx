import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Tooltip,
  GeoJSON,
  useMap,
  useMapEvents,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import supercluster from "supercluster";

/** ---------- Fit to Data (초기 화면 맞추기) ---------- **/
function FitToData({ data }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || fitted.current) return;

    const coords = data.filter(
      (d) => Number.isFinite(d.lat) && Number.isFinite(d.lon)
    );
    if (!coords.length) {
      fitted.current = true;
      return;
    }

    const lats = coords.map((d) => d.lat);
    const lons = coords.map((d) => d.lon);

    const bounds = [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];

    try {
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch {
      map.setView([37.5665, 126.978], 11);
    }

    fitted.current = true;
  }, [data, map]);

  return null;
}

/** ---------- 현재 지도 상태 ---------- **/
function useViewState() {
  const map = useMap();
  const [view, setView] = useState({});

  const update = () => {
    const b = map.getBounds();
    setView({
      zoom: map.getZoom(),
      bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    });
  };

  useMapEvents({ moveend: update, zoomend: update });
  useEffect(update, []);

  return view;
}

/** ---------- 예산(현금 + 대출) 기준 최대 구매 가능액 ---------- **/
function getEffectiveBudgetForPrice(price, budget, loanConfig) {
  if (!loanConfig) return budget;

  const maxLoanByLtv = loanConfig.ltv * price;
  const usableLoan = Math.min(loanConfig.maxLoan, maxLoanByLtv);
  return budget + usableLoan;
}

/** ---------- 동 경계 Choropleth Layer ---------- **/
function DongLayer({ geojson, dongCounts }) {
  const maxVal = Math.max(...dongCounts.values(), 0);

  const style = (feature) => {
    const dongName = feature.properties.emd_kor_nm;
    const count = dongCounts.get(dongName) || 0;

    if (!count || !maxVal) {
      return {
        fillColor: "rgba(0,0,0,0.03)",
        color: "#1f2937",
        weight: 1,
        fillOpacity: 1,
      };
    }

    const alpha = 0.3 + (count / maxVal) * 0.7;

    return {
      fillColor: `rgba(248,113,113,${alpha})`,
      color: "#1f2937",
      weight: 1,
      fillOpacity: 1,
    };
  };

  return <GeoJSON data={geojson} style={style} />;
}

/** ---------- 말풍선 색 결정 (예산 대비 여유도) ---------- **/
function pickBubbleColor(price, budget, loanConfig) {
  const effectiveBudget = getEffectiveBudgetForPrice(price, budget, loanConfig);
  const diff = effectiveBudget - price;

  if (diff >= 3) return "#22c55e"; // 3억 이상 여유 → 초록
  if (diff >= 1) return "#fb923c"; // 1~3억 여유 → 주황
  if (diff >= 0) return "#facc15"; // 0~1억 여유 → 노랑
  return null; // 예산 초과 → 표시 X
}

/** ---------- 말풍선 아이콘 ---------- **/
function createPriceIcon(price, budget, loanConfig, loanOnly = false) {
  const bgColor = pickBubbleColor(price, budget, loanConfig);
  if (!bgColor) return null;

  const borderStyle = loanOnly
    ? "2px solid #38bdf8" // 대출필수: 파란 테두리
    : "1px solid rgba(255,255,255,0.8)";

  // 🔵 검은 글씨 + 파란 형광펜 느낌
  const loanBadge = loanOnly
    ? `<div style="
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          padding: 1px 6px;
        ">
         🏦
       </div>`
    : "";

  return L.divIcon({
    className: "price-marker-icon",
    html: `
      <div style="
        display:inline-flex;
        flex-direction:column;
        align-items:center;
        transform: translateY(-6px);
      ">
        <div style="
          padding:6px 14px;
          border-radius:999px;
          background:${bgColor};
          color:#ffffff;
          font-size:12px;
          font-weight:700;
          white-space:nowrap;

          box-shadow:
            0 0 4px rgba(255,255,255,0.6),
            0 4px 10px rgba(0,0,0,0.4);

          border:${borderStyle};

          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:2px;
        ">
          ${loanBadge}
          <div>${price.toFixed(1)}억</div>
        </div>

        <div style="
          width:0;
          height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${bgColor};
          margin-top:-1px;
          filter:
            drop-shadow(0 0 3px rgba(255,255,255,0.6))
            drop-shadow(0 3px 4px rgba(0,0,0,0.35));
        "></div>
      </div>
    `,
    iconSize: [50, 40],
    iconAnchor: [25, 40],
  });
}

/** ---------- Cluster + 말풍선 ---------- **/
function ClusterLayer({ data, budget, loanConfig, onSelect }) {
  const view = useViewState();

  const SHOW_THRESHOLD = 13; // 말풍선 시작 줌
  const DETAIL_THRESHOLD = 15; // 이 줌 이상부터는 "개별 거래 모드"

  // 1) 좌표/가격 제대로 있는 포인트만 뽑기
  const points = useMemo(
    () =>
      data
        .filter(
          (d) =>
            Number.isFinite(d.lat) &&
            Number.isFinite(d.lon) &&
            Number.isFinite(d.price)
        )
        .map((d, i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [d.lon, d.lat] },
          properties: {
            id: i,
            price: d.price,
            dong: d.dong,
            apt: d.apt,
            area: d.area,
            year: d.year,
            loanOnly: !!d.loanOnly,
          },
        })),
    [data]
  );

  // 2) 중간 줌에서 쓸 supercluster 인덱스
  const index = useMemo(
    () =>
      new supercluster({
        radius: 60,
        maxZoom: 18,
        map: (props) => ({
          sumPrice: props.price,
          count: 1,
        }),
        reduce: (acc, props) => {
          acc.sumPrice += props.sumPrice;
          acc.count += props.count;
        },
      }).load(points),
    [points]
  );

  if (!view.bbox || !Number.isFinite(view.zoom)) return null;
  const zoom = Math.round(view.zoom);

  // 아직 너무 멀리 → 아무 말풍선도 안 보이게
  if (zoom < SHOW_THRESHOLD) return null;

  const [west, south, east, north] = view.bbox;

  // 3) DETAIL_THRESHOLD 이상에서는 "클러스터 끄고 개별 거래만"
  if (zoom >= DETAIL_THRESHOLD) {
    const visiblePoints = points.filter((p) => {
      const [lon, lat] = p.geometry.coordinates;
      return lon >= west && lon <= east && lat >= south && lat <= north;
    });

    return (
      <>
        {visiblePoints.map((p) => {
          const [lon, lat] = p.geometry.coordinates;
          const { id, price, dong, apt, area, year, loanOnly } =
            p.properties;

          const icon = createPriceIcon(
            price,
            budget,
            loanConfig,
            loanOnly
          );
          if (!icon) return null;

          return (
            <Marker
              key={`deal-${id}`}
              position={[lat, lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  onSelect &&
                    onSelect({
                      price,
                      dong,
                      apt,
                      area,
                      year,
                      loanOnly,
                    });
                },
              }}
            >
              <Tooltip>
                {`${dong || ""} / ${apt || ""} / ${price.toFixed(1)}억`}
              </Tooltip>
            </Marker>
          );
        })}
      </>
    );
  }

  // 4) 중간 줌에서는 "클러스터 평균 + 매물 수"로 표시
  const clusters = index.getClusters(view.bbox, zoom);
  if (!clusters.length) return null;

  return (
    <>
      {clusters.map((c) => {
        const [lon, lat] = c.geometry.coordinates;

        if (c.properties.cluster) {
          const avg =
            c.properties.sumPrice && c.properties.count
              ? c.properties.sumPrice / c.properties.count
              : 0;

          const icon = createPriceIcon(avg, budget, loanConfig);
          if (!icon) return null;

          return (
            <Marker
              key={`cluster-${c.id}`}
              position={[lat, lon]}
              icon={icon}
            >
              <Tooltip>
                {`평균 ${avg.toFixed(1)}억 (매물 ${c.properties.count}개)`}
              </Tooltip>
            </Marker>
          );
        }

        const price = c.properties.price;
        const loanOnly = !!c.properties.loanOnly;
        const icon = createPriceIcon(
          price,
          budget,
          loanConfig,
          loanOnly
        );
        if (!icon) return null;

        return (
          <Marker
            key={`point-${c.properties.id}`}
            position={[lat, lon]}
            icon={icon}
            eventHandlers={{
              click: () => {
                onSelect && onSelect(c.properties);
              },
            }}
          >
            <Tooltip>
              {`${c.properties.dong || ""} / ${price.toFixed(1)}억`}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** ---------- 메인 MapView ---------- **/
export default function MapView({ data, budget, loanConfig }) {
  const [geo, setGeo] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/seoul_emd_4326.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch((err) => console.error("Failed to load geojson", err));
  }, []);

  // App에서 이미 "구매 가능 매물"만 내려오므로, 여기서는 유효성만 체크
  const visible = useMemo(
    () =>
      data.filter(
        (d) =>
          Number.isFinite(d.price) &&
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lon)
      ),
    [data]
  );

  const dongCounts = useMemo(() => {
    const m = new Map();
    visible.forEach((d) => {
      if (d.dong) {
        m.set(d.dong, (m.get(d.dong) || 0) + 1);
      }
    });
    return m;
  }, [visible]);

  const selectedDiffText =
    selected && Number.isFinite(selected.price)
      ? (() => {
          const effectiveBudget = getEffectiveBudgetForPrice(
            selected.price,
            budget,
            loanConfig
          );
          const diff = effectiveBudget - selected.price;

          if (diff >= 3)
            return `대출을 포함한 최대 구매 여력 기준, 예산 대비 ${diff.toFixed(
              1
            )}억 여유 있는 매물이에요.`;
          if (diff >= 1)
            return `대출을 포함해도 여유가 남아요. 약 ${diff.toFixed(
              1
            )}억 정도 여유가 있습니다.`;
          if (diff >= 0)
            return `대출을 포함하면 예산 안에서 살 수 있지만 여유는 거의 없어요.`;
          return `대출을 최대한 활용해도 예산을 ${Math.abs(
            diff
          ).toFixed(1)}억 초과하는 매물이에요.`;
        })()
      : "";

  const selectedBadgeColor =
    selected && Number.isFinite(selected.price)
      ? pickBubbleColor(selected.price, budget, loanConfig) || "#e5e7eb"
      : "#e5e7eb";

  const loanOnlyInfo =
    selected && selected.loanOnly
      ? "이 매물은 대출 없이는 현재 예산으로 구매할 수 없어요."
      : "";

  /** ---------- 구매 구성(현금/대출) 바 계산 ---------- **/
  let cashUsed = 0;
  let loanUsed = 0;
  let cashPortion = 0;
  let loanPortion = 0;

  if (selected && Number.isFinite(selected.price)) {
    const price = selected.price;

    // 사용 가능한 대출 최대 금액 (LTV + 상품 한도)
    const maxLoanByLtv = loanConfig ? loanConfig.ltv * price : 0;
    const usableLoan = loanConfig
      ? Math.min(loanConfig.maxLoan, maxLoanByLtv)
      : 0;

    // 현금은 최대 price까지 사용
    cashUsed = Math.min(budget, price);

    // 부족분을 대출로 메우되, 대출 한도 내에서만
    const neededFromLoan = Math.max(price - cashUsed, 0);
    loanUsed = Math.min(neededFromLoan, usableLoan);

    const total = price > 0 ? price : 1;
    cashPortion = cashUsed / total;
    loanPortion = loanUsed / total;
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <MapContainer
        center={[37.5665, 126.978]}
        zoom={11}
        minZoom={11}
        maxBounds={[
          [37.3, 126.7],
          [37.75, 127.2],
        ]}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FitToData data={visible} />
        {geo && <DongLayer geojson={geo} dongCounts={dongCounts} />}

        <ClusterLayer
          data={visible}
          budget={budget}
          loanConfig={loanConfig}
          onSelect={setSelected}
        />
      </MapContainer>

      {/* 오른쪽 매물 상세 패널 */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 280,
            maxWidth: "70vw",
            background: "rgba(255,255,255,0.98)",
            borderRadius: 16,
            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            border: "1px solid rgba(148,163,184,0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 900,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 2,
                }}
              >
                {selected.apt || "아파트 이름 미상"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                {selected.dong || "-"}
              </div>
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                color: "#9ca3af",
              }}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 4,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {Number.isFinite(selected.price)
                ? `${selected.price.toFixed(1)}억`
                : "-"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              {selected.year ? `${selected.year}년 거래` : ""}
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#4b5563",
              marginTop: 2,
            }}
          >
            {Number.isFinite(selected.area)
              ? `전용면적 ${selected.area.toFixed(1)}㎡`
              : "면적 정보 없음"}
          </div>

          {/* 예산 여유도 배지 */}
          <div
            style={{
              marginTop: 8,
              display: "inline-flex",
              padding: "3px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              alignSelf: "flex-start",
              backgroundColor: selectedBadgeColor,
              color: "#0f172a",
            }}
          >
            {selectedDiffText}
          </div>

          {/* 구매 구성 바 (현금/대출) */}
          {Number.isFinite(selected.price) && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                구매 구성
              </div>

              <div
                style={{
                  width: "100%",
                  height: 18,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "#e5e7eb",
                  display: "flex",
                }}
              >
                {/* 현금 구간 */}
                {cashUsed > 0 && (
                  <div
                    style={{
                      width: `${cashPortion * 100}%`,
                      background: "#22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#f9fafb",
                      whiteSpace: "nowrap",
                      padding: "0 4px",
                    }}
                  >
                    {cashPortion > 0.12
                      ? `현금 ${cashUsed.toFixed(1)}억`
                      : ""}
                  </div>
                )}

                {/* 대출 구간 */}
                {loanUsed > 0 && (
                  <div
                    style={{
                      width: `${loanPortion * 100}%`,
                      background: "#38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      padding: "0 4px",
                    }}
                  >
                    {loanPortion > 0.12
                      ? `대출 ${loanUsed.toFixed(1)}억`
                      : ""}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                💰 {cashUsed.toFixed(1)}억
                {loanUsed > 0 && ` + 🏦 ${loanUsed.toFixed(1)}억`}
                {" = "}
                🏠 <b>{selected.price.toFixed(1)}억</b>
              </div>
            </div>
          )}

          {loanOnlyInfo && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#ef4444",
              }}
            >
              {loanOnlyInfo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
