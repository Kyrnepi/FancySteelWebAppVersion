import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Card from '../components/Card'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import Tooltip from '../components/Tooltip'

// All available tiles (power includes zap, modes includes countdown)
const ALL_TILES = ['power', 'lock', 'modes', 'release', 'tilt']

// Available themes
const THEMES = [
  { id: 'default', name: 'Default', icon: '🎨' },
  { id: 'modern', name: 'Modern Remote', icon: '📱' },
  { id: 'steampunk', name: 'Steampunk', icon: '⚙️' },
  { id: 'futuristic', name: 'Futuristic', icon: '🚀' },
  { id: 'neon', name: 'Neon Glow', icon: '💫' }
]

function LocalMode() {
  const { menuOpen, setMenuOpen } = useOutletContext()
  const {
    state,
    setPower,
    sendCommand,
    addNotification,
    checkConnection
  } = useApp()

  const [isLocked, setIsLocked] = useState(false)
  const [zapActive, setZapActive] = useState(false)
  const [beepActive, setBeepActive] = useState(false)
  const [countdownValue, setCountdownValue] = useState(60) // Default 1 minute
  const [countdown, setCountdown] = useState(0)
  const [isCountdownRunning, setIsCountdownRunning] = useState(false)
  const [releaseTime, setReleaseTime] = useState(30)
  const [isReleasing, setIsReleasing] = useState(false)
  const longPressRef = useRef(null)

  const [activeMode, setActiveMode] = useState(null)
  const [buzzerEnabled, setBuzzerEnabled] = useState(false)

  const [tiltValue, setTiltValue] = useState('')
  const [tiltInput, setTiltInput] = useState('')
  const [isCheckingTilt, setIsCheckingTilt] = useState(false)

  // Tile state
  const [visibleTiles, setVisibleTiles] = useState(ALL_TILES)
  const [currentTheme, setCurrentTheme] = useState('default')

  const [draggedTile, setDraggedTile] = useState(null)
  const [dragOverTile, setDragOverTile] = useState(null)

  // Tooltips
  const [tooltips, setTooltips] = useState({})

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config/tiles')
        if (response.ok) {
          const data = await response.json()
          if (data.order && Array.isArray(data.order)) {
            // Migrate old config: convert old tile names to new ones
            const migratedOrder = data.order
              .filter(t => !['zap', 'countdown', 'switches'].includes(t))
              .map(t => t === 'switches' ? 'modes' : t)
            // Ensure 'modes' exists if 'switches' or 'countdown' was there
            if ((data.order.includes('switches') || data.order.includes('countdown')) && !migratedOrder.includes('modes')) {
              migratedOrder.push('modes')
            }
            // Filter to only valid tiles
            const validTiles = migratedOrder.filter(t => ALL_TILES.includes(t))
            setVisibleTiles(validTiles.length > 0 ? validTiles : ALL_TILES)
          }
          if (data.theme) {
            setCurrentTheme(data.theme)
          }
        }
      } catch (error) {
        console.log('Using default config')
      }
    }

    const loadTooltips = async () => {
      try {
        const response = await fetch('/api/config/tooltips')
        if (response.ok) {
          const data = await response.json()
          setTooltips(data)
        }
      } catch (error) {
        console.log('Using default tooltips')
      }
    }

    loadConfig()
    loadTooltips()
    checkConnection()
  }, [checkConnection])

  // Save config
  const saveConfig = useCallback(async (tiles, theme) => {
    try {
      await fetch('/api/config/tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: tiles, theme })
      })
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }, [])

  // Get hidden tiles
  const hiddenTiles = ALL_TILES.filter(t => !visibleTiles.includes(t))

  // Remove tile
  const removeTile = (tileId) => {
    const newTiles = visibleTiles.filter(t => t !== tileId)
    setVisibleTiles(newTiles)
    saveConfig(newTiles, currentTheme)
    addNotification(`Tile removed`, 'info')
  }

  // Add tile back
  const addTile = (tileId) => {
    const newTiles = [...visibleTiles, tileId]
    setVisibleTiles(newTiles)
    saveConfig(newTiles, currentTheme)
    addNotification(`Tile added`, 'success')
    setMenuOpen(false)
  }

  // Change theme
  const changeTheme = (themeId) => {
    setCurrentTheme(themeId)
    saveConfig(visibleTiles, themeId)
    addNotification(`Theme changed to ${THEMES.find(t => t.id === themeId)?.name}`, 'info')
    setMenuOpen(false)
  }

  // Drag and drop
  const handleDragStart = (e, tileId) => {
    setDraggedTile(tileId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, tileId) => {
    e.preventDefault()
    if (tileId !== draggedTile) setDragOverTile(tileId)
  }

  const handleDragLeave = () => setDragOverTile(null)

  const handleDrop = (e, targetTileId) => {
    e.preventDefault()
    if (draggedTile && draggedTile !== targetTileId) {
      const newOrder = [...visibleTiles]
      const draggedIndex = newOrder.indexOf(draggedTile)
      const targetIndex = newOrder.indexOf(targetTileId)
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedTile)
      setVisibleTiles(newOrder)
      saveConfig(newOrder, currentTheme)
    }
    setDraggedTile(null)
    setDragOverTile(null)
  }

  const handleDragEnd = () => {
    setDraggedTile(null)
    setDragOverTile(null)
  }

  // Countdown timer with LOOP
  useEffect(() => {
    let interval
    if (isCountdownRunning && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Loop: restart from countdownValue
            addNotification('Timer loop restarting...', 'info')
            return countdownValue
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isCountdownRunning, countdown, countdownValue, addNotification])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Sync power with device
  const syncPowerFromDevice = async () => {
    try {
      const response = await sendCommand('/DIS/PW')
      if (response?.data) {
        // Extract numeric value from response (e.g., "PW/50" -> 50)
        let value = response.data
        if (typeof value === 'string') {
          // Remove any prefix like "PW/"
          const match = value.match(/\d+/)
          if (match) {
            const power = parseInt(match[0], 10)
            if (!isNaN(power) && power >= 0 && power <= 100) {
              setPower(power)
            }
          }
        } else if (typeof value === 'number') {
          setPower(Math.max(0, Math.min(100, value)))
        }
      }
    } catch (error) {
      // Silently fail - device may not support this command
      console.log('Power sync not available')
    }
  }

  // Power handlers - always send command for resync capability
  const handlePowerUp = async () => {
    // Optimistic update (clamped for display)
    const newPower = Math.min(100, state.power + 5)
    setPower(newPower)
    await sendCommand('/PW/+')
    // Try to sync actual value from device
    await syncPowerFromDevice()
  }

  const handlePowerDown = async () => {
    // Optimistic update (clamped for display)
    const newPower = Math.max(0, state.power - 5)
    setPower(newPower)
    await sendCommand('/PW/-')
    // Try to sync actual value from device
    await syncPowerFromDevice()
  }

  // Beep handler (short press - /B1/1)
  const handleBeepClick = async () => {
    setBeepActive(true)
    await sendCommand('/B1/1')
    addNotification('BEEP!', 'info')
    setTimeout(() => setBeepActive(false), 300)
  }

  // ZAP handler (long press - /Z1/1)
  const handleZapClick = async () => {
    setZapActive(true)
    await sendCommand('/Z1/1')
    addNotification('ZAP!', 'warning')
    setTimeout(() => setZapActive(false), 500)
  }

  // Lock handlers
  const handleLockClick = async () => {
    const newLockedState = !isLocked
    setIsLocked(newLockedState)
    await sendCommand(newLockedState ? '/loc1/1' : '/loc1/0')
    addNotification(newLockedState ? 'LOCKED' : 'UNLOCKED', 'info')
  }

  const handleLockLongClick = async () => {
    await sendCommand('/loc1/0')
    setIsLocked(false)
    addNotification('FORCE UNLOCKED', 'warning')
  }

  // Release handlers
  const handleReleaseTouchDown = () => {
    setIsReleasing(true)
    sendCommand('/REL/0')
  }

  const handleReleaseTouchUp = () => {
    setIsReleasing(false)
    sendCommand('/loc1/0')
  }

  const handleReleaseTimeUp = async () => {
    setReleaseTime(prev => Math.min(300, prev + 5))
    await sendCommand('/T2/+')
  }

  const handleReleaseTimeDown = async () => {
    setReleaseTime(prev => Math.max(5, prev - 5))
    await sendCommand('/T2/-')
  }

  // Countdown handlers
  const handleCountdownUp = async () => {
    setCountdownValue(prev => Math.min(3600, prev + 10))
    await sendCommand('/T1/+')
  }

  const handleCountdownDown = async () => {
    setCountdownValue(prev => Math.max(10, prev - 10))
    await sendCommand('/T1/-')
  }

  const handleToggleCountdown = async (checked) => {
    if (checked) {
      setCountdown(countdownValue)
      setIsCountdownRunning(true)
      await sendCommand('/mode/TM')
      addNotification('Timer started (loop mode)', 'success')
    } else {
      setIsCountdownRunning(false)
      setCountdown(0)
      await sendCommand('/mode/0')
      addNotification('Timer stopped', 'info')
    }
  }

  // Mode handlers - activating a mode stops the countdown loop
  const handleModeToggle = async (mode, endpoint) => {
    if (activeMode === mode) {
      setActiveMode(null)
      await sendCommand('/mode/0')
    } else {
      // Stop countdown loop if running
      if (isCountdownRunning) {
        setIsCountdownRunning(false)
        setCountdown(0)
        addNotification('Countdown stopped (mode change)', 'info')
      }
      setActiveMode(mode)
      await sendCommand(endpoint)
    }
  }

  const handleBuzzerToggle = async () => {
    const newValue = !buzzerEnabled
    setBuzzerEnabled(newValue)
    await sendCommand(newValue ? '/S1/1' : '/S1/0')
  }

  // Tilt handlers
  const handleCheckTilt = async () => {
    setIsCheckingTilt(true)
    try {
      const response = await sendCommand('/DIS/BOW')
      if (response?.data) {
        // Extract numeric value from "BOW/value" format
        let value = response.data
        if (typeof value === 'string' && value.includes('/')) {
          value = value.split('/').pop()
        }
        setTiltValue(value)
        setTiltInput(value)
        addNotification('Tilt retrieved', 'success')
      }
    } catch (error) {
      addNotification('Tilt check failed', 'error')
    } finally {
      setIsCheckingTilt(false)
    }
  }

  const handleSetTilt = async () => {
    if (!tiltInput || isNaN(tiltInput)) {
      addNotification('Enter a valid number', 'warning')
      return
    }
    await sendCommand(`/TX?TILTVAL=${tiltInput}`)
    setTiltValue(tiltInput)
    addNotification(`Tilt set to ${tiltInput}`, 'success')
  }

  // Mode configurations
  const modes = [
    { key: 'petTraining', label: 'Pet Training', endpoint: '/mode/S2', color: 'green' },
    { key: 'petFast', label: 'Pet Fast', endpoint: '/mode/S2F', color: 'orange' },
    { key: 'petFreeze', label: 'Pet Freeze', endpoint: '/mode/S2Z', color: 'cyan' },
    { key: 'sleep', label: 'Sleep Depriv.', endpoint: '/mode/S4', color: 'purple' },
    { key: 'random', label: 'Random', endpoint: '/mode/RN', color: 'blue' }
  ]

  // Tile labels for menu
  const tileLabels = {
    power: '⚡ Power & ZAP',
    lock: '🔒 Lock',
    modes: '🔧 Modes & Timer',
    release: '🕐 Release',
    tilt: '📐 Tilt'
  }

  // Tile components
  const tileComponents = {
    // Power tile with Beep + Zap buttons
    power: (
      <Card title="Power" icon="⚡" className="power-zap-card">
        <div className="power-zap-control">
          <div className="power-horizontal">
            <Tooltip text={tooltips.power?.minus} delay={tooltips.delay}>
              <Button variant="secondary" className="power-btn-side" onClick={handlePowerDown}>−</Button>
            </Tooltip>
            <div className="power-display-center">
              <div className="power-value-large">{state.power}</div>
              <div className="power-unit">%</div>
            </div>
            <Tooltip text={tooltips.power?.plus} delay={tooltips.delay}>
              <Button variant="secondary" className="power-btn-side" onClick={handlePowerUp}>+</Button>
            </Tooltip>
          </div>
          <div className="zap-buttons-row">
            <Tooltip text={tooltips.power?.beep} delay={tooltips.delay}>
              <button
                className={`beep-button ${beepActive ? 'active' : ''}`}
                onClick={handleBeepClick}
              >
                <span className="beep-icon">🔔</span>
                <span className="beep-text">BEEP</span>
              </button>
            </Tooltip>
            <Tooltip text={tooltips.power?.zap} delay={tooltips.delay}>
              <button
                className={`zap-button ${zapActive ? 'active' : ''}`}
                onClick={handleZapClick}
              >
                <span className="zap-icon">⚡</span>
                <span className="zap-text">ZAP</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </Card>
    ),
    lock: (
      <Card title="Lock" icon="🔒" className="lock-card">
        <Tooltip text={tooltips.lock?.button} delay={tooltips.delay}>
          <button
            className={`lock-button-large ${isLocked ? 'locked' : 'unlocked'}`}
            onClick={handleLockClick}
            onContextMenu={(e) => { e.preventDefault(); handleLockLongClick() }}
          >
            <span className="lock-icon">{isLocked ? '🔒' : '🔓'}</span>
            <span className="lock-text">{isLocked ? 'LOCKED' : 'UNLOCKED'}</span>
          </button>
        </Tooltip>
      </Card>
    ),
    // Modes tile with timer at top, then 3 columns: modes, modes, timer slider
    modes: (
      <Card title="Modes" icon="🔧" className="modes-card">
        {/* Timer display at top, centered */}
        <div className="timer-top-section">
          <Tooltip text={tooltips.modes?.timer_minus} delay={tooltips.delay}>
            <Button variant="secondary" className="timer-btn-small" onClick={handleCountdownDown} disabled={isCountdownRunning}>−</Button>
          </Tooltip>
          <div className={`timer-display-top ${isCountdownRunning ? 'active' : ''}`}>
            {isCountdownRunning ? formatTime(countdown) : formatTime(countdownValue)}
          </div>
          <Tooltip text={tooltips.modes?.timer_plus} delay={tooltips.delay}>
            <Button variant="secondary" className="timer-btn-small" onClick={handleCountdownUp} disabled={isCountdownRunning}>+</Button>
          </Tooltip>
        </div>

        <div className="modes-three-columns">
          {/* Column 1: First 3 modes */}
          <div className="modes-column">
            {modes.slice(0, 3).map((mode) => (
              <Tooltip key={mode.key} text={tooltips.modes?.[mode.key]} delay={tooltips.delay}>
                <div className="mode-toggle-wrapper">
                  <Toggle
                    label={mode.label}
                    checked={activeMode === mode.key}
                    onChange={() => handleModeToggle(mode.key, mode.endpoint)}
                    color={mode.color}
                  />
                </div>
              </Tooltip>
            ))}
          </div>

          {/* Column 2: Last 2 modes + Buzzer */}
          <div className="modes-column">
            {modes.slice(3).map((mode) => (
              <Tooltip key={mode.key} text={tooltips.modes?.[mode.key]} delay={tooltips.delay}>
                <div className="mode-toggle-wrapper">
                  <Toggle
                    label={mode.label}
                    checked={activeMode === mode.key}
                    onChange={() => handleModeToggle(mode.key, mode.endpoint)}
                    color={mode.color}
                  />
                </div>
              </Tooltip>
            ))}
            <Tooltip text={tooltips.modes?.buzzer} delay={tooltips.delay}>
              <div className="mode-toggle-wrapper">
                <Toggle
                  label="Buzzer"
                  checked={buzzerEnabled}
                  onChange={handleBuzzerToggle}
                  color="red"
                />
              </div>
            </Tooltip>
          </div>

          {/* Column 3: Timer Toggle (same design as other mode toggles) */}
          <div className="modes-column timer-slider-column">
            <Tooltip text={tooltips.modes?.timer_toggle} delay={tooltips.delay}>
              <div className="mode-toggle-wrapper">
                <Toggle
                  label="Timer"
                  checked={isCountdownRunning}
                  onChange={() => handleToggleCountdown(!isCountdownRunning)}
                  color="green"
                />
              </div>
            </Tooltip>
          </div>
        </div>
      </Card>
    ),
    release: (
      <Card title="Release" icon="🕐" className="release-card">
        <div className="release-control">
          <div className="release-time-display">
            <Tooltip text={tooltips.release?.minus} delay={tooltips.delay}>
              <Button variant="secondary" onClick={handleReleaseTimeDown}>−</Button>
            </Tooltip>
            <div className="release-value">{releaseTime}s</div>
            <Tooltip text={tooltips.release?.plus} delay={tooltips.delay}>
              <Button variant="secondary" onClick={handleReleaseTimeUp}>+</Button>
            </Tooltip>
          </div>
          <Tooltip text={tooltips.release?.button} delay={tooltips.delay}>
            <button
              className={`release-button ${isReleasing ? 'active' : ''}`}
              onMouseDown={handleReleaseTouchDown}
              onMouseUp={handleReleaseTouchUp}
              onMouseLeave={handleReleaseTouchUp}
              onTouchStart={handleReleaseTouchDown}
              onTouchEnd={handleReleaseTouchUp}
            >
              {isReleasing ? 'RELEASING...' : 'HOLD TO RELEASE'}
            </button>
          </Tooltip>
        </div>
      </Card>
    ),
    tilt: (
      <Card title="Tilt" icon="📐" className="tilt-card">
        <div className="tilt-control">
          <div className="tilt-display">
            <span className="tilt-label">Current:</span>
            <span className="tilt-value">{tiltValue || '---'}</span>
          </div>
          <input
            type="number"
            className="tilt-input"
            value={tiltInput}
            onChange={(e) => setTiltInput(e.target.value)}
            placeholder="Tilt value"
          />
          <div className="tilt-buttons">
            <Tooltip text={tooltips.tilt?.check} delay={tooltips.delay}>
              <Button variant="secondary" onClick={handleCheckTilt} disabled={isCheckingTilt}>
                {isCheckingTilt ? '...' : 'Check'}
              </Button>
            </Tooltip>
            <Tooltip text={tooltips.tilt?.set} delay={tooltips.delay}>
              <Button variant="primary" onClick={handleSetTilt}>Set</Button>
            </Tooltip>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className={`local-mode-container theme-${currentTheme}`}>
      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="dropdown-menu">
          {/* Hidden tiles */}
          {hiddenTiles.length > 0 && (
            <div className="dropdown-section">
              <h4>Hidden Tiles</h4>
              <div className="hidden-tiles-list">
                {hiddenTiles.map(tileId => (
                  <button key={tileId} className="add-tile-btn" onClick={() => addTile(tileId)}>
                    + {tileLabels[tileId]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Theme selector */}
          <div className="dropdown-section">
            <h4>Themes</h4>
            <div className="theme-list">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-btn ${currentTheme === theme.id ? 'active' : ''}`}
                  onClick={() => changeTheme(theme.id)}
                >
                  <span className="theme-icon">{theme.icon}</span>
                  <span className="theme-name">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="page local-mode">
        <div className="grid-layout local-grid">
          {visibleTiles.map((tileId) => (
            <div
              key={tileId}
              className={`tile-wrapper ${draggedTile === tileId ? 'dragging' : ''} ${dragOverTile === tileId ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, tileId)}
              onDragOver={(e) => handleDragOver(e, tileId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, tileId)}
              onDragEnd={handleDragEnd}
            >
              <button className="tile-remove-btn" onClick={() => removeTile(tileId)}>×</button>
              {tileComponents[tileId]}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LocalMode
