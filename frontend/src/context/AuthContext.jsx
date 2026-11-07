import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api } from '../utils/api.js'
import { AUTH_EVENT, clearLegacySessions, getSession, saveSession, logout } from '../utils/session.js'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', session: null })
  const [revision, setRevision] = useState(0)
  const retry = () => { setState({ status: 'checking', session: null }); setRevision((n) => n + 1) }
  useEffect(() => {
    const changed = () => { setState({ status: 'checking', session: null }); setRevision((n) => n + 1) }
    const storageChanged = (event) => { if (!event.key || event.key === 'vd_session') changed() }
    window.addEventListener(AUTH_EVENT, changed)
    window.addEventListener('storage', storageChanged)
    return () => { window.removeEventListener(AUTH_EVENT, changed); window.removeEventListener('storage', storageChanged) }
  }, [])
  useEffect(() => {
    let active = true
    clearLegacySessions()
    const cached = getSession()
    if (!cached) { setState({ status: 'guest', session: null }); return }
    api('/auth/me').then((identity) => {
      if (!active || getSession()?.token !== cached.token) return
      const session = { ...identity, token: cached.token, remember: cached.remember }
      saveSession(session, cached.remember, false)
      setState({ status: 'authenticated', session })
    }).catch((error) => {
      if (!active || getSession()?.token !== cached.token) return
      if ([401, 403].includes(error.status)) { logout(false); setState({ status: 'guest', session: null }) }
      else setState({ status: 'error', session: null })
    })
    return () => { active = false }
  }, [revision])
  function updateUser(user) {
    const current = getSession()
    if (current?.type !== 'user') return
    const session = { ...current, user }
    saveSession(session, current.remember, false)
    setState({ status: 'authenticated', session })
  }
  return <AuthContext.Provider value={{ ...state, retry, updateUser }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)

export function RequireAuth({ type }) {
  const location = useLocation()
  const { status, session, retry } = useAuth()
  if (status === 'checking') return <main className="container section" role="status">Vérification de votre session…</main>
  if (status === 'error') return <main className="container section"><p role="alert">Impossible de vérifier votre session. Vérifiez que le serveur est démarré.</p><button className="btn" onClick={retry}>Réessayer</button></main>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (session.type !== type) return <Navigate to={session.type === 'admin' ? '/admin' : '/compte'} replace />
  return <Outlet />
}
