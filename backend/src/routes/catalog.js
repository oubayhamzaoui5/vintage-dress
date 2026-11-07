import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin, requireRole, wrap } from '../middleware/auth.js'
import { imageUpload, saveProductImage, removeProductImage } from '../uploads.js'

const r = Router()
const principal = [requireAdmin, requireRole('principal')]

const SELECT = `SELECT p.id, p.name, p.price, p.stock, p.image, c.name AS category, p.category_id
                FROM products p LEFT JOIN categories c ON c.id = p.category_id`

function validProduct(b) {
  const price = Number(b.price)
  const category_id = b.category_id ? Number(b.category_id) : null
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 150 || !['string', 'number'].includes(typeof b.price) || String(b.price).trim() === '' || !Number.isFinite(price) || price < 0 || price > 99999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) return null
  if (category_id !== null && (!Number.isInteger(category_id) || category_id < 1)) return null
  if (b.stock !== undefined && (!['string', 'number'].includes(typeof b.stock) || String(b.stock).trim() === '' || !Number.isSafeInteger(Number(b.stock)) || Number(b.stock) < 0 || Number(b.stock) > 1000000)) return null
  return { name: b.name.trim(), price, category_id, ...(b.stock !== undefined ? { stock: Number(b.stock) } : {}) }
}

async function categoryExists(id) {
  if (!id) return true
  const [[category]] = await pool.query('SELECT id FROM categories WHERE id = ?', [id])
  return !!category
}

// Public
r.get('/products', wrap(async (_req, res) => {
  const [rows] = await pool.query(`${SELECT} ORDER BY p.id DESC`)
  res.json(rows)
}))
r.get('/categories', wrap(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT c.id, c.name, COUNT(p.id) AS products FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name')
  res.json(rows)
}))

// Administrateur principal uniquement
r.post('/products', ...principal, imageUpload, wrap(async (req, res) => {
  const p = validProduct(req.body)
  if (!p) return res.status(400).json({ error: 'Nom, prix (2 décimales maximum) et stock entier valides requis.' })
  if (!(await categoryExists(p.category_id))) return res.status(400).json({ error: 'Catégorie introuvable.' })
  if (!req.file) return res.status(400).json({ error: 'Ajoutez une photo de la robe.' })
  p.stock ??= 1
  p.image = await saveProductImage(req.file)
  try {
    const [ins] = await pool.query('INSERT INTO products SET ?', [p])
    res.status(201).json({ id: ins.insertId, ...p })
  } catch (error) { await removeProductImage(p.image); throw error }
}))
r.put('/products/:id', ...principal, imageUpload, wrap(async (req, res) => {
  const p = validProduct(req.body)
  if (!p) return res.status(400).json({ error: 'Nom, prix (2 décimales maximum) et stock entier valides requis.' })
  const [[existing]] = await pool.query('SELECT image FROM products WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Produit introuvable.' })
  if (!(await categoryExists(p.category_id))) return res.status(400).json({ error: 'Catégorie introuvable.' })
  const newImage = await saveProductImage(req.file)
  p.image = newImage || existing.image
  try {
    await pool.query('UPDATE products SET ? WHERE id = ?', [p, req.params.id])
  } catch (error) { await removeProductImage(newImage); throw error }
  if (newImage) await removeProductImage(existing.image)
  res.json({ id: +req.params.id, ...p })
}))
r.delete('/products/:id', ...principal, wrap(async (req, res) => {
  try {
    const [[existing]] = await pool.query('SELECT image FROM products WHERE id = ?', [req.params.id])
    const [d] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id])
    if (d.affectedRows) await removeProductImage(existing?.image)
    d.affectedRows ? res.status(204).end() : res.status(404).json({ error: 'Produit introuvable.' })
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'Produit déjà commandé : suppression impossible.' })
    throw e
  }
}))
r.post('/categories', ...principal, wrap(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  if (!name || name.length > 80) return res.status(400).json({ error: 'Nom requis, 80 caractères maximum.' })
  try {
    const [ins] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name])
    res.status(201).json({ id: ins.insertId, name })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Catégorie déjà existante.' })
    throw e
  }
}))

r.put('/categories/:id', ...principal, wrap(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  if (!/^[1-9]\d*$/.test(req.params.id) || !name || name.length > 80) return res.status(400).json({ error: 'Nom requis, 80 caractères maximum.' })
  try {
    const [updated] = await pool.query('UPDATE categories SET name=? WHERE id=?', [name, req.params.id])
    updated.affectedRows ? res.json({ id: +req.params.id, name }) : res.status(404).json({ error: 'Catégorie introuvable.' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Catégorie déjà existante.' })
    throw error
  }
}))
r.delete('/categories/:id', ...principal, wrap(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Catégorie invalide.' })
  try {
    // Atomic check protects categories still assigned to products.
    const [deleted] = await pool.query('DELETE FROM categories WHERE id=? AND NOT EXISTS (SELECT 1 FROM products WHERE category_id=?)', [req.params.id, req.params.id])
    if (deleted.affectedRows) return res.status(204).end()
    const [[category]] = await pool.query('SELECT id FROM categories WHERE id=?', [req.params.id])
    res.status(category ? 409 : 404).json({ error: category ? 'Réaffectez les robes avant de supprimer cette catégorie.' : 'Catégorie introuvable.' })
  } catch (error) {
    if (['ER_ROW_IS_REFERENCED_2', 'ER_LOCK_DEADLOCK'].includes(error.code)) return res.status(409).json({ error: 'Catégorie utilisée. Actualisez la liste.' })
    throw error
  }
}))

export default r
