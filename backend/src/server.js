import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import auth from './routes/auth.js'
import catalog from './routes/catalog.js'
import orders from './routes/orders.js'
import admin from './routes/admin.js'
import account from './routes/account.js'
import { uploadsDirectory } from './uploads.js'
import multer from 'multer'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET manquant ou trop court (32 caractères min.). Voir .env.example')
  process.exit(1)
}

const app = express()
app.use(helmet())
app.use(cors({ origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '100kb' }))
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static(uploadsDirectory, { dotfiles: 'deny', index: false, maxAge: '1d' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api', auth, catalog, orders, admin, account)

app.use((_req, res) => res.status(404).json({ error: 'Route introuvable.' }))
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop volumineuse : 5 Mo maximum.' : 'Envoi invalide. Choisissez une seule photo (5 Mo maximum).' })
  if (err.status === 400) return res.status(400).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur.' })
})

app.listen(process.env.PORT || 5000, process.env.HOST || '127.0.0.1', () => console.log(`API sur http://localhost:${process.env.PORT || 5000}`))
