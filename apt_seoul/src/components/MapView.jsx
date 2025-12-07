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

/* ---------------- Fit Map To Data ---------------- */
function FitToData({ data }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || fitted.current) return;
    const valid = data.filter(
      (d) => Number.isFinite(d.lat) && Number.isFinite(d.lon)
    );

    if (!valid.length) return;

    const lats = valid.map((d) => d.lat);
    const lons = valid.map((d) => d.lon);

    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [50, 50] }
    );

    fitted.current = true;
  }, [data, map]);

  return null;
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



/* ---------------- Map View State ---------------- */
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

function getFinalEffectiveBudget(price, budget, policyLoanConfig, customLoanConfig) {
  let usableLoan = 0;

  // 1) 정책 대출
  if (policyLoanConfig) {
    const maxLoanByLtv = policyLoanConfig.ltv * price;
    usableLoan = Math.min(policyLoanConfig.maxLoan, maxLoanByLtv);
  }

  // 2) 일반 대출 포함 → 정책보다 우선 반영
  if (customLoanConfig) {
    usableLoan = customLoanConfig.availableLoan; // 계산된 PF 값
  }

  return budget + usableLoan;
}

/* ---------------- Budget (loan included) ---------------- */
function getEffectiveBudget(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  // 일반 대출 선택 시 → customLoanCapacity(억) 사용
  if (selectedLoan === "CUSTOM" && customLoanCapacity && customLoanCapacity > 0) {
    return budget + customLoanCapacity;
  }

  // 정책 대출
  if (loanConfig) {
    const maxLoanByLtv = loanConfig.ltv * price;
    const usableLoan = Math.min(loanConfig.maxLoan, maxLoanByLtv);
    return budget + usableLoan;
  }

  // 대출 없음
  return budget;
}

/* ---------------- Bubble Coloring ---------------- */
function getBubbleColor(price, budget, loanConfig, customLoanCapacity, selectedLoan) {
  const eff = getEffectiveBudget(
    price,
    budget,
    loanConfig,
    customLoanCapacity,
    selectedLoan
  );
  const diff = eff - price;

  if (diff >= 2) return "#22c55e"; // 충분 여유
  if (diff >= 1) return "#fb923c"; // 안전
  if (diff >= 0) return "#ec5353"; // 아슬아슬
  return null; // 못 삼
}

function getAffordabilityMessage(price, budget, loanConfig, selectedLoan, customLoanCapacity) {
  const eff = getBuyingPower(price, budget, selectedLoan, loanConfig, customLoanCapacity);
  const diff = eff - price;

  if (diff >= 2) return "구매에 충분한 여유가 있어요! 😊";
  if (diff >= 1) return "구매하기에 적당해요 🙂";
  if (diff >= 0) return "조금 빠듯하지만 구매 가능해요 😬";
  return "예산을 초과했어요 ❌";
}


/* ---------------- Marker Icon ---------------- */
function createMarkerIcon(
  price,
  budget,
  loanConfig,
  selectedLoan,
  customLoanCapacity,
  loanOnly,
  isFavorite
) {
  const bg = getBubbleColor(price, budget, loanConfig, customLoanCapacity, selectedLoan);
  if (!bg) return null;

  const borderColor = isFavorite ? "#facc15" : "white";

  return L.divIcon({
    className: "marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        
        <!-- Bubble -->
        <div style="
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:0px;
          padding:6px 14px;
          background:${bg};
          border-radius:20px;
          border:2px solid ${borderColor};
          color:white;
          font-size:12px;
          font-weight:700;
          white-space:nowrap;
          box-shadow:
            0 0 4px rgba(255,255,255,0.7),
            0 4px 10px rgba(0,0,0,0.45);
        ">

          <!-- Loan icon inside bubble (top center) -->
          ${loanOnly ? `<div style="font-size:20px; margin-bottom:0px;">🏦</div>` : ""}

          <!-- Row: star + price -->
          <div style="display:flex; align-items:center; gap:6px;">
            ${isFavorite ? "⭐" : ""}
            <span>${price.toFixed(1)}억</span>
          </div>
        </div>

        <!-- Triangle outline -->
        <div style="
          width:0;
          height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-top:12px solid ${borderColor};
          margin-top:-2px;
          position:relative;
          z-index:1;
        "></div>

        <!-- Triangle fill -->
        <div style="
          width:0;
          height:0;
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:11px solid ${bg};
          margin-top:-13px;
          position:relative;
          z-index:2;
        "></div>
      </div>
    `,
    iconSize: [100, 55],
    iconAnchor: [50, 55],
  });
}

/* ---------------- Dong Layer ---------------- */
function DongLayer({ geojson, dongCounts }) {
  const maxVal = Math.max(...dongCounts.values(), 0);

  const style = (feature) => {
    const dongName = feature.properties.emd_kor_nm;
    const count = dongCounts.get(dongName) || 0;

    if (!count || !maxVal) {
      return {
        fillColor: "rgba(0,0,0,0.02)",
        color: "#000000",
        weight: 1,
        fillOpacity: 1,
      };
    }

    const alpha = 0.25 + (count / maxVal) * 0.55;

    return {
      fillColor: `rgba(248,113,113,${alpha})`, // 빨강 히트맵
      color: "#000000",
      weight: 1,
      fillOpacity: 1,
    };
  };

  return <GeoJSON data={geojson} style={style} />;
}

/* ---------------- Marker Clustering ---------------- */
function ClusterLayer({
  data,
  budget,
  loanConfig,
  favorites,
  onSelect,
  selectedLoan,
  customLoanCapacity,
}) {
  const view = useViewState();
  const ZOOM_MARKERS = 13;

  const points = useMemo(
    () =>
      data.map((d) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
        properties: { ...d, isFavorite: favorites.includes(d.id) },
      })),
    [data, favorites]
  );

  const index = useMemo(
    () =>
      new supercluster({
        radius: 60,
        maxZoom: 18,
      }).load(points),
    [points]
  );

  if (!view.bbox || view.zoom < ZOOM_MARKERS) return null;

  const clusters = index.getClusters(view.bbox, view.zoom);

  return clusters.map((c) => {
    if (c.properties.cluster) return null;

    const icon = createMarkerIcon(
      c.properties.price,
      budget,
      loanConfig,
      selectedLoan,
      customLoanCapacity,
      c.properties.loanOnly,
      c.properties.isFavorite
    );

    if (!icon) return null;

    return (
      <Marker
        key={c.properties.id}
        position={[c.geometry.coordinates[1], c.geometry.coordinates[0]]}
        icon={icon}
        eventHandlers={{ click: () => onSelect(c.properties) }}
      >
        <Tooltip>
          {`${c.properties.apt || ""} / ${c.properties.price.toFixed(1)}억`}
        </Tooltip>
      </Marker>
    );
  });
}

/* ---------------- Map Click → 상세 패널 닫기 ---------------- */
function MapClickClearSelection({ onClear }) {
  useMapEvents({
    click: () => onClear && onClear(),
  });
  return null;
}

/* ---------------- MAIN ---------------- */
export default function MapView({
  data,
  budget,
  loanConfig,
  selectedLoan,
  customLoanCapacity,
  customLoanData,
  favorites,
  setFavorites,
}) {
  const [geo, setGeo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => {
    fetch("/seoul_emd_4326.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch((e) => console.error(e));
  }, []);

  const visible = useMemo(
    () => (showFavOnly ? data.filter((d) => favorites.includes(d.id)) : data),
    [data, favorites, showFavOnly]
  );

  const dongCounts = useMemo(() => {
    const m = new Map();
    visible.forEach((d) => m.set(d.dong, (m.get(d.dong) || 0) + 1));
    return m;
  }, [visible]);

  const toggleFavorite = () => {
    if (!selected) return;
    setFavorites((prev) =>
      prev.includes(selected.id)
        ? prev.filter((id) => id !== selected.id)
        : [...prev, selected.id]
    );
  };

  const price = selected?.price || 0;

  // 구매 구성 (현금/대출) 계산 (MapView_ver8.jsx기준 378~398)
  // ↓↓↓↓↓↓ 251203 수정 ↓↓↓↓↓↓
  let cashUsed = 0;
  let loanUsed = 0;

  if (selected && Number.isFinite(price)) {
    let maxAvailableLoan=0;

    if (selectedLoan === "CUSTOM" && customLoanCapacity && customLoanCapacity > 0) {
      maxAvailableLoan = customLoanCapacity;
    } else if (loanConfig) {
      const maxLoanByLtv = loanConfig.ltv * price;
      maxAvailableLoan = Math.min(loanConfig.maxLoan, maxLoanByLtv);
    }
    loanUsed = Math.min(price,maxAvailableLoan);//대출은 최대한도로 계산(가격과 대출최대한도 중 min)
    const remainPrice =Math.max(price-loanUsed,0); //실거래가에서 loanUsed 제외한 잔액
    cashUsed = Math.min(budget,remainPrice); // 현금 사용은 잔가와 갖고있는 현금 중 min값 반영
  }
  // ↑↑↑↑↑↑ 251203 수정 ↑↑↑↑↑↑

  const total = price || 1;
  const cashPct = (cashUsed / total) * 100;
  const loanPct = (loanUsed / total) * 100;

  const isFav = selected ? favorites.includes(selected.id) : false;

  const canBuyFlag =
    selected &&
    getBuyingPower(
      selected.price,
      budget,
      loanConfig,
      customLoanCapacity,
      selectedLoan
    ) >= selected.price;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Favorite Toggle Button */}
      <button
        onClick={() => setShowFavOnly((v) => !v)}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "8px 14px",
          borderRadius: 999,
          background: showFavOnly ? "gold" : "#111827",
          color: showFavOnly ? "black" : "white",
          cursor: "pointer",
          fontWeight: 700,
          zIndex: 999,
        }}
      >
        ⭐ {showFavOnly ? "관심 매물" : "전체 매물"}
      </button>

      <MapContainer
        center={[37.5665, 126.978]}
        zoom={11}
        minZoom={11}
        zoomControl={false}
        maxBounds={[
          [37.3, 126.7],
          [37.75, 127.2],
        ]}
        maxBoundsViscosity={1.0}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && <DongLayer geojson={geo} dongCounts={dongCounts} />}
        <FitToData data={visible} />
        <MapClickClearSelection onClear={() => setSelected(null)} />
        <ClusterLayer
          data={visible}
          budget={budget}
          loanConfig={loanConfig}
          favorites={favorites}
          onSelect={setSelected}
          selectedLoan={selectedLoan}
          customLoanCapacity={customLoanCapacity}
        />
      </MapContainer>

      {/* 상세 정보 패널 */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 280,
            background: "white",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0px 8px 20px rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  color: "#111",
                  fontSize: 16,
                }}
              >
                {selected.apt}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {selected.dong}
              </div>
            </div>

            <button
              onClick={toggleFavorite}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  color: isFav ? "#facc15" : "#d1d5db",
                  transition: "color 0.15s ease-out, transform 0.12s ease-out",
                  transform: isFav ? "scale(1.1)" : "scale(1.0)",
                  filter: isFav
                    ? "drop-shadow(0 0 4px rgba(250, 204, 21, 0.7))"
                    : "none",
                }}
              >
                {isFav ? "★" : "☆"}
              </span>
            </button>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 26,
              fontWeight: 800,
              color: "#000",
            }}
          >
            {selected.price.toFixed(1)}억
          </div>

          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            {selected.year}년 · 전용 {selected.area?.toFixed(1)}㎡
          </div>

          <div
            style={{
              marginTop: 10,
              width: "100%",                // ⭐ 전체 폭 사용
              padding: "2px 2px",
              borderRadius: 12,
              background: getBubbleColor(
                selected.price,
                budget,
                loanConfig,
                customLoanCapacity,
                selectedLoan
              ),
              display: "flex",
              justifyContent: "center",     // ⭐ 가로 정렬
              alignItems: "center",         // ⭐ 세로 정렬
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
              minHeight: 20,
              boxSizing: "border-box",      // 레이아웃 안정화
            }}
          >
            {getAffordabilityMessage(selected.price, budget, loanConfig, selectedLoan, customLoanCapacity)}

          </div>

          {/* 구매 bar (pill style) */}
          {Number.isFinite(price) && (
            <div
              style={{
                marginTop: 14,
                width: "100%",
                height: 18,
                background: "#e5e7eb",
                borderRadius: 999,
                display: "flex",
                overflow: "hidden",
              }}
            >
              {cashUsed > 0 && (
                <div
                  style={{
                    width: `${cashPct}%`,
                    background: "#22c55e",
                    color: "#fff",
                    fontSize: 10,
                    textAlign: "center",
                    lineHeight: "18px",
                  }}
                >
                  {cashPct > 12 ? `현금 ${cashUsed.toFixed(1)}억` : ""}
                </div>
              )}

              {loanUsed > 0 && (
                <div
                  style={{
                    width: `${loanPct}%`,
                    background: "#38bdf8",
                    color: "#111",
                    fontSize: 10,
                    textAlign: "center",
                    lineHeight: "18px",
                  }}
                >
                  {loanPct > 12 ? `대출 ${loanUsed.toFixed(1)}억` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
