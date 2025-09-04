// netlify/functions/submitForm.js
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


export default async (req, res) => {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' });
}


try {
const { wilayah, asesor, pm, periode, tanggal, nilai } = req.body;


if (!wilayah || !asesor || !pm || !periode || !tanggal || !Array.isArray(nilai) || nilai.length !== 62) {
return res.status(400).json({ error: 'Input tidak lengkap atau tidak valid.' });
}


const totalSkor = nilai.reduce((sum, n) => sum + parseInt(n || 0), 0);
const skor100 = Math.round((totalSkor / 248) * 100);


let grade = 'Below Standard (Lemah)';
if (skor100 === 100) grade = 'Excellent (Sempurna / Istimewa)';
else if (skor100 >= 90) grade = 'Very Good (Baik Sekali)';
else if (skor100 >= 80) grade = 'Good (Baik)';
else if (skor100 >= 70) grade = 'Satisfactory (Cukup)';
else if (skor100 >= 50) grade = 'Need Improvement (Kurang Baik)';


const { error: insertError } = await supabase.from('penilaian_yes').insert({
wilayah,
asesor,
nama_pm: pm,
periode,
tanggal,
nilai_json: nilai,
total_skor: totalSkor,
grade
});


if (insertError) throw insertError;


await supabase
.from('validasi_data')
.update({ status: 'Sudah Dinilai' })
.match({ wilayah, asesor, nama_pm: pm });


return res.status(200).json({ message: 'Sukses' });
} catch (err) {
return res.status(500).json({ error: err.message });
}
};
