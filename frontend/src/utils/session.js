const KEY = 'vd_session'
export const AUTH_EVENT = 'vd-session-changed'
export function clearLegacySessions() {
  for (const store of [localStorage, sessionStorage]) {
    for (const key of ['vd_user', 'vd_user_token', 'vd_admin', 'vd_admin_token']) store.removeItem(key)
  }
}
export function getSession() {
  try {
    const persistent = localStorage.getItem(KEY)
    const session = JSON.parse(persistent || sessionStorage.getItem(KEY) || 'null')
    if (!session || typeof session.token !== 'string' || !session.token || !['admin', 'user'].includes(session.type)) return null
    const identity = session.type === 'admin' ? session.admin : session.user
    if (!Number.isInteger(identity?.id)) return null
    return { ...session, remember: !!persistent }
  } catch { return null }
}
export function saveSession(session, remember = false, emit = true) {
  clearLegacySessions()
  for (const store of [localStorage, sessionStorage]) store.removeItem(KEY)
  const { token, type, admin, user } = session
  ;(remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ token, type, ...(type === 'admin' ? { admin } : { user }) }))
  if (emit) window.dispatchEvent(new Event(AUTH_EVENT))
}
export function logout(emit = true) {
  clearLegacySessions()
  for (const store of [localStorage, sessionStorage]) store.removeItem(KEY)
  if (emit) window.dispatchEvent(new Event(AUTH_EVENT))
}
export const getToken = () => getSession()?.token || null
export const getUser = () => getSession()?.type === 'user' ? getSession().user : null
export const getAdmin = () => getSession()?.type === 'admin' ? getSession().admin : null
