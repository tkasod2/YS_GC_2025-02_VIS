import Papa from "papaparse";
import { useEffect, useState } from "react";

/**
 * path: public 아래 CSV 경로 (예: "/chunk_9_F.csv")
 * mapRow: 컬럼 매핑 함수 (스키마 다를 때 외부에서 조정 가능)
 */
export function useCSV(path, mapRow) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        try {
          const mapped = data
            .map((r, i) => mapRow ? mapRow(r, i) : r)
            .filter(d => Number.isFinite(d?.lat) && Number.isFinite(d?.lon)); // 위경도 필수
          setRows(mapped);
        } catch (e) {
          setErr(e);
        } finally {
          setLoading(false);
        }
      },
      error: (e) => {
        setErr(e);
        setLoading(false);
      }
    });
  }, [path, mapRow]);

  return { rows, loading, err };
}
