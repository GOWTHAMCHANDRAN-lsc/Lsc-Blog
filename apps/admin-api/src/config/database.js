const mysql = require('mysql2/promise');
const logger = require('./logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'saas_blog',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_MAX) || 20,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
});

// Verify connection on startup
pool
  .getConnection()
  .then(conn => {
    logger.info('MySQL connected');
    conn.release();
  })
  .catch(err => {
    logger.error('MySQL connection failed:', err.message);
    process.exit(1);
  });

/**
 * Execute a query and return rows
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Execute a query and return first row or null
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Run multiple queries in a transaction
 * @param {Function} callback - receives trx object with query/queryOne methods
 */
async function transaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const trx = {
      query: async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows;
      },
      queryOne: async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows[0] || null;
      },
    };
    const result = await callback(trx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { query, queryOne, transaction, pool };
