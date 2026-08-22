# Dayflow HRMS

Dayflow is a modern Human Resource Management System (HRMS) for employees and HR teams. It brings authentication, employee information, attendance, leave management, and payroll into one platform.

## Features

### Employee
- Sign up and log in
- Employee dashboard
- Profile management
- Check in / check out
- Attendance history
- Leave requests and status
- Payroll information

### HR
- HR dashboard
- Employee directory
- Employee profiles
- Attendance monitoring
- Leave approval/rejection
- Payroll management

### Technology
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js / Express
- Database: Supabase PostgreSQL
- Password hashing: bcrypt
- Authentication: JWT
- Package manager: npm

---

## Project Structure

```text
Dayflow_Odoo/
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── server.js
├── db.js
├── seed.js
├── schema.sql
├── check-db.js
├── fix-db.js
├── package.json
├── package-lock.json
├── SUPABASE_SETUP.md
├── README.md
├── .env.example
└── .gitignore
```

Never upload `.env` or `node_modules/` to GitHub.

---

## Requirements

Install:

1. Node.js (LTS recommended)
2. Git (if using GitHub)
3. VS Code
4. A Supabase project

You do **not** need PostgreSQL installed locally.

---

# Running Dayflow

## 1. Clone the project

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Dayflow_Odoo
```

Or extract the ZIP and open the project folder in VS Code.

## 2. Install dependencies

```bash
npm install
```

On Windows, if PowerShell reports that `npm.ps1` is blocked, use:

```powershell
npm.cmd install
```

## 3. Create `.env`

Create `.env` in the project root, next to `server.js`:

```env
DATABASE_URL=YOUR_SUPABASE_DATABASE_CONNECTION_STRING
JWT_SECRET=YOUR_RANDOM_SECRET
PORT=3000
```

Example format:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
JWT_SECRET=dayflow-hackathon-secret
PORT=3000
```

Use the connection string from your Supabase project and replace the placeholders.

### Security

Do **not** upload `.env` to GitHub. Your `.gitignore` should contain:

```gitignore
node_modules/
.env
```

You can upload `.env.example`:

```env
DATABASE_URL=
JWT_SECRET=
PORT=3000
```

## 4. Database setup

If you are using a new Supabase database, open the Supabase SQL Editor and run the SQL from:

```text
schema.sql
```

If you are using the existing Dayflow Supabase database, make sure `DATABASE_URL` points to that database.

Check the connection with:

```bash
node check-db.js
```

## 5. Seed demo data

If the database is empty and the current seed script matches your schema:

```bash
npm run seed
```

Windows PowerShell:

```powershell
npm.cmd run seed
```

If your existing database already contains the demo users/data, you normally do not need to seed again.

## 6. Start the application

```bash
npm start
```

Windows PowerShell:

```powershell
npm.cmd start
```

You should see:

```text
Dayflow running at http://localhost:3000
```

Open:

```text
http://localhost:3000
```

---

# Demo Accounts

If they exist in your seeded database:

### HR

```text
Email: admin@dayflow.local
Password: Admin@123
```

### Employee

```text
Email: employee@dayflow.local
Password: Employee@123
```

If these accounts are not present, run the seed script or use the signup flow.

---

# Main Workflow

## Employee

```text
Login
  ↓
Dashboard
  ↓
Profile
  ↓
Check In / Check Out
  ↓
Attendance
  ↓
Leave Request
  ↓
Leave Status
  ↓
Payroll
```

## HR

```text
HR Login
  ↓
HR Dashboard
  ↓
Employees
  ↓
Attendance
  ↓
Leave Requests
  ↓
Approve / Reject
  ↓
Payroll
```

---

# API Areas

The backend in `server.js` handles the application's API routes for:

- Authentication
- Employees
- Profiles
- Attendance
- Leave
- Payroll
- Dashboard data

Use `server.js` as the source of truth for the exact routes in the current version.

---

# Troubleshooting

## `DATABASE_URL is missing`

Create `.env` in the project root and add:

```env
DATABASE_URL=YOUR_SUPABASE_CONNECTION_STRING
```

Then restart the server.

## `password authentication failed`

Verify the Supabase database password and connection string. Do not share the password publicly.

## `getaddrinfo ENOTFOUND`

The hostname in `DATABASE_URL` is probably incorrect. Copy the connection string again from Supabase.

## `npm.ps1 cannot be loaded`

Use:

```powershell
npm.cmd install
npm.cmd start
```

## `column does not exist`

The database schema and application code are out of sync. Run:

```bash
node check-db.js
```

and compare the database with `schema.sql`. Do not randomly change columns without checking which schema the current application expects.

---

# Running on Another Team Member's Laptop

1. Install Node.js, Git and VS Code.
2. Clone the GitHub repository.
3. Run:

```bash
npm install
```

4. Create a local `.env` with the shared Supabase connection.
5. Run:

```bash
npm start
```

6. Open:

```text
http://localhost:3000
```

All team members can run the application locally while connecting to the same Supabase database.

---

# Four-Member Team Responsibilities

### Member 1 — Frontend / UI-UX

```text
public/index.html
public/app.js
public/styles.css
```

Owns the interface, dashboards, navigation, forms, responsive design, and user experience.

### Member 2 — Backend / Authentication

```text
server.js
```

Owns Node.js/Express APIs, authentication, authorization, validation, and application logic.

### Member 3 — Supabase / Database

```text
db.js
schema.sql
seed.js
SUPABASE_SETUP.md
```

Owns the Supabase PostgreSQL database, schema, connection, constraints, and demo data.

### Member 4 — Testing / Documentation

```text
README.md
package.json
package-lock.json
check-db.js
fix-db.js
```

Owns testing, debugging, setup documentation, integration checks, and demo preparation.

---

# Architecture

```text
Frontend
   │
   ▼
Node.js / Express API
   │
   ▼
PostgreSQL Driver
   │
   ▼
Supabase PostgreSQL
   │
   ├── Users
   ├── Profiles
   ├── Attendance
   ├── Leave
   └── Payroll
```

---

# Hackathon Demo

Recommended sequence:

1. Employee login
2. Employee dashboard
3. Attendance check-in/out
4. Leave request
5. Employee payroll/profile
6. HR login
7. HR dashboard
8. Review and approve leave
9. Show employee/attendance/payroll information
10. Explain Node.js + Supabase architecture
11. Explain the four team contributions

Focus the demo on the complete employee-to-HR workflow rather than showing every source file.

---

# GitHub Safety

Never commit:

```text
.env
node_modules/
```

Recommended `.gitignore`:

```gitignore
node_modules/
.env
```

Commit:

```text
server.js
db.js
seed.js
schema.sql
public/
package.json
package-lock.json
README.md
SUPABASE_SETUP.md
.env.example
```

If a real database password was ever pushed to GitHub, change/reset that password in Supabase before the hackathon.

---

# Quick Start

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Dayflow_Odoo
npm install
```

Create `.env`:

```env
DATABASE_URL=YOUR_SUPABASE_CONNECTION_STRING
JWT_SECRET=dayflow-hackathon-secret
PORT=3000
```

Then:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

**Dayflow HRMS — one platform for a smoother employee and HR experience.**
