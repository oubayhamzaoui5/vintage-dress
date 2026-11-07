import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { sign, wrap, requireSession, requireUser } from '../middleware/auth.js'

const r = Router()
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' } })
const emailValue = (value) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const emailOk = (value) => value.length <= 150 && /^\S+@\S+\.\S+$/.test(value)
const passwordOk = (value) => typeof value === 'string' && value.length >= 6 && Buffer.byteLength(value, 'utf8') <= 72
const FAIL = { error: 'Identifiant ou mot de passe incorrect.' }
const publicUser = ({ id, name, email, phone = '', city = '' }) => ({ id, name, email, phone: phone || '', city: city || '' })
const publicAdmin = ({ id, name, email, role }) => ({ id, name, email, role })
function sendSession(res, identity, type, remember, status = 200) {
  const profile = type === 'admin' ? publicAdmin(identity) : publicUser(identity)
  res.status(status).json({ type, token: sign({ id: profile.id, type }, remember ? '30d' : '8h'), [type === 'admin' ? 'admin' : 'user']: profile })
}
async function emailExists(email, excludeUserId = 0) {
  const [[row]] = await pool.query('SELECT (EXISTS(SELECT 1 FROM users WHERE email = ? AND id <> ?) OR EXISTS(SELECT 1 FROM admins WHERE email = ?)) AS taken', [email, excludeUserId, email])
  return !!row.taken
}

// One public login: identity and role come only from database records.
r.post('/auth/login', limiter, wrap(async (req, res) => {
  const email = emailValue(req.body.email)
  const { password, remember = false } = req.body
  if (!emailOk(email) || !passwordOk(password)) return res.status(400).json({ error: 'E-mail valide et mot de passe de 6 caractères minimum requis (72 octets maximum).' })
  const [[admin]] = await pool.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email])
  if (admin) {
    if (!(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json(FAIL)
    return sendSession(res, admin, 'admin', remember === true)
  }
  const [[user]] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json(FAIL)
  if (user.blocked) return res.status(403).json({ error: 'Ce compte est suspendu.' })
  sendSession(res, user, 'user', remember === true)
}))

// Compatibility for API clients. Browser /admin/login redirects to /login.
r.post('/admin/login', limiter, wrap(async (req, res) => {
  const { identifier, password, remember = false } = req.body
  if (typeof identifier !== 'string' || !passwordOk(password)) return res.status(401).json(FAIL)
  const [[admin]] = await pool.query('SELECT * FROM admins WHERE email = ? OR name = ? LIMIT 1', [identifier.trim(), identifier.trim()])
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json(FAIL)
  sendSession(res, admin, 'admin', remember === true)
}))

r.post('/auth/register', limiter, wrap(async (req, res) => {
  const { name, password } = req.body
  const email = emailValue(req.body.email)
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !emailOk(email) || !passwordOk(password))
    return res.status(400).json({ error: 'Nom (100 caractères maximum), e-mail valide et mot de passe de 6 caractères minimum requis (72 octets maximum).' })
  if (await emailExists(email)) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' })
  try {
    const [ins] = await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)', [name.trim(), email, await bcrypt.hash(password, 12)])
    // Public signup cannot choose an administrator role.
    sendSession(res, { id: ins.insertId, name: name.trim(), email }, 'user', false, 201)
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' })
    throw error
  }
}))

r.get('/auth/me', requireSession, (req, res) => {
  const { type, ...identity } = req.auth
  res.json({ type, [type === 'admin' ? 'admin' : 'user']: identity })
})

r.patch('/auth/profile', requireUser, wrap(async (req, res) => {
  const { name, phone = '', city = '' } = req.body
  const email = emailValue(req.body.email)
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !emailOk(email) || typeof phone !== 'string' || phone.length > 30 || typeof city !== 'string' || city.length > 80)
    return res.status(400).json({ error: 'Coordonnées invalides. Vérifiez le nom, l’e-mail, le téléphone et la ville.' })
  if (await emailExists(email, req.auth.id)) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' })
  try {
    await pool.query('UPDATE users SET name = ?, email = ?, phone = ?, city = ? WHERE id = ?', [name.trim(), email, phone.trim(), city.trim(), req.auth.id])
    res.json({ user: { id: req.auth.id, name: name.trim(), email, phone: phone.trim(), city: city.trim() } })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' })
    throw error
  }
}))

r.patch('/auth/password', requireUser, limiter, wrap(async (req, res) => {
  const { current, next } = req.body
  if (!passwordOk(current) || !passwordOk(next) || current === next) return res.status(400).json({ error: 'Choisissez un nouveau mot de passe différent (6 caractères minimum, 72 octets maximum).' })
  const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.auth.id])
  if (!(await bcrypt.compare(current, user.password_hash))) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' })
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 12), req.auth.id])
  res.json({ ok: true })
}))

export default r
