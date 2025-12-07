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

/** ---------- 동 경계 Choropleth Layer (이전 로직 유지) ---------- **/
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

/** ---------- 파란/노랑/주황/초록 말풍선 아이콘 ---------- **/
function createPriceIcon(price, budget) {
  const diff = budget - price; // 예산 - 실제가격

  // 색상 단계
  let bgColor = null;
  if (diff >= 3) bgColor = "#22c55e"; // 3억 이상 여유: 초록
  else if (diff >= 1) bgColor = "#fb923c"; // 1~3억 여유: 주황
  else if (diff >= 0) bgColor = "#facc15"; // 0~1억 여유: 노랑
  else return null; // 예산 초과 → 마커 표시 안 함

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

          border:1px solid rgba(255,255,255,0.8);
        ">
          ${price.toFixed(1)}억
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
function ClusterLayer({ data, budget }) {
  const view = useViewState();

  const SHOW_THRESHOLD = 13;   // 이 줌 이상에서만 말풍선 보이기
  const DETAIL_THRESHOLD = 15; // 이 줌 이상에서 개별 매물 표시

  // 좌표/가격 제대로 있는 포인트만
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
          properties: { id: i, price: d.price, dong: d.dong },
        })),
    [data]
  );

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

  // 아직 너무 멀리서 보면 → 말풍선 안 보여줌
  if (zoom < SHOW_THRESHOLD) return null;

  const clusters = index.getClusters(view.bbox, zoom);
  if (!clusters.length) return null;

  return (
    <>
      {clusters.map((c) => {
        const [lon, lat] = c.geometry.coordinates;

        // -------- 클러스터 (여러 매물 묶음) --------
        if (c.properties.cluster) {
          const avg =
            c.properties.sumPrice && c.properties.count
              ? c.properties.sumPrice / c.properties.count
              : 0;

          const icon = createPriceIcon(avg, budget);
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

        // -------- 개별 매물 (줌이 충분히 클 때만) --------
        if (zoom < DETAIL_THRESHOLD) return null;

        const price = c.properties.price;
        const icon = createPriceIcon(price, budget);
        if (!icon) return null;

        return (
          <Marker
            key={`point-${c.properties.id}`}
            position={[lat, lon]}
            icon={icon}
          >
            <Tooltip>{`${c.properties.dong || ""} / ${price.toFixed(1)}억`}</Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** ---------- Main Map ---------- **/
export default function MapView({ data, budget }) {
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    fetch("/seoul_emd_4326.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch((err) => console.error("Failed to load geojson", err));
  }, []);

  // ✅ 예산 이내 + 좌표 있는 매물만 사용
  const visible = useMemo(
    () =>
      data.filter(
        (d) =>
          Number.isFinite(d.price) &&
          d.price <= budget &&          // 예산 초과 매물은 아예 제외
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lon)
      ),
    [data, budget]
  );

  // 동별 개수 (색 진하기용)
  const dongCounts = useMemo(() => {
    const m = new Map();
    visible.forEach((d) => {
      if (d.dong) {
        m.set(d.dong, (m.get(d.dong) || 0) + 1);
      }
    });
    return m;
  }, [visible]);

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

        {/* 예산 이내 매물 기준으로 화면 맞추기 */}
        <FitToData data={visible} />

        {/* 동별 색 진하기 유지 */}
        {geo && <DongLayer geojson={geo} dongCounts={dongCounts} />}

        {/* 파란/노랑/주황/초록 말풍선 (클러스터 + 개별) */}
        <ClusterLayer data={visible} budget={budget} />
      </MapContainer>
    </div>
  );
}
