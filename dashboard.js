// dashboard.js

let barChart;

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

function renderKPIs(payload) {
  const { kpis, chart } = payload;

  document.getElementById('kpiCount').textContent = kpis.count.toString();
  document.getElementById('kpiAvgTotal').textContent = fmtPct(kpis.avg_total_pct);
  document.getElementById('kpiWilayah').textContent = chart.wilayahLabels.length.toString();

  const gradesDiv = document.getElementById('kpiGrades');
  gradesDiv.innerHTML = '';
  const entries = Object.entries(kpis.grade_counts).sort((a,b) => b[1]-a[1]);
  if (entries.length === 0) {
    gradesDiv.textContent = '-';
  } else {
    entries.forEach(([g, n]) => {
      const span = document.createElement('span');
      span.className = 'inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded mr-2 mb-1';
      span.textContent = `${g}: ${n}`;
      gradesDiv.appendChild(span);
    });
  }
}

function renderWilayahOptions(payload) {
  const wilayahSelect = document.getElementById('wilayahSelect');
  wilayahSelect.innerHTML = '<option value="">(Semua Wilayah)</option>';
  const set = new Set(payload.wilayah_list || []);
  (Array.from(set).sort()).forEach(w => {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w;
    wilayahSelect.appendChild(opt);
  });
}

function renderChart(payload) {
  const ctx = document.getElementById('barChart').getContext('2d');
  const labels = payload.chart.wilayahLabels;
  const ds = payload.chart.datasets;

  const data = {
    labels,
    datasets: [
      { label: 'CP%', data: ds.campus_preparation_pct },
      { label: 'AM%', data: ds.akhlak_mulia_pct },
      { label: 'QM%', data: ds.quranic_mentorship_pct },
      { label: 'SS%', data: ds.softskill_pct },
      { label: 'LD%', data: ds.leadership_pct },
    ]
  };

  if (barChart) {
    barChart.data = data;
    barChart.update();
    return;
  }

  barChart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label} ${fmtPct(ctx.parsed.y)}`
          }
        }
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
      <td class="px-3 py-2">${r.grade || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function refreshDashboard() {
  const btn = document.getElementById('btnRefresh');
  btn.disabled = true; btn.textContent = 'Loading...';
  try {
    const payload = await fetchSummary();
    renderWilayahOptions(payload); // keep options fresh (especially when period changes)
    renderKPIs(payload);
    renderChart(payload);
    renderTable(payload);
  } catch (err) {
    console.error(err);
    alert('Gagal memuat dashboard: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Refresh';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnRefresh').addEventListener('click', refreshDashboard);

  // Auto-refresh saat filter berubah
  document.getElementById('periodeSelect').addEventListener('change', refreshDashboard);
  document.getElementById('wilayahSelect').addEventListener('change', refreshDashboard);

  // Debounce search
  const search = document.getElementById('searchPm');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(refreshDashboard, 400);
  });

  // Initial load
  refreshDashboard();
});
