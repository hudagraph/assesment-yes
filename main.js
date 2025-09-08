// main.js (frontend Netlify + Supabase)

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
const asesorField    = document.getElementById("asesorField");
const pmSelect       = document.getElementById("pmSelect");
const asesorHidden   = document.getElementById("asesorHidden");

const progressBar    = document.getElementById("progressBar");
const filledCount    = document.getElementById("filledCount");
const totalScore     = document.getElementById("totalScore");
const resultText     = document.getElementById("resultText");

const overlaySpinner = document.getElementById("overlaySpinner");
const collapseContainer = document.getElementById("collapseSections");

let allSelectEls = []; // select skor untuk 62 indikator

// ======= CONFIRM MODAL (pengganti window.confirm) =======
function showConfirmModal(message, { okText = 'Update', cancelText = 'Batal' } = {}) {
  return new Promise((resolve) => {
    const modal      = document.getElementById('updateModal');
    const msgEl      = document.getElementById('updateMessage');
    const okBtn      = document.getElementById('updateYes');
    const cancelBtn  = document.getElementById('updateNo');
    const backdrop   = document.getElementById('updateBackdrop');

    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      // fallback kalau HTML modal belum ada
      const ok = window.confirm(message);
      resolve(ok);
      return;
    }

    msgEl.textContent = message;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    // buka modal
    modal.classList.remove('hidden');
    backdrop?.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      backdrop?.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      backdrop?.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEsc);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onEsc = (e) => { if (e.key === 'Escape') onCancel(); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    backdrop?.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEsc);
  });
}

// ========== API HELPERS ==========
async function getValidasiData() {
  try {
    const periodeNow = document.getElementById('periodeInput')?.value || '';
    const qs = new URLSearchParams();
    if (periodeNow) qs.set('periode', periodeNow);
    qs.set('include_assessed', '1'); // <- tampilkan semua
    const res = await fetch(`/.netlify/functions/getValidasi?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Gagal memuat getValidasi:", err);
    return { wilayah: [], asesor: {}, pm: {} };
  }
}

// ========== RENDER HELPERS ==========
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

  // >>> penting: sinkronkan ke input hidden supaya ikut terkirim
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

// ========== PROGRESS & SKOR ==========
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

// ===== Modal helper (Promise-based) =====
function showConfirmModal({ title, message, okText = 'Update', cancelText = 'Batal' }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const $title = document.getElementById('confirmTitle');
    const $msg = document.getElementById('confirmMessage');
    const $ok = document.getElementById('confirmOk');
    const $cancel = document.getElementById('confirmCancel');

    $title.textContent = title || 'Konfirmasi';
    $msg.textContent = message || 'Apakah kamu yakin?';
    $ok.textContent = okText;
    $cancel.textContent = cancelText;

    const onClose = (val) => {
      modal.classList.add('hidden');
      $ok.removeEventListener('click', onOk);
      $cancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      resolve(val);
    };

    const onOk = () => onClose(true);
    const onCancel = () => onClose(false);
    const onBackdrop = (e) => {
      if (e.target === modal) onClose(false);
    };

    $ok.addEventListener('click', onOk);
    $cancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);

    modal.classList.remove('hidden');
  });
}

// ===== Cek apakah data sudah ada (by wilayah, asesor, pm, periode) =====
async function checkExisting({ wilayah, asesor, pm, periode }) {
  const qs = new URLSearchParams({
    wilayah, asesor, pm, periode
  });
  const res = await fetch(`/.netlify/functions/checkExisting?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return { exists: false };
  return res.json(); // { exists: true/false, last_tanggal?, updated_at? }
}


// ========== SUBMIT ==========
async function handleSubmit(e) {
  e.preventDefault();

  const nilai = allSelectEls.map(sel => sel.value);
  if (nilai.some(n => n === "")) {
    // ganti alert lama (opsional):
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
    asesor: asesorField.value,          // << penting: ambil dari elemen, bukan FormData
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

  // ===== PRE-CHECK: sudah ada datanya? =====
  const existInfo = await checkExisting({
    wilayah: payload.wilayah,
    asesor: payload.asesor,
    pm: payload.pm,
    periode: payload.periode
  });

  if (existInfo.exists) {
    const ok = await showConfirmModal({
      title: 'Data sudah ada',
      message: `Nilai untuk PM "${payload.pm}" pada periode "${payload.periode}" sudah tersimpan.\n` +
               `Ingin mengUPDATE data tersebut?`,
      okText: 'Lanjut Update',
      cancelText: 'Batal'
    });
    if (!ok) return; // batal kirim
  }

  // ===== kirim seperti biasa (submitForm sudah UPSERT) =====
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

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", async () => {
  // set default tanggal = hari ini
  const tanggalInput = document.querySelector('input[name="tanggal"]');
  if (tanggalInput) tanggalInput.value = new Date().toISOString().split("T")[0];

  // Muat data validasi (wilayah, asesor, pm)
  const data = await getValidasiData();
  renderDropdownWilayah(data.wilayah);

  // Event: pilih Wilayah → auto isi Asesor (display), sinkron ke hidden, lalu render PM
  wilayahSelect.addEventListener("change", () => {
    const asesorGroup = document.getElementById("asesorGroup");
    const wilayah = wilayahSelect.value?.trim() || "";
  
    // jika user mengosongkan wilayah
    if (!wilayah) {
      // sembunyikan grup asesor & kosongkan semuanya
      if (asesorGroup) asesorGroup.classList.add("hidden");
      asesorField.innerHTML = '<option value="">-- Pilih Asesor --</option>';
      asesorField.disabled = true;
      if (asesorHidden) asesorHidden.value = "";
  
      pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
      pmSelect.disabled = true;
      return;
    }
  
    // isi asesor (otomatis 1 asesor per wilayah)
    renderAsesorField(wilayah, data.asesor);
    if (asesorGroup) asesorGroup.classList.remove("hidden");
  
    // sinkronkan ke input hidden supaya ikut terkirim saat submit
    const asesor = asesorField.value || "";
    if (asesorHidden) asesorHidden.value = asesor;
  
    // render daftar PM utk (wilayah, asesor)
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
    renderDropdownPM(wilayah, asesor, data.pm); // ini juga otomatis set disabled kalau list kosong
  });

  // ketika PM berubah, cek apakah sudah ada data untuk (wilayah, asesor, pm, periode)
  pmSelect.addEventListener('change', async () => {
    const wilayah = wilayahSelect.value;
    const asesor  = asesorField.value;
    const pm      = pmSelect.value;
    const periode = document.getElementById('periodeInput')?.value || '';
  
    if (!wilayah || !asesor || !pm || !periode) return;
  
    try {
      const qs = new URLSearchParams({ wilayah, asesor, pm, periode });
      const res = await fetch(`/.netlify/functions/checkExisting?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.exists) {
        const ok = confirm(`Data penilaian untuk ${pm} (${wilayah}, ${periode}) sudah ada.\nIngin UPDATE nilainya?`);
        if (!ok) {
          // batal: kembalikan ke "-- Pilih PM --"
          pmSelect.value = '';
        }
        // kalau ok: biarkan user lanjut; submitForm kamu sudah upsert (lihat bagian 3)
      }
    } catch (e) {
      console.warn('checkExisting failed', e);
    }
  });
  
  // kalau periode diubah, kita ulang cek saat PM dipilih lagi
  document.getElementById('periodeInput')?.addEventListener('change', () => {
    if (pmSelect.value) {
      const ev = new Event('change');
      pmSelect.dispatchEvent(ev);
    }
  });


  // Render indikator (ambil dari file indikator.json agar modular)
  try {
    const indikatorList = await fetch("indikator.json", { cache: "no-store" }).then(r => r.json());
    renderIndikatorTable(indikatorList);
  } catch (err) {
    console.error("Gagal memuat indikator.json:", err);
    // fallback minimal kalau file tak ditemukan
    renderIndikatorTable([]);
  }
  updateProgressAndSkor();

  // Event submit
  document.getElementById("penilaianForm").addEventListener("submit", handleSubmit);
});
