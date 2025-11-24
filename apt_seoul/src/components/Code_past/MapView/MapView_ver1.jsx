import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import supercluster from "supercluster";

/** ---------- Fit to Data (지나치게 확대되지 않도록만 사용) ---------- **/
function FitToData({ data }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || fitted.current) return;

    const coords = data.filter(
      (d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)
    );
    if (!coords.length) {
      fitted.current = true;
      return;
    }

    const bounds = [
      [
        Math.min(...coords.map((d) => d.lat)),
        Math.min(...coords.map((d) => d.lng)),
      ],
      [
        Math.max(...coords.map((d) => d.lat)),
        Math.max(...coords.map((d) => d.lng)),
      ],
    ];

    try {
      map.fitBounds(bounds, { padding: [50, 50] });

      // 👉 너무 확대되면 강제로 한 단계 정도 더 축소
      const z = map.getZoom();
      if (z > 11) map.setZoom(11);
    } catch {
      map.setView([37.5665, 126.978], 11);
    }

    fitted.current = true;
  }, [data, map]);

  return null;
}

/** ---------- Track Zoom + Bounds ---------- **/
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

/** ---------- Cluster + Marker (flex 없이 budget만 사용) ---------- **/
function ClusterLayer({ data, budget }) {
  const map = useMap();
  const view = useViewState();

  const index = useMemo(() => {
    // 예산 이내 매물만 클러스터에 반영
    const points = data
      .filter(
        (d) =>
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lng) &&
          Number.isFinite(d.price) &&
          d.price <= budget
      )
      .map((d, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        properties: { id: i, ...d },
      }));

    return new supercluster({
      radius: 60,
      maxZoom: 18,
    }).load(points);
  }, [data, budget]);

  const clusters = useMemo(() => {
    if (!view.bbox) return [];
    return index.getClusters(view.bbox, Math.round(view.zoom || 11));
  }, [view, index]);

  return (
    <>
      {clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates;

        // 클러스터 (여러 집이 뭉쳐 있을 때 큰 원)
        if (c.properties.cluster) {
          const r = Math.min(
            40,
            10 + Math.log2(c.properties.point_count + 1) * 6
          );
          return (
            <CircleMarker
              key={c.id}
              center={[lat, lng]}
              radius={r}
              pathOptions={{
                color: "#fecaca",
                fillColor: "#fecaca",
                fillOpacity: 0.35,
              }}
            >
              <Tooltip>{`근처 ${c.properties.point_count}개`}</Tooltip>
            </CircleMarker>
          );
        }

        // 개별 아파트
        const price = c.properties.price;
        if (!Number.isFinite(price)) return null;

        return (
          <CircleMarker
            key={c.properties.id}
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              color: "#000",
              weight: 1,
              fillColor: "#fecaca", // 예산 이내는 전부 같은 빨강
              fillOpacity: 0.9,
            }}
          >
            <Tooltip>{`${c.properties.dong} / ${price}억`}</Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

/** ---------- Main Map ---------- **/
export default function MapView({ data, budget }) {
  const [geo, setGeo] = useState(null);

  // GeoJSON 로딩
  useEffect(() => {
    fetch("/seoul_emd_4326.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch((err) => console.error("Failed to load geojson", err));
  }, []);

  // 동별 예산 이내 매물 개수
  const dongCounts = useMemo(() => {
    const m = new Map();
    data.forEach((d) => {
      if (Number.isFinite(d.price) && d.price <= budget && d.dong) {
        m.set(d.dong, (m.get(d.dong) || 0) + 1);
      }
    });
    return m;
  }, [data, budget]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: "720px",
        margin: "0 auto",
      }}
    >
      <MapContainer
        center={[37.5665, 126.978]} // 서울 시청 근처
        zoom={11.2}                   // 🔥 기존 12보다 한 단계 더 축소
        minZoom={11.2}                // 이 이하로는 더 축소 안 됨
        maxBounds={[
          [37.3, 126.7],
          [37.75, 127.2],
        ]}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* 서울 범위 내에서 자동으로 맞추되, 줌은 11 이상으로 */}
        <FitToData data={data} />

        {/* 동 경계 색칠 */}
        {geo && <DongLayer geojson={geo} dongCounts={dongCounts} />}

        {/* 아파트 클러스터/마커 */}
        <ClusterLayer data={data} budget={budget} />
      </MapContainer>
    </div>
  );
}
