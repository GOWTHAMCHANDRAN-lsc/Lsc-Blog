/**
 * Simple migration runner — reads numbered SQL files and tracks applied migrations
 * Run with: node src/config/migrate.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runMigrations() {
  // First connect without database to create it if needed
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL');

  // Create database if not exists
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'saas_blog'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();

  // Now connect to the database
  const dbConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'saas_blog',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  // Create migrations tracking table if not exists
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB;
  `);

  // Get applied migrations
  const [applied] = await dbConn.query(
    `SELECT filename FROM schema_migrations`
  );
  const appliedSet = new Set(applied.map(r => r.filename));

  // Read migration files in order
  const migrationsDir = path.join(__dirname, '../../../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found. Running schema.sql instead...');
    const schemaPath = path.resolve(
      __dirname,
      '../../../../database/schema.sql'
    );
    console.log('Schema path:', schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await dbConn.query(schema);
    console.log('✅ Schema applied');
    await dbConn.end();
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let applied_count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  Skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  🔄 Applying ${file}…`);

    await dbConn.query(sql);
    await dbConn.query(`INSERT INTO schema_migrations (filename) VALUES (?)`, [
      file,
    ]);

    console.log(`  ✅ Applied ${file}`);
    applied_count++;
  }

  console.log(`\n🎉 Done. ${applied_count} migration(s) applied.`);
  await dbConn.end();
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
