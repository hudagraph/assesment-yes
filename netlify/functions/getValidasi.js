// netlify/functions/getValidasi.js
import { createClient } from '@supabase/supabase-js';


const supabase = createClient(
'https://dorppttdlqqtrjoastor.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI'
);


export default async (req, res) => {
try {
const { data, error } = await supabase
.from('validasi_data')
.select('wilayah, asesor, nama_pm, status');


if (error) throw error;


const wilayahSet = new Set();
const asesorMap = new Map();
const pmMap = new Map();


for (const row of data) {
wilayahSet.add(row.wilayah);


const aKey = row.wilayah;
const bKey = `${row.wilayah}||${row.asesor}`;


if (!asesorMap.has(aKey)) asesorMap.set(aKey, new Set());
asesorMap.get(aKey).add(row.asesor);


if (!pmMap.has(bKey)) pmMap.set(bKey, []);
if (row.status !== 'Sudah Dinilai') {
pmMap.get(bKey).push(row.nama_pm);
}
}


return res.status(200).json({
wilayah: Array.from(wilayahSet),
asesor: Object.fromEntries([...asesorMap].map(([k, v]) => [k, Array.from(v)])),
pm: Object.fromEntries(pmMap)
});
} catch (err) {
return res.status(500).json({ error: err.message });
}
};
