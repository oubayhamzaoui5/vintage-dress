import { Router } from 'express'
import { createHash } from 'node:crypto'
import { pool } from '../db.js'
import { requireAdmin, requireUser, requireSession, requireRole, wrap } from '../middleware/auth.js'

const r = Router()
const SHIPPING = 8
const invalid = (message) => Object.assign(new Error(message), { status: 400 })
function checkout(body) {
  const delivery = body.delivery || {}
  const limits = { name: 100, phone: 30, city: 80, address: 500 }
  const normalized = {}
  for (const [field, max] of Object.entries(limits)) {
    if (typeof delivery[field] !== 'string' || !delivery[field].trim() || delivery[field].trim().length > max) throw invalid('Renseignez le nom, le téléphone, la ville et l’adresse de livraison.')
    normalized[field] = delivery[field].trim()
  }
  if (!/^[+\d\s().-]{6,30}$/.test(normalized.phone) || normalized.phone.replace(/\D/g, '').length < 6) throw invalid('Numéro de téléphone invalide.')
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.request_key || '')) throw invalid('Référence de commande invalide. Rechargez la page.')
  if (body.payment_method !== 'cash_on_delivery') throw invalid('Choisissez le paiement à la livraison.')
  if (typeof body.expected_total !== 'number' || !Number.isFinite(body.expected_total) || body.expected_total < 0 || Math.abs(body.expected_total * 100 - Math.round(body.expected_total * 100)) > 0.000001) throw invalid('Total invalide.')
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw invalid('Panier vide ou trop volumineux.')
  const groups = new Map()
  const quantities = new Map()
  let quantity = 0
  for (const item of body.items) {
    if (!item || !Number.isSafeInteger(item.product_id) || item.product_id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw invalid('Quantité invalide : 1 à 20 articles par robe.')
    const size = item.size || 'M'
    const color = item.color || 'Modèle présenté'
    if (!['XS', 'S', 'M', 'L', 'XL'].includes(size) || typeof color !== 'string' || color.trim().length > 30) throw invalid('Taille ou couleur invalide.')
    const productQuantity = (quantities.get(item.product_id) || 0) + item.quantity
    if (productQuantity > 20) throw invalid('20 articles maximum pour une même robe, toutes tailles confondues.')
    quantities.set(item.product_id, productQuantity)
    quantity += item.quantity
    const key = JSON.stringify([item.product_id, size, color.trim()])
    const line = groups.get(key) || { product_id: item.product_id, size, color: color.trim(), quantity: 0 }
    line.quantity += item.quantity
    groups.set(key, line)
  }
  if (quantity > 200) throw invalid('200 articles maximum par commande.')
  const items = [...groups.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const hash = createHash('sha256').update(JSON.stringify({ delivery: normalized, items, payment: 'cash_on_delivery' })).digest('hex')
  return { delivery: normalized, items, hash, expectedCents: Math.round(body.expected_total * 100), key: body.request_key }
}
function replay(res, order, hash) {
  if (order.request_hash !== hash) return res.status(409).json({ code: 'REQUEST_REUSED', error: 'Cette référence correspond déjà à une autre commande. Consultez vos commandes avant de recommencer.' })
  return res.json({ id: order.id, total: order.total, status: order.status, replayed: true })
}

// Prices and shipping are calculated here; the browser never determines the payable total.
r.post('/orders', requireUser, wrap(async (req, res) => {
  const input = checkout(req.body)
  const [[previous]] = await pool.query('SELECT id, total, status, request_hash FROM orders WHERE user_id = ? AND request_key = ?', [req.auth.id, input.key])
  if (previous) return replay(res, previous, input.hash)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let cents = SHIPPING * 100
    const lines = []
    for (const item of input.items) {
      const [[product]] = await conn.query('SELECT id, name, price, stock, image FROM products WHERE id = ? FOR UPDATE', [item.product_id])
      if (!product) throw invalid('Une robe du panier n’est plus disponible. Retirez-la du panier pour continuer.')
      if (product.stock < item.quantity) throw Object.assign(new Error(`Stock insuffisant pour ${product.name} (${product.stock} disponible(s)). Ajustez le panier.`), { status: 409, code: 'OUT_OF_STOCK' })
      await conn.query('UPDATE products SET stock=stock-? WHERE id=?', [item.quantity, product.id])
      cents += Math.round(product.price * 100) * item.quantity
      lines.push({ ...item, unit_price: product.price, product_name: product.name, image: product.image })
    }
    if (cents > 9999999999) throw invalid('Le montant de cette commande dépasse la limite autorisée.')
    if (cents !== input.expectedCents) {
      await conn.rollback()
      return res.status(409).json({ code: 'PRICE_CHANGED', total: cents / 100, error: 'Les prix ont changé. Vérifiez le nouveau total, puis confirmez à nouveau.' })
    }
    const [order] = await conn.query(`INSERT INTO orders (user_id, total, customer_name, phone, city, address, shipping, payment_method, request_key, request_hash)
      VALUES (?,?,?,?,?,?,?, 'Paiement à la livraison', ?,?)`, [req.auth.id, cents / 100, input.delivery.name, input.delivery.phone, input.delivery.city, input.delivery.address, SHIPPING, input.key, input.hash])
    for (const line of lines) await conn.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price, size, color, product_name, image) VALUES (?,?,?,?,?,?,?,?)', [order.insertId, line.product_id, line.quantity, line.unit_price, line.size, line.color, line.product_name, line.image])
    await conn.commit()
    res.status(201).json({ id: order.insertId, total: cents / 100, status: 'En attente' })
  } catch (error) {
    await conn.rollback()
    if (error.code === 'ER_DUP_ENTRY') {
      const [[existing]] = await pool.query('SELECT id, total, status, request_hash FROM orders WHERE user_id = ? AND request_key = ?', [req.auth.id, input.key])
      if (existing) return replay(res, existing, input.hash)
    }
    if (error.status) return res.status(error.status).json({ error: error.message, code: error.code })
    throw error
  } finally { conn.release() }
}))

r.get('/orders/mine', requireUser, wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT o.id, o.status, o.total, o.created_at,
    (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id) AS items
    FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC`, [req.auth.id])
  res.json(rows)
}))

// Recover a confirmed checkout after a lost response, even when it used the last item.
r.get('/orders/request/:key', requireUser, wrap(async (req, res) => {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(req.params.key)) return res.status(400).json({ error: 'Référence invalide.' })
  const [[order]] = await pool.query('SELECT id,total,status FROM orders WHERE user_id=? AND request_key=?', [req.auth.id, req.params.key])
  order ? res.json(order) : res.status(404).json({ error: 'Commande non confirmée.' })
}))

r.get('/orders/:id', requireSession, wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Référence invalide.' })
  const [[order]] = await pool.query(`SELECT o.id, o.status, o.total, o.shipping, o.payment_method, o.customer_name, o.phone, o.city, o.address, o.created_at
    FROM orders o WHERE o.id = ? ${req.auth.type === 'user' ? 'AND o.user_id = ?' : ''}`, req.auth.type === 'user' ? [req.params.id, req.auth.id] : [req.params.id])
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' })
  const [items] = await pool.query(`SELECT i.product_id, COALESCE(i.product_name,p.name) AS name, COALESCE(i.image,p.image) AS image,
    i.quantity, i.unit_price, i.size, i.color FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=? ORDER BY i.id`, [order.id])
  res.json({ ...order, items })
}))

r.get('/orders', requireAdmin, wrap(async (_req, res) => {
  const [rows] = await pool.query(`SELECT o.id, COALESCE(o.customer_name,u.name) AS client, o.status, o.total, o.created_at,
    (SELECT GROUP_CONCAT(COALESCE(i.product_name,p.name) SEPARATOR ', ') FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=o.id) AS product
    FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`)
  res.json(rows)
}))

r.patch('/orders/:id/status', requireAdmin, requireRole('principal'), wrap(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !['En attente', 'Expédiée', 'Livrée', 'Annulée'].includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide.' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[order]] = await conn.query('SELECT status FROM orders WHERE id=? FOR UPDATE', [req.params.id])
    if (!order) { await conn.rollback(); return res.status(404).json({ error: 'Commande introuvable.' }) }
    const next = { 'En attente': ['Expédiée', 'Annulée'], 'Expédiée': ['Livrée', 'Annulée'], 'Livrée': [], 'Annulée': [] }
    if (order.status !== req.body.status && !next[order.status].includes(req.body.status)) {
      await conn.rollback(); return res.status(409).json({ error: 'Transition impossible : actualisez la commande. Une commande livrée ou annulée est définitive.' })
    }
    if (req.body.status === 'Annulée' && order.status !== 'Annulée') {
      const [items] = await conn.query('SELECT product_id,SUM(quantity) AS quantity FROM order_items WHERE order_id=? GROUP BY product_id ORDER BY product_id', [req.params.id])
      for (const item of items) await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [item.quantity, item.product_id])
    }
    await conn.query('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id])
    await conn.commit(); res.json({ ok: true })
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}))

export default r
