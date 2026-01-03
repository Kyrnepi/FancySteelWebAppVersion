function Slider({ label, value, min = 0, max = 100, step = 1, onChange, unit = '%', showValue = true }) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="slider-container">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        {showValue && (
          <span className="slider-value">{value}{unit}</span>
        )}
      </div>
      <div className="slider-track-container">
        <input
          type="range"
          className="slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--progress': `${percentage}%` }}
        />
        <div className="slider-track">
          <div className="slider-fill" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    </div>
  )
}

export default Slider
