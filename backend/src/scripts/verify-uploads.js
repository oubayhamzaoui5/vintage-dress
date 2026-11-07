import 'dotenv/config'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { pool } from '../db.js'
import { sign } from '../middleware/auth.js'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { uploadsDirectory } from '../uploads.js'
import { demoCatalog } from './demo-catalog.js'

const base = 'http://127.0.0.1:5000'
const call = (path, options) => fetch(base + '/api' + path, options)
const png = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#8f2f40' } }).png().toBuffer()
const login = await call('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) })
assert.equal(login.status, 200)
const { token } = await login.json()
const headers = { Authorization: `Bearer ${token}` }
function form(buffer = png, type = 'image/png', name = 'photo.png', fields = {}) {
  const body = new FormData()
  body.set('name', 'Vérification temporaire des photos')
  body.set('price', '85')
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  if (buffer) body.set('image', new Blob([buffer], { type }), name)
  return body
}
const request = (body, auth = headers) => call('/products', { method: 'POST', headers: auth, body })
let created
let secondaryId
try {
  assert.equal((await request(form(), {})).status, 401)
  const [secondaryRow] = await pool.query("INSERT INTO admins (name,email,password_hash,role) VALUES (?,?,?,'secondaire')", ['Vérification upload', `upload-${randomUUID()}@example.test`, await bcrypt.hash(randomUUID(), 4)])
  secondaryId = secondaryRow.insertId
  const secondary = { Authorization: `Bearer ${sign({ id: secondaryId, type: 'admin', role: 'secondaire' })}` }
  assert.equal((await request(form(), secondary)).status, 403)
  assert.equal((await request(form(null))).status, 400)
  assert.equal((await request(form(Buffer.from('not an image'), 'image/jpeg', 'fake.jpg'))).status, 400)
  assert.equal((await request(form(Buffer.from('<svg/>'), 'image/svg+xml', 'photo.svg'))).status, 400)
  assert.equal((await request(form(Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 400)
  assert.equal((await request(form(png, 'image/png', 'photo.png', { category_id: '999999' }))).status, 400)
  const response = await request(form())
  assert.equal(response.status, 201)
  created = await response.json()
  assert.match(created.image, /^\/uploads\/products\/[a-f0-9-]+\.webp$/)
  const image = await fetch(base + created.image)
  assert.equal(image.status, 200)
  assert.match(image.headers.get('content-type'), /image\/webp/)
  assert.equal(image.headers.get('cross-origin-resource-policy'), 'cross-origin')
  assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format, 'webp')
  const update = await call(`/products/${created.id}`, { method: 'PUT', headers, body: form(null, '', '', { price: '90' }) })
  assert.equal(update.status, 200)
  assert.equal((await update.json()).image, created.image, 'Editing without a file must preserve photo')
  const oldImage = created.image
  const replacement = await call(`/products/${created.id}`, { method: 'PUT', headers, body: form() })
  assert.equal(replacement.status, 200)
  const replaced = await replacement.json()
  assert.notEqual(replaced.image, oldImage)
  created.image = replaced.image
  assert.equal((await fetch(base + oldImage)).status, 404, 'Replaced upload must be removed')
  const deletion = await call(`/products/${created.id}`, { method: 'DELETE', headers })
  assert.equal(deletion.status, 204)
  assert.equal((await fetch(base + created.image)).status, 404, 'Deleted product upload must be removed')
  await assert.rejects(access(resolve(uploadsDirectory, 'products', created.image.split('/').at(-1))))
  created = null
  const [categories] = await pool.query('SELECT c.name, COUNT(p.id) AS products FROM categories c LEFT JOIN products p ON p.category_id=c.id WHERE c.name IN (?) GROUP BY c.id ORDER BY c.name', [demoCatalog.map((c) => c.category)])
  assert.equal(categories.length, 6)
  assert.ok(categories.every((c) => c.products >= 6))
  console.log('PASS: authorization, 5 MB limit, file validation, create, preserve, replace, delete, file cleanup, 36 products / 6 categories.')
} finally {
  if (created) await call(`/products/${created.id}`, { method: 'DELETE', headers })
  if (secondaryId) await pool.query('DELETE FROM admins WHERE id = ?', [secondaryId])
  await pool.end()
}
