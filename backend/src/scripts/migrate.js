import 'dotenv/config'
import { pool } from '../db.js'
import { migrateCheckout } from '../migrations/checkout.js'
import { migrateAccount } from '../migrations/account.js'
try { await migrateCheckout(); await migrateAccount(); console.log('Checkout/account schema ready. Existing records preserved.') }
finally { await pool.end() }
