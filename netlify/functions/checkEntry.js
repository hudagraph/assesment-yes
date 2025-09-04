// netlify/functions/checkEntry.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const p = new URLSearchParams(event.queryStringParameters || {});
    const wilayah = (p.get('wilayah') || '').trim();
    const asesor  = (p.get('asesor')  || '').trim();
    const pm      = (p.get('pm')      || '').trim();
    const periode = (p.get('periode') || '').trim();

    if (!wilayah || !asesor || !pm || !periode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing params' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('penilaian_yes')
      .select('id', { count: 'exact', head: true })
      .eq('wilayah', wilayah)
      .eq('asesor', asesor)
      .eq('nama_pm', pm)
      .eq('periode', periode);

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // count tersedia di object 'data' untuk head:true? Supabase v2: gunakan 'count' dari response
    const exists = (data && data.length > 0) ? true : false; // fallback
    // Lebih akurat: gunakan properti 'count' dari select head
    // Namun beberapa runtime tidak expose; aman pakai query kedua:
    if (!exists) {
      const { data: rows2, error: err2 } = await supabase
        .from('penilaian_yes')
        .select('id')
        .eq('wilayah', wilayah)
        .eq('asesor', asesor)
        .eq('nama_pm', pm)
        .eq('periode', periode)
        .limit(1);
      if (err2) return { statusCode: 500, body: JSON.stringify({ error: err2.message }) };
      return { statusCode: 200, body: JSON.stringify({ exists: (rows2 || []).length > 0 }) };
    }

    return { statusCode: 200, body: JSON.stringify({ exists: true }) };
  } catch (e) {
    console.error('checkEntry fatal:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
