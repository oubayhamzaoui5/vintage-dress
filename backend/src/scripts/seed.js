// Crée l'administrateur principal à partir du .env.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
const demoLogin = ADMIN_EMAIL === 'admin@admin.com' && ADMIN_PASSWORD === 'azerty123'
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || (!demoLogin && ADMIN_PASSWORD.length < 10)) {
  console.error('Renseignez ADMIN_NAME, ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères min.) dans .env')
  process.exit(1)
}
const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)
await pool.query(
  `INSERT INTO admins (name, email, password_hash, role) VALUES (?,?,?, 'principal')
   ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'principal'`,
  [ADMIN_NAME, ADMIN_EMAIL, hash])
console.log(`Administrateur principal prêt : ${ADMIN_EMAIL}`)
await pool.end()
