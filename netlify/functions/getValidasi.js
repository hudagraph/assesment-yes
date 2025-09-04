// netlify/functions/getValidasi.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

export async function handler(event) {
  try {
    // GET only
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('validasi_data')
      .select('wilayah, asesor, nama_pm, status');

    if (error) {
      console.error('Supabase error getValidasi:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    const wilayahSet = new Set();
    const asesorMap = new Map(); // wilayah -> Set(asesor)
    const pmMap = new Map();     // `${wilayah}||${asesor}` -> [pm]

    for (const row of data || []) {
      wilayahSet.add(row.wilayah);

      if (!asesorMap.has(row.wilayah)) asesorMap.set(row.wilayah, new Set());
      asesorMap.get(row.wilayah).add(row.asesor);

      const key = `${row.wilayah}||${row.asesor}`;
      if (!pmMap.has(key)) pmMap.set(key, []);
      // hanya tampilkan PM yang status-nya belum dinilai
      if (row.status !== 'Sudah Dinilai') pmMap.get(key).push(row.nama_pm);
    }

    const payload = {
      wilayah: Array.from(wilayahSet),
      asesor: Object.fromEntries([...asesorMap].map(([k, v]) => [k, Array.from(v)])),
      pm: Object.fromEntries(pmMap)
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    console.error('getValidasi fatal:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
