function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  icon = null,
  disabled = false,
  loading = false,
  className = ''
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="btn-spinner"></span>
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          <span className="btn-text">{children}</span>
        </>
      )}
    </button>
  )
}

export default Button
