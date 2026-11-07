import { api } from './api.js'
import { saveSession } from './session.js'
export { getUser, logout } from './session.js'

export async function login(email, password, remember = false) {
  const session = await api('/auth/login', { method: 'POST', auth: false, body: { email: email.trim(), password, remember } })
  saveSession(session, remember)
  return session
}
export async function register({ name, email, password }) {
  const session = await api('/auth/register', { method: 'POST', auth: false, body: { name: name.trim(), email: email.trim(), password } })
  saveSession(session, false)
  return session
}
