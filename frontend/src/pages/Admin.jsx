import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

const PERMISSION_LABELS = {
  power_control: 'Power Control',
  lock_control: 'Lock Control',
  modes_timer: 'Modes & Timer',
  release_control: 'Release Control',
  tilt_control: 'Tilt Control',
  random_game: 'Random Game',
  device_settings: 'Device Settings'
}

const MODE_OPTIONS = ['petTraining', 'petFast', 'petFreeze', 'sleep', 'random']

function Admin() {
  const { authFetch, isAdmin, logout } = useAuth()
  const { addNotification } = useApp()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [authConfig, setAuthConfig] = useState({ sessionDuration: 24 })
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Form states
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [editPermissions, setEditPermissions] = useState({})

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
    }
  }, [isAdmin, navigate])

  // Load users and config
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [usersRes, configRes] = await Promise.all([
        authFetch('/api/admin/users'),
        authFetch('/api/admin/auth-config')
      ])

      const usersData = await usersRes.json()
      const configData = await configRes.json()

      if (usersData.success) {
        setUsers(usersData.users)
      }
      if (configData.success) {
        setAuthConfig(configData.config)
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
      addNotification('Failed to load admin data', 'error')
    } finally {
      setLoading(false)
    }
  }, [authFetch, addNotification])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Create user
  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      const response = await authFetch('/api/admin/users', {
        method: 'POST',
        body: { username: newUsername, password: newPassword, permissions: editPermissions }
      })
      const data = await response.json()

      if (data.success) {
        addNotification(`User "${newUsername}" created`, 'success')
        setShowCreateModal(false)
        setNewUsername('')
        setNewPassword('')
        setEditPermissions({})
        loadData()
      } else {
        addNotification(data.error || 'Failed to create user', 'error')
      }
    } catch (err) {
      addNotification('Failed to create user', 'error')
    }
  }

  // Update user permissions
  const handleUpdateUser = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const response = await authFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        body: { permissions: editPermissions }
      })
      const data = await response.json()

      if (data.success) {
        addNotification(`User "${selectedUser.username}" updated`, 'success')
        setShowEditModal(false)
        setSelectedUser(null)
        loadData()
      } else {
        addNotification(data.error || 'Failed to update user', 'error')
      }
    } catch (err) {
      addNotification('Failed to update user', 'error')
    }
  }

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const response = await authFetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: { password: newPassword }
      })
      const data = await response.json()

      if (data.success) {
        addNotification(`Password reset for "${selectedUser.username}"`, 'success')
        setShowResetPasswordModal(false)
        setSelectedUser(null)
        setNewPassword('')
      } else {
        addNotification(data.error || 'Failed to reset password', 'error')
      }
    } catch (err) {
      addNotification('Failed to reset password', 'error')
    }
  }

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      const response = await authFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        addNotification(`User "${selectedUser.username}" deleted`, 'success')
        setShowDeleteConfirm(false)
        setSelectedUser(null)
        loadData()
      } else {
        addNotification(data.error || 'Failed to delete user', 'error')
      }
    } catch (err) {
      addNotification('Failed to delete user', 'error')
    }
  }

  // Update auth config
  const handleUpdateAuthConfig = async () => {
    try {
      const response = await authFetch('/api/admin/auth-config', {
        method: 'PUT',
        body: authConfig
      })
      const data = await response.json()

      if (data.success) {
        addNotification('Session settings updated', 'success')
      } else {
        addNotification(data.error || 'Failed to update settings', 'error')
      }
    } catch (err) {
      addNotification('Failed to update settings', 'error')
    }
  }

  // Open edit modal
  const openEditModal = (user) => {
    setSelectedUser(user)
    setEditPermissions(JSON.parse(JSON.stringify(user.permissions || {})))
    setShowEditModal(true)
  }

  // Open create modal
  const openCreateModal = async () => {
    try {
      const response = await authFetch('/api/admin/default-permissions')
      const data = await response.json()
      if (data.success) {
        setEditPermissions(JSON.parse(JSON.stringify(data.permissions)))
      }
    } catch (err) {
      console.error('Failed to load default permissions:', err)
    }
    setShowCreateModal(true)
  }

  // Toggle permission enabled
  const togglePermission = (key) => {
    setEditPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key]?.enabled
      }
    }))
  }

  // Update permission limit
  const updatePermissionLimit = (key, limitKey, value) => {
    setEditPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [limitKey]: value
      }
    }))
  }

  // Toggle mode in allowed modes
  const toggleAllowedMode = (mode) => {
    setEditPermissions(prev => {
      const currentModes = prev.modes_timer?.allowedModes || []
      const newModes = currentModes.includes(mode)
        ? currentModes.filter(m => m !== mode)
        : [...currentModes, mode]
      return {
        ...prev,
        modes_timer: {
          ...prev.modes_timer,
          allowedModes: newModes
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Administration</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          Back to Control
        </button>
      </div>

      {/* Session Settings */}
      <section className="admin-section">
        <h2>Session Settings</h2>
        <div className="admin-form-row">
          <label>Session Duration (hours)</label>
          <input
            type="number"
            min="1"
            max="720"
            value={authConfig.sessionDuration}
            onChange={(e) => setAuthConfig({ ...authConfig, sessionDuration: parseInt(e.target.value) || 24 })}
          />
          <button className="btn-save" onClick={handleUpdateAuthConfig}>
            Save
          </button>
        </div>
      </section>

      {/* Users List */}
      <section className="admin-section">
        <div className="section-header">
          <h2>Users</h2>
          <button className="btn-create" onClick={openCreateModal}>
            + New User
          </button>
        </div>

        <div className="users-list">
          {users.map(user => (
            <div key={user.id} className={`user-card ${user.isAdmin ? 'admin' : ''}`}>
              <div className="user-info">
                <span className="user-name">
                  {user.username}
                  {user.isAdmin && <span className="admin-badge">Admin</span>}
                </span>
                <span className="user-meta">
                  Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="user-permissions">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <span
                    key={key}
                    className={`permission-badge ${user.isAdmin || user.permissions?.[key]?.enabled ? 'enabled' : 'disabled'}`}
                    title={label}
                  >
                    {label.split(' ')[0]}
                  </span>
                ))}
              </div>
              <div className="user-actions">
                {!user.isAdmin && (
                  <>
                    <button className="btn-edit" onClick={() => openEditModal(user)}>
                      Edit
                    </button>
                    <button className="btn-reset" onClick={() => { setSelectedUser(user); setShowResetPasswordModal(true); }}>
                      Reset PWD
                    </button>
                    <button className="btn-delete" onClick={() => { setSelectedUser(user); setShowDeleteConfirm(true); }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={4}
                  required
                />
              </div>

              <h3>Permissions</h3>
              <div className="permissions-grid">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="permission-item">
                    <label className="permission-toggle">
                      <input
                        type="checkbox"
                        checked={editPermissions[key]?.enabled ?? true}
                        onChange={() => togglePermission(key)}
                      />
                      <span>{label}</span>
                    </label>

                    {/* Max Power for power_control and random_game */}
                    {(key === 'power_control' || key === 'random_game') && editPermissions[key]?.enabled && (
                      <div className="permission-limit">
                        <label>Max Power: {editPermissions[key]?.maxPower ?? 100}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={editPermissions[key]?.maxPower ?? 100}
                          onChange={(e) => updatePermissionLimit(key, 'maxPower', parseInt(e.target.value))}
                        />
                      </div>
                    )}

                    {/* Allowed modes for modes_timer */}
                    {key === 'modes_timer' && editPermissions[key]?.enabled && (
                      <div className="permission-modes">
                        <label>Allowed Modes:</label>
                        <div className="mode-checkboxes">
                          {MODE_OPTIONS.map(mode => (
                            <label key={mode} className="mode-checkbox">
                              <input
                                type="checkbox"
                                checked={editPermissions.modes_timer?.allowedModes?.includes(mode) ?? true}
                                onChange={() => toggleAllowedMode(mode)}
                              />
                              <span>{mode}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit User: {selectedUser.username}</h2>
            <form onSubmit={handleUpdateUser}>
              <h3>Permissions</h3>
              <div className="permissions-grid">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="permission-item">
                    <label className="permission-toggle">
                      <input
                        type="checkbox"
                        checked={editPermissions[key]?.enabled ?? true}
                        onChange={() => togglePermission(key)}
                      />
                      <span>{label}</span>
                    </label>

                    {/* Max Power for power_control and random_game */}
                    {(key === 'power_control' || key === 'random_game') && editPermissions[key]?.enabled && (
                      <div className="permission-limit">
                        <label>Max Power: {editPermissions[key]?.maxPower ?? 100}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={editPermissions[key]?.maxPower ?? 100}
                          onChange={(e) => updatePermissionLimit(key, 'maxPower', parseInt(e.target.value))}
                        />
                      </div>
                    )}

                    {/* Allowed modes for modes_timer */}
                    {key === 'modes_timer' && editPermissions[key]?.enabled && (
                      <div className="permission-modes">
                        <label>Allowed Modes:</label>
                        <div className="mode-checkboxes">
                          {MODE_OPTIONS.map(mode => (
                            <label key={mode} className="mode-checkbox">
                              <input
                                type="checkbox"
                                checked={editPermissions.modes_timer?.allowedModes?.includes(mode) ?? true}
                                onChange={() => toggleAllowedMode(mode)}
                              />
                              <span>{mode}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <h2>Reset Password</h2>
            <p>Reset password for user: <strong>{selectedUser.username}</strong></p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={4}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowResetPasswordModal(false); setNewPassword(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal modal-small" onClick={e => e.stopPropagation()}>
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete user <strong>{selectedUser.username}</strong>?</p>
            <p className="warning">This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="btn-delete" onClick={handleDeleteUser}>
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
