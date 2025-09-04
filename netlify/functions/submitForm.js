// netlify/functions/submitForm.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { wilayah, asesor, pm, periode, tanggal, nilai } = body;

    if (!wilayah || !asesor || !pm || !periode || !tanggal) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Semua field utama wajib diisi' }) };
    }
    if (!Array.isArray(nilai) || nilai.length !== 62) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Jumlah nilai harus 62' }) };
    }

    // rakit nilai_json + n01..n62
    const nilai_json = nilai.map(v => toNum(v) ?? 0);
    const cols = {};
    for (let i = 0; i < 62; i++) {
      const idx = (i + 1).toString().padStart(2, '0');
      cols[`n${idx}`] = toNum(nilai_json[i]);
    }

    const payloadRow = {
      wilayah,
      asesor,
      nama_pm: pm,
      periode,
      tanggal,            // 'YYYY-MM-DD'
      nilai_json,
      ...cols,
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // UPSERT by unique key
    const { data, error } = await supabase
      .from('penilaian_yes')
      .upsert(payloadRow, { onConflict: 'wilayah,asesor,nama_pm,periode' })
      .select();

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // tandai sudah dinilai (opsional sesuai desain kamu)
    await supabase
      .from('validasi_data')
      .update({ status: 'Sudah Dinilai' })
      .eq('wilayah', wilayah)
      .eq('asesor', asesor)
      .eq('nama_pm', pm);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, rows: data?.length || 0 })
    };
  } catch (e) {
    console.error('submitForm fatal:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
