import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LogOut,LayoutDashboard,Clock3,CalendarDays,Wallet,Users,ShieldCheck} from 'lucide-react';
import './styles.css';

const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api';
const request=async(path,opts={})=>{
 const r=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{}),...(localStorage.token?{Authorization:'Bearer '+localStorage.token}:{})}});
 const d=await r.json(); if(!r.ok) throw Error(d.message||'Request failed'); return d;
};

function Login({onLogin}){
 const [email,setEmail]=useState('employee@dayflow.local'),[password,setPassword]=useState('Employee@123'),[error,setError]=useState('');
 async function submit(e){e.preventDefault();try{const d=await request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.token=d.token;onLogin(d.user)}catch(x){setError(x.message)}}
 return <div className="auth"><div className="auth-card"><div className="brand">DAYFLOW</div><h1>Every workday, perfectly aligned.</h1><p className="muted">Human Resource Management System</p>
 <form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button>Sign in</button></form>
 <div className="demo">Demo: employee@dayflow.local / Employee@123<br/>Admin: admin@dayflow.local / Admin@123</div></div></div>
}

function App({user,onLogout}){
 const [page,setPage]=useState('dashboard'),[data,setData]=useState(null);
 const load=async()=>{try{
   if(page==='dashboard'){setData(user.role==='ADMIN'?await request('/analytics'):await request('/attendance'))}
   if(page==='attendance')setData(await request('/attendance'));
   if(page==='leaves')setData(await request('/leaves'));
   if(page==='payroll')setData(await request('/payroll'));
   if(page==='employees')setData(await request('/employees'));
 }catch(e){setData({error:e.message})}};
 useEffect(()=>{load()},[page]);
 const nav=user.role==='ADMIN'?[['dashboard','Dashboard',LayoutDashboard],['employees','Employees',Users],['leaves','Leave approvals',CalendarDays],['attendance','Attendance',Clock3],['payroll','Payroll',Wallet]]:[['dashboard','Dashboard',LayoutDashboard],['attendance','Attendance',Clock3],['leaves','My leave',CalendarDays],['payroll','Payroll',Wallet]];
 return <div className="app"><aside><div className="brand">DAYFLOW</div><div className="role"><ShieldCheck size={16}/> {user.role}</div>{nav.map(([id,t,I])=><button className={page===id?'nav active':'nav'} onClick={()=>setPage(id)} key={id}><I size={18}/>{t}</button>)}<button className="nav logout" onClick={onLogout}><LogOut size={18}/>Logout</button></aside>
 <main><header><div><h2>{nav.find(x=>x[0]===page)?.[1]}</h2><span className="muted">{user.employee?.name||user.email}</span></div><div className="avatar">{(user.employee?.name||'U')[0]}</div></header><section className="content">{page==='dashboard'&&<Dashboard user={user} data={data}/>}
 {page==='attendance'&&<Attendance user={user} data={data} refresh={load}/>}
 {page==='leaves'&&<Leaves user={user} data={data} refresh={load}/>}
 {page==='payroll'&&<Payroll data={data}/>}
 {page==='employees'&&<Employees data={data}/>}</section></main></div>
}

function Dashboard({user,data}){return user.role==='ADMIN'?<div className="grid four">{[['Employees',data?.employees||0],['Payroll total','₹'+Number(data?.payrollTotal||0).toLocaleString()],['Attendance',data?.attendance?.map(x=>x.status+': '+x.count).join(' · ')||'—'],['Leaves',data?.leaves?.map(x=>x.status+': '+x.count).join(' · ')||'—']].map(x=><div className="card metric" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)} </div>:<div className="grid three"><div className="card"><span>Welcome</span><h2>{user.employee?.name}</h2><p>{user.employee?.job_title||'Employee'}</p></div><div className="card"><span>Attendance records</span><strong>{data?.length||0}</strong><p>Recent records</p></div><div className="card"><span>Quick action</span><button onClick={()=>location.reload()}>Refresh</button></div></div>}

function Attendance({user,data,refresh}){const today=data?.find(x=>x.date===new Date().toISOString().slice(0,10));return <><div className="actions">{user.role==='EMPLOYEE'&&<><button onClick={async()=>{await request('/attendance/check-in',{method:'POST'});refresh()}}>Check in</button><button className="secondary" onClick={async()=>{await request('/attendance/check-out',{method:'POST'});refresh()}}>Check out</button></>}</div><div className="card"><h3>Attendance</h3><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead><tbody>{(data||[]).map(x=><tr key={x.id}><td>{x.date}</td><td>{x.check_in?new Date(x.check_in).toLocaleTimeString():'—'}</td><td>{x.check_out?new Date(x.check_out).toLocaleTimeString():'—'}</td><td><span className="pill">{x.status}</span></td></tr>)}</tbody></table>{!data?.length&&<p className="muted">No attendance records yet.</p>}</div></>}

function Leaves({user,data,refresh}){const [form,setForm]=useState({leaveType:'Paid',startDate:'',endDate:'',remarks:''});async function submit(e){e.preventDefault();await request('/leaves',{method:'POST',body:JSON.stringify(form)});setForm({...form,startDate:'',endDate:'',remarks:''});refresh()}return <div className="grid">{user.role==='EMPLOYEE'&&<form className="card form" onSubmit={submit}><h3>Apply for leave</h3><select value={form.leaveType} onChange={e=>setForm({...form,leaveType:e.target.value})}><option>Paid</option><option>Sick</option><option>Unpaid</option></select><input type="date" required value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/><input type="date" required value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/><textarea placeholder="Remarks" value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/><button>Submit request</button></form>}<div className="card"><h3>{user.role==='ADMIN'?'All leave requests':'My leave requests'}</h3>{(data||[]).map(x=><div className="list-row" key={x.id}><div><b>{x.name||'Request'}</b><br/>{x.leave_type} · {x.start_date} → {x.end_date}<br/><small>{x.remarks||'No remarks'}</small></div><div>{user.role==='ADMIN'&&x.status==='Pending'?<><button onClick={async()=>{await request('/leaves/'+x.id,{method:'PATCH',body:JSON.stringify({status:'Approved',adminComment:'Approved'})});refresh()}}>Approve</button> <button className="danger" onClick={async()=>{await request('/leaves/'+x.id,{method:'PATCH',body:JSON.stringify({status:'Rejected',adminComment:'Rejected'})});refresh()}}>Reject</button></>:<span className="pill">{x.status}</span>}</div></div>)}</div></div>}

function Payroll({data}){return <div className="card">{data?<><h3>{data.name} — Salary details</h3><div className="salary"><span>Basic salary</span><b>₹{Number(data.basic_salary).toLocaleString()}</b><span>Allowances</span><b>₹{Number(data.allowances).toLocaleString()}</b><span>Deductions</span><b>-₹{Number(data.deductions).toLocaleString()}</b><span>Net</span><strong>₹{(Number(data.basic_salary)+Number(data.allowances)-Number(data.deductions)).toLocaleString()}</strong></div></>:<p className="muted">No payroll record.</p>}</div>}

function Employees({data}){return <div className="card"><h3>Employees</h3><table><thead><tr><th>Name</th><th>Employee ID</th><th>Department</th><th>Job title</th><th>Salary</th></tr></thead><tbody>{(data||[]).map(e=><tr key={e.id}><td>{e.name}</td><td>{e.employee_id}</td><td>{e.department||'—'}</td><td>{e.job_title||'—'}</td><td>₹{Number(e.salary||0).toLocaleString()}</td></tr>)}</tbody></table></div>}

function Root(){const [user,setUser]=useState(null);if(!user)return <Login onLogin={setUser}/>;return <App user={user} onLogout={()=>{localStorage.removeItem('token');setUser(null)}}/>}
createRoot(document.getElementById('root')).render(<Root/>);
