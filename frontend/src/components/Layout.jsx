import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Notifications from './Notifications'

function Layout() {
  const { state, checkConnection } = useApp()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  const handleAdminClick = () => {
    setMenuOpen(false)
    navigate('/admin')
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <button
            className={`menu-burger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            title="Settings menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="logo">
            <span className="logo-icon">&#9889;</span>
            <h1>Fancy Steel Control</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="header-user">
            <span className="user-name">{user?.username}</span>
            {isAdmin && <span className="admin-indicator">Admin</span>}
          </div>
          <div className="header-connection" onClick={checkConnection} title="Click to check connection">
            <span className={`status-dot ${state.isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">{state.isConnected ? 'Connected' : 'Offline'}</span>
            <span className="device-ip">{state.localIP || '192.168.4.1'}</span>
          </div>
        </div>
      </header>

      <main className="app-main full-width">
        <Outlet context={{ menuOpen, setMenuOpen, isAdmin, handleAdminClick, handleLogout }} />
      </main>

      <Notifications />
    </div>
  )
}

export default Layout
