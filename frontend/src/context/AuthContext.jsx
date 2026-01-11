import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext()

const API_BASE = '/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('authToken'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setUser(data.user)
          } else {
            // Token invalid
            localStorage.removeItem('authToken')
            setToken(null)
          }
        } else {
          // Token invalid or expired
          localStorage.removeItem('authToken')
          setToken(null)
        }
      } catch (err) {
        console.error('Token verification failed:', err)
        localStorage.removeItem('authToken')
        setToken(null)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const login = useCallback(async (username, password) => {
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        localStorage.setItem('authToken', data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      } else {
        setError(data.error || 'Login failed')
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (err) {
      const errorMsg = 'Network error. Please try again.'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('authToken')
    setToken(null)
    setUser(null)
  }, [])

  // Helper to make authenticated API requests
  const authFetch = useCallback(async (url, options = {}) => {
    if (!token) {
      throw new Error('Not authenticated')
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, { ...options, headers })

    // If unauthorized, logout
    if (response.status === 401) {
      logout()
      throw new Error('Session expired')
    }

    return response
  }, [token, logout])

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionKey) => {
    if (!user) return false
    if (user.isAdmin) return true
    return user.permissions?.[permissionKey]?.enabled ?? false
  }, [user])

  // Get permission limits (e.g., maxPower)
  const getPermissionLimits = useCallback((permissionKey) => {
    if (!user) return null
    if (user.isAdmin) return null // Admin has no limits
    return user.permissions?.[permissionKey] ?? null
  }, [user])

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    login,
    logout,
    authFetch,
    hasPermission,
    getPermissionLimits
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
