import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { pool } from '../db.js'
import { sign } from '../middleware/auth.js'
import { removeProductImage } from '../uploads.js'

const base = 'http://127.0.0.1:5000'
const tag = randomUUID()
const users = [], products = [], categories = [], images = []
let secondaryId, messageId
async function request(path, { token, method = 'GET', body } = {}, status = 200) {
  const multipart = body instanceof FormData
  const response = await fetch(base + '/api' + path, { method, headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? multipart ? body : JSON.stringify(body) : undefined })
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`)
  return response.status === 204 ? null : response.json()
}
try {
  const admin = await request('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })
  for (let i = 0; i < 2; i++) {
    const [saved] = await pool.query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', ['MVP verification', `mvp-${tag}-${i}@example.test`, 'unused-fixture-hash'])
    users.push({ id: saved.insertId, token: sign({ id: saved.insertId, type: 'user' }) })
  }
  const [secondary] = await pool.query("INSERT INTO admins (name,email,password_hash,role) VALUES (?,?,?,'secondaire')", ['MVP verification', `mvp-${tag}@example.test`, 'unused-fixture-hash'])
  secondaryId = secondary.insertId
  const secondaryToken = sign({ id: secondaryId, type: 'admin' })
  const token = users[0].token
  const other = users[1].token
  await request('/account/addresses', {}, 401)
  await request('/account/addresses', { token: admin.token }, 401)
  const address = { name: 'Client test', phone: '20123456', city: 'Tunis', address: '12 rue de démonstration' }
  await request('/account/addresses', { token, method: 'POST', body: { ...address, address: '' } }, 400)
  const first = await request('/account/addresses', { token, method: 'POST', body: address }, 201)
  const second = await request('/account/addresses', { token, method: 'POST', body: { ...address, city: 'Sousse' } }, 201)
  assert.equal(first.is_default, true); assert.equal(second.is_default, false)
  await request(`/account/addresses/${first.id}/default`, { token: other, method: 'PATCH' }, 404)
  await request(`/account/addresses/${first.id}`, { token: other, method: 'DELETE' }, 404)
  await request(`/account/addresses/${second.id}/default`, { token, method: 'PATCH' }, 204)
  let rows = await request('/account/addresses', { token })
  assert.equal(rows.filter((row) => row.is_default).length, 1); assert.equal(rows[0].id, second.id)
  await request(`/account/addresses/${second.id}`, { token, method: 'DELETE' }, 204)
  rows = await request('/account/addresses', { token }); assert.equal(rows[0].id, first.id); assert.equal(rows[0].is_default, 1)
  assert.deepEqual(await request('/account/addresses', { token: other }), [])
  assert.deepEqual(await request('/account/preferences', { token }), { orders: true, offers: false, news: true })
  const preferences = { orders: false, offers: true, news: false }
  await request('/account/preferences', { token, method: 'PATCH', body: preferences })
  assert.deepEqual(await request('/account/preferences', { token }), preferences)
  await request('/account/preferences', { token, method: 'PATCH', body: { ...preferences, orders: 'false' } }, 400)
  assert.equal((await request('/account/preferences', { token: other })).orders, true)
  for (const name of [123, {}, 'x'.repeat(81)]) await request('/categories', { token: admin.token, method: 'POST', body: { name } }, 400)
  await request('/categories', { token: secondaryToken, method: 'POST', body: { name: tag } }, 403)
  const category = await request('/categories', { token: admin.token, method: 'POST', body: { name: `MVP ${tag}` } }, 201)
  categories.push(category.id)
  await request(`/categories/${category.id}`, { token: admin.token, method: 'PUT', body: { name: `Renommée ${tag}` } })
  assert.ok((await request('/categories')).some((row) => row.id === category.id && row.name === `Renommée ${tag}`))
  const png = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#8f2f40' } }).png().toBuffer()
  function form(stock = '1', price = '29.95') {
    const f = new FormData()
    f.set('name', `MVP robe ${tag}`); f.set('price', price); f.set('category_id', String(category.id)); f.set('stock', stock)
    f.set('image', new Blob([png], { type: 'image/png' }), 'test.png'); return f
  }
  await request('/products', { token: admin.token, method: 'POST', body: form('-1') }, 400)
  await request('/products', { token: admin.token, method: 'POST', body: form('1.5') }, 400)
  await request('/products', { token: admin.token, method: 'POST', body: form('1', '29.951') }, 400)
  const product = await request('/products', { token: admin.token, method: 'POST', body: form() }, 201)
  products.push(product.id); images.push(product.image)
  await request(`/categories/${category.id}`, { token: admin.token, method: 'DELETE' }, 409)
  for (let i = 0; i < 2; i++) await request(`/account/favorites/${product.id}`, { token, method: 'PUT' }, 204)
  assert.equal((await request('/account/favorites', { token })).length, 1)
  assert.equal((await request('/account/favorites', { token: other })).length, 0)
  await request(`/account/favorites/${product.id}`, { token, method: 'DELETE' }, 204)
  assert.deepEqual(await request('/account/favorites', { token }), [])
  await request('/account/favorites/2147483647', { token, method: 'PUT' }, 404)
  const payload = { delivery: address, items: [{ product_id: product.id, quantity: 1, size: 'M', color: 'Modèle présenté' }], payment_method: 'cash_on_delivery', expected_total: 37.95, request_key: randomUUID() }
  const concurrent = await Promise.all(users.map((user) => fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ ...payload, request_key: randomUUID() }) })))
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409], 'Only one customer can buy last item')
  const successIndex = concurrent.findIndex((r) => r.status === 201)
  const order = await concurrent[successIndex].json()
  const statsBeforeCancel = await request('/admin/stats', { token: admin.token })
  const [[stock]] = await pool.query('SELECT stock FROM products WHERE id=?', [product.id]); assert.equal(stock.stock, 0)
  await request(`/orders/${order.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Livrée' } }, 409)
  await request(`/orders/${order.id}/status`, { token: secondaryToken, method: 'PATCH', body: { status: 'Annulée' } }, 403)
  const updated = await request(`/products/${product.id}`, { token: admin.token, method: 'PUT', body: form('0') })
  images.push(updated.image)
  assert.equal((await fetch(base + product.image)).status, 200, 'Historical order image must survive replacement')
  for (let i = 0; i < 2; i++) await request(`/orders/${order.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Annulée' } })
  const [[restored]] = await pool.query('SELECT stock FROM products WHERE id=?', [product.id]); assert.equal(restored.stock, 1, 'Cancellation restores stock exactly once')
  await request(`/orders/${order.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Expédiée' } }, 409)
  const afterCancel = await request('/admin/stats', { token: admin.token }); assert.equal(afterCancel.revenue, statsBeforeCancel.revenue, 'Pending/cancelled orders are not revenue')
  const deliveryPayload = { ...payload, request_key: randomUUID() }
  const delivered = await request('/orders', { token, method: 'POST', body: deliveryPayload }, 201)
  assert.equal((await request(`/orders/request/${deliveryPayload.request_key}`, { token })).id, delivered.id)
  await request(`/orders/request/${deliveryPayload.request_key}`, { token: other }, 404)
  await request(`/orders/request/${deliveryPayload.request_key}`, {}, 401)
  await request(`/orders/${delivered.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Expédiée' } })
  await request(`/orders/${delivered.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Livrée' } })
  assert.equal((await request('/admin/stats', { token: admin.token })).revenue, Math.round((Number(afterCancel.revenue) + 37.95) * 100) / 100)
  await request(`/orders/${delivered.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'Annulée' } }, 409)
  await request('/orders', { token, method: 'POST', body: deliveryPayload }, 200) // Retry works after stock reaches zero.
  messageId = (await request('/messages', { method: 'POST', body: { name: 'MVP test', email: `mvp-${tag}@example.test`, message: 'Contact workflow verification' } }, 201)).id
  assert.ok((await request('/admin/messages', { token: secondaryToken })).some((message) => message.id === messageId))
  await request('/admin/messages', { token }, 401)
  await request(`/admin/users/${users[1].id}/block`, { token: admin.token, method: 'PATCH', body: { blocked: 'false' } }, 400)
  await request(`/admin/users/${users[1].id}/block`, { token: admin.token, method: 'PATCH', body: { blocked: true } })
  await request('/account/favorites', { token: other }, 403)
  for (const user of users) await pool.query('DELETE FROM orders WHERE user_id=?', [user.id])
  await request(`/products/${product.id}`, { token: admin.token, method: 'DELETE' }, 204)
  await request(`/categories/${category.id}`, { token: admin.token, method: 'DELETE' }, 204)
  console.log('PASS: saved addresses/default/privacy, favorites/idempotency, persisted preferences, category CRUD/validation, stock concurrency, cancellation/restock, order transitions/revenue, historical photos, contact inbox and blocked sessions.')
} finally {
  for (const user of users) { await pool.query('DELETE FROM orders WHERE user_id=?', [user.id]); await pool.query('DELETE FROM users WHERE id=?', [user.id]) }
  for (const id of products) await pool.query('DELETE FROM products WHERE id=?', [id])
  for (const id of categories) await pool.query('DELETE FROM categories WHERE id=?', [id])
  if (secondaryId) await pool.query('DELETE FROM admins WHERE id=?', [secondaryId])
  if (messageId) await pool.query('DELETE FROM messages WHERE id=?', [messageId])
  for (const image of images) await removeProductImage(image)
  await pool.end()
}
