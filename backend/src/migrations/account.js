import { pool } from '../db.js'

export async function migrateAccount() {
  const [stock] = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='stock'")
  if (!stock.length) await pool.query('ALTER TABLE products ADD COLUMN stock INT NOT NULL DEFAULT 20 CHECK (stock >= 0)')
  await pool.query(`CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL, phone VARCHAR(30) NOT NULL,
    city VARCHAR(80) NOT NULL, address VARCHAR(500) NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`)
  await pool.query(`CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL, product_id INT NOT NULL, PRIMARY KEY(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE)`)
  await pool.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INT PRIMARY KEY, orders TINYINT(1) NOT NULL DEFAULT 1,
    offers TINYINT(1) NOT NULL DEFAULT 0, news TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`)
}
