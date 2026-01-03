import { useApp } from '../context/AppContext'

function Notifications() {
  const { state, removeNotification } = useApp()

  return (
    <div className="notifications-container">
      {state.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <span className="notification-icon">
            {notification.type === 'success' && '✓'}
            {notification.type === 'error' && '✕'}
            {notification.type === 'info' && 'ℹ'}
            {notification.type === 'warning' && '⚠'}
          </span>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" aria-label="Fermer">×</button>
        </div>
      ))}
    </div>
  )
}

export default Notifications
