function Toggle({ label, checked, onChange, color = 'primary', disabled = false }) {
  return (
    <div className={`toggle-container ${disabled ? 'disabled' : ''}`}>
      <label className="toggle-label">
        <div className="toggle-info">
          <span className="toggle-text">{label}</span>
          <span className={`toggle-status ${checked ? 'on' : 'off'}`}>
            {checked ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className={`toggle-switch ${color}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
          />
          <span className="toggle-slider"></span>
        </div>
      </label>
    </div>
  )
}

export default Toggle
