const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Configuration paths
const CONFIG_PATH = process.env.CONFIG_PATH || '/config';
const USERS_FILE = path.join(CONFIG_PATH, 'users.json');
const AUTH_CONFIG_FILE = path.join(CONFIG_PATH, 'auth-config.json');

// Environment variables for admin
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Generate a random JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Default auth configuration
const defaultAuthConfig = {
  sessionDuration: 24, // hours
  maxLoginAttempts: 5,
  lockoutDuration: 15, // minutes
};

// Default permissions structure
const defaultPermissions = {
  power_control: { enabled: true, maxPower: 100 },
  lock_control: { enabled: true },
  modes_timer: { enabled: true, allowedModes: ['petTraining', 'petFast', 'petFreeze', 'sleep', 'random'] },
  release_control: { enabled: true },
  tilt_control: { enabled: true },
  random_game: { enabled: true, maxPower: 100 },
  device_settings: { enabled: true }
};

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(CONFIG_PATH, { recursive: true });
  }
}

// Load auth configuration
function loadAuthConfig() {
  try {
    ensureConfigDir();
    if (fs.existsSync(AUTH_CONFIG_FILE)) {
      const data = fs.readFileSync(AUTH_CONFIG_FILE, 'utf8');
      return { ...defaultAuthConfig, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading auth config:', error.message);
  }
  return { ...defaultAuthConfig };
}

// Save auth configuration
function saveAuthConfig(config) {
  try {
    ensureConfigDir();
    fs.writeFileSync(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving auth config:', error.message);
    return false;
  }
}

// Load users from file
function loadUsers() {
  try {
    ensureConfigDir();
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error.message);
  }
  return [];
}

// Save users to file
function saveUsers(users) {
  try {
    ensureConfigDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving users:', error.message);
    return false;
  }
}

// Initialize admin user from environment variables
function initializeAdmin() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('CRITICAL: ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required!');
    process.exit(1);
  }

  const users = loadUsers();
  const existingAdmin = users.find(u => u.isAdmin && u.username === ADMIN_USERNAME);

  if (!existingAdmin) {
    // Create admin user
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const adminUser = {
      id: uuidv4(),
      username: ADMIN_USERNAME,
      password: hashedPassword,
      isAdmin: true,
      permissions: { ...defaultPermissions },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Remove any other admin users and add new one
    const nonAdminUsers = users.filter(u => !u.isAdmin);
    saveUsers([adminUser, ...nonAdminUsers]);
    console.log(`Admin user '${ADMIN_USERNAME}' initialized.`);
  } else {
    // Update admin password if changed
    if (!bcrypt.compareSync(ADMIN_PASSWORD, existingAdmin.password)) {
      existingAdmin.password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      existingAdmin.updatedAt = new Date().toISOString();
      saveUsers(users);
      console.log(`Admin user '${ADMIN_USERNAME}' password updated.`);
    }
  }
}

// Authenticate user
function authenticateUser(username, password) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Check if account is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    return { success: false, error: `Account locked. Try again in ${remainingMinutes} minutes.` };
  }

  // Verify password
  if (!bcrypt.compareSync(password, user.password)) {
    // Increment failed attempts
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    const authConfig = loadAuthConfig();

    if (user.failedAttempts >= authConfig.maxLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + authConfig.lockoutDuration * 60000).toISOString();
      user.failedAttempts = 0;
    }

    saveUsers(users);
    return { success: false, error: 'Invalid credentials' };
  }

  // Reset failed attempts on successful login
  user.failedAttempts = 0;
  user.lockedUntil = null;
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  // Generate JWT token
  const authConfig = loadAuthConfig();
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    },
    JWT_SECRET,
    { expiresIn: `${authConfig.sessionDuration}h` }
  );

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      permissions: user.permissions
    }
  };
}

// Verify JWT token
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = loadUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        permissions: user.permissions
      }
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { success: false, error: 'Token expired' };
    }
    return { success: false, error: 'Invalid token' };
  }
}

// Authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const result = verifyToken(token);

  if (!result.success) {
    return res.status(401).json({ success: false, error: result.error });
  }

  req.user = result.user;
  next();
}

// Admin middleware
function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// Permission check middleware factory
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Admin has all permissions
    if (req.user.isAdmin) {
      return next();
    }

    const permission = req.user.permissions && req.user.permissions[permissionKey];
    if (!permission || !permission.enabled) {
      return res.status(403).json({ success: false, error: `Permission '${permissionKey}' required` });
    }

    // Attach permission limits to request for use in handlers
    req.permissionLimits = permission;
    next();
  };
}

// Get user by ID
function getUserById(userId) {
  const users = loadUsers();
  return users.find(u => u.id === userId);
}

// Get all users (excluding passwords)
function getAllUsers() {
  const users = loadUsers();
  return users.map(u => ({
    id: u.id,
    username: u.username,
    isAdmin: u.isAdmin,
    permissions: u.permissions,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLogin: u.lastLogin
  }));
}

// Create new user
function createUser(username, password, permissions = defaultPermissions) {
  const users = loadUsers();

  // Check if username already exists
  if (users.some(u => u.username === username)) {
    return { success: false, error: 'Username already exists' };
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    password: hashedPassword,
    isAdmin: false,
    permissions: { ...defaultPermissions, ...permissions },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  return {
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.isAdmin,
      permissions: newUser.permissions
    }
  };
}

// Update user
function updateUser(userId, updates) {
  const users = loadUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }

  const user = users[userIndex];

  // Prevent modifying admin status of the main admin
  if (user.isAdmin && user.username === ADMIN_USERNAME) {
    if (updates.isAdmin === false) {
      return { success: false, error: 'Cannot remove admin status from main admin' };
    }
    if (updates.username && updates.username !== ADMIN_USERNAME) {
      return { success: false, error: 'Cannot change main admin username' };
    }
  }

  // Check username uniqueness if changing
  if (updates.username && updates.username !== user.username) {
    if (users.some(u => u.username === updates.username)) {
      return { success: false, error: 'Username already exists' };
    }
  }

  // Update fields
  if (updates.username) user.username = updates.username;
  if (updates.permissions) user.permissions = { ...user.permissions, ...updates.permissions };
  user.updatedAt = new Date().toISOString();

  saveUsers(users);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      permissions: user.permissions
    }
  };
}

// Reset user password
function resetUserPassword(userId, newPassword) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Don't allow resetting main admin password via API
  if (user.isAdmin && user.username === ADMIN_USERNAME) {
    return { success: false, error: 'Main admin password can only be changed via environment variable' };
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  saveUsers(users);

  return { success: true };
}

// Delete user
function deleteUser(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Prevent deleting main admin
  if (user.isAdmin && user.username === ADMIN_USERNAME) {
    return { success: false, error: 'Cannot delete main admin user' };
  }

  const filteredUsers = users.filter(u => u.id !== userId);
  saveUsers(filteredUsers);

  return { success: true };
}

// Export everything
module.exports = {
  initializeAdmin,
  authenticateUser,
  verifyToken,
  authMiddleware,
  adminMiddleware,
  requirePermission,
  getUserById,
  getAllUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  loadAuthConfig,
  saveAuthConfig,
  defaultPermissions
};
