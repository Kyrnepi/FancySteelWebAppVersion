import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Card from '../components/Card'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import Tooltip from '../components/Tooltip'

// All available tiles (power includes zap, modes includes countdown)
const ALL_TILES = ['power', 'lock', 'modes', 'release', 'tilt', 'randomGame']

// Map tile IDs to permission keys
const TILE_PERMISSIONS = {
  power: 'power_control',
  lock: 'lock_control',
  modes: 'modes_timer',
  release: 'release_control',
  tilt: 'tilt_control',
  randomGame: 'random_game'
}

// Available themes
const THEMES = [
  { id: 'default', name: 'Default', icon: '🎨' },
  { id: 'modern', name: 'Modern Remote', icon: '📱' },
  { id: 'steampunk', name: 'Steampunk', icon: '⚙️' },
  { id: 'futuristic', name: 'Futuristic', icon: '🚀' },
  { id: 'neon', name: 'Neon Glow', icon: '💫' }
]

function LocalMode() {
  const { menuOpen, setMenuOpen, isAdmin, handleAdminClick, handleLogout } = useOutletContext()
  const {
    state,
    setPower,
    sendCommand,
    addNotification,
    checkConnection
  } = useApp()
  const { hasPermission, getPermissionLimits, authFetch } = useAuth()

  // Get permission limits for power control
  const powerLimits = getPermissionLimits('power_control')
  const maxPowerAllowed = powerLimits?.maxPower ?? 100
  const randomGameLimits = getPermissionLimits('random_game')
  const maxPowerForRandomGame = randomGameLimits?.maxPower ?? 100

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

  // Random Game state
  const [randomGameConfig, setRandomGameConfig] = useState({
    enablePetTraining: true,
    enablePetFast: true,
    enablePetFreeze: true,
    enableSleep: true,
    enableRandom: true,
    enableBuzzer: false,
    enableTimer: true,
    enableZap: true,
    enableBeep: true,
    enablePower: true, // Random power change action
    maxPower: 50,
    timerMin: 30,
    timerMax: 120,
    gameDuration: 300,
    stepDurationMin: 10,
    stepDurationMax: 60
  })
  const [isRandomGameRunning, setIsRandomGameRunning] = useState(false)
  const [randomGameTimeRemaining, setRandomGameTimeRemaining] = useState(0)
  const randomGameIntervalRef = useRef(null)
  const randomGameStepTimeoutRef = useRef(null)
  const isRandomGameRunningRef = useRef(false) // Ref to avoid closure issues
  const holdIntervalRef = useRef(null) // For hold-to-repeat buttons
  const randomGameKnownPowerRef = useRef(0) // Track power known by random game (UI may not update)
  const randomGameKnownBuzzerRef = useRef(false) // Track buzzer state known by random game
  const randomGameKnownModeRef = useRef(null) // Track active mode known by random game

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await authFetch('/api/config/tiles')
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
        const response = await authFetch('/api/config/tooltips')
        if (response.ok) {
          const data = await response.json()
          setTooltips(data)
        }
      } catch (error) {
        console.log('Using default tooltips')
      }
    }

    const loadRandomGameConfig = async () => {
      try {
        const response = await authFetch('/api/config/randomgame')
        if (response.ok) {
          const data = await response.json()
          setRandomGameConfig(prev => ({ ...prev, ...data }))
        }
      } catch (error) {
        console.log('Using default random game config')
      }
    }

    loadConfig()
    loadTooltips()
    loadRandomGameConfig()
    checkConnection()
  }, [checkConnection, authFetch])

  // Save config
  const saveConfig = useCallback(async (tiles, theme) => {
    try {
      await authFetch('/api/config/tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: tiles, theme })
      })
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }, [authFetch])

  // Filter tiles based on permissions
  const allowedTiles = useMemo(() => {
    return ALL_TILES.filter(tileId => {
      const permKey = TILE_PERMISSIONS[tileId]
      return hasPermission(permKey)
    })
  }, [hasPermission])

  // Get tiles that are allowed but currently hidden
  const hiddenTiles = allowedTiles.filter(t => !visibleTiles.includes(t))

  // Filter visible tiles to only show allowed ones
  const filteredVisibleTiles = useMemo(() => {
    return visibleTiles.filter(tileId => allowedTiles.includes(tileId))
  }, [visibleTiles, allowedTiles])

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
    // Check if already at max allowed power
    if (state.power >= maxPowerAllowed) {
      addNotification(`Power limited to ${maxPowerAllowed}%`, 'warning')
      return
    }
    // Optimistic update (clamped for display and permission limit)
    const newPower = Math.min(maxPowerAllowed, state.power + 5)
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

  // Dedicated deactivation function for random game (uses ref, not stale state)
  const handleModeDeactivate = async () => {
    setActiveMode(null)
    await sendCommand('/mode/0')
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

  // Random Game handlers
  const saveRandomGameConfig = useCallback(async (config) => {
    try {
      await authFetch('/api/config/randomgame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
    } catch (error) {
      console.error('Failed to save random game config:', error)
    }
  }, [authFetch])

  const updateRandomGameConfig = (key, value) => {
    const newConfig = { ...randomGameConfig, [key]: value }
    setRandomGameConfig(newConfig)
    saveRandomGameConfig(newConfig)
  }

  // Helper functions for +/- buttons that update AND save config
  // Use functional updates to avoid stale closure issues with hold-to-repeat
  const updateTimerMin = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.max(10, prev.timerMin + delta)
      const newConfig = { ...prev, timerMin: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }
  const updateTimerMax = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.max(10, prev.timerMax + delta)
      const newConfig = { ...prev, timerMax: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }
  const updateStepMin = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.max(5, prev.stepDurationMin + delta)
      const newConfig = { ...prev, stepDurationMin: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }
  const updateStepMax = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.max(5, prev.stepDurationMax + delta)
      const newConfig = { ...prev, stepDurationMax: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }
  const updateGameDuration = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.max(60, prev.gameDuration + delta)
      const newConfig = { ...prev, gameDuration: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }
  const updateMaxPower = (delta) => {
    setRandomGameConfig(prev => {
      const newValue = Math.min(100, Math.max(0, prev.maxPower + delta))
      const newConfig = { ...prev, maxPower: newValue }
      saveRandomGameConfig(newConfig)
      return newConfig
    })
  }

  // Hold-to-repeat handlers for +/- buttons
  const startHold = (action) => {
    action() // Execute immediately on press
    holdIntervalRef.current = setInterval(action, 150) // Repeat while held
  }

  const stopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  // Touch-specific handlers to prevent scrolling
  const handleTouchStart = (action) => (e) => {
    e.preventDefault()
    startHold(action)
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    stopHold()
  }

  // Helper to set power to a specific value using the actual UI buttons
  // Power must be multiple of 5, 1 second delay between each step for device sync
  // IMPORTANT: Uses handlePowerUp/handlePowerDown - NO direct sendCommand calls!
  // Uses randomGameKnownPowerRef to track power (UI state may not update correctly)
  const setPowerToValue = async (targetPower) => {
    // Ensure target is multiple of 5
    const target = Math.round(targetPower / 5) * 5

    while (randomGameKnownPowerRef.current !== target) {
      if (randomGameKnownPowerRef.current < target) {
        // Press the + button (calls handlePowerUp which sends command)
        await handlePowerUp()
        randomGameKnownPowerRef.current = Math.min(100, randomGameKnownPowerRef.current + 5)
      } else {
        // Press the - button (calls handlePowerDown which sends command)
        await handlePowerDown()
        randomGameKnownPowerRef.current = Math.max(0, randomGameKnownPowerRef.current - 5)
      }
      // Force UI update with our tracked value
      setPower(randomGameKnownPowerRef.current)
      // 1 second delay for device to sync
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Helper to set timer to a specific value using the actual UI buttons
  // Timer must be multiple of 10, 1 second delay between each step for device sync
  // IMPORTANT: Uses handleCountdownUp/handleCountdownDown - NO direct sendCommand calls!
  const setTimerToValue = async (targetSeconds) => {
    // Ensure target is multiple of 10
    const target = Math.round(targetSeconds / 10) * 10
    let currentSeconds = countdownValue

    while (currentSeconds !== target) {
      if (currentSeconds < target) {
        // Press the + button (calls handleCountdownUp which updates UI and sends command)
        await handleCountdownUp()
        currentSeconds = currentSeconds + 10
      } else {
        // Press the - button (calls handleCountdownDown which updates UI and sends command)
        await handleCountdownDown()
        currentSeconds = Math.max(10, currentSeconds - 10)
      }
      // 1 second delay for device to sync
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Execute a random action
  const executeRandomAction = async () => {
    // Use ref to check running state (avoids closure issues with setTimeout)
    if (!isRandomGameRunningRef.current) return

    const availableActions = []

    if (randomGameConfig.enablePetTraining) availableActions.push('petTraining')
    if (randomGameConfig.enablePetFast) availableActions.push('petFast')
    if (randomGameConfig.enablePetFreeze) availableActions.push('petFreeze')
    if (randomGameConfig.enableSleep) availableActions.push('sleep')
    if (randomGameConfig.enableRandom) availableActions.push('random')
    if (randomGameConfig.enableBuzzer) availableActions.push('buzzer')
    if (randomGameConfig.enableTimer) availableActions.push('timer')
    if (randomGameConfig.enableZap) availableActions.push('zap')
    if (randomGameConfig.enableBeep) availableActions.push('beep')
    if (randomGameConfig.enablePower) availableActions.push('power')

    if (availableActions.length === 0) return

    const randomAction = availableActions[Math.floor(Math.random() * availableActions.length)]

    switch (randomAction) {
      case 'petTraining':
        await handleModeToggle('petTraining', '/mode/S2')
        randomGameKnownModeRef.current = 'petTraining'
        setActiveMode('petTraining')
        addNotification('Random: Pet Training activated', 'info')
        break
      case 'petFast':
        await handleModeToggle('petFast', '/mode/S2F')
        randomGameKnownModeRef.current = 'petFast'
        setActiveMode('petFast')
        addNotification('Random: Pet Fast activated', 'info')
        break
      case 'petFreeze':
        await handleModeToggle('petFreeze', '/mode/S2Z')
        randomGameKnownModeRef.current = 'petFreeze'
        setActiveMode('petFreeze')
        addNotification('Random: Pet Freeze activated', 'info')
        break
      case 'sleep':
        await handleModeToggle('sleep', '/mode/S4')
        randomGameKnownModeRef.current = 'sleep'
        setActiveMode('sleep')
        addNotification('Random: Sleep Deprivation activated', 'info')
        break
      case 'random':
        await handleModeToggle('random', '/mode/RN')
        randomGameKnownModeRef.current = 'random'
        setActiveMode('random')
        addNotification('Random: Random mode activated', 'info')
        break
      case 'buzzer': {
        // Toggle buzzer using the button handler
        await handleBuzzerToggle()
        // Update our tracking ref to reflect the new state
        randomGameKnownBuzzerRef.current = !randomGameKnownBuzzerRef.current
        // Force UI update with our tracked value
        setBuzzerEnabled(randomGameKnownBuzzerRef.current)
        addNotification(`Random: Buzzer ${randomGameKnownBuzzerRef.current ? 'ON' : 'OFF'}`, 'info')
        break
      }
      case 'timer': {
        // Random timer must be multiple of 10 (device works in steps of 10 seconds)
        const minSteps = Math.ceil(randomGameConfig.timerMin / 10)
        const maxSteps = Math.floor(randomGameConfig.timerMax / 10)
        const randomTime = (Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps) * 10
        await setTimerToValue(randomTime)
        addNotification(`Random: Timer set to ${formatTime(randomTime)}`, 'info')
        break
      }
      case 'power': {
        // Random power must be multiple of 5 (device works in steps of 5%)
        const maxSteps = Math.floor(randomGameConfig.maxPower / 5)
        const randomPower = Math.floor(Math.random() * (maxSteps + 1)) * 5
        await setPowerToValue(randomPower)
        addNotification(`Random: Power set to ${randomPower}%`, 'info')
        break
      }
      case 'zap': {
        // Only change power if enablePower is checked, otherwise zap at current power
        if (randomGameConfig.enablePower) {
          // Random power must be multiple of 5 (device works in steps of 5%)
          const maxSteps = Math.floor(randomGameConfig.maxPower / 5)
          const randomPower = Math.floor(Math.random() * (maxSteps + 1)) * 5
          await setPowerToValue(randomPower)
          await new Promise(resolve => setTimeout(resolve, 200))
          await handleZapClick()
          addNotification(`Random: Zap at ${randomPower}%`, 'warning')
        } else {
          // Zap at current power level (no power change)
          await handleZapClick()
          addNotification(`Random: Zap at current power`, 'warning')
        }
        break
      }
      case 'beep': {
        // Buzzer must be activated for beep to work
        // Remember previous state to restore after beep
        const wasEnabled = buzzerEnabled
        if (!wasEnabled) {
          // Press the buzzer toggle button to turn it ON
          await handleBuzzerToggle()
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        // Press the beep button
        await handleBeepClick()
        // Restore buzzer to previous state (turn off if it was off before)
        if (!wasEnabled) {
          await new Promise(resolve => setTimeout(resolve, 300))
          // Press the buzzer toggle button to turn it OFF
          await handleBuzzerToggle()
        }
        addNotification('Random: Beep!', 'info')
        break
      }
    }

    // Schedule next random action (use ref to avoid closure issues)
    if (isRandomGameRunningRef.current) {
      const nextDelay = Math.floor(Math.random() * (randomGameConfig.stepDurationMax - randomGameConfig.stepDurationMin + 1)) + randomGameConfig.stepDurationMin
      randomGameStepTimeoutRef.current = setTimeout(executeRandomAction, nextDelay * 1000)
    }
  }

  // End game sequence - uses button handlers to update UI and send commands
  const endRandomGame = async () => {
    // Deactivate active mode using dedicated deactivation function
    // (handleModeToggle has closure issues with stale activeMode state)
    if (randomGameKnownModeRef.current) {
      await handleModeDeactivate()
      randomGameKnownModeRef.current = null
    }

    // Stop timer if running by pressing the timer toggle
    if (isCountdownRunning) {
      await handleToggleCountdown(false)
    }

    // IMPORTANT: Activate buzzer BEFORE beeping (must be ON for beeps to work)
    // Use our tracked ref to know the real buzzer state
    if (!randomGameKnownBuzzerRef.current) {
      await handleBuzzerToggle()
      randomGameKnownBuzzerRef.current = true
      setBuzzerEnabled(true)
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Press the beep button 6 times to signal end
    for (let i = 0; i < 6; i++) {
      await handleBeepClick()
      await new Promise(resolve => setTimeout(resolve, 400))
    }

    // Keep buzzer ON at the end (don't deactivate it)
    addNotification('Random Game ended!', 'success')
  }

  // Start/Stop random game
  const handleRandomGameToggle = async () => {
    if (isRandomGameRunning) {
      // Stop the game - update ref FIRST to stop any pending actions
      isRandomGameRunningRef.current = false
      setIsRandomGameRunning(false)
      setRandomGameTimeRemaining(0)

      if (randomGameIntervalRef.current) {
        clearInterval(randomGameIntervalRef.current)
        randomGameIntervalRef.current = null
      }
      if (randomGameStepTimeoutRef.current) {
        clearTimeout(randomGameStepTimeoutRef.current)
        randomGameStepTimeoutRef.current = null
      }

      await endRandomGame()
    } else {
      // Start the game - update ref FIRST so actions can execute
      isRandomGameRunningRef.current = true
      setIsRandomGameRunning(true)
      setRandomGameTimeRemaining(randomGameConfig.gameDuration)

      // Initialize known values from current state (for tracking during game)
      randomGameKnownPowerRef.current = state.power
      randomGameKnownBuzzerRef.current = buzzerEnabled
      randomGameKnownModeRef.current = activeMode

      addNotification('Random Game started!', 'success')

      // Start the countdown
      randomGameIntervalRef.current = setInterval(() => {
        setRandomGameTimeRemaining(prev => {
          if (prev <= 1) {
            // Game ended - update ref FIRST
            isRandomGameRunningRef.current = false
            setIsRandomGameRunning(false)
            if (randomGameIntervalRef.current) {
              clearInterval(randomGameIntervalRef.current)
              randomGameIntervalRef.current = null
            }
            if (randomGameStepTimeoutRef.current) {
              clearTimeout(randomGameStepTimeoutRef.current)
              randomGameStepTimeoutRef.current = null
            }
            endRandomGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Start first random action
      const firstDelay = Math.floor(Math.random() * (randomGameConfig.stepDurationMax - randomGameConfig.stepDurationMin + 1)) + randomGameConfig.stepDurationMin
      randomGameStepTimeoutRef.current = setTimeout(executeRandomAction, firstDelay * 1000)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (randomGameIntervalRef.current) {
        clearInterval(randomGameIntervalRef.current)
      }
      if (randomGameStepTimeoutRef.current) {
        clearTimeout(randomGameStepTimeoutRef.current)
      }
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current)
      }
    }
  }, [])

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
    tilt: '📐 Tilt',
    randomGame: '🎲 Random Game'
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
              {maxPowerAllowed < 100 && (
                <div className="power-limit-indicator">Max: {maxPowerAllowed}%</div>
              )}
            </div>
            <Tooltip text={tooltips.power?.plus} delay={tooltips.delay}>
              <Button variant="secondary" className="power-btn-side" onClick={handlePowerUp} disabled={state.power >= maxPowerAllowed}>+</Button>
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
    ),
    randomGame: (
      <Card title="Random Game" icon="🎲" className="random-game-card">
        <div className="random-game-content">
          {/* Game timer display when running */}
          {isRandomGameRunning && (
            <div className="random-game-timer">
              <span className="timer-label">Time Remaining:</span>
              <span className="timer-value">{formatTime(randomGameTimeRemaining)}</span>
            </div>
          )}

          {/* Checkboxes in 3 columns */}
          <div className="random-game-checkboxes">
            <Tooltip text={tooltips.randomGame?.enablePetTraining} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enablePetTraining}
                  onChange={(e) => updateRandomGameConfig('enablePetTraining', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Pet Training</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enablePetFast} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enablePetFast}
                  onChange={(e) => updateRandomGameConfig('enablePetFast', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Pet Fast</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enablePetFreeze} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enablePetFreeze}
                  onChange={(e) => updateRandomGameConfig('enablePetFreeze', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Pet Freeze</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableSleep} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableSleep}
                  onChange={(e) => updateRandomGameConfig('enableSleep', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Sleep Depriv.</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableRandom} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableRandom}
                  onChange={(e) => updateRandomGameConfig('enableRandom', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Random</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableBuzzer} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableBuzzer}
                  onChange={(e) => updateRandomGameConfig('enableBuzzer', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Buzzer</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableTimer} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableTimer}
                  onChange={(e) => updateRandomGameConfig('enableTimer', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Timer</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableZap} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableZap}
                  onChange={(e) => updateRandomGameConfig('enableZap', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Zap</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enableBeep} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enableBeep}
                  onChange={(e) => updateRandomGameConfig('enableBeep', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Beep</span>
              </label>
            </Tooltip>
            <Tooltip text={tooltips.randomGame?.enablePower} delay={tooltips.delay}>
              <label className="rg-checkbox">
                <input
                  type="checkbox"
                  checked={randomGameConfig.enablePower}
                  onChange={(e) => updateRandomGameConfig('enablePower', e.target.checked)}
                  disabled={isRandomGameRunning}
                />
                <span>Power</span>
              </label>
            </Tooltip>
          </div>

          {/* Settings with +/- buttons - 2 column layout with hold-to-repeat */}
          <div className="random-game-settings">
            {/* Timer row: min | max */}
            <div className="rg-settings-group">
              <div className="rg-group-label">Timer</div>
              <div className="rg-two-columns">
                <Tooltip text={tooltips.randomGame?.timerMin} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Min</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateTimerMin(-10))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateTimerMin(-10))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{formatTime(randomGameConfig.timerMin)}</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateTimerMin(10))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateTimerMin(10))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
                <Tooltip text={tooltips.randomGame?.timerMax} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Max</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateTimerMax(-10))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateTimerMax(-10))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{formatTime(randomGameConfig.timerMax)}</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateTimerMax(10))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateTimerMax(10))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Step row: min | max */}
            <div className="rg-settings-group">
              <div className="rg-group-label">Step</div>
              <div className="rg-two-columns">
                <Tooltip text={tooltips.randomGame?.stepMin} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Min</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateStepMin(-5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateStepMin(-5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{formatTime(randomGameConfig.stepDurationMin)}</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateStepMin(5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateStepMin(5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
                <Tooltip text={tooltips.randomGame?.stepMax} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Max</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateStepMax(-5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateStepMax(-5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{formatTime(randomGameConfig.stepDurationMax)}</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateStepMax(5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateStepMax(5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Settings row: Duration | Max Power */}
            <div className="rg-settings-group">
              <div className="rg-group-label">Settings</div>
              <div className="rg-two-columns">
                <Tooltip text={tooltips.randomGame?.duration} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Duration</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateGameDuration(-60))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateGameDuration(-60))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{formatTime(randomGameConfig.gameDuration)}</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateGameDuration(60))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateGameDuration(60))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
                <Tooltip text={tooltips.randomGame?.maxPower} delay={tooltips.delay}>
                  <div className="rg-setting-compact">
                    <span className="rg-label-small">Max Power</span>
                    <div className="rg-plusminus-compact">
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateMaxPower(-5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateMaxPower(-5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>−</button>
                      <span className="rg-value-sm">{randomGameConfig.maxPower}%</span>
                      <button className="rg-btn-sm" onMouseDown={() => startHold(() => updateMaxPower(5))} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={handleTouchStart(() => updateMaxPower(5))} onTouchEnd={handleTouchEnd} disabled={isRandomGameRunning}>+</button>
                    </div>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Start/Stop button */}
          <Tooltip text={tooltips.randomGame?.start} delay={tooltips.delay}>
            <button
              className={`random-game-btn ${isRandomGameRunning ? 'stop' : 'start'}`}
              onClick={handleRandomGameToggle}
            >
              {isRandomGameRunning ? '⏹ STOP' : '▶ START'}
            </button>
          </Tooltip>
        </div>
      </Card>
    )
  }

  return (
    <div className={`local-mode-container theme-${currentTheme}`}>
      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="dropdown-menu">
          {/* Admin and Logout buttons */}
          <div className="dropdown-section dropdown-actions">
            {isAdmin && (
              <button className="dropdown-action-btn admin-btn" onClick={handleAdminClick}>
                Admin.
              </button>
            )}
            <button className="dropdown-action-btn logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>

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
          {filteredVisibleTiles.map((tileId) => (
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
