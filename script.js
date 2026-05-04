/* ════════════════════════════════════════════
   Health Tracker — script.js
   Full modular JavaScript with PHP backend
   communication via Fetch API
════════════════════════════════════════════ */

'use strict';

// ════════════════════════════════════════════
//  CONFIGURATION
// ════════════════════════════════════════════
const API = 'http://localhost/webpro5/backend.php';// Path to PHP backend

// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════
let currentUser    = null;   // Logged-in user object
let records        = [];     // Basic health records
let advancedRecs   = [];     // Advanced health records
let editingId      = null;   // ID of record being edited
let editingAdvId   = null;   // ID of advanced record being edited
let waterGoal      = 2.5;    // Daily water goal in litres
let stepsGoal      = 10000;  // Daily steps goal
let dismissedAlerts= [];     // IDs of dismissed alert types

// Chart instances (kept global to allow destroy/re-create)
let weightChart = null, historyChart = null;
let rptWeightChart = null, rptBmiChart = null, rptStepsChart = null;

// Water cup state (each cup = 250ml, 10 cups default = 2.5L)
let cupState = Array(10).fill(false);

// ════════════════════════════════════════════
//  FETCH HELPER — communicates with backend.php
// ════════════════════════════════════════════
async function api(action, payload = {}) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API error:', err);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// ════════════════════════════════════════════
//  AUTH — Login / Register / Logout
// ════════════════════════════════════════════

/** Switch to Register form */
function showRegister() {
  document.getElementById('login-card').style.display   = 'none';
  document.getElementById('register-card').style.display = 'block';
}

/** Switch to Login form */
function showLogin() {
  document.getElementById('register-card').style.display = 'none';
  document.getElementById('login-card').style.display    = 'block';
}

/** Handle Login form submit */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const msg   = document.getElementById('login-msg');

  if (!email || !pass) { showMsg(msg, 'error', 'Please fill all fields.'); return; }

  const btn = document.querySelector('#login-card .btn-primary');
  btn.textContent = 'Signing in…'; btn.disabled = true;

  const res = await api('login', { email, password: pass });

  btn.textContent = 'Sign In →'; btn.disabled = false;

  if (res.success) {
    launchApp(res.user);
  } else {
    showMsg(msg, 'error', res.error || 'Invalid email or password.');
  }
}

/** Handle Register form submit */
async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const msg   = document.getElementById('reg-msg');

  if (!name || !email || !pass) { showMsg(msg, 'error', 'Please fill all fields.'); return; }
  if (pass.length < 8) { showMsg(msg, 'error', 'Password must be at least 8 characters.'); return; }
  if (pass !== pass2)  { showMsg(msg, 'error', 'Passwords do not match.'); return; }

  const btn = document.querySelector('#register-card .btn-primary');
  btn.textContent = 'Creating…'; btn.disabled = true;

  const res = await api('register', { name, email, password: pass });

  btn.textContent = 'Create Account →'; btn.disabled = false;

  if (res.success) {
    launchApp(res.user);
  } else {
    showMsg(msg, 'error', res.error || 'Registration failed.');
  }
}

/** Logout — clear session on backend */
async function doLogout() {
  await api('logout');
  currentUser = null;
  records = []; advancedRecs = [];
  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
  toast('Signed out successfully', 'success');
}

/** Display auth message box */
function showMsg(el, type, text) {
  el.className   = `msg-box ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

// ════════════════════════════════════════════
//  APP LAUNCH — called after successful login
// ════════════════════════════════════════════
async function launchApp(user) {
  currentUser = user;

  // Load profile preferences from localStorage (extended profile)
  const prefs = loadProfilePrefs(user.id);
  waterGoal  = prefs.waterGoal  || 2.5;
  stepsGoal  = prefs.stepsGoal  || 10000;
  dismissedAlerts = JSON.parse(localStorage.getItem(`ht_dismissed_${user.id}`) || '[]');

  // Switch screens
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display         = 'block';

  // Populate sidebar user info
  document.getElementById('sidebar-avatar').textContent = user.name[0].toUpperCase();
  document.getElementById('sidebar-name').textContent   = user.name;

  // Populate profile section
  document.getElementById('profile-avatar-lg').textContent  = user.name[0].toUpperCase();
  document.getElementById('profile-name-display').textContent = user.name;
  document.getElementById('profile-email-display').textContent = user.email;
  document.getElementById('prof-name').value  = user.name;
  document.getElementById('prof-email').value = user.email;

  // Apply saved profile preferences to form
  document.getElementById('prof-age').value        = prefs.age        || '';
  document.getElementById('prof-gender').value     = prefs.gender     || '';
  document.getElementById('prof-height').value     = prefs.height     || '';
  document.getElementById('prof-goal').value       = prefs.goal       || 'maintain';
  document.getElementById('prof-water-goal').value = prefs.waterGoal  || 2.5;
  document.getElementById('prof-steps-goal').value = prefs.stepsGoal  || 10000;

  // Time-based greeting
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const emoji = hour < 12 ? '🌅' : hour < 17 ? '🌿' : '🌙';
  document.getElementById('greeting-emoji').textContent = emoji;
  document.getElementById('greeting-text').textContent  = `${greet}, ${user.name.split(' ')[0]}!`;

  // Fetch all data and render
  await fetchAllData();
  initWaterCups();

  // Show AI suggestions banner after a short delay for UX polish
  setTimeout(() => showAISuggestions(), 600);

  // Set water reminder (every 90 minutes)
  setInterval(() => waterReminder(), 90 * 60 * 1000);
}

// ════════════════════════════════════════════
//  DATA FETCHING — load all records from PHP
// ════════════════════════════════════════════

/** Fetch basic records + advanced records in parallel */
async function fetchAllData() {
  const [recRes, advRes] = await Promise.all([
    api('getRecords'),
    api('getAdvanced')
  ]);
  if (recRes.success)  records      = recRes.records      || [];
  if (advRes.success)  advancedRecs = advRes.records      || [];

  refreshDashboard();
}

// ════════════════════════════════════════════
//  DASHBOARD — main refresh controller
// ════════════════════════════════════════════
function refreshDashboard() {
  if (!currentUser) return;
  updateMetricCards();
  renderRecentTable();
  renderHistoryTable();
  updateGoals();
  drawCharts();
  updateProfileStats();
  updateAdvancedCards();
  renderAdvancedTable();
  checkAlerts(false);
  updateAchievements();
}

// ── Metric Cards ──────────────────────────
function updateMetricCards() {
  if (records.length === 0) return;
  const latest = records[records.length - 1];

  // Weight card
  document.getElementById('m-weight').textContent    = latest.weight;
  document.getElementById('m-weight-sub').innerHTML  = `<span>Last: ${fmtDate(latest.date)}</span>`;

  // BMI card
  document.getElementById('m-bmi').textContent       = latest.bmi;
  const { label, cls } = bmiCategory(latest.bmi);
  document.getElementById('m-bmi-sub').innerHTML     = `<span class="chip ${cls}">${label}</span>`;

  // Steps card
  document.getElementById('m-steps').textContent     = Number(latest.steps).toLocaleString();
  const stepPct = Math.min(100, Math.round((latest.steps / stepsGoal) * 100));
  document.getElementById('m-steps-sub').innerHTML   = `${stepPct}% of daily goal`;

  // Water card
  document.getElementById('m-water').textContent     = latest.water_intake;
  const waterPct = Math.min(100, Math.round((latest.water_intake / waterGoal) * 100));
  document.getElementById('m-water-sub').innerHTML   = `${waterPct}% of daily goal`;
  document.getElementById('water-goal-label').textContent = `Goal: ${waterGoal}L`;
}

// ── Advanced Vitals Cards ──────────────────
function updateAdvancedCards() {
  if (advancedRecs.length === 0) return;
  const latest = advancedRecs[advancedRecs.length - 1];

  // Blood Pressure
  if (latest.systolic && latest.diastolic) {
    document.getElementById('m-bp').textContent = `${latest.systolic}/${latest.diastolic}`;
    const bpS = bpStatus(latest.systolic, latest.diastolic);
    document.getElementById('m-bp-sub').innerHTML = `<span class="chip ${bpS.cls}">${bpS.label}</span>`;
  }

  // Heart Rate
  if (latest.heart_rate) {
    document.getElementById('m-hr').textContent = latest.heart_rate;
    const hrS = hrStatus(latest.heart_rate);
    document.getElementById('m-hr-sub').innerHTML = `<span class="chip ${hrS.cls}">${hrS.label}</span>`;
  }

  // Blood Sugar
  if (latest.blood_sugar) {
    document.getElementById('m-sugar').textContent = latest.blood_sugar;
    const typeLabel = latest.sugar_type === 'fasting' ? 'Fasting' : 'After Meal';
    document.getElementById('m-sugar-sub').textContent = typeLabel;
  }

  // Sleep
  if (latest.sleep_hours) {
    document.getElementById('m-sleep').textContent = latest.sleep_hours;
    const sleepS = sleepStatus(latest.sleep_hours, latest.sleep_quality);
    document.getElementById('m-sleep-sub').innerHTML = `<span class="chip sleep-${latest.sleep_quality || 'good'}">${sleepS}</span>`;
  }

  // Nutrition
  document.getElementById('m-calories').textContent = latest.calories || '--';
  document.getElementById('m-protein').textContent  = latest.protein  || '--';
  document.getElementById('m-carbs').textContent    = latest.carbs    || '--';
  document.getElementById('m-fat').textContent      = latest.fat      || '--';

  // Activity
  if (latest.activity_type) {
    const icons = { walking: '🚶', running: '🏃', cycling: '🚴' };
    document.getElementById('m-activity-icon').textContent    = icons[latest.activity_type] || '🏋️';
    document.getElementById('m-activity-type').textContent    = capitalize(latest.activity_type);
    document.getElementById('m-activity-details').textContent = `${latest.activity_duration || 0} minutes`;
    const burned = calcBurnedCals(latest.activity_type, latest.activity_duration);
    document.getElementById('m-calories-burned').textContent  = burned + ' kcal';
  }
}

// ── Goal Bars ─────────────────────────────
function updateGoals() {
  if (records.length === 0) return;
  const latest   = records[records.length - 1];
  const stepsPct = Math.min(100, Math.round((latest.steps / stepsGoal) * 100));
  const waterPct = Math.min(100, Math.round((latest.water_intake / waterGoal) * 100));
  const entryPct = Math.min(100, Math.round((records.length / 30) * 100));
  setGoal('g-steps',   stepsPct);
  setGoal('g-water',   waterPct);
  setGoal('g-entries', entryPct);
}

function setGoal(id, pct) {
  document.getElementById(`${id}-pct`).textContent   = pct + '%';
  document.getElementById(`${id}-bar`).style.width   = pct + '%';
}

// ────────────────────────────────────────────
//  TABLES
// ────────────────────────────────────────────

/** Render the 5-row recent records table on Dashboard */
function renderRecentTable() {
  const tbody  = document.getElementById('recent-tbody');
  const recent = [...records].reverse().slice(0, 5);
  tbody.innerHTML = recent.length ? recent.map(r => rowHTML(r)).join('') : emptyRow(7);
}

/** Render full records table on History page */
function renderHistoryTable() {
  const tbody = document.getElementById('history-tbody');
  const all   = [...records].reverse();
  tbody.innerHTML = all.length ? all.map(r => rowHTML(r)).join('') : emptyRow(7);
  document.getElementById('total-records').textContent = `${records.length} entries`;
}

/** Build a basic record row */
function rowHTML(r) {
  const { label, cls } = bmiCategory(r.bmi);
  return `<tr>
    <td>${fmtDate(r.date)}</td>
    <td>${r.weight} kg</td>
    <td>${r.height} cm</td>
    <td><span class="bmi-badge chip ${cls}">${r.bmi} · ${label}</span></td>
    <td>${Number(r.steps).toLocaleString()}</td>
    <td>${r.water_intake} L</td>
    <td>
      <button class="action-btn edit" onclick="editEntry(${r.id})">✏️</button>
      <button class="action-btn delete" onclick="deleteEntry(${r.id})">🗑️</button>
    </td>
  </tr>`;
}

/** Render the advanced health history table */
function renderAdvancedTable() {
  const tbody = document.getElementById('advanced-tbody');
  const all   = [...advancedRecs].reverse();
  tbody.innerHTML = all.length ? all.map(r => advRowHTML(r)).join('') : emptyRow(8);
  document.getElementById('total-advanced').textContent = `${advancedRecs.length} entries`;
}

/** Build an advanced record row */
function advRowHTML(r) {
  const bpText  = (r.systolic && r.diastolic) ? `${r.systolic}/${r.diastolic}` : '--';
  const bpS     = (r.systolic && r.diastolic) ? bpStatus(r.systolic, r.diastolic) : null;
  const hrText  = r.heart_rate || '--';
  const hrS     = r.heart_rate ? hrStatus(r.heart_rate) : null;
  const sugarTx = r.blood_sugar ? `${r.blood_sugar} (${r.sugar_type === 'fasting' ? 'F' : 'AM'})` : '--';
  const sleepTx = r.sleep_hours ? `${r.sleep_hours}h · ${r.sleep_quality || ''}` : '--';
  const actTx   = r.activity_type ? `${capitalize(r.activity_type)} ${r.activity_duration}m` : '--';
  const calTx   = r.calories ? `${r.calories} kcal` : '--';

  return `<tr>
    <td>${fmtDate(r.date)}</td>
    <td>${bpS ? `<span class="chip ${bpS.cls}">${bpText}</span>` : bpText}</td>
    <td>${hrS ? `<span class="chip ${hrS.cls}">${hrText}</span>` : hrText}</td>
    <td>${sugarTx}</td>
    <td>${sleepTx}</td>
    <td>${actTx}</td>
    <td>${calTx}</td>
    <td>
      <button class="action-btn edit" onclick="editAdvanced(${r.id})">✏️</button>
      <button class="action-btn delete" onclick="deleteAdvanced(${r.id})">🗑️</button>
    </td>
  </tr>`;
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📋</div>No records yet. Log your first entry!</div></td></tr>`;
}

// ════════════════════════════════════════════
//  CHARTS
// ════════════════════════════════════════════

/** Common Chart.js options generator */
const chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11, family: 'DM Sans' } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11, family: 'DM Sans' } } }
  }
};

function makeLineDataset(vals, borderColor, fillColor) {
  return {
    data: vals,
    borderColor: borderColor,
    backgroundColor: (ctx) => {
      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, fillColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      return g;
    },
    fill: true, tension: 0.4, pointRadius: 4,
    pointBackgroundColor: borderColor,
    pointBorderColor: '#111827', pointBorderWidth: 2,
  };
}

/** Draw/refresh dashboard charts */
function drawCharts() {
  const data    = records.slice(-7);
  const labels  = data.map(r => fmtDate(r.date, true));
  const weights = data.map(r => parseFloat(r.weight));

  if (weightChart) weightChart.destroy();
  const wCtx = document.getElementById('weightChart').getContext('2d');
  weightChart = new Chart(wCtx, {
    type: 'line',
    data: { labels, datasets: [makeLineDataset(weights, '#4ade80', 'rgba(74,222,128,0.2)')] },
    options: chartDefaults
  });

  if (historyChart) historyChart.destroy();
  const hCtx    = document.getElementById('historyChart').getContext('2d');
  const hLabels = records.slice(-10).map(r => fmtDate(r.date, true));
  historyChart = new Chart(hCtx, {
    type: 'bar',
    data: {
      labels: hLabels,
      datasets: [
        {
          label: 'Steps',
          data: records.slice(-10).map(r => r.steps),
          backgroundColor: 'rgba(56,189,248,0.5)',
          borderColor: '#38bdf8', borderWidth: 1, borderRadius: 4, yAxisID: 'y',
        },
        {
          label: 'Water (×1000)',
          data: records.slice(-10).map(r => r.water_intake * 1000),
          backgroundColor: 'rgba(251,191,36,0.5)',
          borderColor: '#fbbf24', borderWidth: 1, borderRadius: 4, yAxisID: 'y',
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11, family: 'DM Sans' } } } },
    }
  });
}

// ════════════════════════════════════════════
//  REPORTS — weekly / monthly charts
// ════════════════════════════════════════════
function renderReports() {
  const days    = parseInt(document.getElementById('report-period').value);
  const cutoff  = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const filtered = records.filter(r => new Date(r.date) >= cutoff);

  if (filtered.length === 0) {
    document.getElementById('rpt-avg-weight').textContent = '--';
    document.getElementById('rpt-avg-bmi').textContent    = '--';
    document.getElementById('rpt-avg-steps').textContent  = '--';
    document.getElementById('rpt-avg-water').textContent  = '--';
    if (rptWeightChart) rptWeightChart.destroy();
    if (rptBmiChart)    rptBmiChart.destroy();
    if (rptStepsChart)  rptStepsChart.destroy();
    return;
  }

  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  const weights = filtered.map(r => parseFloat(r.weight));
  const bmis    = filtered.map(r => parseFloat(r.bmi));
  const steps   = filtered.map(r => parseInt(r.steps));
  const waters  = filtered.map(r => parseFloat(r.water_intake));
  const labels  = filtered.map(r => fmtDate(r.date, true));

  // Summary stats
  document.getElementById('rpt-avg-weight').textContent = avg(weights);
  document.getElementById('rpt-avg-bmi').textContent    = avg(bmis);
  document.getElementById('rpt-avg-steps').textContent  = Math.round(avg(steps)).toLocaleString();
  document.getElementById('rpt-avg-water').textContent  = avg(waters);

  const { label: bmiLab, cls: bmiCls } = bmiCategory(avg(bmis));
  document.getElementById('rpt-bmi-status').innerHTML  = `<span class="chip ${bmiCls}">${bmiLab}</span>`;

  const weightChange = (weights[weights.length-1] - weights[0]).toFixed(1);
  const arrow = weightChange > 0 ? '↑' : weightChange < 0 ? '↓' : '→';
  document.getElementById('rpt-weight-trend').textContent =
    `${arrow} ${Math.abs(weightChange)} kg over period`;

  const stepsAvgPct = Math.round((parseFloat(avg(steps)) / stepsGoal) * 100);
  document.getElementById('rpt-steps-info').textContent = `${stepsAvgPct}% of goal`;

  const waterAvgPct = Math.round((parseFloat(avg(waters)) / waterGoal) * 100);
  document.getElementById('rpt-water-info').textContent = `${waterAvgPct}% of goal`;

  // Weight Trend Chart
  if (rptWeightChart) rptWeightChart.destroy();
  rptWeightChart = new Chart(document.getElementById('rptWeightChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [makeLineDataset(weights, '#4ade80', 'rgba(74,222,128,0.15)')] },
    options: chartDefaults
  });

  // BMI Trend Chart
  if (rptBmiChart) rptBmiChart.destroy();
  rptBmiChart = new Chart(document.getElementById('rptBmiChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [makeLineDataset(bmis, '#2dd4bf', 'rgba(45,212,191,0.15)')] },
    options: chartDefaults
  });

  // Steps + Water Chart
  if (rptStepsChart) rptStepsChart.destroy();
  rptStepsChart = new Chart(document.getElementById('rptStepsChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Steps', data: steps, backgroundColor: 'rgba(56,189,248,0.55)', borderColor: '#38bdf8', borderWidth: 1, borderRadius: 3 },
        { label: 'Water (ml)', data: waters.map(w => w * 1000), backgroundColor: 'rgba(251,191,36,0.55)', borderColor: '#fbbf24', borderWidth: 1, borderRadius: 3 }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11, family: 'DM Sans' } } } }
    }
  });
}

// ════════════════════════════════════════════
//  WATER CUPS (Smart Water Tracker)
// ════════════════════════════════════════════
function initWaterCups() {
  const numCups = Math.round(waterGoal / 0.25); // dynamic based on goal
  cupState = Array(numCups).fill(false);
  renderCups();
}

function renderCups() {
  const el = document.getElementById('water-cups');
  el.innerHTML = '';
  cupState.forEach((filled, i) => {
    const cup = document.createElement('div');
    cup.className = 'water-cup' + (filled ? ' filled' : '');
    cup.title     = `${((i + 1) * 0.25).toFixed(2)}L`;
    cup.onclick   = () => toggleCup(i);
    el.appendChild(cup);
  });
}

function toggleCup(i) {
  cupState[i] = !cupState[i];
  renderCups();
  const total = (cupState.filter(Boolean).length * 0.25).toFixed(1);
  document.getElementById('m-water').textContent = total;
  const pct = Math.min(100, Math.round((total / waterGoal) * 100));
  document.getElementById('m-water-sub').textContent = `${pct}% of daily goal`;
  setGoal('g-water', pct);
  // Reminder if half-way but behind schedule
  const hour = new Date().getHours();
  if (hour > 12 && parseFloat(total) < waterGoal / 2) {
    toast(`💧 Only ${total}L so far — try to drink more!`, 'error');
  }
}

/** Periodic water reminder (called every 90 minutes) */
function waterReminder() {
  const filled = cupState.filter(Boolean).length * 0.25;
  if (filled < waterGoal) {
    toast(`💧 Reminder: Drink some water! You've had ${filled.toFixed(1)}L today.`, 'success');
  }
}

// ════════════════════════════════════════════
//  BASIC HEALTH RECORD CRUD
// ════════════════════════════════════════════

/** Open Add/Edit modal for basic records */
function openModal(id = null) {
  editingId = id;
  document.getElementById('modal-title').textContent = id ? 'Edit Entry' : 'Log Health Entry';
  document.getElementById('modal-sub').textContent   = id ? 'Update your health data' : 'Record your daily metrics';

  if (id) {
    const r = records.find(x => x.id == id);
    document.getElementById('e-date').value   = r.date;
    document.getElementById('e-weight').value = r.weight;
    document.getElementById('e-height').value = r.height;
    document.getElementById('e-steps').value  = r.steps;
    document.getElementById('e-water').value  = r.water_intake;
    calcBMI();
  } else {
    // Pre-fill with defaults
    const prefs = loadProfilePrefs(currentUser.id);
    document.getElementById('e-date').value   = new Date().toISOString().split('T')[0];
    document.getElementById('e-weight').value = '';
    document.getElementById('e-height').value = prefs.height || '';
    document.getElementById('e-steps').value  = '';
    document.getElementById('e-water').value  = '';
    document.getElementById('e-bmi').value    = '';
    document.getElementById('bmi-preview').style.display = 'none';
  }
  document.getElementById('entry-modal').classList.add('open');
  closeSidebar();
}

function closeModal() {
  document.getElementById('entry-modal').classList.remove('open');
}

/** Auto-calculate BMI as user types weight/height */
function calcBMI() {
  const w = parseFloat(document.getElementById('e-weight').value);
  const h = parseFloat(document.getElementById('e-height').value) / 100;
  if (!w || !h || h <= 0) {
    document.getElementById('e-bmi').value = '';
    document.getElementById('bmi-preview').style.display = 'none';
    return;
  }
  const bmi = (w / (h * h)).toFixed(1);
  document.getElementById('e-bmi').value = bmi;
  const { label, cls } = bmiCategory(bmi);
  const prev = document.getElementById('bmi-preview');
  prev.style.display = 'block';
  prev.innerHTML = `Your BMI is <strong>${bmi}</strong> — <span class="chip ${cls}">${label}</span>`;
}

/** Save (create or update) a basic health record via API */
async function saveEntry() {
  const date   = document.getElementById('e-date').value;
  const weight = parseFloat(document.getElementById('e-weight').value);
  const height = parseFloat(document.getElementById('e-height').value);
  const steps  = parseInt(document.getElementById('e-steps').value) || 0;
  const water  = parseFloat(document.getElementById('e-water').value) || 0;

  if (!date || !weight || !height) { toast('Please fill date, weight, and height.', 'error'); return; }
  if (weight < 20 || weight > 300) { toast('Enter a valid weight (20–300 kg).', 'error'); return; }
  if (height < 100 || height > 250) { toast('Enter a valid height (100–250 cm).', 'error'); return; }

  const bmi = parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));

  let res;
  if (editingId) {
    res = await api('updateRecord', { id: editingId, date, weight, height, bmi, steps, water_intake: water });
  } else {
    res = await api('createRecord', { date, weight, height, bmi, steps, water_intake: water });
  }

  if (res.success) {
    toast(editingId ? 'Entry updated!' : 'Entry added!', 'success');
    closeModal();
    await fetchAllData();
  } else {
    toast(res.error || 'Failed to save entry.', 'error');
  }
}

function editEntry(id)   { openModal(id); }

async function deleteEntry(id) {
  if (!confirm('Delete this record?')) return;
  const res = await api('deleteRecord', { id });
  if (res.success) {
    toast('Record deleted.', 'success');
    await fetchAllData();
  } else {
    toast(res.error || 'Failed to delete.', 'error');
  }
}

// ════════════════════════════════════════════
//  ADVANCED HEALTH CRUD
// ════════════════════════════════════════════

/** Open Add/Edit modal for advanced records */
function openAdvancedModal(id = null) {
  editingAdvId = id;
  document.getElementById('adv-modal-title').textContent = id ? 'Edit Advanced Entry' : 'Log Advanced Health';

  if (id) {
    const r = advancedRecs.find(x => x.id == id);
    document.getElementById('adv-date').value         = r.date;
    document.getElementById('adv-systolic').value     = r.systolic     || '';
    document.getElementById('adv-diastolic').value    = r.diastolic    || '';
    document.getElementById('adv-hr').value           = r.heart_rate   || '';
    document.getElementById('adv-sugar').value        = r.blood_sugar  || '';
    document.getElementById('adv-sugar-type').value   = r.sugar_type   || 'fasting';
    document.getElementById('adv-sleep').value        = r.sleep_hours  || '';
    document.getElementById('adv-sleep-quality').value= r.sleep_quality|| 'good';
    document.getElementById('adv-calories').value     = r.calories     || '';
    document.getElementById('adv-protein').value      = r.protein      || '';
    document.getElementById('adv-carbs').value        = r.carbs        || '';
    document.getElementById('adv-fat').value          = r.fat          || '';
    document.getElementById('adv-activity').value     = r.activity_type|| '';
    document.getElementById('adv-duration').value     = r.activity_duration || '';
    updateBPStatus(); updateHRStatus(); calcCaloriesBurned();
  } else {
    document.getElementById('adv-date').value = new Date().toISOString().split('T')[0];
    ['adv-systolic','adv-diastolic','adv-hr','adv-sugar','adv-sleep','adv-calories',
     'adv-protein','adv-carbs','adv-fat','adv-duration'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('adv-sugar-type').value   = 'fasting';
    document.getElementById('adv-sleep-quality').value= 'good';
    document.getElementById('adv-activity').value     = '';
    document.getElementById('bp-status').style.display   = 'none';
    document.getElementById('hr-status').style.display   = 'none';
    document.getElementById('calories-burned-preview').style.display = 'none';
  }
  document.getElementById('advanced-modal').classList.add('open');
  closeSidebar();
}

function closeAdvancedModal() {
  document.getElementById('advanced-modal').classList.remove('open');
}

/** Real-time BP status display inside modal */
function updateBPStatus() {
  const sys  = parseInt(document.getElementById('adv-systolic').value);
  const dia  = parseInt(document.getElementById('adv-diastolic').value);
  const el   = document.getElementById('bp-status');
  if (!sys || !dia) { el.style.display = 'none'; return; }
  const s = bpStatus(sys, dia);
  el.style.display = 'block';
  el.innerHTML = `Status: <span class="chip ${s.cls}">${s.label}</span> — ${s.note}`;
}

/** Real-time HR status display inside modal */
function updateHRStatus() {
  const bpm = parseInt(document.getElementById('adv-hr').value);
  const el  = document.getElementById('hr-status');
  if (!bpm) { el.style.display = 'none'; return; }
  const s = hrStatus(bpm);
  el.style.display = 'block';
  el.innerHTML = `<span class="chip ${s.cls}">${s.label}</span> — ${s.note}`;
}

/** Auto calculate calories burned from activity type + duration */
function calcCaloriesBurned() {
  const type = document.getElementById('adv-activity').value;
  const dur  = parseInt(document.getElementById('adv-duration').value);
  const el   = document.getElementById('calories-burned-preview');
  if (!type || !dur) { el.style.display = 'none'; return; }
  const burned = calcBurnedCals(type, dur);
  el.style.display = 'block';
  document.getElementById('burned-val').textContent = burned;
}

/** Save (create or update) an advanced health record via API */
async function saveAdvanced() {
  const date = document.getElementById('adv-date').value;
  if (!date) { toast('Please select a date.', 'error'); return; }

  const payload = {
    date,
    systolic:          parseInt(document.getElementById('adv-systolic').value)      || null,
    diastolic:         parseInt(document.getElementById('adv-diastolic').value)     || null,
    heart_rate:        parseInt(document.getElementById('adv-hr').value)            || null,
    blood_sugar:       parseFloat(document.getElementById('adv-sugar').value)       || null,
    sugar_type:        document.getElementById('adv-sugar-type').value,
    sleep_hours:       parseFloat(document.getElementById('adv-sleep').value)       || null,
    sleep_quality:     document.getElementById('adv-sleep-quality').value,
    calories:          parseInt(document.getElementById('adv-calories').value)      || null,
    protein:           parseFloat(document.getElementById('adv-protein').value)     || null,
    carbs:             parseFloat(document.getElementById('adv-carbs').value)       || null,
    fat:               parseFloat(document.getElementById('adv-fat').value)         || null,
    activity_type:     document.getElementById('adv-activity').value               || null,
    activity_duration: parseInt(document.getElementById('adv-duration').value)     || null,
  };

  let res;
  if (editingAdvId) {
    res = await api('updateAdvanced', { id: editingAdvId, ...payload });
  } else {
    res = await api('createAdvanced', payload);
  }

  if (res.success) {
    toast(editingAdvId ? 'Advanced entry updated!' : 'Advanced entry saved!', 'success');
    closeAdvancedModal();
    await fetchAllData();
  } else {
    toast(res.error || 'Failed to save.', 'error');
  }
}

function editAdvanced(id) { openAdvancedModal(id); }

async function deleteAdvanced(id) {
  if (!confirm('Delete this advanced record?')) return;
  const res = await api('deleteAdvanced', { id });
  if (res.success) {
    toast('Record deleted.', 'success');
    await fetchAllData();
  } else {
    toast(res.error || 'Failed to delete.', 'error');
  }
}

// ════════════════════════════════════════════
//  BMI CALCULATOR MODAL
// ════════════════════════════════════════════
function openBMICalc() {
  document.getElementById('bmi-modal').classList.add('open');
  closeSidebar();
}
function closeBMICalc() {
  document.getElementById('bmi-modal').classList.remove('open');
}
function updateBMICalc() {
  const w   = parseFloat(document.getElementById('bc-weight').value);
  const h   = parseFloat(document.getElementById('bc-height').value) / 100;
  const res = document.getElementById('bmi-result');
  if (!w || !h || h <= 0) { res.style.display = 'none'; return; }
  const bmi = (w / (h * h)).toFixed(1);
  const { label, cls, note } = bmiCategory(bmi, true);
  res.style.display = 'block';
  const colors = { normal: '#4ade80', underweight: '#38bdf8', overweight: '#fbbf24', obese: '#f87171' };
  const col = colors[cls];
  res.style.background = `${hexToRgba(col, 0.08)}`;
  res.style.border     = `1px solid ${hexToRgba(col, 0.2)}`;
  document.getElementById('bc-bmi-val').textContent  = bmi;
  document.getElementById('bc-bmi-val').style.color  = col;
  document.getElementById('bc-bmi-cat').textContent  = label;
  document.getElementById('bc-bmi-cat').style.color  = col;
  document.getElementById('bc-bmi-note').textContent = note;
}

// ════════════════════════════════════════════
//  HEALTH ALERTS SYSTEM
// ════════════════════════════════════════════

/**
 * Check all health conditions and generate alerts.
 * @param {boolean} force  - if true, ignore dismissed list and show fresh
 */
function checkAlerts(force = false) {
  const alerts = [];

  if (force) dismissedAlerts = [];

  const latest    = records.length > 0      ? records[records.length - 1]      : null;
  const advLatest = advancedRecs.length > 0 ? advancedRecs[advancedRecs.length - 1] : null;

  // ── Basic record alerts ──
  if (latest) {
    const bmi = parseFloat(latest.bmi);
    if (bmi >= 30) alerts.push({ id:'bmi-obese',    type:'danger',  icon:'⚠️', title:'High BMI Alert', desc:`Your BMI is ${bmi} — this is in the Obese range. Please consult a healthcare professional for guidance.` });
    else if (bmi >= 25) alerts.push({ id:'bmi-over', type:'warning', icon:'⚠️', title:'BMI Overweight', desc:`Your BMI is ${bmi} — overweight range. Consider dietary adjustments and more physical activity.` });
    else if (bmi < 18.5) alerts.push({ id:'bmi-under', type:'info',  icon:'ℹ️', title:'BMI Underweight', desc:`Your BMI is ${bmi} — underweight. Focus on nutrient-dense foods to reach a healthy weight.` });

    if (latest.water_intake < waterGoal * 0.5)
      alerts.push({ id:'water-low', type:'warning', icon:'💧', title:'Low Water Intake', desc:`You logged only ${latest.water_intake}L today — below 50% of your goal. Stay hydrated!` });

    if (latest.steps < stepsGoal * 0.3)
      alerts.push({ id:'steps-low', type:'info', icon:'👟', title:'Low Step Count', desc:`Only ${Number(latest.steps).toLocaleString()} steps logged — aim for at least ${stepsGoal.toLocaleString()} per day.` });
  }

  // ── Advanced record alerts ──
  if (advLatest) {
    if (advLatest.systolic && advLatest.diastolic) {
      const s = bpStatus(advLatest.systolic, advLatest.diastolic);
      if (s.cls === 'bp-high') alerts.push({ id:'bp-high', type:'danger', icon:'🩺', title:'High Blood Pressure', desc:`${advLatest.systolic}/${advLatest.diastolic} mmHg — ${s.label}. Monitor closely and consult a doctor if sustained.` });
      else if (s.cls === 'bp-low') alerts.push({ id:'bp-low', type:'warning', icon:'🩺', title:'Low Blood Pressure', desc:`${advLatest.systolic}/${advLatest.diastolic} mmHg — may cause dizziness. Stay hydrated and consider medical advice.` });
    }
    if (advLatest.heart_rate) {
      const hrS = hrStatus(advLatest.heart_rate);
      if (hrS.cls === 'hr-high') alerts.push({ id:'hr-high', type:'danger', icon:'❤️', title:'Elevated Heart Rate', desc:`${advLatest.heart_rate} BPM is above normal range (>100). Rest and monitor.` });
      else if (hrS.cls === 'hr-low') alerts.push({ id:'hr-low', type:'info', icon:'❤️', title:'Low Heart Rate', desc:`${advLatest.heart_rate} BPM — below normal. If you are not an athlete, consider seeking medical advice.` });
    }
    if (advLatest.sleep_hours && parseFloat(advLatest.sleep_hours) < 6)
      alerts.push({ id:'sleep-low', type:'warning', icon:'😴', title:'Insufficient Sleep', desc:`Only ${advLatest.sleep_hours} hours of sleep logged. Adults need 7–9 hours for optimal health.` });
  }

  // ── Filter dismissed ──
  const visible = force ? alerts : alerts.filter(a => !dismissedAlerts.includes(a.id));

  // Update badge count in sidebar
  const badge = document.getElementById('alerts-badge');
  if (visible.length > 0) {
    badge.style.display  = 'inline';
    badge.textContent    = visible.length;
  } else {
    badge.style.display  = 'none';
  }

  // Render alerts container
  const container = document.getElementById('alerts-container');
  if (visible.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No active alerts. You're doing great!</p></div>`;
  } else {
    container.innerHTML = visible.map(a => `
      <div class="alert-card ${a.type}" id="alert-${a.id}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-desc">${a.desc}</div>
        </div>
        <button class="alert-dismiss" onclick="dismissAlert('${a.id}')" title="Dismiss">×</button>
      </div>`).join('');
  }
}

function dismissAlert(id) {
  dismissedAlerts.push(id);
  localStorage.setItem(`ht_dismissed_${currentUser.id}`, JSON.stringify(dismissedAlerts));
  document.getElementById(`alert-${id}`)?.remove();
  checkAlerts(false);
}

function dismissAllAlerts() {
  const cards = document.querySelectorAll('.alert-card');
  cards.forEach(c => {
    const id = c.id.replace('alert-', '');
    dismissedAlerts.push(id);
  });
  localStorage.setItem(`ht_dismissed_${currentUser.id}`, JSON.stringify(dismissedAlerts));
  checkAlerts(false);
  toast('All alerts dismissed.', 'success');
}

// ════════════════════════════════════════════
//  AI SUGGESTIONS (logic-based, no API)
// ════════════════════════════════════════════
function showAISuggestions() {
  const banner = document.getElementById('ai-suggestions-banner');
  const suggestions = [];

  if (records.length === 0) {
    banner.style.display = 'none'; return;
  }
  const latest    = records[records.length - 1];
  const advLatest = advancedRecs.length > 0 ? advancedRecs[advancedRecs.length - 1] : null;

  // Water suggestion
  if (parseFloat(latest.water_intake) < waterGoal)
    suggestions.push({ icon:'💧', text: `<strong>Drink more water!</strong> You logged ${latest.water_intake}L — try to reach your ${waterGoal}L goal today.` });

  // Steps suggestion
  if (parseInt(latest.steps) < stepsGoal)
    suggestions.push({ icon:'👟', text: `<strong>Increase your steps!</strong> ${Number(latest.steps).toLocaleString()} logged vs ${stepsGoal.toLocaleString()} goal. Even a 15-min walk helps.` });

  // Sleep suggestion
  if (advLatest && advLatest.sleep_hours && parseFloat(advLatest.sleep_hours) < 7)
    suggestions.push({ icon:'😴', text: `<strong>Prioritise sleep.</strong> ${advLatest.sleep_hours}hrs is below the recommended 7–9hrs. Better sleep improves metabolism and recovery.` });

  // BMI suggestion based on health goal
  const prefs  = loadProfilePrefs(currentUser.id);
  const bmi    = parseFloat(latest.bmi);
  if (prefs.goal === 'loss' && bmi < 18.5)
    suggestions.push({ icon:'⚡', text: `<strong>Goal mismatch detected.</strong> Your BMI is ${bmi} (underweight) but your goal is weight loss. Consider updating your profile goal.` });

  if (suggestions.length === 0) { banner.style.display = 'none'; return; }

  banner.style.display = 'block';
  banner.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--sage);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🤖 AI Suggestions</div>
    ${suggestions.slice(0, 3).map(s => `
      <div class="suggestion-card">
        <span class="sug-icon">${s.icon}</span>
        <span class="sug-text">${s.text}</span>
      </div>`).join('')}
  `;
}

// ════════════════════════════════════════════
//  GAMIFICATION — Streaks & Achievements
// ════════════════════════════════════════════
function updateAchievements() {
  const streak = calcStreak();
  document.getElementById('streak-count').textContent = streak;
  document.getElementById('streak-msg').textContent =
    streak >= 7  ? '🔥 Amazing! You\'re on a hot streak!' :
    streak >= 3  ? '👏 Keep it up! 3+ days strong.' :
    streak === 1 ? '✅ Great start! Come back tomorrow.' :
                   'Start logging daily to build your streak!';

  // Goal completion bars
  const stepsDays = records.filter(r => parseInt(r.steps) >= stepsGoal).length;
  const waterDays = records.filter(r => parseFloat(r.water_intake) >= waterGoal).length;
  const recPct    = Math.min(100, Math.round((records.length / 30) * 100));
  const stepsPct  = records.length ? Math.min(100, Math.round((stepsDays / records.length) * 100)) : 0;
  const waterPct  = records.length ? Math.min(100, Math.round((waterDays / records.length) * 100)) : 0;
  const advPct    = Math.min(100, Math.round((advancedRecs.length / 10) * 100));

  setGoal('ach-records', recPct);
  setGoal('ach-steps',   stepsPct);
  setGoal('ach-water',   waterPct);
  setGoal('ach-adv',     advPct);

  renderBadges(streak, stepsDays, waterDays);
}

/** Calculate consecutive-day logging streak */
function calcStreak() {
  if (records.length === 0) return 0;
  const dates = [...new Set(records.map(r => r.date))].sort().reverse();
  let streak  = 0;
  let current = new Date(); current.setHours(0,0,0,0);
  for (const d of dates) {
    const dt = new Date(d + 'T00:00:00');
    const diff = Math.round((current - dt) / 86400000);
    if (diff === 0 || diff === streak) { streak++; current = dt; }
    else break;
  }
  return streak;
}

/** Define and render achievement badges */
function renderBadges(streak, stepsDays, waterDays) {
  const BADGES = [
    { id:'first',   icon:'🎉', name:'First Entry',   desc:'Log your first health record',     earned: records.length >= 1 },
    { id:'week',    icon:'📅', name:'Week Warrior',   desc:'Log entries for 7 days',           earned: records.length >= 7 },
    { id:'month',   icon:'🗓️', name:'Monthly Master', desc:'Log 30 health entries',            earned: records.length >= 30 },
    { id:'streak3', icon:'🔥', name:'3-Day Streak',   desc:'Log data 3 days in a row',         earned: streak >= 3 },
    { id:'streak7', icon:'🏆', name:'Week Streak',    desc:'Log data 7 days in a row',         earned: streak >= 7 },
    { id:'steps5',  icon:'👟', name:'Step Achiever',  desc:'Hit steps goal 5 days',            earned: stepsDays >= 5 },
    { id:'steps10', icon:'🏅', name:'Step Master',    desc:'Hit steps goal 10 days',           earned: stepsDays >= 10 },
    { id:'water5',  icon:'💧', name:'Hydration Hero', desc:'Hit water goal 5 days',            earned: waterDays >= 5 },
    { id:'adv1',    icon:'🩺', name:'Vital Logger',   desc:'Log first advanced health entry',  earned: advancedRecs.length >= 1 },
    { id:'adv10',   icon:'🏥', name:'Health Pro',     desc:'Log 10 advanced health entries',   earned: advancedRecs.length >= 10 },
    { id:'bmi_ok',  icon:'✅', name:'Healthy Range',  desc:'Maintain normal BMI',              earned: records.length > 0 && parseFloat(records[records.length-1].bmi) >= 18.5 && parseFloat(records[records.length-1].bmi) < 25 },
    { id:'profile', icon:'⭐', name:'Profile Star',   desc:'Complete your profile settings',   earned: isProfileComplete() },
  ];

  const grid = document.getElementById('badge-grid');
  grid.innerHTML = BADGES.map(b => `
    <div class="badge-item ${b.earned ? 'earned' : 'locked'}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${b.earned ? '<div class="badge-earned-tag">✓ EARNED</div>' : ''}
    </div>`).join('');
}

function isProfileComplete() {
  const prefs = loadProfilePrefs(currentUser?.id);
  return !!(prefs.age && prefs.gender && prefs.height);
}

// ════════════════════════════════════════════
//  PROFILE
// ════════════════════════════════════════════

/** Save extended profile (name via API + prefs locally) */
async function saveProfile() {
  const name       = document.getElementById('prof-name').value.trim();
  if (!name) { toast('Name cannot be empty.', 'error'); return; }

  const prefs = {
    age:        parseInt(document.getElementById('prof-age').value)       || null,
    gender:     document.getElementById('prof-gender').value,
    height:     parseFloat(document.getElementById('prof-height').value) || null,
    goal:       document.getElementById('prof-goal').value,
    waterGoal:  parseFloat(document.getElementById('prof-water-goal').value) || 2.5,
    stepsGoal:  parseInt(document.getElementById('prof-steps-goal').value)   || 10000,
  };

  // Update name via backend
  const res = await api('updateProfile', { name });
  if (!res.success) { toast(res.error || 'Failed to update name.', 'error'); return; }

  // Save extended prefs locally
  saveProfilePrefs(currentUser.id, prefs);
  waterGoal  = prefs.waterGoal;
  stepsGoal  = prefs.stepsGoal;

  // Update UI
  currentUser.name = name;
  document.getElementById('sidebar-avatar').textContent       = name[0].toUpperCase();
  document.getElementById('sidebar-name').textContent         = name;
  document.getElementById('profile-avatar-lg').textContent    = name[0].toUpperCase();
  document.getElementById('profile-name-display').textContent = name;

  initWaterCups(); // Rebuild water cups for new goal
  refreshDashboard();
  toast('Profile updated!', 'success');
}

function changePassword() {
  const p1 = document.getElementById('new-pass').value;
  const p2 = document.getElementById('new-pass2').value;
  if (!p1) { toast('Enter a new password.', 'error'); return; }
  if (p1.length < 8) { toast('Password must be 8+ characters.', 'error'); return; }
  if (p1 !== p2) { toast('Passwords do not match.', 'error'); return; }

  api('changePassword', { password: p1 }).then(res => {
    if (res.success) {
      document.getElementById('new-pass').value  = '';
      document.getElementById('new-pass2').value = '';
      toast('Password updated!', 'success');
    } else {
      toast(res.error || 'Failed to update password.', 'error');
    }
  });
}

function updateProfileStats() {
  const el   = document.getElementById('profile-stats');
  const avg  = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--';
  const fmt  = n => n === '--' ? '--' : n.toLocaleString?.() ?? n;
  const weights = records.map(r => parseFloat(r.weight));
  const bmis    = records.map(r => parseFloat(r.bmi));
  const steps   = records.map(r => parseInt(r.steps));
  el.innerHTML  = `
    <div class="stat-pill">Entries: <strong>${records.length}</strong></div>
    <div class="stat-pill">Avg Weight: <strong>${avg(weights)} kg</strong></div>
    <div class="stat-pill">Avg BMI: <strong>${avg(bmis)}</strong></div>
    <div class="stat-pill">Avg Steps: <strong>${fmt(avg(steps))}</strong></div>
    <div class="stat-pill">Streak: <strong>${calcStreak()} days 🔥</strong></div>
  `;
}

// ════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════
function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${id}`).classList.add('active');
  if (el) el.classList.add('active');

  // Lazy-render section-specific content
  if (id === 'history')      renderHistoryTable();
  if (id === 'reports')      renderReports();
  if (id === 'alerts')       checkAlerts(false);
  if (id === 'achievements') updateAchievements();
  if (id === 'advanced')     renderAdvancedTable();

  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ════════════════════════════════════════════
//  PROFILE PREFS (localStorage — extended data)
// ════════════════════════════════════════════
function loadProfilePrefs(uid) {
  return JSON.parse(localStorage.getItem(`ht_prefs_${uid}`) || '{}');
}
function saveProfilePrefs(uid, prefs) {
  localStorage.setItem(`ht_prefs_${uid}`, JSON.stringify(prefs));
}

// ════════════════════════════════════════════
//  HEALTH STATUS CLASSIFIERS
// ════════════════════════════════════════════

function bmiCategory(bmi, withNote = false) {
  const b = parseFloat(bmi);
  let label, cls, note;
  if (b < 18.5)      { label='Underweight'; cls='underweight'; note='BMI < 18.5. Consider increasing caloric intake with nutrient-dense foods.'; }
  else if (b < 25)   { label='Normal';      cls='normal';      note='BMI 18.5–24.9. You are in the healthy weight range!'; }
  else if (b < 30)   { label='Overweight';  cls='overweight';  note='BMI 25–29.9. Moderate lifestyle adjustments recommended.'; }
  else               { label='Obese';       cls='obese';       note='BMI ≥ 30. Please consult a healthcare professional.'; }
  return { label, cls, note };
}

function bpStatus(sys, dia) {
  // AHA blood pressure classification
  if (sys < 90 || dia < 60)        return { label:'Low BP',             cls:'bp-low',      note:'Hypotension — consider medical advice.' };
  if (sys < 120 && dia < 80)       return { label:'Normal',             cls:'bp-normal',   note:'Healthy blood pressure range.' };
  if (sys < 130 && dia < 80)       return { label:'Elevated',           cls:'bp-elevated', note:'Slightly elevated — monitor regularly.' };
  if (sys < 140 || dia < 90)       return { label:'High (Stage 1)',      cls:'bp-high',     note:'Hypertension Stage 1 — consult a doctor.' };
  return                                  { label:'High (Stage 2)',      cls:'bp-high',     note:'Hypertension Stage 2 — seek medical care.' };
}

function hrStatus(bpm) {
  const b = parseInt(bpm);
  if (b < 60)   return { label:'Low',    cls:'hr-low',    note:'Bradycardia — may be normal for athletes.' };
  if (b <= 100) return { label:'Normal', cls:'hr-normal', note:'Normal resting heart rate.' };
  return               { label:'High',   cls:'hr-high',   note:'Tachycardia — rest and monitor.' };
}

function sleepStatus(hours, quality) {
  const h = parseFloat(hours);
  if (h < 6)  return 'Poor';
  if (h < 7)  return quality === 'excellent' ? 'Fair' : 'Poor';
  if (h <= 9) return quality === 'poor' ? 'Fair' : (quality === 'excellent' ? 'Excellent' : 'Good');
  return 'Long';
}

/** Calculate estimated calories burned (METs × weight × hours) */
function calcBurnedCals(type, durationMin) {
  const weight  = records.length > 0 ? parseFloat(records[records.length-1].weight) : 70;
  const mets    = { walking: 3.5, running: 9.0, cycling: 7.5 };
  const met     = mets[type] || 4;
  const hours   = (durationMin || 0) / 60;
  return Math.round(met * weight * hours);
}

// ════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════

function fmtDate(d, short = false) {
  const dt = new Date(d + 'T00:00:00');
  if (short) return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Append a toast notification */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ════════════════════════════════════════════
//  INIT — DOMContentLoaded
// ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in (via backend session)
  const res = await api('checkSession');
  if (res.success && res.user) {
    launchApp(res.user);
  }

  // Enter key on auth forms
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('reg-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

  // Close modals on overlay click
  document.getElementById('entry-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('advanced-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAdvancedModal(); });
  document.getElementById('bmi-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeBMICalc(); });
});
