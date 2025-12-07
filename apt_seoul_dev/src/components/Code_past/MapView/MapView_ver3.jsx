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

/** ---------- 동 경계 Choropleth Layer (원래 그대로) ---------- **/
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

/** ---------- 파란 말풍선 아이콘 ---------- **/
function createPriceIcon(label) {
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
          background:#2563eb;               /* 파란말풍선 */
          color:#ffffff;
          font-size:12px;
          font-weight:700;
          white-space:nowrap;
          
          /* ✨ 그림자 + 하이라이트 */
          box-shadow:
            0 0 4px rgba(255,255,255,0.7),   /* 흰색 하이라이트 */
            0 4px 10px rgba(0,0,0,0.4);      /* 기존 어둡 그림자 */

          border:1px solid rgba(255,255,255,0.8);
        ">
          ${label}
        </div>

        <!-- 말풍선 꼬리 -->
        <div style="
          width:0;
          height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid #2563eb;
          margin-top:-1px;

          /* 꼬리에도 같은 느낌의 테두리/광택 */
          filter:
            drop-shadow(0 0 3px rgba(255,255,255,0.7))
            drop-shadow(0 3px 4px rgba(0,0,0,0.35));
        "></div>
      </div>
    `,
    iconSize: [50, 40],
    iconAnchor: [25, 40], 
  });
}

function ClusterLayer({ data }) {
  const view = useViewState();

  // 🔥 줌 기준 설정
  const SHOW_THRESHOLD = 13;  // ← 이 수준부터 말풍선 보이게
  const DETAIL_THRESHOLD = 15; // ← 이 수준부터 개별 매물 표시

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

  // 🔥 줌이 일정 이하라면 → 말풍선 숨김
  if (zoom < SHOW_THRESHOLD) return null;

  const clusters = index.getClusters(view.bbox, zoom);

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

          const label = `${avg.toFixed(1)}억`;
          const icon = createPriceIcon(label);

          return (
            <Marker key={`cluster-${c.id}`} position={[lat, lon]} icon={icon}>
              <Tooltip>
                평균 {label} (매물 {c.properties.count}개)
              </Tooltip>
            </Marker>
          );
        }

        // -------- 개별 매물 (줌 매우 클 때만 표시) --------
        if (zoom < DETAIL_THRESHOLD) return null;

        const price = c.properties.price;
        const label = `${price.toFixed(1)}억`;
        const icon = createPriceIcon(label);

        return (
          <Marker
            key={`point-${c.properties.id}`}
            position={[lat, lon]}
            icon={icon}
          >
            <Tooltip>{`${c.properties.dong || ""} / ${label}`}</Tooltip>
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

  // ✅ 예산 이내 + 좌표 있는 매물만 사용 (동 색 + 마커 둘 다)
  const visible = useMemo(
    () =>
      data.filter(
        (d) =>
          Number.isFinite(d.price) &&
          d.price <= budget &&
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lon)
      ),
    [data, budget]
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

        {/* 파란 말풍선 (클러스터 평균 + 개별 매물) */}
        <ClusterLayer data={visible} />
      </MapContainer>
    </div>
  );
}
