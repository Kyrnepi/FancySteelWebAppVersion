const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 5000;
const CONFIG_PATH = process.env.CONFIG_PATH || '/config';
const CONFIG_FILE = path.join(CONFIG_PATH, 'settings.json');
const STATE_FILE = path.join(CONFIG_PATH, 'state.json');

// Default device IP (the device on the local network)
const DEFAULT_DEVICE_IP = '192.168.4.1';
const DEVICE_TIMEOUT = 5000; // 5 seconds timeout for device requests

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Default device state
const defaultDeviceState = {
  wifiFence: false,
  fastPet: false,
  freeze: false,
  posture: false,
  recharge: false,
  power: 50,
  timerEnabled: false,
  timerValue: 30,
  isConnected: true,
  lastCommand: null,
  lastCommandTime: null
};

// Default configuration
const defaultConfig = {
  // Device connection settings
  deviceIP: DEFAULT_DEVICE_IP,
  connectionMode: 'local', // 'local' or 'internet'
  internetUrl: '',

  // Device WiFi settings
  deviceSSID: 'V-CAGE',
  devicePassword: '12345678',
  deviceKey: '',
  deviceSerial: '',

  // App settings
  autoConnect: false,
  keepAlive: true,
  debugMode: false,
  soundEnabled: true,
  showAnalogClock: true,
  showDigitalClock: true
};

// Helper function to make HTTP request to the device
function makeDeviceRequest(deviceIP, path, timeout = DEVICE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const url = `http://${deviceIP}${path}`;
    console.log(`[Device Request] ${url}`);

    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[Device Response] Status: ${res.statusCode}, Data: ${data.substring(0, 100)}`);
        resolve({
          success: true,
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.on('error', (err) => {
      console.error(`[Device Error] ${err.message}`);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Device request timeout'));
    });
  });
}

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(CONFIG_PATH, { recursive: true });
    console.log(`Created config directory: ${CONFIG_PATH}`);
  }
}

// Load configuration from file
function loadConfig() {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading config:', error.message);
  }
  return { ...defaultConfig };
}

// Save configuration to file
function saveConfig(config) {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('Configuration saved to:', CONFIG_FILE);
    return true;
  } catch (error) {
    console.error('Error saving config:', error.message);
    return false;
  }
}

// Load device state from file
function loadState() {
  try {
    ensureConfigDir();
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return { ...defaultDeviceState, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading state:', error.message);
  }
  return { ...defaultDeviceState };
}

// Save device state to file
function saveState(state) {
  try {
    ensureConfigDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving state:', error.message);
    return false;
  }
}

// Initialize state and config from persistent storage
let deviceState = loadState();
let appConfig = loadConfig();

console.log('Loaded configuration from:', CONFIG_FILE);
console.log('Loaded state from:', STATE_FILE);

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    configPath: CONFIG_PATH
  });
});

// Get device state
app.get('/api/state', (req, res) => {
  res.json({
    success: true,
    data: deviceState
  });
});

// Update device state
app.post('/api/state', (req, res) => {
  const updates = req.body;
  deviceState = { ...deviceState, ...updates };
  saveState(deviceState);

  res.json({
    success: true,
    data: deviceState
  });
});

// Get configuration
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: appConfig
  });
});

// Update configuration
app.post('/api/config', (req, res) => {
  const updates = req.body;
  appConfig = { ...appConfig, ...updates };
  const saved = saveConfig(appConfig);

  res.json({
    success: saved,
    data: appConfig,
    message: saved ? 'Configuration saved' : 'Failed to save configuration'
  });
});

// Tiles configuration file
const TILES_CONFIG_FILE = path.join(CONFIG_PATH, 'tiles.json');
const TOOLTIPS_CONFIG_FILE = path.join(CONFIG_PATH, 'tooltips.json');

// Default tooltips configuration
const defaultTooltips = {
  // Delay in milliseconds before tooltip appears (default 3 seconds)
  delay: 3000,
  power: {
    minus: "Decrease power by 5% (can resync with device)",
    plus: "Increase power by 5% (can resync with device)",
    beep: "Short beep signal",
    zap: "Send zap signal (hold for long zap)"
  },
  lock: {
    button: "Toggle lock state. Right-click to force unlock"
  },
  modes: {
    timer_minus: "Decrease timer by 10 seconds",
    timer_plus: "Increase timer by 10 seconds",
    timer_toggle: "Start/stop timer loop",
    petTraining: "Pet Training mode",
    petFast: "Fast Pet Training mode",
    petFreeze: "Freeze Pet Training mode",
    sleep: "Sleep Deprivation mode",
    random: "Random mode",
    buzzer: "Toggle buzzer sound"
  },
  release: {
    minus: "Decrease release time",
    plus: "Increase release time",
    button: "Hold to release"
  },
  tilt: {
    check: "Check current tilt value from device",
    set: "Set new tilt value"
  },
  randomGame: {
    start: "Start the random game with selected options",
    stop: "Stop the current random game"
  }
};

// Get tiles order
app.get('/api/config/tiles', (req, res) => {
  try {
    if (fs.existsSync(TILES_CONFIG_FILE)) {
      const data = fs.readFileSync(TILES_CONFIG_FILE, 'utf8');
      const tilesConfig = JSON.parse(data);
      res.json(tilesConfig);
    } else {
      res.json({ order: null, theme: 'default' });
    }
  } catch (error) {
    console.error('Failed to read tiles config:', error);
    res.json({ order: null, theme: 'default' });
  }
});

// Save tiles order and theme
app.post('/api/config/tiles', (req, res) => {
  try {
    const { order, theme } = req.body;

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(CONFIG_PATH, { recursive: true });
    }

    fs.writeFileSync(TILES_CONFIG_FILE, JSON.stringify({ order, theme }, null, 2));
    res.json({ success: true, message: 'Tiles config saved' });
  } catch (error) {
    console.error('Failed to save tiles config:', error);
    res.status(500).json({ success: false, error: 'Failed to save tiles config' });
  }
});

// Get tooltips configuration
app.get('/api/config/tooltips', (req, res) => {
  try {
    if (fs.existsSync(TOOLTIPS_CONFIG_FILE)) {
      const data = fs.readFileSync(TOOLTIPS_CONFIG_FILE, 'utf8');
      const tooltipsConfig = JSON.parse(data);
      res.json(tooltipsConfig);
    } else {
      // Create default tooltips file
      fs.writeFileSync(TOOLTIPS_CONFIG_FILE, JSON.stringify(defaultTooltips, null, 2));
      res.json(defaultTooltips);
    }
  } catch (error) {
    console.error('Failed to read tooltips config:', error);
    res.json(defaultTooltips);
  }
});

// Save tooltips configuration
app.post('/api/config/tooltips', (req, res) => {
  try {
    const tooltips = req.body;

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(CONFIG_PATH, { recursive: true });
    }

    fs.writeFileSync(TOOLTIPS_CONFIG_FILE, JSON.stringify(tooltips, null, 2));
    res.json({ success: true, message: 'Tooltips config saved' });
  } catch (error) {
    console.error('Failed to save tooltips config:', error);
    res.status(500).json({ success: false, error: 'Failed to save tooltips config' });
  }
});

// Random Game configuration
const RANDOMGAME_CONFIG_FILE = path.join(CONFIG_PATH, 'randomgame.json');

const defaultRandomGameConfig = {
  enablePetTraining: true,
  enablePetFast: true,
  enablePetFreeze: true,
  enableSleep: true,
  enableRandom: true,
  enableBuzzer: false,
  enableTimer: true,
  enableZap: true,
  enableBeep: true,
  maxPower: 50,
  timerMin: 30,
  timerMax: 120,
  gameDuration: 300,
  stepDurationMin: 10,
  stepDurationMax: 60
};

// Get random game configuration
app.get('/api/config/randomgame', (req, res) => {
  try {
    if (fs.existsSync(RANDOMGAME_CONFIG_FILE)) {
      const data = fs.readFileSync(RANDOMGAME_CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      res.json(config);
    } else {
      // Create default config file
      fs.writeFileSync(RANDOMGAME_CONFIG_FILE, JSON.stringify(defaultRandomGameConfig, null, 2));
      res.json(defaultRandomGameConfig);
    }
  } catch (error) {
    console.error('Failed to read random game config:', error);
    res.json(defaultRandomGameConfig);
  }
});

// Save random game configuration
app.post('/api/config/randomgame', (req, res) => {
  try {
    const config = req.body;

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(CONFIG_PATH, { recursive: true });
    }

    fs.writeFileSync(RANDOMGAME_CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ success: true, message: 'Random game config saved' });
  } catch (error) {
    console.error('Failed to save random game config:', error);
    res.status(500).json({ success: false, error: 'Failed to save random game config' });
  }
});

// Send command
app.post('/api/command', (req, res) => {
  const { type, action, power, ...params } = req.body;

  console.log(`Command received: ${type}/${action}`, params);

  // Simulate command processing
  deviceState.lastCommand = { type, action, ...params };
  deviceState.lastCommandTime = new Date().toISOString();

  // Update state based on command
  if (type === 'quick_action') {
    switch (action) {
      case 'start':
        deviceState.isRunning = true;
        break;
      case 'stop':
        deviceState.isRunning = false;
        break;
      case 'pause':
        deviceState.isPaused = true;
        break;
      case 'reset':
        deviceState.power = 50;
        deviceState.isRunning = false;
        deviceState.isPaused = false;
        break;
    }
  } else if (type === 'zap') {
    deviceState.lastZap = {
      power: power || deviceState.power,
      timestamp: new Date().toISOString()
    };
  }

  saveState(deviceState);

  res.json({
    success: true,
    command: { type, action },
    state: deviceState,
    message: `Command ${type}/${action} executed successfully`
  });
});

// Toggle switch
app.post('/api/toggle/:switch', (req, res) => {
  const switchName = req.params.switch;

  if (switchName in deviceState) {
    deviceState[switchName] = !deviceState[switchName];
    saveState(deviceState);
    res.json({
      success: true,
      switch: switchName,
      value: deviceState[switchName]
    });
  } else {
    res.status(400).json({
      success: false,
      error: `Unknown switch: ${switchName}`
    });
  }
});

// Set power level
app.post('/api/power', (req, res) => {
  const { level } = req.body;

  if (typeof level === 'number' && level >= 0 && level <= 100) {
    deviceState.power = level;
    saveState(deviceState);
    res.json({
      success: true,
      power: deviceState.power
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Invalid power level. Must be between 0 and 100.'
    });
  }
});

// Set timer
app.post('/api/timer', (req, res) => {
  const { value, enabled } = req.body;

  if (typeof value === 'number') {
    deviceState.timerValue = Math.max(1, Math.min(120, value));
  }
  if (typeof enabled === 'boolean') {
    deviceState.timerEnabled = enabled;
  }

  saveState(deviceState);

  res.json({
    success: true,
    timer: {
      value: deviceState.timerValue,
      enabled: deviceState.timerEnabled
    }
  });
});

// Authentication (simulated)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Simple validation (in production, use proper authentication)
  if (username && password) {
    appConfig.username = username;
    saveConfig(appConfig);
    res.json({
      success: true,
      token: 'simulated-jwt-token',
      user: { username }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Reset to defaults
app.post('/api/reset', (req, res) => {
  const { type } = req.body;

  if (type === 'state' || type === 'all') {
    deviceState = { ...defaultDeviceState };
    saveState(deviceState);
  }
  if (type === 'config' || type === 'all') {
    appConfig = { ...defaultConfig };
    saveConfig(appConfig);
  }

  res.json({
    success: true,
    message: `Reset ${type} to defaults`,
    state: type === 'state' || type === 'all' ? deviceState : undefined,
    config: type === 'config' || type === 'all' ? appConfig : undefined
  });
});

// =====================================================
// DEVICE PROXY ENDPOINTS
// These endpoints proxy requests to the actual device
// =====================================================

// Check device connection
app.get('/api/device/check', async (req, res) => {
  const deviceIP = appConfig.deviceIP || DEFAULT_DEVICE_IP;

  try {
    const response = await makeDeviceRequest(deviceIP, '/', 3000);
    deviceState.isConnected = true;
    saveState(deviceState);

    res.json({
      success: true,
      connected: true,
      deviceIP: deviceIP,
      data: response.data
    });
  } catch (error) {
    deviceState.isConnected = false;
    saveState(deviceState);

    res.json({
      success: false,
      connected: false,
      deviceIP: deviceIP,
      error: error.message
    });
  }
});

// Send command to device (GET request to /TX?...)
app.get('/api/device/tx', async (req, res) => {
  const deviceIP = appConfig.deviceIP || DEFAULT_DEVICE_IP;

  // Build query string from request query parameters
  const queryString = new URLSearchParams(req.query).toString();
  const path = queryString ? `/TX?${queryString}` : '/TX';

  try {
    const response = await makeDeviceRequest(deviceIP, path);
    deviceState.isConnected = true;
    deviceState.lastCommand = { path, timestamp: new Date().toISOString() };
    saveState(deviceState);

    res.json({
      success: true,
      data: response.data,
      statusCode: response.statusCode
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Send command to device (POST - converts body to query params)
app.post('/api/device/tx', async (req, res) => {
  const deviceIP = appConfig.deviceIP || DEFAULT_DEVICE_IP;
  const params = req.body;

  // Build query string from body
  const queryString = new URLSearchParams(params).toString();
  const path = queryString ? `/TX?${queryString}` : '/TX';

  try {
    const response = await makeDeviceRequest(deviceIP, path);
    deviceState.isConnected = true;
    deviceState.lastCommand = { params, timestamp: new Date().toISOString() };
    saveState(deviceState);

    res.json({
      success: true,
      data: response.data,
      statusCode: response.statusCode
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Generic device proxy - forwards any path to the device
app.all('/api/device/proxy/*', async (req, res) => {
  const deviceIP = appConfig.deviceIP || DEFAULT_DEVICE_IP;

  // Get the path after /api/device/proxy/
  let devicePath = req.params[0] || '';
  if (!devicePath.startsWith('/')) {
    devicePath = '/' + devicePath;
  }

  // Add query string if present
  const queryString = new URLSearchParams(req.query).toString();
  if (queryString) {
    devicePath += '?' + queryString;
  }

  try {
    const response = await makeDeviceRequest(deviceIP, devicePath);
    deviceState.isConnected = true;
    saveState(deviceState);

    res.json({
      success: true,
      data: response.data,
      statusCode: response.statusCode,
      path: devicePath
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      path: devicePath
    });
  }
});

// Update device IP configuration
app.post('/api/device/config', (req, res) => {
  const { deviceIP, connectionMode, internetUrl, deviceSSID, devicePassword, deviceKey, deviceSerial } = req.body;

  if (deviceIP) appConfig.deviceIP = deviceIP;
  if (connectionMode) appConfig.connectionMode = connectionMode;
  if (internetUrl !== undefined) appConfig.internetUrl = internetUrl;
  if (deviceSSID) appConfig.deviceSSID = deviceSSID;
  if (devicePassword) appConfig.devicePassword = devicePassword;
  if (deviceKey !== undefined) appConfig.deviceKey = deviceKey;
  if (deviceSerial !== undefined) appConfig.deviceSerial = deviceSerial;

  saveConfig(appConfig);

  res.json({
    success: true,
    config: {
      deviceIP: appConfig.deviceIP,
      connectionMode: appConfig.connectionMode,
      internetUrl: appConfig.internetUrl,
      deviceSSID: appConfig.deviceSSID,
      devicePassword: appConfig.devicePassword,
      deviceKey: appConfig.deviceKey,
      deviceSerial: appConfig.deviceSerial
    }
  });
});

// Get device configuration
app.get('/api/device/config', (req, res) => {
  res.json({
    success: true,
    config: {
      deviceIP: appConfig.deviceIP || DEFAULT_DEVICE_IP,
      connectionMode: appConfig.connectionMode || 'local',
      internetUrl: appConfig.internetUrl || '',
      deviceSSID: appConfig.deviceSSID || 'V-CAGE',
      devicePassword: appConfig.devicePassword || '12345678',
      deviceKey: appConfig.deviceKey || '',
      deviceSerial: appConfig.deviceSerial || ''
    }
  });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         Fancy Steel Web App Mode - Backend Server          ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   Server running on:  http://0.0.0.0:${PORT}                 ║
║   Environment:        ${process.env.NODE_ENV || 'development'}                    ║
║   Config path:        ${CONFIG_PATH}
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
