const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
import { getToken } from './session.js'
export { getToken } from './session.js'

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const multipart = body instanceof FormData
  const headers = multipart ? {} : { 'Content-Type': 'application/json' }
  const token = auth && getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? multipart ? body : JSON.stringify(body) : undefined })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur réseau.'), { status: res.status, code: data.code, details: data })
  return data
}

export const mediaUrl = (path) => path?.startsWith('/uploads/') ? new URL(path, BASE).href : path
