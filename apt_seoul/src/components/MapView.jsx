import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";

/** 분위수 계산 유틸(간단) */
function quantile(arr, q) {
  const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return rest ? a[base] + rest * (a[base + 1] - a[base]) : a[base];
}

/** 데이터에 맞춰 bounds 자동 맞추기(이상치 트림 + invalidateSize) */
function FitToData({ data }) {
  const map = useMap();
  const did = useRef(false);

  useEffect(() => {
    // Leaflet 컨테이너 초기 사이즈 보정
    const id = setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  useEffect(() => {
    if (!data?.length) return;

    const lats = data.map(d => d.lat).filter(Number.isFinite);
    const lons = data.map(d => d.lon).filter(Number.isFinite);
    if (!lats.length || !lons.length) return;

    // 2%~98% 구간으로 트림해서 이상치 배제
    const minLat = quantile(lats, 0.02);
    const maxLat = quantile(lats, 0.98);
    const minLon = quantile(lons, 0.02);
    const maxLon = quantile(lons, 0.98);

    // 값이 말이 되는지 검사 후 fitBounds
    if (Number.isFinite(minLat) && Number.isFinite(maxLat) && Number.isFinite(minLon) && Number.isFinite(maxLon)) {
      map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [24, 24] });
      // 첫 렌더에만 강제 줌 보정하고 싶으면 아래 플래그 사용
      if (!did.current) {
        did.current = true;
        setTimeout(() => map.invalidateSize(), 0);
      }
    } else {
      // fallback: 강서구 대략 중심
      map.setView([37.558, 126.85], 12);
    }
  }, [data, map]);

  return null;
}

export default function MapView({ data, budget }) {
  // 반경/색상 스케일
  const areaMin = useMemo(() => Math.min(...data.map(d => d.area).filter(Number.isFinite)), [data]);
  const areaMax = useMemo(() => Math.max(...data.map(d => d.area).filter(Number.isFinite)), [data]);
  const radius = v => {
    if (!Number.isFinite(v) || !Number.isFinite(areaMin) || areaMax === areaMin) return 8;
    const t = (v - areaMin) / Math.max(1e-6, areaMax - areaMin);
    return 6 + t * 12; // 6~18px
  };
  const color = price => (Number.isFinite(price) && price <= budget ? "#22c55e" : "#475569");

  return (
    <div className="panel map" style={{ height: "100%", overflow: "hidden" }}>
      <MapContainer
        center={[37.558, 126.85]}  // 초기값(곧 fitBounds로 재조정)
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        preferCanvas
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        <FitToData data={data} />

        {data.map(d => (
          <CircleMarker
            key={d.id}
            center={[d.Latitude ?? d.lat, d.Longitude ?? d.lon]} // 혹시 대문자 컬럼이 그대로 들어올 때 대비
            radius={radius(d.area)}
            pathOptions={{ color: "#0f172a", weight: 1, fillColor: color(d.price), fillOpacity: 0.9 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                <div><b>{d.dong}</b> · {d.apt ?? ""}</div>
                <div>가격: {Number.isFinite(d.price) ? d.price.toFixed(1) : "-"}억</div>
                <div>면적: {d.area ?? "-"}㎡ · 연도: {d.year ?? "-"}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
