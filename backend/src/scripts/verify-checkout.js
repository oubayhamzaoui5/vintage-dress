import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'
import { afterLogin } from '../../../frontend/src/utils/checkout.js'

const suffix = randomUUID()
const ids = []
let productId
const call = (path, { method = 'GET', body, token } = {}) => fetch('http://127.0.0.1:5000/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
async function expect(path, options, status) {
  const response = await call(path, options)
  assert.equal(response.status, status, `${options?.method || 'GET'} ${path}`)
  return response
}
try {
  const customers = []
  for (let i = 0; i < 2; i++) {
    const response = await expect('/auth/register', { method: 'POST', body: { name: 'Vérification commande', email: `checkout-${suffix}-${i}@example.test`, password: `Checkout-${suffix}` } }, 201)
    const session = await response.json()
    ids.push(session.user.id); customers.push(session)
  }
  const admin = await (await expect('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } }, 200)).json()
  const [product] = await pool.query('INSERT INTO products (name, price, image) VALUES (?,?,?)', ['Robe test commande', 79.5, '/uploads/demo/8091678.webp'])
  productId = product.insertId
  const body = { items: [{ product_id: productId, quantity: 2, size: 'M', color: 'Modèle présenté' }], delivery: { name: 'Client de vérification', phone: '20123456', city: 'Tunis', address: '12 rue de démonstration, appartement 2' }, payment_method: 'cash_on_delivery', expected_total: 167, request_key: randomUUID() }
  const post = (payload = body, token = customers[0].token) => ({ method: 'POST', token, body: payload })
  await expect('/orders', { method: 'POST', body }, 401)
  await expect('/orders', post(body, admin.token), 401)
  await expect('/orders', post({ ...body, items: [] }), 400)
  await expect('/orders', post({ ...body, delivery: { ...body.delivery, address: '' } }), 400)
  await expect('/orders', post({ ...body, items: [{ ...body.items[0], quantity: 1.5 }] }), 400)
  await expect('/orders', post({ ...body, items: [{ ...body.items[0], quantity: '2cats' }] }), 400)
  await expect('/orders', post({ ...body, items: [{ ...body.items[0], quantity: 11 }, { ...body.items[0], quantity: 10, size: 'L' }] }), 400)
  await expect('/orders', post({ ...body, items: [{ ...body.items[0], size: 'INVALID' }] }), 400)
  await expect('/orders', post({ ...body, payment_method: 'card' }), 400)
  const repriced = await expect('/orders', post({ ...body, expected_total: 1, items: [{ ...body.items[0], price: 0.01 }] }), 409)
  assert.equal((await repriced.json()).code, 'PRICE_CHANGED')
  await expect('/orders', post({ ...body, items: [...body.items, { product_id: 2147483647, quantity: 1 }] }), 400)
  const [[before]] = await pool.query('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?', [ids[0]])
  assert.equal(before.count, 0, 'Invalid checkout must not leave partial orders')
  const concurrent = await Promise.all([call('/orders', post()), call('/orders', post())])
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 201])
  const results = await Promise.all(concurrent.map((response) => response.json()))
  assert.equal(results[0].id, results[1].id, 'Concurrent retries must return the same order')
  const orderId = results[0].id
  const [[count]] = await pool.query('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?', [ids[0]])
  assert.equal(count.count, 1)
  const detail = await (await expect(`/orders/${orderId}`, { token: customers[0].token }, 200)).json()
  assert.equal(detail.total, 167)
  assert.equal(detail.shipping, 8)
  assert.equal(detail.address, body.delivery.address)
  assert.equal(detail.payment_method, 'Paiement à la livraison')
  assert.equal(detail.items[0].quantity, 2)
  assert.equal(detail.items[0].unit_price, 79.5)
  const mine = await (await expect('/orders/mine', { token: customers[0].token }, 200)).json()
  assert.ok(mine.some((order) => order.id === orderId))
  await expect(`/orders/${orderId}`, { token: customers[1].token }, 404)
  await expect(`/orders/${orderId}`, {}, 401)
  await expect('/orders', { token: customers[0].token }, 401)
  const adminOrders = await (await expect('/orders', { token: admin.token }, 200)).json()
  assert.ok(adminOrders.some((order) => order.id === orderId))
  await expect(`/orders/${orderId}`, { token: admin.token }, 200)
  await expect(`/orders/${orderId}/status`, { method: 'PATCH', token: customers[0].token, body: { status: 'Livrée' } }, 401)
  await expect(`/orders/${orderId}/status`, { method: 'PATCH', token: admin.token, body: { status: 'Expédiée' } }, 200)
  assert.equal((await (await expect(`/orders/${orderId}`, { token: customers[0].token }, 200)).json()).status, 'Expédiée')
  const reused = await expect('/orders', post({ ...body, delivery: { ...body.delivery, address: 'Autre adresse' } }), 409)
  assert.equal((await reused.json()).code, 'REQUEST_REUSED')
  await pool.query('UPDATE products SET name=?, price=? WHERE id=?', ['Robe test modifiée', 99, productId])
  const replay = await expect('/orders', post(), 200)
  assert.equal((await replay.json()).id, orderId)
  const snapshot = await (await expect(`/orders/${orderId}`, { token: customers[0].token }, 200)).json()
  assert.equal(snapshot.items[0].name, 'Robe test commande')
  assert.equal(snapshot.items[0].unit_price, 79.5)
  await expect('/orders', post({ ...body, request_key: randomUUID() }), 409)
  assert.equal(afterLogin('user', { from: '/commande' }), '/commande')
  assert.equal(afterLogin('admin', { from: '/commande' }), '/admin')
  assert.equal(afterLogin('user', { from: 'https://example.com' }), '/compte')
  console.log('PASS: guest/admin rejection, delivery/cart validation, authoritative pricing, rollback, concurrent idempotency, customer history/privacy, admin details/status, immutable order snapshots, safe login return.')
} finally {
  const [remaining] = await pool.query('SELECT id FROM users WHERE email IN (?,?)', [`checkout-${suffix}-0@example.test`, `checkout-${suffix}-1@example.test`])
  for (const id of new Set([...ids, ...remaining.map((user) => user.id)])) { await pool.query('DELETE FROM orders WHERE user_id = ?', [id]); await pool.query('DELETE FROM users WHERE id = ?', [id]) }
  if (productId) await pool.query('DELETE FROM products WHERE id = ?', [productId])
  await pool.end()
}
