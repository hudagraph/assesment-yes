// netlify/functions/checkExisting.js
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
      return { statusCode: 200, body: JSON.stringify({ exists: false }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('penilaian_yes')
      .select('id, tanggal, updated_at')
      .eq('wilayah', wilayah)
      .eq('asesor', asesor)
      .eq('nama_pm', pm)
      .eq('periode', periode)
      .limit(1);

    if (error) {
      console.error('checkExisting error:', error);
      return { statusCode: 500, body: JSON.stringify({ exists: false }) };
    }

    const row = (data && data[0]) || null;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        exists: !!row,
        last_tanggal: row?.tanggal || null,
        updated_at: row?.updated_at || null
      })
    };
  } catch (err) {
    console.error('checkExisting fatal:', err);
    return { statusCode: 500, body: JSON.stringify({ exists: false }) };
  }
}
