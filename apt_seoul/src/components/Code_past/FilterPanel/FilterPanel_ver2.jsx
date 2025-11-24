// src/components/FilterPanel.jsx

export default function FilterPanel({
  budget,
  setBudget,
  areaRange,
  setAreaRange,
  yearMin,
  setYearMin,
}) {
  return (
    <div className="card">
      {/* 🔵 프로필 블록 전체 */}
      <div className="profile-block">
        {/* 사진 컨테이너는 이미 잘 되어 있다면 className만 맞춰줘 */}
        <div className="profile-avatar">
          <img src="/image.png" alt="프로필" />
        </div>

        {/* 이름 / 멘트 */}
        <div className="profile-name">예비신부 님</div>
        <div className="profile-sub">나의 영끌 예산을 입력하세요.</div>
      </div>

      {/* 🔻 기존 필터들 그대로 */}
      <h3 style={{ marginTop: 0 }}>필터</h3>

      <div className="field">
        <label>예산 ({budget.toFixed(1)}억)</label>
        <input
          type="range"
          min={4}
          max={14}
          step={0.1}
          value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>4억</span>
          <span>14억</span>
        </div>
      </div>

      <div className="field">
        <label>면적 ({areaRange[0]}㎡ ~ {areaRange[1]}㎡)</label>
        <div className="dual">
          <input
            type="range"
            min={30}
            max={120}
            value={areaRange[0]}
            onChange={(e) =>
              setAreaRange([
                Math.min(+e.target.value, areaRange[1]),
                areaRange[1],
              ])
            }
          />
          <input
            type="range"
            min={30}
            max={120}
            value={areaRange[1]}
            onChange={(e) =>
              setAreaRange([
                areaRange[0],
                Math.max(+e.target.value, areaRange[0]),
              ])
            }
          />
        </div>
        <div className="scale">
          <span>30㎡</span>
          <span>120㎡</span>
        </div>
      </div>

      <div className="field">
        <label>거래 연도 (최소: {yearMin})</label>
        <input
          type="range"
          min={2022}
          max={2024}
          step={1}
          value={yearMin}
          onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
        />
        <div className="scale">
          <span>2022</span>
          <span>2024</span>
        </div>
      </div>
    </div>
  );
}


