/**
 * Manual seed script to create the Kagzso tenant.
 * ESM version.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../backend/.env') });

async function seed() {
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'attendance_system',
  });

  try {
    const [result] = await connection.execute(
      'INSERT IGNORE INTO tenants (name, slug, admin_pass, user_pass) VALUES (?, ?, ?, ?)',
      ['Kagzso', 'kagzso', 'Kagzso@123', 'Kagzso@123']
    );
    if (result.affectedRows > 0) {
      console.log('Kagzso tenant created successfully.');
    } else {
      console.log('Kagzso tenant already exists.');
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await connection.end();
  }
}

seed();
