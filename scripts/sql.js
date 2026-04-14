/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const url = process.env.DATABASE_URL
if (!url) { console.error('Missing DATABASE_URL in .env.local'); process.exit(1) }

const arg = process.argv[2]
if (!arg) {
  console.error('Usage:\n  node scripts/sql.js "SELECT ..."\n  node scripts/sql.js --file path/to/query.sql')
  process.exit(1)
}

const sql = arg === '--file'
  ? fs.readFileSync(process.argv[3], 'utf8')
  : arg

const run = async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const res = await client.query(sql)
    if (Array.isArray(res)) {
      for (const r of res) console.log(JSON.stringify({ command: r.command, rowCount: r.rowCount, rows: r.rows }, null, 2))
    } else {
      console.log(JSON.stringify({ command: res.command, rowCount: res.rowCount, rows: res.rows }, null, 2))
    }
  } finally {
    await client.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })
