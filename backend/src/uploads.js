import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import multer from 'multer'
import sharp from 'sharp'
import { pool } from './db.js'

export const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url))
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 4, fieldSize: 1024 },
  fileFilter: (_req, file, next) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      return next(Object.assign(new Error('Choisissez une image JPEG, PNG ou WebP.'), { status: 400 }))
    next(null, true)
  },
}).single('image')

export async function saveProductImage(file) {
  if (!file) return null
  let output
  try {
    const image = sharp(file.buffer, { limitInputPixels: 30000000, animated: false })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('format')
    output = await image.rotate().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
  } catch {
    throw Object.assign(new Error('Image invalide. Utilisez une photo JPEG, PNG ou WebP non animée (30 mégapixels maximum).'), { status: 400 })
  }
  const directory = resolve(uploadsDirectory, 'products')
  await mkdir(directory, { recursive: true })
  const name = `${randomUUID()}.webp`
  const { writeFile } = await import('node:fs/promises')
  await writeFile(resolve(directory, name), output, { flag: 'wx' })
  return `/uploads/products/${name}`
}

export async function removeProductImage(image) {
  if (!/^\/uploads\/products\/[a-f0-9-]+\.webp$/.test(image || '')) return
  const [[used]] = await pool.query('SELECT id FROM order_items WHERE image=? LIMIT 1', [image])
  if (used) return // Keep historical order photos after a catalog image replacement.
  await unlink(resolve(uploadsDirectory, 'products', image.split('/').at(-1))).catch((error) => {
    if (error.code !== 'ENOENT') console.error('Image cleanup failed:', error.code)
  })
}
