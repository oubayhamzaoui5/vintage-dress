import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

export const sign = (payload, expiresIn = '8h') =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn })

async function verify(req, res, next, type) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Authentification requise.' })
  let data
  try {
    data = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (!['admin', 'user'].includes(data.type) || (type && data.type !== type) || !Number.isInteger(data.id)) throw new Error('type')
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide.' })
  }
  try {
    const query = data.type === 'admin' ? 'SELECT id, name, email, role FROM admins WHERE id = ?' : 'SELECT id, name, email, phone, city, blocked FROM users WHERE id = ?'
    const [[identity]] = await pool.query(query, [data.id])
    if (!identity) return res.status(401).json({ error: 'Session expirée ou invalide.' })
    if (identity.blocked) return res.status(403).json({ error: 'Ce compte est suspendu.' })
    delete identity.blocked
    req.auth = { ...identity, type: data.type }
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAdmin = (req, res, next) => verify(req, res, next, 'admin')
export const requireUser = (req, res, next) => verify(req, res, next, 'user')
export const requireSession = (req, res, next) => verify(req, res, next)

// Les droits sont vérifiés ICI, côté serveur, à chaque requête.
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role)
    ? next()
    : res.status(403).json({ error: 'Action réservée à l’administrateur principal.' })

export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next)
