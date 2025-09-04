// netlify/functions/submitForm.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { wilayah, asesor, pm, periode, tanggal, nilai } = body;

    if (!wilayah || !asesor || !pm || !periode || !tanggal || !Array.isArray(nilai) || nilai.length !== 62) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Input tidak lengkap atau tidak valid.' }) };
    }

    const totalSkor = nilai.reduce((sum, n) => sum + parseInt(n || 0, 10), 0);
    const skor100 = Math.round((totalSkor / 248) * 100);

    let grade = 'Below Standard (Lemah)';
    if (skor100 === 100) grade = 'Excellent (Sempurna / Istimewa)';
    else if (skor100 >= 90) grade = 'Very Good (Baik Sekali)';
    else if (skor100 >= 80) grade = 'Good (Baik)';
    else if (skor100 >= 70) grade = 'Satisfactory (Cukup)';
    else if (skor100 >= 50) grade = 'Need Improvement (Kurang Baik)';

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { error: insertError } = await supabase
      .from('penilaian_yes')
      .insert({
        wilayah,
        asesor,
        nama_pm: pm,
        periode,
        tanggal,
        nilai_json: nilai,
        total_skor: totalSkor,
        grade
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) };
    }

    const { error: updateError } = await supabase
      .from('validasi_data')
      .update({ status: 'Sudah Dinilai' })
      .match({ wilayah, asesor, nama_pm: pm });

    if (updateError) {
      console.error('Supabase update error:', updateError);
      // tidak fatal untuk user; tetap balas sukses tapi log error
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Sukses' })
    };
  } catch (err) {
    console.error('submitForm fatal:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
