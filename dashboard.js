// dashboard.js

let trendChart = null;
let profileChart = null;
let pmPool = []; // untuk autocomplete

// Helpers
const $ = (id) => document.getElementById(id);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
const fmtPct = (x) => (x == null || isNaN(x)) ? '-' : `${Number(x).toFixed(2)}%`;

// =============================
// Fetch data dari Netlify Func
// =============================
async function fetchSummary() {
  const periode = $('periodeSelect').value;
  const wilayah = $('wilayahSelect').value;
  const q = $('searchPm').value.trim();

  const qs = new URLSearchParams();
  qs.set('periode', periode);
  if (wilayah) qs.set('wilayah', wilayah);
  if (q) qs.set('q', q);

  const res = await fetch(`/.netlify/functions/getSummary?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`getSummary failed: ${res.status}`);
  return res.json();
}

// =============================
// Filters
// =============================
function renderWilayahOptions(payload) {
  const wilayahSelect = $('wilayahSelect');
  const current = wilayahSelect.value;
  wilayahSelect.innerHTML = '<option value="">(Semua Wilayah)</option>';

  (payload.wilayah_list || []).sort().forEach(w => {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w;
    wilayahSelect.appendChild(opt);
  });

  // pertahankan pilihan jika masih valid
  if ((payload.wilayah_list || []).includes(current)) {
    wilayahSelect.value = current;
  }
}

// =============================
// KPI Cards
// =============================
function renderKPIsTop(payload) {
  const { kpis, meta } = payload;
  setText('kpiCount', (kpis.count || 0).toString());
  setText('kpiCountSub', kpis.total_target_pm ? `dari ${kpis.total_target_pm} PM target` : '');
  setText('kpiAvgTotal', fmtPct(kpis.avg_total_pct));
  setText('kpiWilayah', (meta.all_wilayah_count || 0).toString());
  setText('kpiAvgGrade', kpis.avg_grade || '-');

  const gradesDiv = $('kpiGrades');
  gradesDiv.innerHTML = '';
  const entries = Object.entries(kpis.grade_counts || {}).sort((a,b) => b[1] - a[1]);
  if (!entries.length) {
    gradesDiv.textContent = '-';
  } else {
    entries.forEach(([g, n]) => {
      const pill = document.createElement('span');
      pill.className = 'inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded mr-2 mb-1';
      pill.textContent = `${g}: ${n}`;
      gradesDiv.appendChild(pill);
    });
  }
}

function renderKPIsSections(avgWithGrade) {
  const put = (pctId, gradeId, obj) => {
    setText(pctId, fmtPct(obj.pct));
    setText(gradeId, obj.grade);
  };
  put('kpiCP', 'kpiCPg', avgWithGrade.campus_preparation);
  put('kpiAM', 'kpiAMg', avgWithGrade.akhlak_mulia);
  put('kpiQM', 'kpiQMg', avgWithGrade.quranic_mentorship);
  put('kpiSS', 'kpiSSg', avgWithGrade.softskill);
  put('kpiLD', 'kpiLDg', avgWithGrade.leadership);
}

// =============================
// Charts
// =============================
function renderTrendChart(payload) {
  const ctx = $('trendChart').getContext('2d');
  const labels = payload.chartTrend.labels || [];
  const data = payload.chartTrend.total_pct_avg || [];

  const chartData = {
    labels,
    datasets: [
      { label: 'Rata-rata Total (%)', data, tension: 0.3, fill: false }
    ]
  };

  if (trendChart) {
    trendChart.data = chartData;
    trendChart.update();
    return;
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => fmtPct(c.parsed.y) } }
      }
    }
  });
}

function renderProfileByWilayahChart(payload) {
  const canvas = document.getElementById('profileByWilayahChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // 1) Coba pakai data server dulu
  let labels = payload.chartProfileByWilayah?.wilayahLabels || [];
  let ds = payload.chartProfileByWilayah?.datasets || {};

  // 2) Deteksi: kalau labels kosong ATAU terlihat seperti daftar "nama PM",
  //    kita rebuild dari payload.rows agar pasti per-wilayah.
  const looksLikePM = (arr) => {
    if (!arr.length) return false;
    // Heuristik sederhana: nama PM biasanya > 1 kata & jumlah label banyak (>8)
    const multiWord = arr.filter(x => (x || '').trim().split(/\s+/).length >= 2).length;
    return arr.length > 8 && multiWord / arr.length > 0.6;
  };

  if (!labels.length || looksLikePM(labels)) {
    const map = new Map(); // w -> {count, cp, am, qm, ss, ld}
    (payload.rows || []).forEach(r => {
      const w = (r.wilayah || '').trim() || '(Tanpa Wilayah)';
      if (!map.has(w)) map.set(w, { count: 0, cp: 0, am: 0, qm: 0, ss: 0, ld: 0 });
      const s = map.get(w);
      s.count += 1;
      s.cp += Number(r.campus_preparation_pct || 0);
      s.am += Number(r.akhlak_mulia_pct || 0);
      s.qm += Number(r.quranic_mentorship_pct || 0);
      s.ss += Number(r.softskill_pct || 0);
      s.ld += Number(r.leadership_pct || 0);
    });

    labels = Array.from(map.keys()).sort();
    const avgArr = (pick) => labels.map(w => {
      const m = map.get(w); const d = m?.count || 0;
      return Number(d ? (m[pick] / d).toFixed(2) : 0);
    });

    ds = {
      campus_preparation_pct: avgArr('cp'),
      akhlak_mulia_pct:       avgArr('am'),
      quranic_mentorship_pct: avgArr('qm'),
      softskill_pct:          avgArr('ss'),
      leadership_pct:         avgArr('ld'),
    };
  }

  const toNum = (a) => (a || []).map(Number);

  const data = {
    labels,
    datasets: [
      { label: 'CP%', data: toNum(ds.campus_preparation_pct), backgroundColor: '#F59E0B', borderColor: '#F59E0B', borderWidth: 1 },
      { label: 'AM%', data: toNum(ds.akhlak_mulia_pct),       backgroundColor: '#3B82F6', borderColor: '#3B82F6', borderWidth: 1 },
      { label: 'QM%', data: toNum(ds.quranic_mentorship_pct), backgroundColor: '#10B981', borderColor: '#10B981', borderWidth: 1 },
      { label: 'SS%', data: toNum(ds.softskill_pct),          backgroundColor: '#8B5CF6', borderColor: '#8B5CF6', borderWidth: 1 },
      { label: 'LD%', data: toNum(ds.leadership_pct),         backgroundColor: '#EF4444', borderColor: '#EF4444', borderWidth: 1 },
    ]
  };

  if (window.profileChart) { window.profileChart.data = data; window.profileChart.update(); return; }
  window.profileChart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${Number(c.parsed.y).toFixed(2)}%` } } }
    }
  });
}


// =============================
// Tabel
// =============================
function renderTable(payload) {
  const tbody = $('tableBody');
  const info = $('tableInfo');
  const rows = payload.rows || [];

  info.textContent = `${rows.length} baris`;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="px-3 py-2">${r.wilayah || '-'}</td>
      <td class="px-3 py-2">${r.asesor || '-'}</td>
      <td class="px-3 py-2">${r.nama_pm || '-'}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.campus_preparation_pct)}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.akhlak_mulia_pct)}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.quranic_mentorship_pct)}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.softskill_pct)}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.leadership_pct)}</td>
      <td class="px-3 py-2 text-right">${fmtPct(r.total_pct)}</td>
      <td class="px-3 py-2"><span class="inline-block px-2 py-0.5 rounded bg-gray-100">${r.grade || '-'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// =============================
// Autocomplete "Cari PM"
// =============================
function setupAutocomplete(payload) {
  pmPool = payload.pm_names || [];

  const input = $('searchPm');
  const suggest = $('pmSuggest');

  function showSuggestions(q) {
    suggest.innerHTML = '';
    if (!q || q.length < 2) { suggest.classList.add('hidden'); return; }
    const hits = pmPool.filter(n => n.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
    if (!hits.length) { suggest.classList.add('hidden'); return; }
    hits.forEach(name => {
      const li = document.createElement('li');
      li.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer';
      li.textContent = name;
      li.onclick = () => { input.value = name; suggest.classList.add('hidden'); refreshDashboard(); };
      suggest.appendChild(li);
    });
    suggest.classList.remove('hidden');
  }

  input.addEventListener('input', () => showSuggestions(input.value));
  input.addEventListener('focus', () => showSuggestions(input.value));
  document.addEventListener('click', (e) => {
    const within = e.target === input || suggest.contains(e.target);
    if (!within) suggest.classList.add('hidden');
  });
}

// =============================
// Orkestrasi
// =============================
async function refreshDashboard() {
  const btn = $('btnRefresh');
  btn.disabled = true; btn.textContent = 'Loading...';

  try {
    const payload = await fetchSummary();

    // Filters
    renderWilayahOptions(payload);

    // KPIs
    renderKPIsTop(payload);
    renderKPIsSections(payload.avgSectionsWithGrade);

    // Charts
    renderTrendChart(payload);                 // Line trend 4 periode
    renderProfileByWilayahChart(payload);      // Bar compare profil per wilayah

    // Tabel
    renderTable(payload);

    // Autocomplete
    setupAutocomplete(payload);
  } catch (err) {
    console.error(err);
    alert('Gagal memuat dashboard: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Refresh';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('btnRefresh').addEventListener('click', refreshDashboard);
  $('periodeSelect').addEventListener('change', refreshDashboard);
  $('wilayahSelect').addEventListener('change', refreshDashboard);

  // Optional debounce pada input, actual refresh terjadi saat pilih suggestion atau klik Refresh
  let t;
  $('searchPm').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { /* bisa auto-refresh jika mau */ }, 600);
  });

  refreshDashboard();
});
