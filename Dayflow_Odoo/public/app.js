const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem('dayflow_token');
let me = null;

async function api(url, options={}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':'application/json',
      ...(options.headers||{}),
      ...(token ? {Authorization:`Bearer ${token}`} : {})
    }
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(msg, type='success'){
  const t=document.createElement('div');
  t.className='toast '+type;
  t.textContent=msg;
  $('#toast').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function money(v){return '₹'+Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0});}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function firstName(){return (me?.full_name||'there').trim().split(/\s+/)[0]||'there';}
function todayText(){return new Intl.DateTimeFormat('en-IN',{weekday:'long',month:'long',day:'numeric'}).format(new Date());}

$$('.tab').forEach(b=>b.onclick=()=>{
  $$('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  $('#signinForm').classList.toggle('hidden',b.dataset.tab!=='signin');
  $('#signupForm').classList.toggle('hidden',b.dataset.tab!=='signup');
});

$('#signinForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=e.submitter; btn.disabled=true; btn.innerHTML='Signing in…';
  try{
    const d=await api('/api/auth/signin',{method:'POST',body:JSON.stringify({
      email:$('#loginEmail').value.trim(),password:$('#loginPassword').value
    })});
    token=d.token; localStorage.setItem('dayflow_token',token);
    await startApp();
  }catch(err){toast(err.message,'error')}
  finally{btn.disabled=false;btn.innerHTML='Enter workspace <span>→</span>'}
};

$('#signupForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const d=await api('/api/auth/signup',{method:'POST',body:JSON.stringify({
      employeeId:$('#signupId').value.trim(),fullName:$('#signupName').value.trim(),
      email:$('#signupEmail').value.trim(),password:$('#signupPassword').value,role:$('#signupRole').value
    })});
    $('#verificationBox').classList.remove('hidden');
    $('#verificationBox').innerHTML=`<strong>Almost there.</strong><br>Demo verification: <a href="${d.verificationUrl}" target="_blank">${location.origin}${d.verificationUrl}</a>`;
    toast('Account created');
  }catch(err){toast(err.message,'error')}
};

$('#logoutBtn').onclick=()=>{
  localStorage.removeItem('dayflow_token');
  token=null; me=null; location.reload();
};

async function startApp(){
  try{
    me=await api('/api/me');
    $('#authView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    $('#roleLabel').textContent=me.role==='hr'?'HR / ADMIN':'EMPLOYEE';
    updateIdentity();
    buildNav();
    showPage('dashboard');
  }catch(e){
    localStorage.removeItem('dayflow_token'); token=null;
  }
}
function updateIdentity(){
  $('#sideUser').innerHTML=`<div class="side-user"><b>${esc(me.full_name||'Dayflow user')}</b>${esc(me.email)}</div>`;
  $('#avatar').textContent=(me.full_name||'D')[0].toUpperCase();
}
function buildNav(){
  const items=me.role==='hr'
    ? [['dashboard','⌂','Overview'],['employees','◉','People'],['attendance','◷','Attendance'],['leaves','✓','Leave approvals'],['payroll','₹','Payroll'],['profile','◎','My profile']]
    : [['dashboard','⌂','My day'],['attendance','◷','Attendance'],['leaves','✓','Leave requests'],['payroll','₹','My salary'],['profile','◎','My profile']];
  $('#nav').innerHTML=items.map(x=>`<button class="nav-item" data-page="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join('');
  $$('.nav-item').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
}
async function showPage(page){
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={dashboard:me.role==='hr'?'Overview':'My day',employees:'People',attendance:'Attendance',leaves:me.role==='hr'?'Leave approvals':'Leave requests',payroll:'Payroll',profile:'Profile'};
  $('#pageTitle').textContent=titles[page];
  $('#content').innerHTML=`<div class="section"><div class="muted">Loading your workspace…</div></div>`;
  try{
    if(page==='dashboard')return renderDashboard();
    if(page==='employees')return renderEmployees();
    if(page==='attendance')return renderAttendance();
    if(page==='leaves')return renderLeaves();
    if(page==='payroll')return renderPayroll();
    if(page==='profile')return renderProfile(me.id);
  }catch(e){toast(e.message,'error')}
}

async function renderDashboard(){
  const d=await api('/api/dashboard');
  if(me.role==='hr'){
    $('#content').innerHTML=`
      <div class="hero">
        <div><div class="eyebrow">HR CONTROL CENTER • ${todayText().toUpperCase()}</div><h1>Good morning, ${esc(firstName())}.</h1><p>Here’s the pulse of your people today.</p></div>
        <div class="hero-actions"><button class="btn" onclick="showPage('employees')">+ Employee directory</button><button class="primary" onclick="showPage('leaves')">Review leaves →</button></div>
      </div>
      <div class="cards">
        <div class="stat"><div class="label">TOTAL EMPLOYEES</div><div class="value">${d.employees}</div><div class="hint">Active employee accounts</div><div class="trend">↑ Growing team</div></div>
        <div class="stat"><div class="label">PRESENT TODAY</div><div class="value">${d.presentToday}</div><div class="hint">Checked in today</div><div class="trend">● Live</div></div>
        <div class="stat"><div class="label">PENDING LEAVES</div><div class="value">${d.pendingLeaves}</div><div class="hint">Waiting for your decision</div><div class="trend" style="background:#fff7ed;color:#b54708">Action needed</div></div>
        <div class="stat"><div class="label">MONTHLY PAYROLL</div><div class="value">${money(d.payroll)}</div><div class="hint">Configured net payroll</div></div>
      </div>
      <div class="dashboard-grid">
        <div class="section chart-card"><div class="section-head"><div><h3>Attendance rhythm</h3><span class="muted">A simple view of the week</span></div><span class="badge Present">Healthy</span></div>
          <div class="chart">${[72,84,76,92,88,96,81].map((v,i)=>`<div class="bar" style="height:${v}%"><small>${['M','T','W','T','F','S','S'][i]}</small></div>`).join('')}</div>
        </div>
        <div class="section"><div class="section-head"><div><h3>Today at a glance</h3><span class="muted">Team availability</span></div></div>
          <div class="donut-wrap"><div class="donut"></div><div class="donut-center"><b>${d.employees?Math.round(d.presentToday/d.employees*100):0}%</b><span>present</span></div></div>
          <div class="legend"><span><i></i>Present</span><span><i class="off"></i>Other</span></div>
        </div>
      </div>
      <div class="section"><div class="section-head"><div><h3>Quick actions</h3><span class="muted">Jump straight into the work</span></div></div>
        <div class="quick-actions"><button class="btn" onclick="showPage('employees')">◉ People</button><button class="btn" onclick="showPage('attendance')">◷ Attendance</button><button class="btn" onclick="showPage('leaves')">✓ Leave approvals</button><button class="btn" onclick="showPage('payroll')">₹ Payroll</button></div>
      </div>`;
  } else {
    const attendancePct=Math.min(100,Math.round((d.presentDays/22)*100));
    $('#content').innerHTML=`
      <div class="hero">
        <div><div class="eyebrow">YOUR DAY • ${todayText().toUpperCase()}</div><h1>Good morning, ${esc(firstName())}.</h1><p>Everything you need for a smoother workday, in one place.</p></div>
        <div class="hero-actions"><button class="primary" onclick="checkIn()">Check in now →</button></div>
      </div>
      <div class="cards">
        <div class="stat"><div class="label">PRESENT DAYS</div><div class="value">${d.presentDays}</div><div class="hint">Recorded attendance</div><div class="trend">On track</div></div>
        <div class="stat"><div class="label">PENDING LEAVES</div><div class="value">${d.pendingLeaves}</div><div class="hint">Awaiting HR approval</div></div>
        <div class="stat"><div class="label">NET SALARY</div><div class="value">${money(d.netSalary)}</div><div class="hint">Current payroll view</div></div>
        <div class="stat"><div class="label">ATTENDANCE SCORE</div><div class="value">${attendancePct}%</div><div class="hint">Based on 22 working days</div></div>
      </div>
      <div class="dashboard-grid">
        <div class="section chart-card"><div class="section-head"><div><h3>This week</h3><span class="muted">Your attendance rhythm</span></div><span class="badge Present">On track</span></div>
          <div class="chart">${[88,94,91,97,82,0,0].map((v,i)=>`<div class="bar" style="height:${Math.max(v,8)}%;opacity:${v?1:.18}"><small>${['M','T','W','T','F','S','S'][i]}</small></div>`).join('')}</div>
        </div>
        <div class="section"><div class="section-head"><div><h3>Quick actions</h3><span class="muted">Save a few clicks</span></div></div>
          <div class="quick-actions" style="display:grid;grid-template-columns:1fr 1fr">
            <button class="btn success" onclick="checkIn()">◉ Check in</button><button class="btn" onclick="checkOut()">◉ Check out</button>
            <button class="btn" onclick="showPage('leaves')">✓ Apply leave</button><button class="btn" onclick="showPage('payroll')">₹ View salary</button>
          </div>
        </div>
      </div>
      <div class="section"><div class="section-head"><div><h3>Recent activity</h3><span class="muted">Your Dayflow workspace</span></div></div>
        <div class="activity"><div class="activity-item"><div class="activity-icon">✓</div><div><b>Profile is ready</b><small>Keep your contact details up to date.</small></div></div>
        <div class="activity-item"><div class="activity-icon">◷</div><div><b>Attendance is synced</b><small>Your latest attendance is visible in Attendance.</small></div></div>
        <div class="activity-item"><div class="activity-icon">₹</div><div><b>Payroll is available</b><small>View your current salary structure anytime.</small></div></div></div>
      </div>`;
  }
}

async function renderEmployees(){
  const rows=await api('/api/employees');
  $('#content').innerHTML=`
    <div class="hero"><div><div class="eyebrow">PEOPLE DIRECTORY</div><h1>Your team.</h1><p>Browse employee records, roles and compensation.</p></div><button class="primary" onclick="showPage('profile')">My profile →</button></div>
    <div class="section"><div class="section-head"><div><h3>All employees</h3><span class="muted">${rows.length} people in your workspace</span></div><input class="search" id="empSearch" placeholder="Search by name, ID or email…"></div>
    <div class="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Job title</th><th>Salary</th><th>Action</th></tr></thead><tbody id="empBody">${rows.map(r=>empRow(r)).join('')}</tbody></table></div></div>`;
  $('#empSearch').oninput=e=>$$('#empBody tr').forEach(tr=>tr.style.display=tr.innerText.toLowerCase().includes(e.target.value.toLowerCase())?'':'none');
}
function empRow(r){return `<tr><td><b>${esc(r.full_name)}</b><br><small>${esc(r.employee_id)} · ${esc(r.email)}</small></td><td><span class="badge ${r.role==='hr'?'Approved':'Present'}">${r.role==='hr'?'HR':'Employee'}</span></td><td>${esc(r.department||'—')}</td><td>${esc(r.job_title||'—')}</td><td class="salary">${money(r.salary)}</td><td><button class="btn" onclick="showPage('profile');setTimeout(()=>renderProfile(${r.id}),80)">View profile</button></td></tr>`}

async function renderAttendance(){
  let rows=await api('/api/attendance');
  if(me.role==='hr'){
    const employees=await api('/api/employees');
    $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">TIME & ATTENDANCE</div><h1>Attendance.</h1><p>See who is present and how the team is tracking.</p></div></div>
      <div class="section"><div class="section-head"><div><h3>Attendance records</h3><span class="muted">Select an employee to inspect their timeline.</span></div><select id="attEmployee" class="search"><option value="${me.id}">My records</option>${employees.filter(x=>x.role==='employee').map(x=>`<option value="${x.id}">${esc(x.full_name)} (${x.employee_id})</option>`).join('')}</select></div><div id="attTable"></div></div>`;
    const draw=async()=>{rows=await api('/api/attendance?userId='+$('#attEmployee').value);$('#attTable').innerHTML=attendanceTable(rows)};
    $('#attEmployee').onchange=draw; return draw();
  }
  $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">TIME & ATTENDANCE</div><h1>Own your time.</h1><p>Clock in, clock out and keep your attendance clean.</p></div><div class="hero-actions"><button class="btn success" onclick="checkIn()">Check in</button><button class="btn" onclick="checkOut()">Check out</button></div></div>
    <div class="section"><div class="section-head"><div><h3>My attendance</h3><span class="muted">Latest 60 records</span></div></div>${attendanceTable(rows)}</div>`;
}
function attendanceTable(rows){return rows.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${new Date(r.attendance_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</b></td><td>${r.check_in?new Date(r.check_in).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td>${r.check_out?new Date(r.check_out).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td><span class="badge ${r.status}">${r.status}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><div class="empty-icon">◷</div><b>No attendance yet</b><div>Once you check in, your records will appear here.</div></div>'}
async function checkIn(){try{await api('/api/attendance/checkin',{method:'POST'});toast('You’re checked in ✓');showPage('attendance')}catch(e){toast(e.message,'error')}}
async function checkOut(){try{await api('/api/attendance/checkout',{method:'POST'});toast('Checked out successfully');showPage('attendance')}catch(e){toast(e.message,'error')}}

async function renderLeaves(){
  const rows=me.role==='hr'?await api('/api/all-leaves'):await api('/api/leaves');
  $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">TIME OFF</div><h1>${me.role==='hr'?'Leave approvals.':'Leave requests.'}</h1><p>${me.role==='hr'?'Keep approvals moving and your team informed.':'Request time away and track every decision.'}</p></div>${me.role==='employee'?'<button class="primary" onclick="openLeaveModal()">+ Apply for leave</button>':''}</div>
    <div class="section"><div class="section-head"><div><h3>${me.role==='hr'?'All requests':'My requests'}</h3><span class="muted">${rows.length} request${rows.length===1?'':'s'}</span></div></div>${leaveTable(rows)}</div>`;
}
function leaveTable(rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${me.role==='hr'?'<th>Employee</th>':''}<th>Type</th><th>Dates</th><th>Remarks</th><th>Status</th>${me.role==='hr'?'<th>Action</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr>${me.role==='hr'?`<td><b>${esc(r.full_name)}</b><br><small>${esc(r.employee_id)}</small></td>`:''}<td>${esc(r.leave_type)}</td><td>${new Date(r.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} → ${new Date(r.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td><td>${esc(r.remarks||'—')}</td><td><span class="badge ${r.status}">${r.status}</span></td>${me.role==='hr'?`<td>${r.status==='Pending'?`<button class="btn success" onclick="decideLeave(${r.id},'Approved')">Approve</button> <button class="btn danger" onclick="decideLeave(${r.id},'Rejected')">Reject</button>`:'—'}</td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty"><div class="empty-icon">✓</div><b>No leave requests</b><div>Your leave workflow is clear.</div></div>'}
function openLeaveModal(){
  const m=document.createElement('div');m.className='modal';m.id='leaveModal';
  m.innerHTML=`<div class="modal-card"><button class="close" onclick="$('#leaveModal').remove()">×</button><div class="eyebrow">TIME OFF</div><h2>Take some time.</h2><p class="muted">Submit a request for HR approval.</p><form id="leaveForm"><label>Leave type<select id="leaveType"><option>Paid</option><option>Sick</option><option>Unpaid</option></select></label><div class="grid2"><label>Start date<input id="startDate" type="date" required></label><label>End date<input id="endDate" type="date" required></label></div><label>Remarks<textarea id="remarks" rows="3" placeholder="Optional context for HR"></textarea></label><div class="form-actions"><button type="button" class="btn" onclick="$('#leaveModal').remove()">Cancel</button><button class="primary">Submit request →</button></div></form></div>`;
  document.body.appendChild(m);
  $('#leaveForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/leaves',{method:'POST',body:JSON.stringify({leaveType:$('#leaveType').value,startDate:$('#startDate').value,endDate:$('#endDate').value,remarks:$('#remarks').value})});$('#leaveModal').remove();toast('Leave request submitted');renderLeaves()}catch(err){toast(err.message,'error')}};
}
async function decideLeave(id,status){
  const comment=status==='Rejected'?prompt('Reason for rejection:')||'Rejected by HR':prompt('Optional approval comment:')||'';
  try{await api('/api/leaves/'+id,{method:'PATCH',body:JSON.stringify({status,adminComment:comment})});toast(`Leave ${status.toLowerCase()}`);renderLeaves()}catch(e){toast(e.message,'error')}
}

async function renderPayroll(){
  if(me.role==='hr'){
    const rows=await api('/api/all-payroll');
    $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">COMPENSATION</div><h1>Payroll control.</h1><p>Maintain salary structures and keep net pay transparent.</p></div></div>
      <div class="section"><div class="section-head"><div><h3>Salary structures</h3><span class="muted">Edit the components below and save per employee.</span></div></div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net salary</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.full_name)}</b><br><small>${r.employee_id}</small></td><td><input id="b${r.user_id}" value="${r.basic_salary}"></td><td><input id="a${r.user_id}" value="${r.allowances}"></td><td><input id="d${r.user_id}" value="${r.deductions}"></td><td class="salary">${money(r.net_salary)}</td><td><button class="btn success" onclick="savePayroll(${r.user_id})">Save</button></td></tr>`).join('')}</tbody></table></div></div>`;
  } else {
    const r=await api('/api/payroll');
    $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">COMPENSATION</div><h1>Your salary.</h1><p>A clear view of your current configured payroll.</p></div><span class="badge Approved">READ ONLY</span></div>
      <div class="cards"><div class="stat"><div class="label">BASIC</div><div class="value">${money(r?.basic_salary)}</div></div><div class="stat"><div class="label">ALLOWANCES</div><div class="value">${money(r?.allowances)}</div></div><div class="stat"><div class="label">DEDUCTIONS</div><div class="value">${money(r?.deductions)}</div></div><div class="stat"><div class="label">NET SALARY</div><div class="value">${money(r?.net_salary)}</div></div></div>
      <div class="section"><div class="section-head"><div><h3>Salary details</h3><span class="muted">Your current payroll configuration</span></div></div><div class="profile-grid"><div class="field"><small>Employee</small><b>${esc(r?.full_name)}</b></div><div class="field"><small>Employee ID</small><b>${esc(r?.employee_id)}</b></div><div class="field"><small>Net pay</small><b>${money(r?.net_salary)}</b></div></div></div>`;
  }
}
async function savePayroll(id){try{await api('/api/payroll/'+id,{method:'PATCH',body:JSON.stringify({basicSalary:$('#b'+id).value,allowances:$('#a'+id).value,deductions:$('#d'+id).value})});toast('Payroll updated ✓');renderPayroll()}catch(e){toast(e.message,'error')}}

async function renderProfile(id){
  const p=await api('/api/profile/'+id);const editable=me.role==='hr'||id===me.id;
  $('#content').innerHTML=`<div class="hero"><div><div class="eyebrow">PEOPLE PROFILE</div><h1>${esc(p.full_name)}.</h1><p>${esc(p.job_title||'Dayflow team member')} · ${esc(p.department||'Department not set')}</p></div>${editable?`<button class="primary" onclick="openProfileModal(${p.id})">Edit profile →</button>`:''}</div>
    <div class="section"><div class="section-head"><div><h3>Profile overview</h3><span class="muted">Your people record in Dayflow</span></div><span class="badge ${p.role==='hr'?'Approved':'Present'}">${p.role==='hr'?'HR / ADMIN':'EMPLOYEE'}</span></div>
    <div class="profile-grid"><div class="field"><small>Employee ID</small><b>${esc(p.employee_id)}</b></div><div class="field"><small>Email</small><b>${esc(p.email)}</b></div><div class="field"><small>Phone</small><b>${esc(p.phone||'—')}</b></div><div class="field"><small>Address</small><b>${esc(p.address||'—')}</b></div><div class="field"><small>Job title</small><b>${esc(p.job_title||'—')}</b></div><div class="field"><small>Department</small><b>${esc(p.department||'—')}</b></div><div class="field"><small>Joining date</small><b>${p.joining_date?new Date(p.joining_date).toLocaleDateString('en-IN'):'—'}</b></div><div class="field"><small>Salary</small><b>${money(p.salary)}</b></div><div class="field"><small>Documents</small><b>${esc(p.documents||'—')}</b></div></div></div>`;
}
function openProfileModal(id){
  api('/api/profile/'+id).then(p=>{
    const hr=me.role==='hr';const m=document.createElement('div');m.className='modal';m.id='profileModal';
    m.innerHTML=`<div class="modal-card"><button class="close" onclick="$('#profileModal').remove()">×</button><div class="eyebrow">PROFILE EDITOR</div><h2>Keep it current.</h2><p class="muted">Update the people record below.</p><form id="profileForm"><div class="grid2"><label>Full name<input id="pfName" value="${esc(p.full_name)}" ${hr?'':'disabled'}></label><label>Phone<input id="pfPhone" value="${esc(p.phone||'')}"></label></div><label>Address<input id="pfAddress" value="${esc(p.address||'')}"></label>${hr?`<div class="grid2"><label>Job title<input id="pfJob" value="${esc(p.job_title||'')}"></label><label>Department<input id="pfDept" value="${esc(p.department||'')}"></label><label>Joining date<input id="pfJoin" type="date" value="${p.joining_date||''}"></label><label>Salary<input id="pfSalary" type="number" value="${p.salary||0}"></label></div>`:''}<div class="form-actions"><button type="button" class="btn" onclick="$('#profileModal').remove()">Cancel</button><button class="primary">Save changes →</button></div></form></div>`;
    document.body.appendChild(m);
    $('#profileForm').onsubmit=async e=>{
      e.preventDefault();const body={phone:$('#pfPhone').value,address:$('#pfAddress').value};
      if(hr)Object.assign(body,{full_name:$('#pfName').value,job_title:$('#pfJob').value,department:$('#pfDept').value,joining_date:$('#pfJoin').value,salary:$('#pfSalary').value});
      try{await api('/api/profile/'+id,{method:'PATCH',body:JSON.stringify(body)});$('#profileModal').remove();toast('Profile updated ✓');renderProfile(id);me=await api('/api/me');updateIdentity()}catch(err){toast(err.message,'error')}
    };
  });
}
function showNotifications(){
  const m=document.createElement('div');m.className='modal';m.id='notifModal';
  m.innerHTML=`<div class="modal-card"><button class="close" onclick="$('#notifModal').remove()">×</button><div class="eyebrow">NOTIFICATIONS</div><h2>You’re all caught up.</h2><div class="activity" style="margin-top:12px"><div class="activity-item"><div class="activity-icon">✓</div><div><b>Dayflow is connected</b><small>Your workspace is synced with Supabase.</small></div></div><div class="activity-item"><div class="activity-icon">◷</div><div><b>Attendance is ready</b><small>Check in when your workday begins.</small></div></div><div class="activity-item"><div class="activity-icon">✦</div><div><b>Welcome to the new Dayflow</b><small>A cleaner workspace for your team.</small></div></div></div></div>`;
  document.body.appendChild(m);
}

if(token) startApp();
