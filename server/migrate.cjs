const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Pool } = require('pg');

async function migrate() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error('Задайте DATABASE_URL_UNPOOLED с прямым URL Neon');
  if (new URL(connectionString).hostname.split('.')[0].endsWith('-pooler')) {
    throw new Error('Для миграции нужен прямой URL Neon без -pooler');
  }
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await pool.query(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Таблицы доступа готовы.');
  } finally {
    await pool.end();
  }
}

migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
