import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Notifications from './Notifications'

function Layout() {
  const { state, checkConnection } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

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
            <span className="logo-icon">⚡</span>
            <h1>Fancy Steel Control</h1>
          </div>
        </div>
        <div className="header-connection" onClick={checkConnection} title="Click to check connection">
          <span className={`status-dot ${state.isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{state.isConnected ? 'Connected' : 'Offline'}</span>
          <span className="device-ip">{state.localIP || '192.168.4.1'}</span>
        </div>
      </header>

      <main className="app-main full-width">
        <Outlet context={{ menuOpen, setMenuOpen }} />
      </main>

      <Notifications />
    </div>
  )
}

export default Layout
