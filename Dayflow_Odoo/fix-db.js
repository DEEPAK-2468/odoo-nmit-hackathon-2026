require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixDatabase() {
  try {
    console.log('Adding missing Dayflow columns...');

    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS password_hash TEXT
    `);

    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS verification_token TEXT
    `);

    console.log('Database columns added successfully.');

    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\nCurrent public.users columns:');
    console.table(result.rows);

  } catch (error) {
    console.error('DATABASE FIX ERROR:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

fixDatabase();