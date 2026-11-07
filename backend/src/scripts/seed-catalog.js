import 'dotenv/config'
import { access } from 'node:fs/promises'
import { pool } from '../db.js'
import { demoCatalog } from './demo-catalog.js'

const photos = new Set(demoCatalog.flatMap(({ products }) => products.map(([, , photo]) => photo)))
try {
  await Promise.all([...photos].map((photo) => access(new URL(`../../uploads/demo/${photo}.webp`, import.meta.url))))
  const conn = await pool.getConnection()
  let inserted = 0
  try {
    await conn.beginTransaction()
    for (const group of demoCatalog) {
      await conn.query('INSERT IGNORE INTO categories (name) VALUES (?)', [group.category])
      const [[category]] = await conn.query('SELECT id FROM categories WHERE name = ?', [group.category])
      for (const [name, price, photo] of group.products) {
        const [[existing]] = await conn.query('SELECT id FROM products WHERE name = ? LIMIT 1', [name])
        if (!existing) {
          await conn.query('INSERT INTO products (name, price, category_id, image, stock) VALUES (?,?,?,?,20)', [name, price, category.id, `/uploads/demo/${photo}.webp`])
          inserted++
        }
      }
    }
    await conn.commit()
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
  const [[counts]] = await pool.query('SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM categories) AS categories')
  console.log(`Demo catalog ready: ${inserted} products added; ${counts.products} products, ${counts.categories} categories total.`)
} finally { await pool.end() }
