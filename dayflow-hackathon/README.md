# Dayflow — Hackathon-ready HRMS

A compact full-stack implementation of the uploaded Dayflow HRMS specification.

## Features
- Employee/Admin authentication
- Role-based dashboards
- Employee profile management
- Check-in/check-out attendance
- Daily/weekly attendance
- Leave application and approval
- Payroll visibility and admin salary control
- Basic analytics
- Responsive React UI

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT + bcrypt

## Run
1. Create PostgreSQL database `dayflow`.
2. Copy `server/.env.example` to `server/.env`.
3. Run the SQL in `server/schema.sql`.
4. In `server/`: `npm install && npm run dev`
5. In `client/`: `npm install && npm run dev`

Frontend defaults to http://localhost:5173 and API to http://localhost:4000.

Demo accounts after seeding:
- Admin: admin@dayflow.local / Admin@123
- Employee: employee@dayflow.local / Employee@123
