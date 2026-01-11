import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

const AppContext = createContext()

// API base URL - uses relative path since frontend is served by same server
const API_BASE = '/api'

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

const DEFAULT_LOCAL_IP = '192.168.4.1'

const initialState = {
  // Main Control Switches
  wifiFence: false,
  fastPet: false,
  freeze: false,
  posture: false,
  recharge: false,

  // Device Configuration
  power: 5,
  timerEnabled: false,
  timerValue: 30,
  pauseDelay: false,
  petSwitch: false,
  randomSwitch: false,
  sleepSwitch: false,
  buzzerSwitch: true,
  lockTimer: false,

  // Fast Pet and Freeze Levels
  fastPetLevel: 50,
  freezeLevel: 50,

  // Clock Settings
  showAnalogClock: true,
  showDigitalClock: true,
  timeDiffMin: 0,

  // Network Configuration
  connectionMode: 'local', // 'local' or 'internet'
  localIP: DEFAULT_LOCAL_IP,
  internetUrl: '',
  isConnected: false,
  lastResponse: null,
  connectionError: null,

  // Device Setup
  deviceSSID: 'V-CAGE',
  devicePassword: '12345678',
  deviceKey: '',
  deviceSerial: '',
  tiltValue: 50,

  // UI State
  notifications: [],
  soundEnabled: true,
  debugMode: false
}

function appReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SWITCH':
      return { ...state, [action.payload]: !state[action.payload] }
    case 'SET_VALUE':
      return { ...state, [action.payload.key]: action.payload.value }
    case 'SET_POWER':
      return { ...state, power: Math.min(100, Math.max(0, action.payload)) }
    case 'SET_TIMER':
      return { ...state, timerValue: action.payload }
    case 'SET_CONNECTION_MODE':
      return { ...state, connectionMode: action.payload }
    case 'SET_NETWORK_CONFIG':
      return { ...state, ...action.payload }
    case 'SET_CONNECTION':
      return {
        ...state,
        isConnected: action.payload,
        connectionError: action.payload ? null : state.connectionError
      }
    case 'SET_CONNECTION_ERROR':
      return { ...state, connectionError: action.payload, isConnected: false }
    case 'SET_RESPONSE':
      return { ...state, lastResponse: action.payload, isConnected: true }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications.slice(-4), action.payload]
      }
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      }
    case 'LOAD_STATE':
      return { ...state, ...action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('fancySteelAppState')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        dispatch({ type: 'LOAD_STATE', payload: parsed })
      } catch (e) {
        console.error('Failed to load saved state:', e)
      }
    }

    // Also load device config from backend
    loadDeviceConfig()
  }, [])

  // Save state to localStorage on changes
  useEffect(() => {
    const stateToSave = { ...state, notifications: [], lastResponse: null, connectionError: null }
    localStorage.setItem('fancySteelAppState', JSON.stringify(stateToSave))
  }, [state])

  // Load device configuration from backend
  const loadDeviceConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/device/config`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.success && data.config) {
        dispatch({
          type: 'SET_NETWORK_CONFIG',
          payload: {
            localIP: data.config.deviceIP,
            connectionMode: data.config.connectionMode,
            internetUrl: data.config.internetUrl,
            deviceSSID: data.config.deviceSSID,
            devicePassword: data.config.devicePassword,
            deviceKey: data.config.deviceKey,
            deviceSerial: data.config.deviceSerial
          }
        })
      }
    } catch (error) {
      console.error('Failed to load device config:', error)
    }
  }

  const toggleSwitch = (key) => {
    dispatch({ type: 'TOGGLE_SWITCH', payload: key })
  }

  const setValue = (key, value) => {
    dispatch({ type: 'SET_VALUE', payload: { key, value } })
  }

  const setPower = (value) => {
    dispatch({ type: 'SET_POWER', payload: value })
  }

  const setTimer = (value) => {
    dispatch({ type: 'SET_TIMER', payload: value })
  }

  const setConnectionMode = (mode) => {
    dispatch({ type: 'SET_CONNECTION_MODE', payload: mode })
  }

  const setNetworkConfig = async (config) => {
    dispatch({ type: 'SET_NETWORK_CONFIG', payload: config })

    // Also save to backend
    try {
      await fetch(`${API_BASE}/device/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          deviceIP: config.localIP || config.deviceIP,
          connectionMode: config.connectionMode,
          internetUrl: config.internetUrl,
          deviceSSID: config.deviceSSID,
          devicePassword: config.devicePassword,
          deviceKey: config.deviceKey,
          deviceSerial: config.deviceSerial
        })
      })
    } catch (error) {
      console.error('Failed to save device config:', error)
    }
  }

  const setConnection = (connected) => {
    dispatch({ type: 'SET_CONNECTION', payload: connected })
  }

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    dispatch({ type: 'ADD_NOTIFICATION', payload: { id, message, type } })
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
    }, 3000)
  }, [])

  const removeNotification = (id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
  }

  // Check connection to device via backend proxy
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/device/check`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) return false
      const data = await response.json()

      dispatch({ type: 'SET_CONNECTION', payload: data.connected })

      if (data.connected) {
        dispatch({
          type: 'SET_RESPONSE',
          payload: { raw: data.data, timestamp: new Date().toISOString() }
        })
      }

      return data.connected
    } catch (error) {
      console.error('Connection check failed:', error)
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: error.message })
      return false
    }
  }, [])

  // Send command to device via backend proxy
  // If command starts with '/', it's a direct device path (e.g., '/PW/+', '/Z1/1')
  // Otherwise, it's treated as a query parameter
  const sendCommand = useCallback(async (command, params = {}) => {
    try {
      let response

      if (command.startsWith('/')) {
        // Direct device path - use the proxy endpoint
        const devicePath = command.substring(1) // Remove leading /
        response = await fetch(`${API_BASE}/device/proxy/${devicePath}`, {
          headers: getAuthHeaders()
        })
      } else {
        // Query parameter style (legacy)
        const queryParams = new URLSearchParams({
          ...params,
          cmd: command,
          power: state.power
        })
        response = await fetch(`${API_BASE}/device/tx?${queryParams.toString()}`, {
          headers: getAuthHeaders()
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { success: false, error: errorData.error || 'Request failed' }
      }

      const data = await response.json()

      if (data.success) {
        dispatch({
          type: 'SET_RESPONSE',
          payload: { raw: data.data, timestamp: new Date().toISOString() }
        })
        return { success: true, data: data.data }
      } else {
        console.error('Command failed:', data.error)
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Command request failed:', error)
      return { success: false, error: error.message }
    }
  }, [state.power])

  // Send command via POST (for more complex commands)
  const sendCommandPost = useCallback(async (params = {}) => {
    try {
      const response = await fetch(`${API_BASE}/device/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...params,
          power: state.power
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { success: false, error: errorData.error || 'Request failed' }
      }

      const data = await response.json()

      if (data.success) {
        dispatch({
          type: 'SET_RESPONSE',
          payload: { raw: data.data, timestamp: new Date().toISOString() }
        })
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Command request failed:', error)
      return { success: false, error: error.message }
    }
  }, [state.power])

  // Verify connection (with notification)
  const verifyConnection = useCallback(async () => {
    addNotification('Checking connection...', 'info')
    const connected = await checkConnection()
    if (connected) {
      addNotification('Device connected', 'success')
    } else {
      addNotification('Device not reachable', 'error')
    }
    return connected
  }, [checkConnection, addNotification])

  // Save device setup config
  const saveDeviceSetup = async (config) => {
    try {
      const response = await fetch(`${API_BASE}/device/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { success: false, error: errorData.error || 'Request failed' }
      }

      const data = await response.json()

      if (data.success) {
        dispatch({
          type: 'SET_NETWORK_CONFIG',
          payload: {
            localIP: data.config.deviceIP,
            connectionMode: data.config.connectionMode,
            internetUrl: data.config.internetUrl,
            deviceSSID: data.config.deviceSSID,
            devicePassword: data.config.devicePassword,
            deviceKey: data.config.deviceKey,
            deviceSerial: data.config.deviceSerial
          }
        })
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      console.error('Failed to save device setup:', error)
      return { success: false, error: error.message }
    }
  }

  const value = {
    state,
    toggleSwitch,
    setValue,
    setPower,
    setTimer,
    setConnectionMode,
    setNetworkConfig,
    setConnection,
    addNotification,
    removeNotification,
    sendCommand,
    sendCommandPost,
    checkConnection,
    verifyConnection,
    saveDeviceSetup,
    loadDeviceConfig
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export { DEFAULT_LOCAL_IP }
