const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function seed() {
  try {
    console.log('Seeding Dayflow users...');

    const adminHash = await bcrypt.hash('Admin@123', 10);
    const employeeHash = await bcrypt.hash('Employee@123', 10);

    // HR account
    const admin = await pool.query(
      `INSERT INTO public.users
        (employee_id, email, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_id, email, role, email_verified`,
      [
        'HR001',
        'admin@dayflow.local',
        adminHash,
        'hr',
        true
      ]
    );

    // Employee account
    const employee = await pool.query(
      `INSERT INTO public.users
        (employee_id, email, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_id, email, role, email_verified`,
      [
        'EMP001',
        'employee@dayflow.local',
        employeeHash,
        'employee',
        true
      ]
    );

    console.log('');
    console.log('======================================');
    console.log('DAYFLOW SEED SUCCESSFUL');
    console.log('======================================');

    console.log('');
    console.log('HR ACCOUNT');
    console.log('Employee ID: HR001');
    console.log('Email:       admin@dayflow.local');
    console.log('Password:    Admin@123');
    console.log('Role:        hr');

    console.log('');
    console.log('EMPLOYEE ACCOUNT');
    console.log('Employee ID: EMP001');
    console.log('Email:       employee@dayflow.local');
    console.log('Password:    Employee@123');
    console.log('Role:        employee');

    console.log('');
    console.table([
      admin.rows[0],
      employee.rows[0]
    ]);

  } catch (error) {
    console.error('SEED ERROR:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

seed();