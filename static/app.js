const pages = ['overview','mood','courses','teachers','trends','issues','risks','keywords','records','batch','test','simulate','logs','settings'];
let state = { token: localStorage.getItem('lms_token') || '', dashboard: null, currentPage: 'overview', simulated: [], charts: {} };

function $(id){ return document.getElementById(id); }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function fmt(v){ return typeof v === 'number' ? (Math.round(v*1000)/1000) : (v ?? '—'); }
function toast(msg, type='info'){
  const box = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

async function api(url, options={}){
  const headers = {'Content-Type':'application/json', ...(options.headers || {})};
  if(state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(url, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    if(res.status === 401){ localStorage.removeItem('lms_token'); }
    throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  }
  return data;
}

async function doLogin(){
  const err = $('login-err'); err.style.display='none'; err.textContent='';
  const btn = $('login-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in';
  try{
    const data = await api('/login', {method:'POST', body:JSON.stringify({username:$('login-user').value || 'admin', password:$('login-pass').value || ''})});
    state.token = data.token;
    localStorage.setItem('lms_token', state.token);
    $('user-name').textContent = data.username || 'admin';
    showApp();
  }catch(e){ err.textContent = e.message; err.style.display='block'; }
  finally{ btn.disabled=false; btn.textContent='Sign in'; }
}
function doLogout(){ localStorage.removeItem('lms_token'); state.token=''; location.reload(); }
function showApp(){ $('login-screen').style.display='none'; $('app').classList.add('visible'); showPage('overview'); loadDashboard(); health(); }

function showPage(page){
  state.currentPage = page;
  pages.forEach(p=>{
    const nav = $(`nav-${p}`); if(nav) nav.classList.toggle('active', p===page);
    const el = $(`page-${p}`); if(el) el.classList.toggle('active', p===page);
  });
  if(page === 'records') loadRecords();
  if(page === 'logs') loadLogs();
  if(page === 'settings') health();
}

function badge(v){
  const x = (v || 'none').toString().toLowerCase();
  const cls = ['positive','negative','neutral','critical','high','medium','low'].includes(x) ? `badge-${x}` : 'badge-outline';
  return `<span class="badge ${cls}">${esc(v || 'none')}</span>`;
}
function kpi(label, value, sub=''){
  return `<div class="kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-val">${esc(value)}</div>${sub?`<div class="kpi-sub">${esc(sub)}</div>`:''}</div>`;
}
function empty(icon, text){ return `<div class="empty-state card"><div class="icon">${icon}</div><p>${esc(text)}</p></div>`; }
function table(headers, rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}" class="text-muted">No data yet</td></tr>`}</tbody></table></div>`;
}

async function loadDashboard(){
  try{
    state.dashboard = await api('/dashboard');
    renderDashboard();
    const riskCount = state.dashboard?.overview?.high_critical_count || 0;
    $('risk-badge').style.display = riskCount ? 'inline-flex' : 'none';
    $('risk-badge').textContent = riskCount;
  }catch(e){ toast(e.message, 'error'); }
}

function renderDashboard(){
  if(!state.dashboard) return;
  renderOverview(); renderMood(); renderCourses(); renderTeachers(); renderTrends(); renderIssues(); renderRisks(); renderKeywords();
}
function renderOverview(){
  const o = state.dashboard.overview || {};
  $('overview-body').innerHTML = `
    <div class="kpi-grid">
      ${kpi('Total analyzed', o.total_processed ?? o.total ?? 0, 'persisted results')}
      ${kpi('Avg sentiment', fmt(o.average_sentiment_score ?? o.avg_sentiment_score), '0 negative → 1 positive')}
      ${kpi('Avg confidence', fmt(o.average_confidence ?? o.avg_confidence), 'AI confidence')}
      ${kpi('High/Critical', o.high_critical_count || 0, 'human review cases')}
      ${kpi('Admin attention', o.admin_attention_count || 0, 'requires action')}
      ${kpi('Top issue', o.top_issue_category || o.top_issue || 'none', 'dominant category')}
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-header"><div class="card-title">Executive Summary</div></div><p>${esc(o.executive_summary || 'No processed feedback yet.')}</p></div>
      <div class="card"><div class="card-header"><div class="card-title">Satisfaction Dimensions</div></div><canvas id="chart-dims" height="180"></canvas></div>
      <div class="card"><div class="card-header"><div class="card-title">Sentiment Distribution</div></div><canvas id="chart-sentiment" height="180"></canvas></div>
      <div class="card"><div class="card-header"><div class="card-title">Issue Distribution</div></div><canvas id="chart-issues" height="180"></canvas></div>
    </div>
    <div class="card mt-3"><div class="card-header"><div class="card-title">Latest AI-analyzed feedbacks</div></div>${recordsTable(o.latest || [])}</div>`;
  drawCharts();
}
function renderMood(){
  const m = state.dashboard.university_mood || {};
  $('mood-body').innerHTML = `
    <div class="kpi-grid">${kpi('Dominant emotion', m.dominant_emotion || 'none')}${kpi('University score', fmt(m.university_satisfaction_score))}${kpi('Teaching quality', fmt(m.satisfaction_dimensions?.teaching_quality))}${kpi('Fairness', fmt(m.satisfaction_dimensions?.fairness))}</div>
    <div class="grid-2"><div class="card"><div class="card-title">Emotion distribution</div>${statList(m.emotion_distribution || {})}</div><div class="card"><div class="card-title">Mood trend</div><canvas id="chart-mood-trend" height="220"></canvas></div></div>`;
  drawCharts();
}
function renderCourses(){
  const source = state.dashboard.courses || [];
  const items = Array.isArray(source) ? source : (source.all || source.most_problematic || []);
  const rows = items.map(x=>`<tr><td><b>${esc(x.course_id)}</b><br><span class="text-muted">${esc(x.course_name)}</span></td><td>${x.feedback_count}</td><td>${fmt(x.average_sentiment ?? x.avg_sentiment)}</td><td>${esc(x.top_issue)}</td><td>${x.high_risk_count}</td><td>${(x.top_keywords||[]).slice(0,4).map(k=>`<span class="badge badge-outline">${esc(k)}</span>`).join(' ')}</td></tr>`);
  $('courses-body').innerHTML = `<div class="card"><div class="card-title mb-3">Course intelligence</div>${table(['Course','Count','Avg sentiment','Top issue','High risk','Keywords'], rows)}</div>`;
}
function renderTeachers(){
  const source = state.dashboard.teachers || [];
  const items = Array.isArray(source) ? source : (source.teachers || []);
  const rows = items.map(x=>`<tr><td><b>${esc(x.teacher_fullname || x.teacher_id)}</b><br><span class="text-muted">${esc(x.teacher_role || '')}</span></td><td>${x.feedback_count}</td><td>${fmt(x.average_sentiment_score ?? x.avg_sentiment_score)}</td><td>${esc(x.dominant_emotion)}</td><td>${x.fairness_concern_count}</td><td>${x.high_critical_count}</td></tr>`);
  $('teachers-body').innerHTML = `<div class="alert alert-warn mb-3">AI-assisted monitoring signal, not a final judgment against teachers.</div><div class="card">${table(['Teacher','Feedback','Avg sentiment','Dominant emotion','Fairness concerns','High/Critical'], rows)}</div>`;
}
function renderTrends(){
  const t = state.dashboard.trends || {};
  const series = t.sentiment_over_time || t.daily || t.monthly || [];
  $('trends-body').innerHTML = `<div class="grid-2"><div class="card"><div class="card-title">Sentiment over time</div><canvas id="chart-trend" height="240"></canvas></div><div class="card"><div class="card-title">Trend data</div><div class="json-viewer">${esc(JSON.stringify(series, null, 2))}</div></div></div>`;
  drawCharts();
}
function renderIssues(){
  const x = state.dashboard.issues || {};
  const list = x.issues || x.top_10 || [];
  const enriched = list.map(i => ({issue: i.issue || i.category, count: i.count || 0, percentage: i.percentage || 0, severity_mix: i.severities || i.severity_mix || {}, action: i.top_action || i.suggested_action || ''}));
  const top = n => enriched.slice(0,n).map(i=>`<div class="stat-row"><span class="stat-label">${esc(i.issue)}</span><span class="stat-val">${i.count} · ${i.percentage}%</span></div>`).join('') || '<p class="text-muted">No issues yet</p>';
  $('issues-body').innerHTML = `<div class="grid-3"><div class="card"><div class="card-title">TOP 3</div>${top(3)}</div><div class="card"><div class="card-title">TOP 5</div>${top(5)}</div><div class="card"><div class="card-title">TOP 10</div>${top(10)}</div></div><div class="card mt-3"><div class="card-title">Problem details</div><div class="json-viewer">${esc(JSON.stringify(enriched.slice(0,10), null, 2))}</div></div>`;
}
function renderRisks(){
  const source = state.dashboard.risks || [];
  const items = Array.isArray(source) ? source : (source.alerts || []);
  const rows = items.map(x=>`<tr><td>${esc(x.feedback_id)}</td><td>${esc(x.course_id)}</td><td>${esc(x.teacher_fullname || x.teacher_id)}</td><td>${esc((x.risk?.types || x.risk_types || []).join(', ') || 'none')}<br><span class="text-muted">p=${fmt(x.risk?.probability ?? x.probability)}</span></td><td>${badge(x.severity)}</td><td>${esc(x.recommended_action)}</td></tr>`);
  $('risks-body').innerHTML = `<div class="alert alert-warn mb-3">AI-generated risk indicators require human review before any action.</div><div class="card">${table(['Feedback','Course','Teacher','Risk','Severity','Action'], rows)}</div>`;
}
function renderKeywords(){
  const k = state.dashboard.keywords || {};
  const normalize = arr => (arr || []).map(x => ({name: x.name || x.word || x.topic || x.subtopic || '', count: x.count || 0}));
  const cloud = arr => normalize(arr).map(x=>`<span class="badge badge-outline" style="margin:.15rem">${esc(x.name)} · ${x.count}</span>`).join('') || '<p class="text-muted">No keywords yet</p>';
  $('keywords-body').innerHTML = `<div class="grid-3"><div class="card"><div class="card-title mb-3">Top keywords</div>${cloud(k.top_keywords)}</div><div class="card"><div class="card-title mb-3">Negative words</div>${cloud(k.negative_words || k.top_negative_keywords)}</div><div class="card"><div class="card-title mb-3">Positive words</div>${cloud(k.positive_words || k.top_positive_keywords)}</div></div><div class="card mt-3"><div class="card-title mb-3">Topic clusters</div>${cloud(k.top_topics)}${cloud(k.top_subtopics)}</div>`;
}
function statList(obj){ return Object.entries(obj).map(([k,v])=>`<div class="stat-row"><span class="stat-label">${esc(k)}</span><span class="stat-val">${v}</span></div>`).join('') || '<p class="text-muted">No data</p>'; }

function chart(id,type,labels,data,label=''){
  const el = $(id); if(!el || !window.Chart) return;
  if(state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart(el, {type, data:{labels, datasets:[{label, data, borderWidth:1}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#ddd'}}}, scales:type==='doughnut'?{}:{x:{ticks:{color:'#999'},grid:{color:'#222'}},y:{ticks:{color:'#999'},grid:{color:'#222'}}}}});
}
function drawCharts(){
  const d = state.dashboard; if(!d) return;
  chart('chart-sentiment','doughnut',Object.keys(d.overview?.sentiment_counts || d.overview?.sentiments || {}),Object.values(d.overview?.sentiment_counts || d.overview?.sentiments || {}),'Sentiment');
  chart('chart-issues','bar',Object.keys(d.overview?.issue_distribution || d.overview?.issues || {}),Object.values(d.overview?.issue_distribution || d.overview?.issues || {}),'Issues');
  chart('chart-dims','bar',Object.keys(d.overview?.satisfaction_averages || d.overview?.satisfaction_dimensions || {}),Object.values(d.overview?.satisfaction_averages || d.overview?.satisfaction_dimensions || {}),'Satisfaction');
  const tr=d.trends?.sentiment_over_time || d.trends?.daily || d.trends?.monthly || []; chart('chart-trend','line',tr.map(x=>x.period),tr.map(x=>x.avg_sentiment ?? ((x.positive||0)+(x.neutral||0)*0.5)/Math.max(1,x.total||1)),'Sentiment'); chart('chart-mood-trend','line',tr.map(x=>x.period),tr.map(x=>x.avg_sentiment ?? ((x.positive||0)+(x.neutral||0)*0.5)/Math.max(1,x.total||1)),'Mood');
}

function recordsTable(items){
  const rows = (items||[]).map(r=>{
    const out = r.output || r.outputFromAI || r;
    return `<tr onclick="openRecord('${esc(r.feedback_id)}')"><td>${esc(r.feedback_id)}</td><td>${esc(r.course_id||'')}</td><td>${esc(r.teacher_fullname||r.teacher_id||'')}</td><td>${badge(out.sentiment)}</td><td>${badge(out.severity)}</td><td>${esc(out.issue_category||'')}</td><td>${esc(out.summary_uz||'')}</td></tr>`;
  });
  return table(['ID','Course','Teacher','Sentiment','Severity','Issue','Summary'], rows);
}
async function loadRecords(){
  try{
    const q = new URLSearchParams();
    const map = {sentiment:'filter-sentiment', severity:'filter-severity', issue_category:'filter-issue', requires_admin_attention:'filter-admin'};
    Object.entries(map).forEach(([k,id])=>{ const v=$(id)?.value; if(v) q.set(k,v); });
    const d = await api(`/records?${q.toString()}`);
    $('records-list').innerHTML = `<div class="card">${recordsTable(d.items || [])}</div>`;
  }catch(e){ toast(e.message,'error'); }
}
function clearFilters(){ ['filter-sentiment','filter-severity','filter-issue','filter-admin'].forEach(id=>$(id).value=''); loadRecords(); }
async function openRecord(feedbackId){
  try{
    const r = await api(`/records/${encodeURIComponent(feedbackId)}`);
    $('modal-title').textContent = feedbackId;
    $('modal-body').innerHTML = `<div class="grid-2"><div><h4>InputToSystem</h4><pre class="json-viewer">${esc(JSON.stringify(r.input_to_system,null,2))}</pre></div><div><h4>InputToAI</h4><pre class="json-viewer">${esc(JSON.stringify(r.input_to_ai,null,2))}</pre></div></div><h4>OutputFromAI</h4><pre class="json-viewer">${esc(JSON.stringify(r.output,null,2))}</pre><h4>Raw Model Output</h4><pre class="json-viewer">${esc(r.raw_output||'')}</pre>`;
    $('record-modal').style.display='flex';
  }catch(e){ toast(e.message,'error'); }
}
function closeModal(){ $('record-modal').style.display='none'; }

async function previewSource(){
  try{
    const src = $('batch-source').value;
    const d = await api(`/feedbacks/${src}?limit=10`);
    $('preview-title').textContent = `${src === 'seed' ? 'seed_1600.json' : 'batch_30.json'} · ${d.total} records`;
    $('preview-items').innerHTML = recordsPreview(d.items || []);
    $('source-preview').style.display = 'block';
  }catch(e){ toast(e.message,'error'); }
}
function recordsPreview(items){
  const rows = items.map(x=>`<tr><td>${x.index}</td><td>${esc(x.feedback_id)}</td><td>${esc(x.course_id||'')}</td><td>${esc(x.teacher_id||'')}</td><td>${esc(x.raw_text||'')}</td><td>${x.already_processed ? badge('processed') : badge('pending')}</td></tr>`);
  return table(['#','ID','Course','Teacher','Text','Status'], rows);
}
async function processBatch(){
  const btn=$('process-btn'), status=$('batch-status'); btn.disabled=true; status.innerHTML='<div class="spinner"></div> Processing batch through AI service...';
  try{
    const start=Date.now();
    const d = await api('/process-batch', {method:'POST', body:JSON.stringify({source:$('batch-source').value, limit:Number($('batch-limit').value || 30)})});
    state.dashboard = d.dashboard;
    status.innerHTML = `<div class="kpi-grid">${kpi('Requested',d.total_requested)}${kpi('Success',d.success)}${kpi('Failed',d.failed)}${kpi('Fallback',d.fallback_used)}${kpi('Duration',`${d.duration_seconds}s`)}</div><div class="progress-wrap"><div class="progress-bar" style="width:100%"></div></div>`;
    renderDashboard(); toast(`Batch complete in ${Math.round((Date.now()-start)/1000)}s`,'success');
  }catch(e){ status.innerHTML=`<div class="alert alert-err">${esc(e.message)}</div>`; toast(e.message,'error'); }
  finally{ btn.disabled=false; }
}

function generateRandomContext(){
  const courses=[['CS-101','Algorithms'],['AM-201','Linear Algebra'],['IT-202','Linux Systems'],['DS-202','Statistics for DS']];
  const teachers=[['T-01','Aziz Karimov'],['T-07','Xasanova Zulfiya'],['T-18','Nazarova Maftuna'],['T-09','Mirzayeva Feruza']];
  const c=courses[Math.floor(Math.random()*courses.length)], t=teachers[Math.floor(Math.random()*teachers.length)];
  $('test-fid').value = `custom-${Date.now().toString().slice(-6)}`; $('test-course').value=c[0]; $('test-cname').value=c[1]; $('test-teacher').value=t[0]; $('test-tname').value=t[1]; $('test-dept').value=['Computer Science','Applied Mathematics','Information Technologies','Data Science'][Math.floor(Math.random()*4)]; $('test-gpa').value=(2.8+Math.random()*2.1).toFixed(1); $('test-att').value=(0.55+Math.random()*0.45).toFixed(2);
}
async function analyzeCustom(){
  const btn=$('analyze-btn'); btn.disabled=true; $('test-result-panel').innerHTML='<div class="card"><div class="spinner"></div> Analyzing custom feedback...</div>';
  try{
    const body={raw_text:$('test-text').value, feedback_id:$('test-fid').value || undefined, rating:Number($('test-rating').value||3), course_id:$('test-course').value, teacher_id:$('test-teacher').value, teacher_fullname:$('test-tname').value, course_name:$('test-cname').value, department:$('test-dept').value, gpa:Number($('test-gpa').value||3.5), attendance_rate:Number($('test-att').value||0.85), feedback_channel:$('test-channel').value};
    const d = await api('/analyze-custom', {method:'POST', body:JSON.stringify(body)});
    state.dashboard = d.dashboard; renderDashboard();
    $('test-result-panel').innerHTML = `<div class="card"><div class="card-title mb-3">Structured Output</div><pre class="json-viewer">${esc(JSON.stringify(d.outputFromAI,null,2))}</pre></div><div class="card mt-3"><div class="card-title mb-3">InputToAI</div><pre class="json-viewer">${esc(JSON.stringify(d.inputToAI,null,2))}</pre></div>`;
    toast('Custom feedback analyzed','success');
  }catch(e){ $('test-result-panel').innerHTML=`<div class="alert alert-err">${esc(e.message)}</div>`; toast(e.message,'error'); }
  finally{ btn.disabled=false; }
}

async function generateSim(){
  try{
    const d = await api('/generate-simulated-feedbacks',{method:'POST', body:JSON.stringify({count:Number($('sim-count').value||5), sentiment_style:$('sim-sentiment').value, issue_theme:$('sim-theme').value})});
    state.simulated = d.items || [];
    $('analyze-sim-btn').style.display = state.simulated.length ? 'inline-flex' : 'none';
    $('sim-result-panel').innerHTML = `<div class="card"><div class="card-title">Generated ${state.simulated.length} temporary demo items</div><p class="text-muted">Not saved as dataset. Analyze all to add results to dashboard.</p></div>`;
    $('sim-items-panel').style.display='block'; $('sim-items-panel').innerHTML = `<div class="card">${recordsPreview(state.simulated.map((x,i)=>({index:i,feedback_id:x.feedback_id,course_id:x.metadata?.course_id,teacher_id:x.metadata?.teacher_id,raw_text:x.content?.raw_text,already_processed:false})))}</div>`;
  }catch(e){ toast(e.message,'error'); }
}
async function analyzeSim(){
  try{
    $('sim-result-panel').innerHTML='<div class="card"><div class="spinner"></div> Analyzing simulated items...</div>';
    const d = await api('/analyze-simulated',{method:'POST', body:JSON.stringify({items:state.simulated})});
    await loadDashboard(); $('sim-result-panel').innerHTML=`<div class="card"><pre class="json-viewer">${esc(JSON.stringify(d,null,2))}</pre></div>`; toast('Simulated items analyzed','success');
  }catch(e){ toast(e.message,'error'); }
}

async function loadLogs(){
  try{
    const level = $('log-level-filter').value;
    const d = await api(`/logs${level?`?level=${level}`:''}`);
    $('logs-list').innerHTML = (d.logs||d.items||[]).map(l=>`<div class="log-row log-${esc(l.level)}"><span>${esc(l.timestamp)}</span><b>${esc(l.level)}</b><span>${esc(l.event)}</span><code>${esc(JSON.stringify(l.details||{}))}</code></div>`).join('') || '<p class="text-muted">No logs</p>';
  }catch(e){ toast(e.message,'error'); }
}
async function health(){
  try{
    const h = await api('/health');
    $('ai-badge').textContent = `● ${h.ai_provider || 'mock'}`; $('ai-badge').className = `ai-badge ${h.ai_provider || 'mock'}`;
    ['s-provider','s-project','s-model','s-count'].forEach(id=>{ if($(id)) $(id).textContent='—'; });
    if($('health-info')) $('health-info').innerHTML = `<div class="json-viewer">${esc(JSON.stringify(h,null,2))}</div>`;
    if($('s-provider')) $('s-provider').textContent=h.ai_provider; if($('s-project')) $('s-project').textContent=h.project; if($('s-model')) $('s-model').textContent=h.model; if($('s-count')) $('s-count').textContent=h.processed_count;
  }catch(e){ toast(e.message,'error'); }
}
async function resetDemo(){
  if(!confirm('Clear all processed results and dashboard state?')) return;
  try{ const d=await api('/reset-demo',{method:'POST'}); state.dashboard=d.dashboard; renderDashboard(); toast('Demo state reset','success'); }
  catch(e){ toast(e.message,'error'); }
}

window.addEventListener('DOMContentLoaded', ()=>{
  $('app').classList.remove('visible');
  if(state.token) showApp();
  $('login-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
});
