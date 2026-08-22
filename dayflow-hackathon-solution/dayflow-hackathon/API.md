# Dayflow API

## Auth
- POST `/api/auth/login` — `{email,password}`
- POST `/api/auth/register` — `{employeeId,email,password,role,name}`
- GET `/api/me` — current user

## Employees
- GET `/api/employees` — ADMIN
- PUT `/api/employees/:id` — profile update

## Attendance
- GET `/api/attendance`
- POST `/api/attendance/check-in` — EMPLOYEE
- POST `/api/attendance/check-out` — EMPLOYEE

## Leave
- GET `/api/leaves`
- POST `/api/leaves` — EMPLOYEE
- PATCH `/api/leaves/:id` — ADMIN; `{status,adminComment}`

## Payroll
- GET `/api/payroll`
- GET `/api/analytics` — ADMIN

## Demo
- POST `/api/demo/seed` — resets and creates demo data.
