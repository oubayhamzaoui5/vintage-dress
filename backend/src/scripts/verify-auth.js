import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { sign } from '../middleware/auth.js'

const suffix = randomUUID()
const email = `auth-${suffix}@example.test`
const changedEmail = `updated-${suffix}@example.test`
const password = `Vintage-${suffix}`
const nextPassword = `Changed-${suffix}`
const call = (path, { method = 'GET', body, token } = {}) => fetch('http://127.0.0.1:5000/api' + path, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
})
async function expectStatus(path, options, expected) {
  const response = await call(path, options)
  assert.equal(response.status, expected, `${options?.method || 'GET'} ${path}`)
  return response
}
let userId
let secondaryId
try {
  await expectStatus('/auth/login', { method: 'POST', body: { email, password } }, 401)
  const [[before]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE email = ?', [email])
  assert.equal(before.count, 0, 'Unknown login must not create an account')
  await expectStatus('/auth/register', { method: 'POST', body: { name: '', email, password } }, 400)
  const created = await expectStatus('/auth/register', { method: 'POST', body: { name: 'Vérification temporaire', email: ` ${email.toUpperCase()} `, password, role: 'principal', type: 'admin' } }, 201)
  const session = await created.json()
  userId = session.user.id
  assert.equal(session.type, 'user')
  assert.equal(session.admin, undefined)
  const [[row]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId])
  assert.equal(row.email, email)
  assert.notEqual(row.password_hash, password)
  assert.ok(await bcrypt.compare(password, row.password_hash))
  await expectStatus('/auth/register', { method: 'POST', body: { name: 'Doublon', email, password } }, 409)
  await expectStatus('/auth/register', { method: 'POST', body: { name: 'Doublon admin', email: process.env.ADMIN_EMAIL, password } }, 409)
  await expectStatus('/auth/login', { method: 'POST', body: { email, password: 'incorrect-password' } }, 401)
  const login = await expectStatus('/auth/login', { method: 'POST', body: { email, password } }, 200)
  assert.equal((await login.json()).user.id, userId)
  const me = await expectStatus('/auth/me', { token: session.token }, 200)
  assert.equal((await me.json()).user.id, userId)
  await expectStatus('/auth/me', { token: 'forged-token' }, 401)
  await expectStatus('/auth/me', { token: sign({ id: userId, type: 'user' }, '-1s') }, 401)
  await expectStatus('/admin/stats', { token: session.token }, 401)
  await expectStatus('/orders/mine', { token: session.token }, 200)
  await expectStatus('/auth/profile', { method: 'PATCH', token: session.token, body: { name: 'Profil enregistré', email: changedEmail, phone: '20123456', city: 'Tunis' } }, 200)
  const profile = await (await expectStatus('/auth/me', { token: session.token }, 200)).json()
  assert.equal(profile.user.email, changedEmail)
  assert.equal(profile.user.city, 'Tunis')
  await expectStatus('/auth/password', { method: 'PATCH', token: session.token, body: { current: 'incorrect-password', next: nextPassword } }, 401)
  await expectStatus('/auth/password', { method: 'PATCH', token: session.token, body: { current: password, next: nextPassword } }, 200)
  await expectStatus('/auth/login', { method: 'POST', body: { email: changedEmail, password } }, 401)
  await expectStatus('/auth/login', { method: 'POST', body: { email: changedEmail, password: nextPassword } }, 200)
  await pool.query('UPDATE users SET blocked = 1 WHERE id = ?', [userId])
  await expectStatus('/auth/me', { token: session.token }, 403)
  await expectStatus('/auth/login', { method: 'POST', body: { email: changedEmail, password: nextPassword } }, 403)
  await pool.query('UPDATE users SET blocked = 0 WHERE id = ?', [userId])
  const admin = await (await expectStatus('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } }, 200)).json()
  assert.equal(admin.type, 'admin')
  assert.equal(admin.admin.role, 'principal')
  await expectStatus('/admin/stats', { token: admin.token }, 200)
  await expectStatus('/orders/mine', { token: admin.token }, 401)
  const [ins] = await pool.query("INSERT INTO admins (name,email,password_hash,role) VALUES (?,?,?,'secondaire')", ['Vérification temporaire', `secondary-${suffix}@example.test`, await bcrypt.hash(randomUUID(), 4)])
  secondaryId = ins.insertId
  await expectStatus('/products', { method: 'POST', token: sign({ id: secondaryId, type: 'admin', role: 'principal' }), body: {} }, 403)
  await pool.query('DELETE FROM users WHERE id = ?', [userId])
  userId = null
  await expectStatus('/auth/me', { token: session.token }, 401)

  // Exercise browser storage logic without relying on a cached prototype identity.
  const storage = () => { const data = new Map(); return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) } }
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
  globalThis.window = new EventTarget()
  const browser = await import('../../../frontend/src/utils/session.js')
  localStorage.setItem('vd_user', JSON.stringify({ name: 'Fake profile', email }))
  assert.equal(browser.getSession(), null)
  browser.clearLegacySessions()
  assert.equal(localStorage.getItem('vd_user'), null)
  browser.saveSession(session, false)
  assert.equal(localStorage.getItem('vd_session'), null)
  assert.ok(sessionStorage.getItem('vd_session'))
  browser.saveSession(admin, true)
  assert.equal(sessionStorage.getItem('vd_session'), null)
  assert.ok(localStorage.getItem('vd_session'))
  assert.equal(browser.getUser(), null)
  assert.equal(browser.getAdmin().id, admin.admin.id)
  browser.logout()
  assert.equal(browser.getToken(), null)
  console.log('PASS: signup persistence, password hashes, unknown/wrong logins, duplicates, admin routing identity, roles, expired/forged/deleted/blocked sessions, profile/password persistence, remember/logout, legacy mock profiles.')
} finally {
  if (userId) await pool.query('DELETE FROM users WHERE id = ?', [userId])
  if (secondaryId) await pool.query('DELETE FROM admins WHERE id = ?', [secondaryId])
  await pool.end()
}
