const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dayflow-dev-secret';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function hrOnly(req, res, next) {
  if (req.user.role !== 'hr') return res.status(403).json({ error: 'HR/Admin access required' });
  next();
}

app.get('/api/health', (_, res) => res.json({ ok: true, app: 'Dayflow HRMS' }));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { employeeId, email, password, role = 'employee', fullName } = req.body;
    if (!employeeId || !email || !password || !fullName) return res.status(400).json({ error: 'Employee ID, name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must contain at least 8 characters' });
    if (!['employee', 'hr'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const exists = await pool.query('SELECT id FROM users WHERE email=$1 OR employee_id=$2', [email, employeeId]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email or Employee ID already exists' });

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const u = await pool.query(`INSERT INTO users(employee_id,email,password_hash,role,verification_token)
      VALUES($1,$2,$3,$4,$5) RETURNING id,employee_id,email,role,email_verified,verification_token`,
      [employeeId, email.toLowerCase(), hash, role, verificationToken]);
    await pool.query('INSERT INTO profiles(user_id,full_name) VALUES($1,$2)', [u.rows[0].id, fullName]);
    await pool.query('INSERT INTO payroll(user_id) VALUES($1)', [u.rows[0].id]);

    res.status(201).json({
      message: 'Account created. Demo email verification is required.',
      verificationUrl: `/api/auth/verify/${verificationToken}`
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Signup failed' }); }
});

app.get('/api/auth/verify/:token', async (req, res) => {
  const r = await pool.query('UPDATE users SET email_verified=TRUE, verification_token=NULL WHERE verification_token=$1 RETURNING email', [req.params.token]);
  if (!r.rowCount) return res.status(400).send('<h2>Invalid or expired verification link.</h2>');
  res.send('<h2>Email verified successfully.</h2><p>You can return to Dayflow and sign in.</p>');
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [String(email || '').toLowerCase()]);
    if (!r.rowCount) return res.status(401).json({ error: 'Incorrect email or password' });
    const user = r.rows[0];
    if (!await bcrypt.compare(password || '', user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
    if (!user.email_verified) return res.status(403).json({ error: 'Please verify your email before signing in' });
    res.json({ token: tokenFor(user), user: { id: user.id, employeeId: user.employee_id, email: user.email, role: user.role } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Sign in failed' }); }
});

app.get('/api/me', auth, async (req, res) => {
  const r = await pool.query(`SELECT u.id,u.employee_id,u.email,u.role,u.email_verified,
    p.full_name,p.phone,p.address,p.job_title,p.department,p.joining_date,p.salary,p.profile_picture,p.documents
    FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [req.user.id]);
  res.json(r.rows[0]);
});

app.get('/api/dashboard', auth, async (req, res) => {
  if (req.user.role === 'hr') {
    const [employees, pending, present, payroll] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='employee'"),
      pool.query("SELECT COUNT(*)::int AS count FROM leave_requests WHERE status='Pending'"),
      pool.query("SELECT COUNT(*)::int AS count FROM attendance WHERE attendance_date=CURRENT_DATE AND status='Present'"),
      pool.query("SELECT COALESCE(SUM(basic_salary+allowances-deductions),0)::numeric AS total FROM payroll")
    ]);
    return res.json({ employees: employees.rows[0].count, pendingLeaves: pending.rows[0].count, presentToday: present.rows[0].count, payroll: payroll.rows[0].total });
  }
  const [att, leaves, pay] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM attendance WHERE user_id=$1 AND status='Present'", [req.user.id]),
    pool.query("SELECT COUNT(*)::int AS count FROM leave_requests WHERE user_id=$1 AND status='Pending'", [req.user.id]),
    pool.query("SELECT COALESCE(basic_salary+allowances-deductions,0)::numeric AS total FROM payroll WHERE user_id=$1", [req.user.id])
  ]);
  res.json({ presentDays: att.rows[0].count, pendingLeaves: leaves.rows[0].count, netSalary: pay.rows[0]?.total || 0 });
});

app.get('/api/employees', auth, hrOnly, async (_, res) => {
  const r = await pool.query(`SELECT u.id,u.employee_id,u.email,u.role,p.full_name,p.phone,p.address,p.job_title,p.department,p.joining_date,p.salary
    FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY u.id DESC`);
  res.json(r.rows);
});

app.get('/api/profile/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'hr' && id !== req.user.id) return res.status(403).json({ error: 'You can only view your own profile' });
  const r = await pool.query(`SELECT u.id,u.employee_id,u.email,u.role,p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Employee not found' });
  res.json(r.rows[0]);
});

app.patch('/api/profile/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'hr' && id !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  const allowedEmployee = ['phone','address','profile_picture'];
  const allowedHr = [...allowedEmployee, 'full_name','job_title','department','joining_date','salary','documents'];
  const allowed = req.user.role === 'hr' ? allowedHr : allowedEmployee;
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No editable fields supplied' });
  const values = fields.map(k => req.body[k]);
  const set = fields.map((k,i)=>`${k}=$${i+1}`).join(', ');
  await pool.query(`UPDATE profiles SET ${set}, updated_at=NOW() WHERE user_id=$${fields.length+1}`, [...values,id]);
  if (req.user.role === 'hr' && req.body.salary !== undefined) await pool.query('UPDATE payroll SET basic_salary=$1,updated_at=NOW() WHERE user_id=$2', [Number(req.body.salary),id]);
  res.json({ message: 'Profile updated' });
});

app.get('/api/attendance', auth, async (req, res) => {
  const target = req.user.role === 'hr' && req.query.userId ? Number(req.query.userId) : req.user.id;
  if (req.user.role !== 'hr' && target !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  const r = await pool.query(`SELECT a.*,p.full_name,u.employee_id FROM attendance a JOIN users u ON u.id=a.user_id JOIN profiles p ON p.user_id=u.id
    WHERE a.user_id=$1 ORDER BY attendance_date DESC LIMIT 60`, [target]);
  res.json(r.rows);
});

app.post('/api/attendance/checkin', auth, async (req, res) => {
  const r = await pool.query(`INSERT INTO attendance(user_id,attendance_date,check_in,status) VALUES($1,CURRENT_DATE,NOW(),'Present')
    ON CONFLICT(user_id,attendance_date) DO UPDATE SET check_in=COALESCE(attendance.check_in,NOW()), status='Present' RETURNING *`, [req.user.id]);
  res.json(r.rows[0]);
});

app.post('/api/attendance/checkout', auth, async (req, res) => {
  const r = await pool.query(`UPDATE attendance SET check_out=NOW() WHERE user_id=$1 AND attendance_date=CURRENT_DATE RETURNING *`, [req.user.id]);
  if (!r.rowCount) return res.status(400).json({ error: 'Check in first' });
  res.json(r.rows[0]);
});

app.get('/api/leaves', auth, async (req, res) => {
  const target = req.user.role === 'hr' && req.query.userId ? Number(req.query.userId) : req.user.id;
  const r = await pool.query(`SELECT l.*,p.full_name,u.employee_id FROM leave_requests l JOIN users u ON u.id=l.user_id JOIN profiles p ON p.user_id=u.id
    WHERE l.user_id=$1 ORDER BY l.created_at DESC`, [target]);
  res.json(r.rows);
});

app.get('/api/all-leaves', auth, hrOnly, async (_, res) => {
  const r = await pool.query(`SELECT l.*,p.full_name,u.employee_id FROM leave_requests l JOIN users u ON u.id=l.user_id JOIN profiles p ON p.user_id=u.id ORDER BY l.created_at DESC`);
  res.json(r.rows);
});

app.post('/api/leaves', auth, async (req, res) => {
  const { leaveType, startDate, endDate, remarks } = req.body;
  if (!['Paid','Sick','Unpaid'].includes(leaveType) || !startDate || !endDate) return res.status(400).json({ error: 'Leave type and date range are required' });
  if (endDate < startDate) return res.status(400).json({ error: 'End date must be after start date' });
  const r = await pool.query(`INSERT INTO leave_requests(user_id,leave_type,start_date,end_date,remarks) VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.user.id,leaveType,startDate,endDate,remarks || null]);
  res.status(201).json(r.rows[0]);
});

app.patch('/api/leaves/:id', auth, hrOnly, async (req, res) => {
  const { status, adminComment } = req.body;
  if (!['Approved','Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid leave status' });
  const r = await pool.query(`UPDATE leave_requests SET status=$1,admin_comment=$2 WHERE id=$3 RETURNING *`, [status,adminComment || null,Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: 'Leave request not found' });
  if (status === 'Approved') {
    const l = r.rows[0];
    await pool.query(`INSERT INTO attendance(user_id,attendance_date,status) SELECT $1,gs::date,'Leave' FROM generate_series($2::date,$3::date,'1 day') gs
      ON CONFLICT(user_id,attendance_date) DO UPDATE SET status='Leave'`, [l.user_id,l.start_date,l.end_date]);
  }
  res.json(r.rows[0]);
});

app.get('/api/payroll', auth, async (req, res) => {
  const target = req.user.role === 'hr' && req.query.userId ? Number(req.query.userId) : req.user.id;
  const r = await pool.query(`SELECT pr.*,u.employee_id,p.full_name, (pr.basic_salary+pr.allowances-pr.deductions) AS net_salary
    FROM payroll pr JOIN users u ON u.id=pr.user_id JOIN profiles p ON p.user_id=u.id WHERE pr.user_id=$1`, [target]);
  res.json(r.rows[0] || null);
});

app.get('/api/all-payroll', auth, hrOnly, async (_, res) => {
  const r = await pool.query(`SELECT pr.*,u.employee_id,p.full_name,(pr.basic_salary+pr.allowances-pr.deductions) AS net_salary
    FROM payroll pr JOIN users u ON u.id=pr.user_id JOIN profiles p ON p.user_id=u.id ORDER BY p.full_name`);
  res.json(r.rows);
});

app.patch('/api/payroll/:userId', auth, hrOnly, async (req, res) => {
  const { basicSalary, allowances, deductions } = req.body;
  const r = await pool.query(`UPDATE payroll SET basic_salary=$1,allowances=$2,deductions=$3,updated_at=NOW() WHERE user_id=$4 RETURNING *`, [Number(basicSalary)||0,Number(allowances)||0,Number(deductions)||0,Number(req.params.userId)]);
  if (!r.rowCount) return res.status(404).json({ error: 'Payroll record not found' });
  res.json(r.rows[0]);
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => app.listen(PORT, () => console.log(`Dayflow running at http://localhost:${PORT}`)))
  .catch(err => { console.error('Database initialization failed:', err); process.exit(1); });
