import { useState, useEffect } from 'react'

function Clock({ showAnalog = true, showDigital = true }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = time.getHours()
  const minutes = time.getMinutes()
  const seconds = time.getSeconds()

  const hourDeg = (hours % 12) * 30 + minutes * 0.5
  const minuteDeg = minutes * 6
  const secondDeg = seconds * 6

  return (
    <div className="clock-display">
      {showAnalog && (
        <div className="analog-clock">
          <div className="clock-face">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="clock-number"
                style={{
                  transform: `rotate(${i * 30}deg) translateY(-70px) rotate(-${i * 30}deg)`
                }}
              >
                {i === 0 ? 12 : i}
              </div>
            ))}
            <div
              className="clock-hand hour-hand"
              style={{ transform: `rotate(${hourDeg}deg)` }}
            />
            <div
              className="clock-hand minute-hand"
              style={{ transform: `rotate(${minuteDeg}deg)` }}
            />
            <div
              className="clock-hand second-hand"
              style={{ transform: `rotate(${secondDeg}deg)` }}
            />
            <div className="clock-center" />
          </div>
        </div>
      )}

      {showDigital && (
        <div className="digital-clock">
          <span className="digit">{String(hours).padStart(2, '0')}</span>
          <span className="colon">:</span>
          <span className="digit">{String(minutes).padStart(2, '0')}</span>
          <span className="colon">:</span>
          <span className="digit seconds">{String(seconds).padStart(2, '0')}</span>
        </div>
      )}
    </div>
  )
}

export default Clock
