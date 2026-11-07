import { createHash } from 'node:crypto'
import { setDefaultResultOrder } from 'node:dns'
import { setDefaultAutoSelectFamily } from 'node:net'
import { createWriteStream, createReadStream } from 'node:fs'
import { mkdir, access, readFile, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

// This PC has intermittent IPv6 connectivity. Keep download traffic on IPv4.
setDefaultResultOrder('ipv4first')
setDefaultAutoSelectFamily(false)

const root = fileURLToPath(new URL('../', import.meta.url))
const local = resolve(root, '.local')
const version = '11.4.13'
const archive = `mariadb-${version}-winx64.zip`
const downloadBase = `https://archive.mariadb.org/mariadb-${version}/winx64-packages/`
// Official sha256sums.txt for this exact Windows ZIP, pinned for reproducible setup.
const checksum = 'd62986d433eeebfde218560b276103831604a61e929e87f1a17f5aebd80257e2'
const base = resolve(local, `mariadb-${version}-winx64`)
const data = resolve(local, 'mysql-data')
const exists = async (path) => access(path).then(() => true, () => false)
const settings = dotenv.parse(await readFile(resolve(root, '.env')))
const backend = dotenv.parse(await readFile(resolve(root, 'backend/.env')))
const port = Number(backend.DB_PORT || 3307)
if (backend.DB_HOST !== '127.0.0.1' || backend.DB_NAME !== 'vintage_dress' || backend.DB_USER !== 'vintage') {
  throw new Error('Portable setup requires DB_HOST=127.0.0.1, DB_USER=vintage and DB_NAME=vintage_dress in backend/.env.')
}
if (!settings.MYSQL_ROOT_PASSWORD || !backend.DB_PASSWORD) throw new Error('Run npm run setup first.')
const connectionOptions = { host: '127.0.0.1', port, user: 'root', password: settings.MYSQL_ROOT_PASSWORD, connectTimeout: 1500 }
const command = process.argv[2] || 'start'
async function download(url, timeout = 30000) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (error) {
      if (attempt === 3) throw error
      console.log(`Download connection failed; retry ${attempt}/2…`)
    }
  }
}
const run = (exe, args, options = {}) => new Promise((resolvePromise, reject) => {
  const child = spawn(exe, args, { windowsHide: true, stdio: 'inherit', ...options })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`Database helper exited with code ${code}`)))
})
async function connect() { return mysql.createConnection(connectionOptions) }
async function install() {
  if (process.platform !== 'win32') throw new Error('Portable database launcher supports Windows only.')
  if (await exists(resolve(base, 'bin/mariadbd.exe'))) return
  await mkdir(local, { recursive: true })
  const zip = resolve(local, archive)
  if (!(await exists(zip))) {
    console.log(`Downloading official MariaDB ${version} Windows ZIP (91 MB)…`)
    const response = await download(downloadBase + archive, 300000)
    if (!response.ok) throw new Error(`Database download failed: ${response.status}`)
    const partial = zip + '.partial'
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
    const { rename } = await import('node:fs/promises')
    await rename(partial, zip)
  }
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(zip)) hash.update(chunk)
  if (hash.digest('hex') !== checksum.toLowerCase()) throw new Error('Archive SHA256 mismatch; remove the local ZIP and retry.')
  console.log('SHA256 verified. Extracting portable database…')
  await run('tar.exe', ['-xf', zip, '-C', local])
}
async function initialize() {
  if (await exists(resolve(data, 'mysql'))) return
  console.log('Initializing local database files…')
  await run(resolve(base, 'bin/mariadb-install-db.exe'), [`--datadir=${data}`, `--password=${settings.MYSQL_ROOT_PASSWORD}`, `--port=${port}`])
}
async function configure(conn) {
  await conn.query('CREATE DATABASE IF NOT EXISTS vintage_dress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
  const [[{ tables }]] = await conn.query("SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='vintage_dress'")
  if (tables === 0) {
    const schema = await readFile(resolve(root, 'backend/schema.sql'), 'utf8')
    for (const statement of schema.split(';').map((s) => s.trim()).filter(Boolean)) await conn.query(statement)
    console.log('Imported project schema.')
  } else {
    const [existing] = await conn.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='vintage_dress'")
    const names = new Set(existing.map((table) => table.name))
    if (['admins', 'users', 'categories', 'products', 'orders', 'order_items', 'messages'].some((name) => !names.has(name))) {
      throw new Error('Existing schema is incomplete; refusing to overwrite database files.')
    }
  }
  await conn.query("CREATE USER IF NOT EXISTS 'vintage'@'127.0.0.1' IDENTIFIED BY ?", [backend.DB_PASSWORD])
  await conn.query("ALTER USER 'vintage'@'127.0.0.1' IDENTIFIED BY ?", [backend.DB_PASSWORD])
  await conn.query("GRANT ALL PRIVILEGES ON vintage_dress.* TO 'vintage'@'127.0.0.1'")
  // Keep both local connection forms usable; Windows may identify loopback as localhost.
  await conn.query("CREATE USER IF NOT EXISTS 'vintage'@'localhost' IDENTIFIED BY ?", [backend.DB_PASSWORD])
  await conn.query("ALTER USER 'vintage'@'localhost' IDENTIFIED BY ?", [backend.DB_PASSWORD])
  await conn.query("GRANT ALL PRIVILEGES ON vintage_dress.* TO 'vintage'@'localhost'")
}
if (command === 'stop') {
  const conn = await connect()
  try { await conn.query('SHUTDOWN') } finally { await conn.end() }
  console.log('Local database stopped. Data preserved.')
} else if (command === 'start') {
  await install()
  await initialize()
  let conn
  try { conn = await connect() } catch (err) {
    if (err.code !== 'ECONNREFUSED') throw err
    const log = await open(resolve(local, 'mysql.log'), 'a')
    const child = spawn(resolve(base, 'bin/mariadbd.exe'), [
      '--no-defaults', `--basedir=${base}`, `--datadir=${data}`, `--port=${port}`,
      '--bind-address=127.0.0.1', '--skip-name-resolve', '--character-set-server=utf8mb4',
      '--collation-server=utf8mb4_unicode_ci', '--console',
    ], { cwd: base, windowsHide: true, detached: true, stdio: ['ignore', log.fd, log.fd] })
    await new Promise((resolvePromise, reject) => { child.once('spawn', resolvePromise); child.once('error', reject) })
    await writeFile(resolve(local, 'mysql.pid'), String(child.pid))
    child.unref()
    await log.close()
    for (let attempt = 0; attempt < 40; attempt++) {
      try { conn = await connect(); break } catch (error) {
        if (error.code !== 'ECONNREFUSED') throw error
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    if (!conn) throw new Error('Database did not start. See .local/mysql.log.')
  }
  try { await configure(conn) } finally { await conn.end() }
  console.log(`MariaDB ${version} ready on 127.0.0.1:${port}. No Docker or Windows service required.`)
} else throw new Error('Usage: node scripts/local-db.mjs start|stop')
