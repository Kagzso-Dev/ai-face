/**
 * Resilient seed script:
 * 1. Creates database if not exists
 * 2. Runs setup.sql statement by statement, ignoring failures (like already existing indexes)
 * 3. Seeds the Kagzso tenant
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true
  });

  try {
    console.log('Connecting to MySQL...');
    
    // Force a total clean by dropping the database first
    console.log(`Dropping and recreating database: ${process.env.DB_NAME}...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
    await connection.query(`CREATE DATABASE \`${process.env.DB_NAME}\``);
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    console.log(`Database ${process.env.DB_NAME} is now clean.`);

    const sqlPath = path.join(__dirname, '../database/setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    const statements = sql
      .replace(/--.*$/gm, '') 
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log('Running setup.sql statements resiliently...');
    for (const stmt of statements) {
      if (stmt.toLowerCase().startsWith('create database')) continue;
      if (stmt.toLowerCase().startsWith('use')) continue;
      try {
        await connection.query(stmt);
      } catch (e) {
        if (!stmt.toLowerCase().includes('index')) {
           console.warn(`Statement failed but continuing: ${stmt.substring(0, 50)}... Error: ${e.message}`);
        }
      }
    }

    // ─── CLEAN SLATE: Remove all existing users and attendance data ───
    console.log('Clearing all users and attendance records for a clean slate...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE attendance');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database cleared.');

    // 3. Seed Kagzso tenant & Windows
    const [rows] = await connection.execute('SELECT id FROM tenants WHERE slug = ?', ['kagzso']);
    let tenantId;
    if (rows.length === 0) {
      const [ins] = await connection.execute(
        'INSERT INTO tenants (name, slug, admin_pass, user_pass) VALUES (?, ?, ?, ?)',
        ['Kagzso', 'kagzso', 'Kagzso@123', 'Kagzso@123']
      );
      tenantId = ins.insertId;
      console.log('Kagzso tenant created.');
    } else {
      tenantId = rows[0].id;
      await connection.execute(
        'UPDATE tenants SET admin_pass = ?, user_pass = ? WHERE id = ?',
        ['Kagzso@123', 'Kagzso@123', tenantId]
      );
      console.log('Kagzso tenant updated.');
    }

    // Seed Windows
    await connection.execute('DELETE FROM attendance_windows WHERE tenant_id = ?', [tenantId]);
    const windows = [
      ['Morning', '08:00', '10:00', 1, 0],
      ['Afternoon', '12:00', '14:00', 1, 0],
      ['Evening', '16:00', '18:00', 1, 0]
    ];
    for (const w of windows) {
      await connection.execute(
        'INSERT INTO attendance_windows (tenant_id, label, start_time, end_time, enabled, late_absent) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, ...w]
      );
    }
    console.log('Default attendance windows seeded for Kagzso.');

  } catch (err) {
    console.error('Operation failed:', err);
  } finally {
    await connection.end();
  }
}

run();
