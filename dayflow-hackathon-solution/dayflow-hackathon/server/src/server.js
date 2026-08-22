import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { auth, role, signToken } from './auth.js';

dotenv.config();
const app = express();
app.use(cors({origin: process.env.CORS_ORIGIN || '*'}));
app.use(express.json());

const q = (text, params=[]) => pool.query(text, params);

app.get('/api/health', (_,res)=>res.json({ok:true, service:'Dayflow API'}));

app.post('/api/auth/login', async (req,res)=>{
  try {
    const {email,password} = req.body;
    const {rows} = await q('SELECT * FROM users WHERE email=$1',[email]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({message:'Incorrect email or password'});
    const user = rows[0];
    const e = await q('SELECT * FROM employees WHERE user_id=$1',[user.id]);
    res.json({token:signToken(user), user:{id:user.id,email:user.email,role:user.role,employee:e.rows[0]}});
  } catch(e){res.status(500).json({message:e.message});}
});

app.post('/api/auth/register', async (req,res)=>{
  try {
    const {employeeId,email,password,role:requestedRole='EMPLOYEE',name} = req.body;
    const role = requestedRole === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
    const hash = await bcrypt.hash(password,10);
    const u = await q('INSERT INTO users(employee_id,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING *',
      [employeeId,email,hash,role]);
    const e = await q('INSERT INTO employees(user_id,name) VALUES($1,$2) RETURNING *',[u.rows[0].id,name || employeeId]);
    res.status(201).json({message:'Registered',user:{...u.rows[0],employee:e.rows[0]}});
  } catch(e){res.status(400).json({message:e.code==='23505'?'Email or Employee ID already exists':e.message});}
});

app.get('/api/me', auth, async (req,res)=>{
  const {rows} = await q(`SELECT u.id,u.email,u.role,e.* FROM users u JOIN employees e ON e.user_id=u.id WHERE u.id=$1`,[req.user.id]);
  res.json(rows[0]);
});

app.get('/api/employees', auth, role('ADMIN'), async (_,res)=>{
  const {rows}=await q(`SELECT e.*,u.email,u.employee_id FROM employees e JOIN users u ON u.id=e.user_id ORDER BY e.name`);
  res.json(rows);
});

app.put('/api/employees/:id', auth, async (req,res)=>{
  const allowed = req.user.role==='ADMIN' || String(req.user.id)===String(req.body.userId);
  if(!allowed) return res.status(403).json({message:'Forbidden'});
  const {name,phone,address,job_title,department,salary}=req.body;
  const {rows}=await q(`UPDATE employees SET name=COALESCE($1,name),phone=COALESCE($2,phone),address=COALESCE($3,address),
    job_title=COALESCE($4,job_title),department=COALESCE($5,department),
    salary=CASE WHEN $6::numeric IS NULL THEN salary ELSE $6 END WHERE id=$7 RETURNING *`,
    [name,phone,address,job_title,department,salary ?? null,req.params.id]);
  res.json(rows[0]);
});

app.get('/api/attendance', auth, async (req,res)=>{
  const emp = req.user.role==='ADMIN' && req.query.employeeId ? req.query.employeeId :
    (await q('SELECT id FROM employees WHERE user_id=$1',[req.user.id])).rows[0]?.id;
  const {rows}=await q('SELECT * FROM attendance WHERE employee_id=$1 ORDER BY date DESC LIMIT 60',[emp]);
  res.json(rows);
});

app.post('/api/attendance/check-in', auth, role('EMPLOYEE'), async (req,res)=>{
  const emp=(await q('SELECT id FROM employees WHERE user_id=$1',[req.user.id])).rows[0];
  const {rows}=await q(`INSERT INTO attendance(employee_id,date,check_in,status)
    VALUES($1,CURRENT_DATE,NOW(),'Present')
    ON CONFLICT(employee_id,date) DO UPDATE SET check_in=COALESCE(attendance.check_in,NOW()),status='Present'
    RETURNING *`,[emp.id]);
  res.json(rows[0]);
});

app.post('/api/attendance/check-out', auth, role('EMPLOYEE'), async (req,res)=>{
  const emp=(await q('SELECT id FROM employees WHERE user_id=$1',[req.user.id])).rows[0];
  const {rows}=await q(`UPDATE attendance SET check_out=NOW() WHERE employee_id=$1 AND date=CURRENT_DATE RETURNING *`,[emp.id]);
  if(!rows[0]) return res.status(400).json({message:'Check in first'});
  res.json(rows[0]);
});

app.get('/api/leaves', auth, async (req,res)=>{
  const employeeFilter = req.user.role==='ADMIN' ? '' :
    `WHERE l.employee_id=(SELECT id FROM employees WHERE user_id=${req.user.id})`;
  const {rows}=await q(`SELECT l.*,e.name FROM leave_requests l JOIN employees e ON e.id=l.employee_id ${employeeFilter} ORDER BY l.created_at DESC`);
  res.json(rows);
});

app.post('/api/leaves', auth, role('EMPLOYEE'), async (req,res)=>{
  const emp=(await q('SELECT id FROM employees WHERE user_id=$1',[req.user.id])).rows[0];
  const {leaveType,startDate,endDate,remarks}=req.body;
  const {rows}=await q(`INSERT INTO leave_requests(employee_id,leave_type,start_date,end_date,remarks)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[emp.id,leaveType,startDate,endDate,remarks]);
  res.status(201).json(rows[0]);
});

app.patch('/api/leaves/:id', auth, role('ADMIN'), async (req,res)=>{
  const {status,adminComment}=req.body;
  const {rows}=await q(`UPDATE leave_requests SET status=$1,admin_comment=$2 WHERE id=$3 RETURNING *`,
    [status,adminComment,req.params.id]);
  res.json(rows[0]);
});

app.get('/api/payroll', auth, async (req,res)=>{
  const id=req.user.role==='ADMIN' && req.query.employeeId ? req.query.employeeId :
    (await q('SELECT id FROM employees WHERE user_id=$1',[req.user.id])).rows[0]?.id;
  const {rows}=await q(`SELECT p.*,e.name,e.job_title FROM payroll p JOIN employees e ON e.id=p.employee_id WHERE p.employee_id=$1`,[id]);
  res.json(rows[0] || null);
});

app.get('/api/analytics', auth, role('ADMIN'), async (_,res)=>{
  const [employees,attendance,leaves,payroll]=await Promise.all([
    q('SELECT COUNT(*)::int count FROM employees'),
    q(`SELECT status,COUNT(*)::int count FROM attendance GROUP BY status`),
    q(`SELECT status,COUNT(*)::int count FROM leave_requests GROUP BY status`),
    q(`SELECT COALESCE(SUM(basic_salary+allowances-deductions),0)::numeric total FROM payroll`)
  ]);
  res.json({employees:employees.rows[0].count,attendance:attendance.rows,leaves:leaves.rows,payrollTotal:payroll.rows[0].total});
});

app.post('/api/demo/seed', async (_,res)=>{
  try {
    const passwordAdmin=await bcrypt.hash('Admin@123',10), passwordEmp=await bcrypt.hash('Employee@123',10);
    await q('DELETE FROM leave_requests'); await q('DELETE FROM attendance'); await q('DELETE FROM payroll'); await q('DELETE FROM employees'); await q('DELETE FROM users');
    const a=(await q(`INSERT INTO users(employee_id,email,password_hash,role) VALUES('ADM001','admin@dayflow.local',$1,'ADMIN') RETURNING id`,[passwordAdmin])).rows[0];
    const e=(await q(`INSERT INTO users(employee_id,email,password_hash,role) VALUES('EMP001','employee@dayflow.local',$1,'EMPLOYEE') RETURNING id`,[passwordEmp])).rows[0];
    const ae=(await q(`INSERT INTO employees(user_id,name,job_title,department,salary) VALUES($1,'Admin User','HR Manager','Human Resources',90000) RETURNING id`,[a.id])).rows[0];
    const ee=(await q(`INSERT INTO employees(user_id,name,job_title,department,salary) VALUES($1,'Alex Employee','Software Engineer','Engineering',75000) RETURNING id`,[e.id])).rows[0];
    await q(`INSERT INTO payroll(employee_id,basic_salary,allowances,deductions) VALUES($1,90000,5000,3000),($2,75000,7000,2500)`,[ae.id,ee.id]);
    await q(`INSERT INTO attendance(employee_id,date,check_in,check_out,status) VALUES($1,CURRENT_DATE-1,NOW()-interval '8 hours',NOW(),'Present'),($2,CURRENT_DATE-1,NOW()-interval '8 hours',NOW(),'Present')`,[ae.id,ee.id]);
    res.json({message:'Seeded demo data'});
  } catch(e){res.status(500).json({message:e.message});}
});

app.listen(process.env.PORT || 4000,()=>console.log('Dayflow API running'));
