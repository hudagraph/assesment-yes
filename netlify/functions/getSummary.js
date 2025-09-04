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

function gradeFromPct(p) {
  const x = Number(p) || 0;
  if (x === 100) return 'Excellent (Sempurna / Istimewa)';
  if (x >= 90)   return 'Very Good (Baik Sekali)';
  if (x >= 80)   return 'Good (Baik)';
  if (x >= 70)   return 'Satisfactory (Cukup)';
  if (x >= 50)   return 'Need Improvement (Kurang Baik)';
  return 'Below Standard (Lemah)';
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const periode = params.get('periode') || 'Assesment Awal';
    const wilayah = params.get('wilayah') || '';       // optional
    const q = (params.get('q') || '').trim();          // optional
    const limit = Math.min(parseInt(params.get('limit') || '2000', 10), 5000);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 0) Wilayah list (global, dari validasi_data)
    const { data: vdAll, error: vdErr } = await supabase
      .from('validasi_data')
      .select('wilayah, nama_pm, asesor');

    if (vdErr) {
      console.error('validasi_data error:', vdErr);
      return { statusCode: 500, body: JSON.stringify({ error: vdErr.message }) };
    }

    const allWilayahSet = new Set();
    let targetRows = vdAll || [];
    if (wilayah) {
      targetRows = targetRows.filter(r => r.wilayah === wilayah);
    }
    (vdAll || []).forEach(r => { if (r.wilayah) allWilayahSet.add(r.wilayah); });
    const allWilayahCount = allWilayahSet.size;
    const wilayah_list = Array.from(allWilayahSet).sort();

    // total_target_pm = jumlah PM yang harus dinilai (berdasarkan validasi_data)
    const total_target_pm = targetRows.length;

    // 1) Data untuk periode terpilih (table + KPI)
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
      console.error('getSummary select error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // KPI
    const kpis = {
      count: rows.length,
      total_target_pm,
      avg_total_pct: 0,
      avg_grade: '-',
      grade_counts: {},
    };
    const sum = {
      campus_preparation_pct: 0,
      akhlak_mulia_pct: 0,
      quranic_mentorship_pct: 0,
      softskill_pct: 0,
      leadership_pct: 0,
      total_pct: 0,
    };

    rows.forEach(r => {
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
    const avgSections = {
      campus_preparation_pct: +(sum.campus_preparation_pct / denom).toFixed(2),
      akhlak_mulia_pct:       +(sum.akhlak_mulia_pct / denom).toFixed(2),
      quranic_mentorship_pct: +(sum.quranic_mentorship_pct / denom).toFixed(2),
      softskill_pct:          +(sum.softskill_pct / denom).toFixed(2),
      leadership_pct:         +(sum.leadership_pct / denom).toFixed(2),
    };
    kpis.avg_total_pct = +(sum.total_pct / denom).toFixed(2);
    kpis.avg_grade = gradeFromPct(kpis.avg_total_pct);

    const avgSectionsWithGrade = {
      campus_preparation: { pct: avgSections.campus_preparation_pct, grade: gradeFromPct(avgSections.campus_preparation_pct) },
      akhlak_mulia:       { pct: avgSections.akhlak_mulia_pct,       grade: gradeFromPct(avgSections.akhlak_mulia_pct) },
      quranic_mentorship: { pct: avgSections.quranic_mentorship_pct, grade: gradeFromPct(avgSections.quranic_mentorship_pct) },
      softskill:          { pct: avgSections.softskill_pct,          grade: gradeFromPct(avgSections.softskill_pct) },
      leadership:         { pct: avgSections.leadership_pct,         grade: gradeFromPct(avgSections.leadership_pct) },
    };

    // 2) Bar chart perbandingan profil antar wilayah (AVG % per section per WILAYAH)
    const sumsByWilayah = new Map(); // w -> {count, cp, am, qm, ss, ld}
    (rows || []).forEach(r => {
      const w = (r.wilayah || '').trim() || '(Tanpa Wilayah)';
      if (!sumsByWilayah.has(w)) {
        sumsByWilayah.set(w, { count: 0, cp: 0, am: 0, qm: 0, ss: 0, ld: 0 });
      }
      const s = sumsByWilayah.get(w);
      s.count += 1;
      s.cp += Number(r.campus_preparation_pct || 0);
      s.am += Number(r.akhlak_mulia_pct || 0);
      s.qm += Number(r.quranic_mentorship_pct || 0);
      s.ss += Number(r.softskill_pct || 0);
      s.ld += Number(r.leadership_pct || 0);
    });
    
    // Label = HANYA wilayah yang punya data
    let wilayahLabels = Array.from(sumsByWilayah.keys()).sort();
    
    // Jika user filter 1 wilayah, persempit
    if (wilayah) {
      wilayahLabels = wilayahLabels.filter(w => w === wilayah);
    }
    
    const compareDatasets = {
      campus_preparation_pct: [],
      akhlak_mulia_pct: [],
      quranic_mentorship_pct: [],
      softskill_pct: [],
      leadership_pct: [],
    };
    
    wilayahLabels.forEach(w => {
      const s = sumsByWilayah.get(w);
      const d = s?.count || 0;
      const avg = v => Number(d ? (v / d).toFixed(2) : 0);
      compareDatasets.campus_preparation_pct.push(avg(s?.cp || 0));
      compareDatasets.akhlak_mulia_pct.push(avg(s?.am || 0));
      compareDatasets.quranic_mentorship_pct.push(avg(s?.qm || 0));
      compareDatasets.softskill_pct.push(avg(s?.ss || 0));
      compareDatasets.leadership_pct.push(avg(s?.ld || 0));
    });
    
    // kirim
    // chartProfileByWilayah: { wilayahLabels, datasets: compareDatasets }


    // 3) Line chart tren 4 periode (avg total_pct per periode, dengan filter wilayah & q)
    let trendSel = supabase
      .from('v_penilaian_summary')
      .select('periode, total_pct, wilayah, nama_pm')
      .in('periode', PERIODES)
      .limit(50000); // cukup besar untuk tren

    if (wilayah) trendSel = trendSel.eq('wilayah', wilayah);
    if (q) trendSel = trendSel.ilike('nama_pm', `%${q}%`);

    const { data: trendRows, error: trendErr } = await trendSel;
    if (trendErr) {
      console.error('trend select error:', trendErr);
      return { statusCode: 500, body: JSON.stringify({ error: trendErr.message }) };
    }
    // hitung rata-rata per periode (urut tetap)
    const trendTotals = PERIODES.map(label => {
      const items = (trendRows || []).filter(r => r.periode === label);
      if (!items.length) return 0;
      const sumPct = items.reduce((s, r) => s + Number(r.total_pct || 0), 0);
      return + (sumPct / items.length).toFixed(2);
    });

    // pm_names untuk autocomplete
    const pm_names = Array.from(new Set((rows || []).map(r => r.nama_pm).filter(Boolean))).sort();

    const apiVersion = 'chart-wilayah-v3';
    body: JSON.stringify({ apiVersion, ...payload })
    
    const payload = {
      periode,
      wilayah_list,
      meta: { all_wilayah_count: allWilayahCount, periods: PERIODES },
      kpis,
      avgSections,
      avgSectionsWithGrade,
      chartTrend: { labels: PERIODES, total_pct_avg: trendTotals },
      chartProfileByWilayah: { wilayahLabels, datasets: compareDatasets },
      pm_names,
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
