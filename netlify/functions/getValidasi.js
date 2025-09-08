// netlify/functions/getValidasi.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

export async function handler(event) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const periode = (params.get('periode') || '').trim();
    const includeAssessed = params.get('include_assessed') !== '0'; // default: true

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ambil master validasi
    const { data: vdata, error } = await supabase
      .from('validasi_data')
      .select('wilayah, asesor, nama_pm');
    if (error) throw error;

    // bila includeAssessed = false, sembunyikan PM yang sudah dinilai pada periode tsb
    let assessedSet = new Set();
    if (!includeAssessed && periode) {
      const { data: assessed, error: e2 } = await supabase
        .from('penilaian_yes')
        .select('wilayah, asesor, nama_pm')
        .eq('periode', periode);
      if (e2) throw e2;
      (assessed || []).forEach(r => {
        assessedSet.add(`${(r.wilayah||'').trim()}||${(r.asesor||'').trim()}||${(r.nama_pm||'').trim()}`);
      });
    }

    const wilayahSet = new Set();
    const asesorMap = {};   // { [wilayah]: [asesor1] }
    const pmMap = {};       // { ["wilayah||asesor"]: [pm1, pm2] }

    (vdata || []).forEach(r => {
      const w = (r.wilayah || '').trim();
      const a = (r.asesor || '').trim();
      const p = (r.nama_pm || '').trim();
      if (!w || !a || !p) return;

      wilayahSet.add(w);
      if (!asesorMap[w]) asesorMap[w] = [];
      if (!asesorMap[w].includes(a)) asesorMap[w].push(a);

      const key = `${w}||${a}`;
      if (!pmMap[key]) pmMap[key] = [];
      // skip jika diset untuk hide yang sudah dinilai
      if (!includeAssessed && periode) {
        const trip = `${w}||${a}||${p}`;
        if (assessedSet.has(trip)) return;
      }
      pmMap[key].push(p);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        wilayah: Array.from(wilayahSet).sort(),
        asesor: asesorMap,
        pm: pmMap
      })
    };
  } catch (err) {
    console.error('getValidasi error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
