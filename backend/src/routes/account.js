import { Router } from 'express'
import { pool } from '../db.js'
import { requireUser, wrap } from '../middleware/auth.js'

const r = Router()
r.use('/account', requireUser)
const validId = (value) => /^[1-9]\d*$/.test(value)

r.get('/account/addresses', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, phone, city, address, is_default FROM addresses WHERE user_id=? ORDER BY is_default DESC, id', [req.auth.id])
  res.json(rows)
}))
r.post('/account/addresses', wrap(async (req, res) => {
  const fields = { name: 100, phone: 30, city: 80, address: 500 }
  const values = {}
  for (const [field, max] of Object.entries(fields)) {
    const value = req.body[field]
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return res.status(400).json({ error: 'Nom, téléphone, ville et adresse complète valides requis.' })
    values[field] = value.trim()
  }
  if (!/^[+\d\s().-]{6,30}$/.test(values.phone) || values.phone.replace(/\D/g, '').length < 6) return res.status(400).json({ error: 'Numéro de téléphone invalide.' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE', [req.auth.id])
    const [[count]] = await conn.query('SELECT COUNT(*) AS n FROM addresses WHERE user_id=?', [req.auth.id])
    if (count.n >= 10) { await conn.rollback(); return res.status(400).json({ error: '10 adresses maximum. Supprimez une ancienne adresse.' }) }
    const [saved] = await conn.query('INSERT INTO addresses (user_id,name,phone,city,address,is_default) VALUES (?,?,?,?,?,?)', [req.auth.id, values.name, values.phone, values.city, values.address, count.n === 0])
    await conn.commit()
    res.status(201).json({ id: saved.insertId, ...values, is_default: count.n === 0 })
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}))
// Serialize address changes per customer so exactly one default remains.
async function changeAddress(req, res, remove) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Adresse invalide.' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE', [req.auth.id])
    const [[target]] = await conn.query('SELECT id,is_default FROM addresses WHERE id=? AND user_id=?', [req.params.id, req.auth.id])
    if (!target) { await conn.rollback(); return res.status(404).json({ error: 'Adresse introuvable.' }) }
    if (remove) {
      await conn.query('DELETE FROM addresses WHERE id=? AND user_id=?', [target.id, req.auth.id])
      if (target.is_default) await conn.query('UPDATE addresses SET is_default=1 WHERE user_id=? ORDER BY id LIMIT 1', [req.auth.id])
    } else {
      await conn.query('UPDATE addresses SET is_default=(id=?) WHERE user_id=?', [target.id, req.auth.id])
    }
    await conn.commit()
    res.status(204).end()
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}
r.patch('/account/addresses/:id/default', wrap((req, res) => changeAddress(req, res, false)))
r.delete('/account/addresses/:id', wrap((req, res) => changeAddress(req, res, true)))

r.get('/account/favorites', wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT p.id,p.name,p.price,p.stock,p.image,c.name AS category,p.category_id
    FROM favorites f JOIN products p ON p.id=f.product_id LEFT JOIN categories c ON c.id=p.category_id WHERE f.user_id=? ORDER BY p.id DESC`, [req.auth.id])
  res.json(rows)
}))
r.put('/account/favorites/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Produit invalide.' })
  const [[product]] = await pool.query('SELECT id FROM products WHERE id=?', [req.params.id])
  if (!product) return res.status(404).json({ error: 'Produit indisponible.' })
  await pool.query('INSERT INTO favorites (user_id,product_id) VALUES (?,?) ON DUPLICATE KEY UPDATE product_id=VALUES(product_id)', [req.auth.id, product.id])
  res.status(204).end()
}))
r.delete('/account/favorites/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Produit invalide.' })
  await pool.query('DELETE FROM favorites WHERE user_id=? AND product_id=?', [req.auth.id, req.params.id])
  res.status(204).end()
}))
r.get('/account/preferences', wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT orders,offers,news FROM notification_preferences WHERE user_id=?', [req.auth.id])
  res.json(row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, !!value])) : { orders: true, offers: false, news: true })
}))
r.patch('/account/preferences', wrap(async (req, res) => {
  const { orders, offers, news } = req.body
  if ([orders, offers, news].some((value) => typeof value !== 'boolean')) return res.status(400).json({ error: 'Préférences invalides.' })
  await pool.query('INSERT INTO notification_preferences (user_id,orders,offers,news) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE orders=VALUES(orders),offers=VALUES(offers),news=VALUES(news)', [req.auth.id, orders, offers, news])
  res.json({ orders, offers, news })
}))
export default r
