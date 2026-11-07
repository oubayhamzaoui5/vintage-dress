import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const secret = () => randomBytes(32).toString('hex')
const writeMissing = (path, content) => {
  const target = resolve(root, path)
  if (!existsSync(target)) { writeFileSync(target, content); console.log(`Created ${path}`) }
  else console.log(`Keeping existing ${path}`)
}
writeMissing('.env', `MYSQL_ROOT_PASSWORD=${secret()}\nMYSQL_PASSWORD=${secret()}\n`)
const dbPassword = readFileSync(resolve(root, '.env'), 'utf8').match(/^MYSQL_PASSWORD=(.+)$/m)?.[1]?.trim()
if (!dbPassword) throw new Error('Set MYSQL_PASSWORD in root .env before running setup.')
writeMissing('backend/.env', `PORT=5000\nHOST=127.0.0.1\nCLIENT_URL=http://localhost:5173\nDB_HOST=127.0.0.1\nDB_PORT=3307\nDB_USER=vintage\nDB_PASSWORD=${dbPassword}\nDB_NAME=vintage_dress\nJWT_SECRET=${secret()}\nADMIN_NAME=Rania Attia\nADMIN_EMAIL=admin@admin.com\nADMIN_PASSWORD=azerty123\n`)
writeMissing('frontend/.env', 'VITE_API_URL=http://127.0.0.1:5000/api\n')
console.log('Local configuration ready. Admin credentials: backend/.env')
