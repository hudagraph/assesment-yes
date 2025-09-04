// dashboard.js

let trendChart, profileChart;
let pmPool = []; // untuk autocomplete

function fmtPct(x) {
  return (x == null || isNaN(x)) ? '-' : `${Number(x).toFixed(2)}%`;
}

async function fetchSummary() {
  const periode = document.getElementById('periodeSelect').value;
  const wilayah = document.getElementById('wilayahSelect').value;
  const q = document.getElementById('searchPm').value.trim();

  const qs = new URLSearchParams();
  qs.set('periode', periode);
  if (wilayah) qs.set('wilayah', wilayah);
  if (q) qs.set('q', q);

  const res = await fetch(`/.netlify/functions/getSummary?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`getSummary failed: ${res.status}`);
  return res.json();
}

function renderWilayahOptions(payload) {
  const wilayahSelect = document.getElementById('wilayahSelect');
  const current = wilayahSelect.value;
  wilayahSelect.innerHTML = '<option value="">(Semua Wilayah)</option>';
  (payload.wilayah_list || []).sort().forEach(w => {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w;
    wilayahSelect.appendChild(opt);
  });
  // pertahankan pilihan jika masih ada
  if ((payload.wilayah_list || []).includes(current)) {
    wilayahSelect.value = current;
  }
}

function renderKPIsTop(payload) {
  const { kpis, meta } = payload;
  document.getElementById('kpiCount').textContent = (kpis.count || 0).toString();
  document.getElementById('kpiCountSub').textContent = kpis.total_target_pm
    ? `dari ${kpis.total_target_pm} PM target`
    : '';
  document.getElementById('kpiAvgTotal').textContent = fmtPct(kpis.avg_total_pct);
  document.getElementById('kpiWilayah').textContent = (meta.all_wilayah_count || 0).toString();
  document.getElementById('kpiAvgGrade').textContent = kpis.avg_grade || '-';

  const gradesDiv = document.getElementById('kpiGrades');
  gradesDiv.innerHTML = '';
  const entries = Object.entries(kpis.grade_counts || {}).sort((a,b) => b[1]-a[1]);
  if (!entries.length) {
    gradesDiv.textContent = '-';
  } else {
    entries.forEach(([g,n]) => {
      const span = document.createElement('span');
      span.className = 'inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded mr-2 mb-1';
      span.textContent = `${g}: ${n}`;
      gradesDiv.appendChild(span);
    });
  }
}

function renderKPIsSections(avgWithGrade) {
  const setItem = (idPct, idGrade, obj) => {
    document.getElementById(idPct).textContent = fmtPct(obj.pct);
    document.getElementById(idGrade).textContent = obj.grade;
  };
  setItem('kpiCP', 'kpiCPg', avgWithGrade.campus_preparation);
  setItem('kpiAM', 'kpiAMg', avgWithGrade.akhlak_mulia);
  setItem('kpiQM', 'kpiQMg', avgWithGrade.quranic_mentorship);
  setItem('kpiSS', 'kpiSSg', avgWithGrade.softskill);
  setItem('kpiLD', 'kpiLDg', avgWithGrade.leadership);
}

function renderTrendChart(payload) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const labels = payload.chartTrend.labels;
  const data = payload.chartTrend.total_pct_avg;

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Rata-rata Total (%)',
        data,
        tension: 0.3,
        fill: false
      }
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
        legend: { display: true, position: 'bottom' },
        tooltip: { callbacks: { label: (c) => fmtPct(c.parsed.y) } }
      }
    }
  });
}

function renderProfileByWilayahChart(payload) {
  const ctx = document.getElementById('profileByWilayahChart').getContext('2d');
  const labels = payload.chartProfileByWilayah.wilayahLabels || [];
  const ds = payload.chartProfileByWilayah.datasets || {};

  // Warna tetap per profil
  const COLORS = {
    cp: '#F59E0B', // amber
    am: '#3B82F6', // blue
    qm: '#10B981', // emerald
    ss: '#8B5CF6', // violet
    ld: '#EF4444', // red
  };

  const data = {
    labels,
    datasets: [
      { label: 'CP%', data: ds.campus_preparation_pct || [], backgroundColor: COLORS.cp },
      { label: 'AM%', data: ds.akhlak_mulia_pct || [],       backgroundColor: COLORS.am },
      { label: 'QM%', data: ds.quranic_mentorship_pct || [], backgroundColor: COLORS.qm },
      { label: 'SS%', data: ds.softskill_pct || [],          backgroundColor: COLORS.ss },
      { label: 'LD%', data: ds.leadership_pct || [],         backgroundColor: COLORS.ld },
    ]
  };

  if (profileChart) {
    profileChart.data = data;
    profileChart.update();
    return;
  }

  profileChart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${fmtPct(c.parsed.y)}` } }
      }
    }
  });
}

function renderTable(payload) {
  const tbody = document.getElementById('tableBody');
  const info = document.getElementById('tableInfo');
  tbody.innerHTML = '';

  const rows = payload.rows || [];
  info.textContent = `${rows.length} baris`;

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

function setupAutocomplete(payload) {
  pmPool = payload.pm_names || [];
  const searchPm = document.getElementById('searchPm');
  const suggest = document.getElementById('pmSuggest');

  function showSuggestions(q) {
    suggest.innerHTML = '';
    if (!q || q.length < 2) { suggest.classList.add('hidden'); return; }
    const hits = pmPool.filter(n => n.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
    if (!hits.length) { suggest.classList.add('hidden'); return; }
    hits.forEach(name => {
      const li = document.createElement('li');
      li.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer';
      li.textContent = name;
      li.onclick = () => {
        searchPm.value = name;
        suggest.classList.add('hidden');
        refreshDashboard();
      };
      suggest.appendChild(li);
    });
    suggest.classList.remove('hidden');
  }

  // events
  searchPm.addEventListener('input', () => showSuggestions(searchPm.value));
  searchPm.addEventListener('focus', () => showSuggestions(searchPm.value));
  document.addEventListener('click', (e) => {
    const within = e.target === searchPm || suggest.contains(e.target);
    if (!within) suggest.classList.add('hidden');
  });
}

async function refreshDashboard() {
  const btn = document.getElementById('btnRefresh');
  btn.disabled = true; btn.textContent = 'Loading...';
  try {
    const payload = await fetchSummary();
    renderWilayahOptions(payload);
    renderKPIsTop(payload);
    renderKPIsSections(payload.avgSectionsWithGrade);
    renderTrendChart(payload);
    renderProfileByWilayahChart(payload);
    renderTable(payload);
    setupAutocomplete(payload);
  } catch (err) {
    console.error(err);
    alert('Gagal memuat dashboard: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Refresh';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnRefresh').addEventListener('click', refreshDashboard);
  document.getElementById('periodeSelect').addEventListener('change', refreshDashboard);
  document.getElementById('wilayahSelect').addEventListener('change', refreshDashboard);

  // Debounce search (tetap ada, walau autocomplete juga trigger refresh saat item dipilih)
  const search = document.getElementById('searchPm');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      // Jangan refresh keras setiap ketik; cukup saat pilih suggestion atau klik Refresh
      // Kalau mau otomatis, uncomment:
      // refreshDashboard();
    }, 600);
  });

  // Initial load
  refreshDashboard();
});
