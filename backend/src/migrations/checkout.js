// Additive migration: preserve existing orders and their line items.
import { pool } from '../db.js'

export async function migrateCheckout() {
  const conn = await pool.getConnection()
  let locked = false
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK('vintage_dress_checkout_schema', 10) AS acquired")
    if (!lock.acquired) throw new Error('Checkout schema migration is already running. Retry shortly.')
    locked = true
    const definitions = {
      orders: {
        customer_name: 'VARCHAR(100) NULL', phone: 'VARCHAR(30) NULL', city: 'VARCHAR(80) NULL', address: 'VARCHAR(500) NULL',
        shipping: 'DECIMAL(10,2) NOT NULL DEFAULT 8', payment_method: "VARCHAR(40) NOT NULL DEFAULT 'Paiement à la livraison'",
        request_key: 'CHAR(36) NULL', request_hash: 'CHAR(64) NULL',
      },
      order_items: { product_name: 'VARCHAR(150) NULL', image: 'VARCHAR(500) NULL' },
    }
    for (const [table, columns] of Object.entries(definitions)) {
      const [existing] = await conn.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table])
      const names = new Set(existing.map((column) => column.name))
      for (const [name, definition] of Object.entries(columns)) if (!names.has(name)) await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
    }
    const [indexes] = await conn.query("SHOW INDEX FROM orders WHERE Key_name = 'orders_user_request_unique'")
    if (!indexes.length) await conn.query('ALTER TABLE orders ADD UNIQUE INDEX orders_user_request_unique (user_id, request_key)')
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('vintage_dress_checkout_schema')")
    conn.release()
  }
}
