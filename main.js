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
const asesorField    = document.getElementById("asesorField"); // <select id="asesorField" ...>
const pmSelect       = document.getElementById("pmSelect");

const progressBar    = document.getElementById("progressBar");
const filledCount    = document.getElementById("filledCount");
const totalScore     = document.getElementById("totalScore");
const resultText     = document.getElementById("resultText");

const overlaySpinner = document.getElementById("overlaySpinner");
const collapseContainer = document.getElementById("collapseSections");

let allSelectEls = []; // select skor untuk 62 indikator

// ========== API HELPERS ==========
async function getValidasiData() {
  try {
    const res = await fetch("/.netlify/functions/getValidasi", { cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json(); // { wilayah:[], asesor:{[wilayah]:[asesor]}, pm:{["wilayah||asesor"]:[pm]} }
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
  // Tiap wilayah hanya punya 1 asesor → auto-isi & disabled
  const list = asesorMap[wilayah] || [];
  const asesor = list.length ? list[0] : "";
  asesorField.value = asesor;

  asesorField.innerHTML = '<option value="">-- Pilih Asesor --</option>';
  if (asesor) {
    const opt = document.createElement("option");
    opt.value = asesor;
    opt.textContent = asesor;
    asesorField.appendChild(opt);
    asesorField.value = asesor;
  }
  asesorField.disabled = true; // kunci karena fixed per wilayah
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

// ========== SUBMIT ==========
async function handleSubmit(e) {
  e.preventDefault();

  const nilai = allSelectEls.map(sel => sel.value);
  if (nilai.some(n => n === "")) {
    alert("Semua skor wajib diisi!");
    return;
  }

  const form = e.target;
  const data = new FormData(form);
  const payload = {
    pm: data.get("pm"),
    wilayah: data.get("wilayah"),
    asesor: data.get("asesor"), // ini adalah asesorField yang sudah auto-isi & disabled
    periode: data.get("periode"),
    tanggal: data.get("tanggal"),
    nilai
  };

  // Validasi minimal
  if (!payload.wilayah || !payload.asesor || !payload.pm || !payload.periode || !payload.tanggal) {
    alert("Semua field utama wajib diisi!");
    return;
  }

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

    // Sukses
    // Reset form & progres
    form.reset();
    allSelectEls.forEach(sel => (sel.value = ""));
    updateProgressAndSkor();

    // Reset PM list setelah submit
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
    pmSelect.disabled = true;

    alert("Data berhasil disimpan!");
  } catch (err) {
    overlaySpinner.style.display = "none";
    console.error("Submit error:", err);
    alert("Gagal menyimpan: " + err.message);
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

  // Event: pilih Wilayah → auto isi Asesor, lalu render PM
  wilayahSelect.addEventListener("change", () => {
    renderAsesorField(wilayahSelect.value, data.asesor);
  
    // tampilkan field asesor setelah otomatis terisi
    const asesorGroup = document.getElementById("asesorGroup");
    if (asesorGroup) asesorGroup.classList.remove("hidden");
  
    const wilayah = wilayahSelect.value;
    const asesor = asesorField.value;
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
    renderDropdownPM(wilayah, asesor, data.pm);
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
