import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { requireAdmin, requireRole, wrap } from '../middleware/auth.js'

const r = Router()

// Message de contact (public)
r.post('/messages', wrap(async (req, res) => {
  const { name = '', email = '', message = '' } = req.body
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof email !== 'string' || email.trim().length > 150 || !/^\S+@\S+\.\S+$/.test(email.trim()) || typeof message !== 'string' || !message.trim() || message.trim().length > 3000)
    return res.status(400).json({ error: 'Nom (100 caractères maximum), e-mail valide et message (3 000 caractères maximum) requis.' })
  const [saved] = await pool.query('INSERT INTO messages (name, email, message) VALUES (?,?,?)', [name.trim(), email.trim().toLowerCase(), message.trim()])
  res.status(201).json({ ok: true, id: saved.insertId })
}))

r.use('/admin', requireAdmin)

r.get('/admin/me', (req, res) => {
  const { id, name, email, role } = req.auth
  res.json({ id, name, email, role })
})

r.get('/admin/stats', wrap(async (_req, res) => {
  const [[c]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COALESCE(SUM(total),0) FROM orders WHERE status = 'Livrée') AS revenue`)
  const [sales] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(total) AS total FROM orders
     WHERE status = 'Livrée' AND created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY day`)
  const [top] = await pool.query(
    `SELECT p.name, SUM(i.quantity) AS sold FROM order_items i
     JOIN products p ON p.id = i.product_id JOIN orders o ON o.id = i.order_id AND o.status = 'Livrée'
     GROUP BY p.id ORDER BY sold DESC LIMIT 5`)
  res.json({ ...c, sales, top })
}))

r.get('/admin/messages', wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, message, created_at FROM messages ORDER BY id DESC')
  res.json(rows)
}))

// --- Principal uniquement ---
const principal = requireRole('principal')

r.get('/admin/users', principal, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, phone, city, blocked, created_at FROM users ORDER BY id DESC')
  res.json(rows)
}))
r.patch('/admin/users/:id/block', principal, wrap(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || typeof req.body.blocked !== 'boolean') return res.status(400).json({ error: 'Compte ou état de blocage invalide.' })
  const [u] = await pool.query('UPDATE users SET blocked = ? WHERE id = ?', [req.body.blocked ? 1 : 0, req.params.id])
  u.affectedRows ? res.json({ ok: true }) : res.status(404).json({ error: 'Utilisateur introuvable.' })
}))

r.get('/admin/admins', principal, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM admins ORDER BY id')
  res.json(rows)
}))
r.post('/admin/admins', principal, wrap(async (req, res) => {
  const { password, role = 'secondaire' } = req.body
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const fields = {}
  if (!name || name.length > 100) fields.name = 'Nom obligatoire, 100 caractères maximum.'
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 150) fields.email = 'Saisissez une adresse e-mail valide (150 caractères maximum).'
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Mot de passe de 10 caractères minimum, 72 octets maximum.'
  if (!['principal', 'secondaire'].includes(role)) fields.role = 'Choisissez Principal ou Secondaire.'
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Vérifiez les champs du nouvel administrateur.', fields })
  try {
    const [[customer]] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
    if (customer) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé par un compte client.', fields: { email: 'Utilisez une autre adresse pour ce compte administrateur.' } })
    const [ins] = await pool.query('INSERT INTO admins (name, email, password_hash, role) VALUES (?,?,?,?)',
      [name, email, await bcrypt.hash(password, 12), role])
    res.status(201).json({ id: ins.insertId, name, email, role })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet e-mail est déjà utilisé par un administrateur.', fields: { email: 'Utilisez une adresse e-mail différente.' } })
    throw e
  }
}))
r.delete('/admin/admins/:id', principal, wrap(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Identifiant administrateur invalide.' })
  if (+req.params.id === req.auth.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' })
  const [removed] = await pool.query('DELETE FROM admins WHERE id = ?', [req.params.id])
  if (!removed.affectedRows) return res.status(404).json({ error: 'Administrateur introuvable. Actualisez la liste.' })
  res.status(204).end()
}))

export default r
