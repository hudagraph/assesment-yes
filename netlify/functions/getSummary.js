// netlify/functions/getSummary.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dorppttdlqqtrjoastor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnBwdHRkbHFxdHJqb2FzdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTQzOTQsImV4cCI6MjA3MjQ5MDM5NH0.tMC5JrzsdZHp3_eq0ifQPrYaks8XQstbhD6M1VmFHbI';

const PERIODES = [
  'Assesment Awal',
  'Tri Semester 1',
  'Tri Semester 2',
  'Assesment Akhir',
];

export async function handler(event) {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const periode = params.get('periode') || 'Assesment Awal';
    const wilayah = params.get('wilayah') || ''; // optional
    const q = (params.get('q') || '').trim();    // optional search PM
    const limit = Math.min(parseInt(params.get('limit') || '500', 10), 2000);

    if (!PERIODES.includes(periode)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Periode tidak valid' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Base query
    let sel = supabase
      .from('v_penilaian_summary')
      .select(
        'id, wilayah, asesor, nama_pm, periode, tanggal, ' +
        'campus_preparation, akhlak_mulia, quranic_mentorship, softskill, leadership, ' +
        'campus_preparation_pct, akhlak_mulia_pct, quranic_mentorship_pct, softskill_pct, leadership_pct, ' +
        'total_skor, total_pct, grade, created_at'
      )
      .eq('periode', periode)
      .limit(limit);

    if (wilayah) sel = sel.eq('wilayah', wilayah);
    if (q) sel = sel.ilike('nama_pm', `%${q}%`);

    const { data: rows, error } = await sel;
    if (error) {
      console.error('Supabase getSummary error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // KPI & agregasi
    const kpis = {
      count: rows.length,
      avg_total_pct: 0,
      grade_counts: {}
    };
    const sum = {
      campus_preparation_pct: 0,
      akhlak_mulia_pct: 0,
      quranic_mentorship_pct: 0,
      softskill_pct: 0,
      leadership_pct: 0,
      total_pct: 0
    };

    const wilayahSet = new Set();
    const asesorSet = new Set();

    rows.forEach(r => {
      wilayahSet.add(r.wilayah);
      asesorSet.add(`${r.wilayah}||${r.asesor}`);

      sum.campus_preparation_pct += Number(r.campus_preparation_pct || 0);
      sum.akhlak_mulia_pct       += Number(r.akhlak_mulia_pct || 0);
      sum.quranic_mentorship_pct += Number(r.quranic_mentorship_pct || 0);
      sum.softskill_pct          += Number(r.softskill_pct || 0);
      sum.leadership_pct         += Number(r.leadership_pct || 0);
      sum.total_pct              += Number(r.total_pct || 0);

      const g = r.grade || 'Unknown';
      kpis.grade_counts[g] = (kpis.grade_counts[g] || 0) + 1;
    });

    const denom = rows.length || 1;
    kpis.avg_total_pct = +(sum.total_pct / denom).toFixed(2);

    const avgSections = {
      campus_preparation_pct: +(sum.campus_preparation_pct / denom).toFixed(2),
      akhlak_mulia_pct:       +(sum.akhlak_mulia_pct / denom).toFixed(2),
      quranic_mentorship_pct: +(sum.quranic_mentorship_pct / denom).toFixed(2),
      softskill_pct:          +(sum.softskill_pct / denom).toFixed(2),
      leadership_pct:         +(sum.leadership_pct / denom).toFixed(2),
    };

    // Chart: rata-rata per section per wilayah
    const perWilayahMap = new Map(); // wilayah -> accum
    rows.forEach(r => {
      if (!perWilayahMap.has(r.wilayah)) {
        perWilayahMap.set(r.wilayah, {
          count: 0,
          campus_preparation_pct: 0,
          akhlak_mulia_pct: 0,
          quranic_mentorship_pct: 0,
          softskill_pct: 0,
          leadership_pct: 0,
        });
      }
      const acc = perWilayahMap.get(r.wilayah);
      acc.count += 1;
      acc.campus_preparation_pct += Number(r.campus_preparation_pct || 0);
      acc.akhlak_mulia_pct       += Number(r.akhlak_mulia_pct || 0);
      acc.quranic_mentorship_pct += Number(r.quranic_mentorship_pct || 0);
      acc.softskill_pct          += Number(r.softskill_pct || 0);
      acc.leadership_pct         += Number(r.leadership_pct || 0);
    });

    const wilayahLabels = [];
    const chartDatasets = {
      campus_preparation_pct: [],
      akhlak_mulia_pct: [],
      quranic_mentorship_pct: [],
      softskill_pct: [],
      leadership_pct: [],
    };
    for (const [w, acc] of perWilayahMap.entries()) {
      wilayahLabels.push(w);
      const d = Math.max(acc.count, 1);
      chartDatasets.campus_preparation_pct.push(+ (acc.campus_preparation_pct / d).toFixed(2));
      chartDatasets.akhlak_mulia_pct.push(+ (acc.akhlak_mulia_pct / d).toFixed(2));
      chartDatasets.quranic_mentorship_pct.push(+ (acc.quranic_mentorship_pct / d).toFixed(2));
      chartDatasets.softskill_pct.push(+ (acc.softskill_pct / d).toFixed(2));
      chartDatasets.leadership_pct.push(+ (acc.leadership_pct / d).toFixed(2));
    }

    const payload = {
      periode,
      wilayah_list: Array.from(wilayahSet).sort(),
      kpis,
      avgSections,
      chart: { wilayahLabels, datasets: chartDatasets },
      rows
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    console.error('getSummary fatal:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
