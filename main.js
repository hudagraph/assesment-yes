// main.js (untuk frontend)

const indikatorData = [
  { kategori: "Campus Preparation", jumlah: 8 },
  { kategori: "Akhlak Mulia", jumlah: 18 },
  { kategori: "Quranic Mentorship", jumlah: 7 },
  { kategori: "Softskill", jumlah: 10 },
  { kategori: "Leadership", jumlah: 19 }
];

// Ambil referensi element
const wilayahSelect = document.getElementById("wilayahSelect");
const asesorSelect = document.getElementById("asesorSelect");
const pmSelect = document.getElementById("pmSelect");
const progressBar = document.getElementById("progressBar");
const filledCount = document.getElementById("filledCount");
const totalScore = document.getElementById("totalScore");
const resultText = document.getElementById("resultText");

const overlaySpinner = document.getElementById("overlaySpinner");
const collapseContainer = document.getElementById("collapseSections");

let allSelectEls = [];

async function getValidasiData() {
  const res = await fetch('/.netlify/functions/getValidasi');
  if (!res.ok) {
    console.error('getValidasi status', res.status);
    return { wilayah: [], asesor: {}, pm: {} };
  }
  return res.json();
}

function renderDropdownWilayah(wilayahList = []) {
  wilayahSelect.innerHTML = '<option value="">-- Pilih Wilayah --</option>';
  wilayahList.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w;
    wilayahSelect.appendChild(opt);
  });
}

function renderDropdownAsesor(wilayah, asesorMap) {
  const list = asesorMap[wilayah] || [];
  asesorSelect.innerHTML = '<option value="">-- Pilih Asesor --</option>';
  list.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    asesorSelect.appendChild(opt);
  });
  asesorSelect.disabled = list.length === 0;
}

function renderDropdownPM(wilayah, asesor, pmMap) {
  const key = `${wilayah}||${asesor}`;
  const list = pmMap[key] || [];
  pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
  list.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
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
      const data = indikatorList[indikatorIndex] || { indikator: "INDIKATOR KURANG", sub: "" };
      const tr = document.createElement("tr");
      tr.className = indikatorIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

      tr.innerHTML = `
        <td class="border border-gray-200 px-2 py-2 text-center">${indikatorIndex + 1}</td>
        <td class="border border-gray-200 px-2 py-2">${data.indikator}</td>
        <td class="border border-gray-200 px-2 py-2">${data.sub}</td>
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

function updateProgressAndSkor() {
  const nilai = allSelectEls.map(sel => parseInt(sel.value) || 0);
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

async function handleSubmit(e) {
  e.preventDefault();

  const nilai = allSelectEls.map(sel => sel.value);
  if (nilai.some(n => n === "")) return alert("Semua skor wajib diisi!");

  const form = e.target;
  const data = new FormData(form);
  const payload = {
    pm: data.get("pm"),
    wilayah: data.get("wilayah"),
    asesor: data.get("asesor"),
    periode: data.get("periode"),
    tanggal: data.get("tanggal"),
    nilai
  };

  overlaySpinner.style.display = "flex";

  try {
    const res = await fetch("/.netlify/functions/submitForm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    overlaySpinner.style.display = "none";
    if (!res.ok) throw new Error(result.error || "Gagal menyimpan");

    alert("Data berhasil disimpan!");
    form.reset();
    allSelectEls.forEach(sel => sel.value = "");
    updateProgressAndSkor();
  } catch (err) {
    overlaySpinner.style.display = "none";
    alert("Gagal menyimpan: " + err.message);
  }
}

// ==== INIT ====
document.addEventListener("DOMContentLoaded", async () => {
  const wilayahInput = document.querySelector("input[name='wilayah']");
  const asesorInput = document.querySelector("input[name='asesor']");
  const periodeInput = document.querySelector("input[name='periode']");
  const tanggalInput = document.querySelector("input[name='tanggal']");
  if (tanggalInput) tanggalInput.value = new Date().toISOString().split('T')[0];

  const data = await getValidasiData();
  renderDropdownWilayah(data.wilayah);

  wilayahSelect.addEventListener("change", () => {
    renderDropdownAsesor(wilayahSelect.value, data.asesor);
    pmSelect.innerHTML = '<option value="">-- Pilih PM --</option>';
  });

  asesorSelect.addEventListener("change", () => {
    renderDropdownPM(wilayahSelect.value, asesorSelect.value, data.pm);
  });

  // Render indikator
  const indikatorList = await fetch("indikator.json").then(r => r.json());
  renderIndikatorTable(indikatorList);
  updateProgressAndSkor();

  // Event Submit
  document.getElementById("penilaianForm").addEventListener("submit", handleSubmit);
});
