// main.js — Form Penilaian YES 2025
// ===============================================================

// ========== KONFIGURASI KELOMPOK INDIKATOR (jumlah total 62) ==========
const indikatorData = [
  { kategori: "Campus Preparation", jumlah: 8 },
  { kategori: "Akhlak Mulia", jumlah: 18 },
  { kategori: "Quranic Mentorship", jumlah: 7 },
  { kategori: "Softskill", jumlah: 10 },
  { kategori: "Leadership", jumlah: 19 }
];

// ========== ELEMEN DOM ==========
const wilayahSelect  = document.getElementById("wilayahSelect");
const asesorField    = document.getElementById("asesorField");  // <select disabled, hanya display>
const asesorHidden   = document.getElementById("asesorHidden");  // <input type="hidden" name="asesor">
const pmSelect       = document.getElementById("pmSelect");

const progressBar    = document.getElementById("progressBar");
const filledCount    = document.getElementById("filledCount");
const totalScore     = document.getElementById("totalScore");
const resultText     = document.getElementById("resultText");

const overlaySpinner = document.getElementById("overlaySpinner");
const collapseContainer = document.getElementById("collapseSections");

let allSelectEls = []; // select skor untuk 62 indikator

// ===============================================================
//  Modal Konfirmasi (unified) — bisa dipanggil pakai STRING atau OBJECT
//  - showConfirmModal("pesan", {title?, okText?, cancelText?})
//  - showConfirmModal({title, message, okText, cancelText})
//  Auto-create DOM jika belum ada (anti-null).
// ===============================================================
function ensureModalDOM() {
  if (document.getElementById('updateModal')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'updateBackdrop';
  backdrop.className = 'fixed inset-0 bg-black/40 z-40 hidden';
  document.body.appendChild(backdrop);

  const wrap = document.createElement('div');
  wrap.id = 'updateModal';
  wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
  wrap.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b">
        <h3 id="updateTitle" class="text-lg font-semibold">Konfirmasi</h3>
      </div>
      <div class="px-6 py-4">
        <p id="updateMessage" class="text-gray-700">Apakah kamu yakin?</p>
      </div>
      <div class="px-6 py-4 border-t flex items-center justify-end gap-3">
        <button id="updateNo" class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Batal</button>
        <button id="updateYes" class="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700">OK</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function showConfirmModal(arg, opts = {}) {
  return new Promise((resolve) => {
    ensureModalDOM();

    const modal    = document.getElementById('updateModal');
    const titleEl  = document.getElementById('updateTitle');
    const msgEl    = document.getElementById('updateMessage');
    const okBtn    = document.getElementById('updateYes');
    const cancelBt = document.getElementById('updateNo');
    const backdrop = document.getElementById('updateBackdrop');

    const isString = typeof arg === 'string';
    const title    = isString ? (opts.title || 'Konfirmasi')  : (arg.title   || 'Konfirmasi');
    const message  = isString ? arg                           : (arg.message || 'Apakah kamu yakin?');
    const okText   = isString ? (opts.okText || 'OK')         : (arg.okText  || 'OK');
    const noText   = isString ? (opts.cancelText || 'Batal')  : (arg.cancelText || 'Batal');

    if (titleEl)  titleEl.textContent = title;
    if (msgEl)    msgEl.textContent   = message;
    if (okBtn)    okBtn.textContent   = okText;
    if (cancelBt) cancelBt.textContent= noText;

    const open = () => {
      modal.classList.remove('hidden');
      backdrop?.classList.remove('hidden');
    };
    const close = () => {
      modal.classList.add('hidden');
      backdrop?.classList.add('hidden');
    };

    const cleanup = () => {
      okBtn?.removeEventListener('click', onOk);
      cancelBt?.removeEventListener('click', onCancel);
      backdrop?.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEsc);
    };
    const onOk = () => { cleanup(); close(); resolve(true); };
    const onCancel = () => { cleanup(); close(); resolve(false); };
    const onEsc = (e) => { if (e.key === 'Escape') onCancel(); };

    okBtn?.addEventListener('click', onOk);
    cancelBt?.addEventListener('click', onCancel);
    backdrop?.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEsc);

    open();
  });
}

// ===============================================================
//  API Helpers
// ===============================================================
async function getValidasiData() {
  try {
    const periodeNow = document.getElementById('periodeInput')?.value || '';
    const qs = new URLSearchParams();
    if (periodeNow) qs.set('periode', periodeNow);
    qs.set('include_assessed', '1'); // tampilkan semua PM (baik yg sudah dinilai maupun belum)
    const res = await fetch(`/.netlify/functions/getValidasi?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json(); // { wilayah:[], asesor:{wilayah:[asesor]}, pm:{'wilayah||asesor':[pm]} }
  } catch (err) {
    console.error("Gagal memuat getValidasi:", err);
    return { wilayah: [], asesor: {}, pm: {} };
  }
}

async function checkExisting({ wilayah, asesor, pm, periode }) {
  try {
    const qs = new URLSearchParams({ wilayah, asesor, pm, periode });
    const res = await fetch(`/.netlify/functions/checkExisting?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) return { exists: false };
    return await res.json(); // { exists, last_tanggal?, created_at? }
  } catch (e) {
    console.error('checkExisting error:', e);
    return { exists: false };
  }
}

// ===============================================================
//  Render Helpers
// ===============================================================
function renderDropdownWilayah(wilayahList = []) {
  wilayahSelect.innerHTML = '<option value="">-- Pilih Wilayah --</option>';
  wilayahList.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    wilayahSelect.appendChild(opt);
  });
}

function renderAsesorField(wilayah, asesorMap = {}) {
  // Tiap wilayah hanya 1 asesor → auto-isi & disabled
  const list = asesorMap[wilayah] || [];
  const asesor = list.length ? list[0] : "";

  asesorField.innerHTML = '<option value="">-- Pilih Asesor --</option>';
  if (asesor) {
    const opt = document.createElement("option");
    opt.value = asesor;
    opt.textContent = asesor;
    asesorField.appendChild(opt);
    asesorField.value = asesor;
  }
  asesorField.disabled = true;

  // Sync ke hidden agar ikut terkirim saat submit
  if (asesorHidden) asesorHidden.value = asesor || "";
}

function renderDropdownPM(wilayah, asesor, pmMap = {}) {
  const key = `${wilayah}||${asesor}`;
  const list = pmMap[key] || [];
  pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
  list.forEach(pm => {
    const opt = document.createElement("option");
    opt.value = pm;
    opt.textContent = pm;
    pmSelect.appendChild(opt);
  });
  pmSelect.disabled = list.length === 0;
}

function renderIndikatorTable(indikatorList) {
  let indikatorIndex = 0;
  collapseContainer.innerHTML = "";
  allSelectEls = [];

  indikatorData.forEach((group, idx) => {
    const details = document.createElement("details");
    if (idx === 0) details.open = true;
    details.className = "rounded-xl shadow-sm bg-white overflow-hidden transition hover:shadow-md";

    const summary = document.createElement("summary");
    summary.textContent = `${String.fromCharCode(65 + idx)}. ${group.kategori}`;
    summary.className = "cursor-pointer font-semibold text-sky-700 px-4 py-3 bg-sky-100 hover:bg-sky-200";
    details.appendChild(summary);

    const table = document.createElement("table");
    table.className = "w-full border-collapse text-sm";

    table.innerHTML = `
      <thead>
        <tr class="bg-gray-100 text-gray-700 text-left">
          <th class="border border-gray-200 px-2 py-2 w-10">No</th>
          <th class="border border-gray-200 px-2 py-2 w-1/3">Indikator</th>
          <th class="border border-gray-200 px-2 py-2">Sub Indikator</th>
          <th class="border border-gray-200 px-2 py-2 w-24">Skor (1-4)</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    for (let i = 0; i < group.jumlah; i++) {
      const row = indikatorList[indikatorIndex] || { indikator: "INDIKATOR KURANG", sub: "" };
      const tr = document.createElement("tr");
      tr.className = indikatorIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

      tr.innerHTML = `
        <td class="border border-gray-200 px-2 py-2 text-center">${indikatorIndex + 1}</td>
        <td class="border border-gray-200 px-2 py-2">${row.indikator}</td>
        <td class="border border-gray-200 px-2 py-2">${row.sub}</td>
        <td class="border border-gray-200 px-2 py-2 text-center">
          <select name="nilai" required data-idx="${indikatorIndex}"
                  class="w-full border rounded-md px-2 py-1 focus:ring-2 focus:ring-sky-400 outline-none">
            <option value="">-</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </td>
      `;

      const selectEl = tr.querySelector("select");
      selectEl.addEventListener("change", updateProgressAndSkor);
      allSelectEls.push(selectEl);
      tbody.appendChild(tr);
      indikatorIndex++;
    }

    details.appendChild(table);
    collapseContainer.appendChild(details);
  });
}

// ===============================================================
//  Progress & Skor
// ===============================================================
function updateProgressAndSkor() {
  const nilai = allSelectEls.map(sel => parseInt(sel.value, 10) || 0);
  const terisi = allSelectEls.filter(sel => sel.value).length;
  const total = nilai.reduce((a, b) => a + b, 0);
  const percent = Math.round((terisi / allSelectEls.length) * 100);

  progressBar.style.width = percent + "%";
  filledCount.textContent = terisi;
  totalScore.textContent = total;

  const skor100 = Math.round((total / (allSelectEls.length * 4)) * 100);
  let grade = "Below Standard (Lemah)";
  if (skor100 === 100) grade = "Excellent (Sempurna / Istimewa)";
  else if (skor100 >= 90) grade = "Very Good (Baik Sekali)";
  else if (skor100 >= 80) grade = "Good (Baik)";
  else if (skor100 >= 70) grade = "Satisfactory (Cukup)";
  else if (skor100 >= 50) grade = "Need Improvement (Kurang Baik)";

  resultText.textContent = grade;
}

// ===============================================================
//  Submit
// ===============================================================
async function handleSubmit(e) {
  e.preventDefault();

  const nilai = allSelectEls.map(sel => sel.value);
  if (nilai.some(n => n === "")) {
    await showConfirmModal({
      title: 'Skor belum lengkap',
      message: 'Masih ada skor indikator yang kosong. Lengkapi semua skor (1–4) ya.',
      okText: 'OK',
      cancelText: 'Tutup'
    });
    return;
  }

  const form = e.target;
  const data = new FormData(form);
  const payload = {
    pm: data.get("pm"),
    wilayah: data.get("wilayah"),
    asesor: asesorHidden?.value || asesorField?.value || "",   // pastikan terisi
    periode: data.get("periode"),
    tanggal: data.get("tanggal"),
    nilai
  };

  if (!payload.wilayah || !payload.asesor || !payload.pm || !payload.periode || !payload.tanggal) {
    await showConfirmModal({
      title: 'Form belum lengkap',
      message: 'Semua field utama (Wilayah, Asesor, PM, Periode, Tanggal) wajib diisi.',
      okText: 'OK',
      cancelText: 'Tutup'
    });
    return;
  }

  // Pre-check lagi sebelum kirim (double safety)
  const existInfo = await checkExisting({
    wilayah: payload.wilayah,
    asesor: payload.asesor,
    pm: payload.pm,
    periode: payload.periode
  });

  if (existInfo.exists) {
    const ok = await showConfirmModal({
      title: 'Data sudah ada',
      message: `Nilai untuk PM "${payload.pm}" pada periode "${payload.periode}" sudah tersimpan.\nIngin mengUPDATE data tersebut?`,
      okText: 'Lanjut Update',
      cancelText: 'Batal'
    });
    if (!ok) return;
  }

  // Kirim (submitForm melakukan UPSERT)
  overlaySpinner.style.display = "flex";
  try {
    const res = await fetch("/.netlify/functions/submitForm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    overlaySpinner.style.display = "none";

    if (!res.ok) throw new Error(result.error || `Gagal menyimpan (status ${res.status})`);

    // Sukses → reset
    form.reset();
    allSelectEls.forEach(sel => (sel.value = ""));
    updateProgressAndSkor();
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
    pmSelect.disabled = true;

    await showConfirmModal({
      title: 'Berhasil',
      message: 'Data berhasil disimpan/diupdate.',
      okText: 'OK',
      cancelText: 'Tutup'
    });
  } catch (err) {
    overlaySpinner.style.display = "none";
    console.error("Submit error:", err);
    await showConfirmModal({
      title: 'Gagal',
      message: 'Gagal menyimpan: ' + err.message,
      okText: 'OK',
      cancelText: 'Tutup'
    });
  }
}

// ===============================================================
//  INIT — Orkestrasi
// ===============================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Default tanggal = hari ini
  const tanggalInput = document.querySelector('input[name="tanggal"]');
  if (tanggalInput) tanggalInput.value = new Date().toISOString().split("T")[0];

  // Muat data validasi (wilayah, asesor, pm)
  const data = await getValidasiData();
  renderDropdownWilayah(data.wilayah);

  // Pilih Wilayah → auto isi Asesor, sync hidden, render PM
  wilayahSelect.addEventListener("change", () => {
    const asesorGroup = document.getElementById("asesorGroup");
    const wilayah = wilayahSelect.value?.trim() || "";

    if (!wilayah) {
      // kosongkan jika wilayah dihapus
      if (asesorGroup) asesorGroup.classList.add("hidden");
      asesorField.innerHTML = '<option value="">-- Pilih Asesor --</option>';
      asesorField.disabled = true;
      if (asesorHidden) asesorHidden.value = "";
      pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
      pmSelect.disabled = true;
      return;
    }

    // Auto isi asesor
    renderAsesorField(wilayah, data.asesor);
    if (asesorGroup) asesorGroup.classList.remove("hidden");

    // Sinkronkan ke hidden
    const asesor = asesorField.value || "";
    if (asesorHidden) asesorHidden.value = asesor;

    // Render daftar PM utk pasangan (wilayah, asesor)
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
    renderDropdownPM(wilayah, asesor, data.pm);
  });

  // Saat PM dipilih → cek existing & tawarkan update
  pmSelect.addEventListener('change', async () => {
    const wilayah = wilayahSelect.value?.trim();
    const asesor  = (asesorHidden?.value || asesorField.value || "").trim();
    const pm      = pmSelect.value?.trim();
    const periode = document.getElementById('periodeInput').value?.trim();

    if (!wilayah || !asesor || !pm || !periode) return;

    try {
      const info = await checkExisting({ wilayah, asesor, pm, periode });
      if (info?.exists) {
        const ok = await showConfirmModal(
          `Data penilaian untuk ${pm} (${wilayah}, ${periode}) sudah ada.\nIngin UPDATE nilainya?`,
          { okText: 'Update', cancelText: 'Batal' }
        );
        if (!ok) {
          pmSelect.value = ''; // batalkan pilihan
        }
      }
    } catch (e) {
      console.error('checkExisting error:', e);
      // boleh tampilkan toast ringan di sini bila mau
    }
  });

  // Jika periode diganti, dan PM sudah terpilih → ulangi check
  document.getElementById('periodeInput')?.addEventListener('change', () => {
    if (pmSelect.value) {
      pmSelect.dispatchEvent(new Event('change'));
    }
  });

  // Render indikator (dari indikator.json)
  try {
    const indikatorList = await fetch("indikator.json", { cache: "no-store" }).then(r => r.json());
    renderIndikatorTable(indikatorList);
  } catch (err) {
    console.error("Gagal memuat indikator.json:", err);
    renderIndikatorTable([]);
  }
  updateProgressAndSkor();

  // Submit
  document.getElementById("penilaianForm").addEventListener("submit", handleSubmit);
});
