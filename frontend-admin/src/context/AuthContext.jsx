import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth as authApi } from '../api/endpoints'

const AuthContext = createContext(null)

const TOKEN_KEY = 'kupot_token'
const USER_KEY  = 'kupot_user'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // On mount: restore from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser  = localStorage.getItem(USER_KEY)
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch (err) {
      console.warn('Failed to restore auth from storage', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    setError(null)
    try {
      const res = await authApi.login(username, password)
      // res = { token, user: {id, name, role} }
      localStorage.setItem(TOKEN_KEY, res.token)
      localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      setToken(res.token)
      setUser(res.user)
      return res.user
    } catch (err) {
      setError(err.message || 'שגיאת התחברות')
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setError(null)
  }, [])

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
