import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

export async function handler(event) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const wilayah = (params.get('wilayah') || '').trim();
    const asesor  = (params.get('asesor')  || '').trim();
    const nama_pm = (params.get('pm')      || '').trim();
    const periode = (params.get('periode') || '').trim();

    if (!wilayah || !asesor || !nama_pm || !periode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'missing params' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('penilaian_yes')
      .select('id, tanggal, created_at')
      .eq('wilayah', wilayah)
      .eq('asesor', asesor)
      .eq('nama_pm', nama_pm)
      .eq('periode', periode)
      .limit(1);

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ exists: (data && data.length > 0), last: data?.[0] || null })
    };
  } catch (err) {
    console.error('checkExisting error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
