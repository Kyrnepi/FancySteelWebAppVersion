import { useState, useEffect } from 'react'
import { useApp, DEFAULT_LOCAL_IP } from '../context/AppContext'
import Card from '../components/Card'
import Button from '../components/Button'
import Slider from '../components/Slider'

function DeviceSetup() {
  const {
    state,
    setValue,
    addNotification,
    sendCommand,
    setNetworkConfig,
    saveDeviceSetup,
    checkConnection
  } = useApp()

  const [deviceIP, setDeviceIP] = useState(state.localIP || DEFAULT_LOCAL_IP)

  // WiFi Configuration
  const [ssid, setSsid] = useState(state.deviceSSID || 'V-CAGE')
  const [password, setPassword] = useState(state.devicePassword || '12345678')
  const [deviceKey, setDeviceKey] = useState(state.deviceKey || '')
  const [deviceSerial, setDeviceSerial] = useState(state.deviceSerial || '')

  // Tilt Configuration
  const [tiltValue, setTiltValue] = useState(state.tiltValue || 50)
  const [tiltDisplay, setTiltDisplay] = useState('--')

  // Status
  const [isChecking, setIsChecking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastResponse, setLastResponse] = useState('')

  // Sync with state
  useEffect(() => {
    setSsid(state.deviceSSID || 'V-CAGE')
    setPassword(state.devicePassword || '12345678')
    setDeviceKey(state.deviceKey || '')
    setDeviceSerial(state.deviceSerial || '')
    setTiltValue(state.tiltValue || 50)
    setDeviceIP(state.localIP || DEFAULT_LOCAL_IP)
  }, [state.deviceSSID, state.devicePassword, state.deviceKey, state.deviceSerial, state.tiltValue, state.localIP])

  // Check device configuration
  const handleCheckConfig = async () => {
    setIsChecking(true)
    try {
      const response = await sendCommand('/DIS/BOW')  // Check device connection/config
      if (response && response.data) {
        setLastResponse(response.data)
        // Parse response to extract device info
        try {
          const parts = response.data.split(',')
          if (parts.length >= 4) {
            setSsid(parts[0] || ssid)
            setPassword(parts[1] || password)
            setDeviceKey(parts[2] || deviceKey)
            setDeviceSerial(parts[3] || deviceSerial)
          }
        } catch (e) {
          console.log('Could not parse response:', e)
        }
        addNotification('Configuration loaded', 'success')
      } else {
        addNotification('Could not load configuration', 'error')
      }
    } catch (error) {
      addNotification('Check failed: ' + error.message, 'error')
    } finally {
      setIsChecking(false)
    }
  }

  // Save device configuration (to backend)
  const handleSaveConfig = async () => {
    setIsSaving(true)
    try {
      // Save to backend (which stores it in /config)
      const result = await saveDeviceSetup({
        deviceIP: deviceIP,
        deviceSSID: ssid,
        devicePassword: password,
        deviceKey: deviceKey,
        deviceSerial: deviceSerial
      })

      if (result.success) {
        addNotification('Configuration saved', 'success')
        // Test connection with new IP
        checkConnection()
      } else {
        addNotification('Failed to save configuration', 'error')
      }
    } catch (error) {
      addNotification('Save failed: ' + error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Check tilt sensor
  const handleCheckTilt = async () => {
    try {
      const response = await sendCommand('/DIS/TILT')  // Get tilt sensor value
      if (response && response.data) {
        setTiltDisplay(response.data)
        addNotification('Tilt value loaded', 'success')
      } else {
        addNotification('Could not read tilt sensor', 'error')
      }
    } catch (error) {
      addNotification('Tilt check failed', 'error')
    }
  }

  // Save tilt configuration
  const handleSaveTilt = async () => {
    try {
      setValue('tiltValue', tiltValue)
      // Tilt is saved locally, device doesn't have a save tilt endpoint
      addNotification('Tilt configuration saved locally', 'info')
    } catch (error) {
      addNotification('Tilt save failed', 'error')
    }
  }

  return (
    <div className="page device-setup">
      <div className="page-header">
        <h1 className="page-title">DEVICE SETUP</h1>
        <p className="page-subtitle">Configure WiFi and device settings</p>
      </div>

      <div className="grid-layout setup-grid">
        {/* WiFi Configuration */}
        <Card title="WiFi Access Point" icon="📶" className="wifi-config-card">
          <div className="form-group">
            <label className="form-label">SSID (Network Name)</label>
            <input
              type="text"
              className="form-input"
              placeholder="V-CAGE"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
            />
            <span className="form-hint">Default: V-CAGE</span>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="12345678"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="form-hint">Default: 12345678</span>
          </div>

          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={handleCheckConfig}
              loading={isChecking}
            >
              Check
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveConfig}
              loading={isSaving}
            >
              Save
            </Button>
          </div>
        </Card>

        {/* Device Information */}
        <Card title="Device Information" icon="🔑" className="device-info-card">
          <div className="form-group">
            <label className="form-label">Device Key</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter device key"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Device Serial</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter device serial"
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
            />
          </div>
        </Card>

        {/* Tilt Configuration */}
        <Card title="Tilt Sensor" icon="📐" className="tilt-config-card">
          <div className="tilt-display">
            <div className="tilt-value-display">
              <span className="tilt-label">Current Tilt:</span>
              <span className="tilt-reading">{tiltDisplay}</span>
            </div>
          </div>

          <Slider
            label="Tilt Sensitivity"
            value={tiltValue}
            onChange={setTiltValue}
            min={0}
            max={100}
            step={5}
            unit="%"
          />

          <div className="form-actions">
            <Button variant="secondary" onClick={handleCheckTilt}>
              Check Tilt
            </Button>
            <Button variant="primary" onClick={handleSaveTilt}>
              Save Tilt
            </Button>
          </div>
        </Card>

        {/* Local IP Configuration */}
        <Card title="Server Connection" icon="🖥️" className="local-ip-card">
          <div className="form-group">
            <label className="form-label">Device IP Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="192.168.4.1"
              value={deviceIP}
              onChange={(e) => setDeviceIP(e.target.value)}
            />
            <span className="form-hint">IP accessible from this server (default: {DEFAULT_LOCAL_IP})</span>
          </div>

          <div className="connection-status-box">
            <div className={`status-indicator ${state.isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              <span>{state.isConnected ? 'Device Connected' : 'Device Not Connected'}</span>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              saveDeviceSetup({ deviceIP }).then(() => checkConnection())
            }}
            className="full-width"
          >
            Save IP & Test Connection
          </Button>
        </Card>

        {/* Response Display */}
        <Card title="Device Response" icon="📨" className="response-card">
          <div className="response-display">
            {lastResponse ? (
              <pre className="response-content">{lastResponse}</pre>
            ) : (
              <p className="no-response">No response data. Click "Check" to load device configuration.</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setLastResponse('')}
          >
            Clear
          </Button>
        </Card>

        {/* Instructions */}
        <Card title="Setup Instructions" icon="📖" className="instructions-card">
          <div className="instructions-content">
            <h4>Architecture:</h4>
            <p>The <strong>server</strong> connects to the device at <strong>{deviceIP}</strong>. Your browser connects to the server, which proxies commands to the device.</p>

            <h4>Server Setup:</h4>
            <ol>
              <li>Ensure this server is on the same network as the device</li>
              <li>The device creates a WiFi network: <strong>{ssid}</strong></li>
              <li>Connect the server to this network (password: <strong>{password}</strong>)</li>
              <li>The device is at <strong>http://{deviceIP}</strong></li>
              <li>Click "Save IP & Test Connection" to verify</li>
            </ol>

            <h4>Client Access:</h4>
            <ol>
              <li>Access this web app from any device on any network</li>
              <li>Commands are sent to the server, which forwards them to the device</li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default DeviceSetup
