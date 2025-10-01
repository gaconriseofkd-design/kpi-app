// /api/kpi/submit.js
import { adminClient } from './_client.js';

function scoreProductivity(oe, table) {
  const x = Number(oe || 0);
  // bảng đơn giản — bạn có thể dời sang DB nếu muốn
  const t = table || [
    { threshold: 112, score: 10 },
    { threshold: 108, score: 9 },
    { threshold: 104, score: 8 },
    { threshold: 100, score: 7 },
    { threshold: 98,  score: 6 },
    { threshold: 96,  score: 4 },
    { threshold: 94,  score: 2 },
    { threshold: 92,  score: 0 },
  ];
  for (const r of t) if (x >= r.threshold) return r.score;
  return t.at(-1).score;
}

function scoreQuality(defects, ranges) {
  const d = Number(defects || 0);
  const rs = ranges || [
    { min: 0, max: 0, score: 10, bonus: 2 },
    { min: 1, max: 2, score: 8 },
    { min: 3, max: 4, score: 6 },
    { min: 5, max: 6, score: 4 },
    { min: 7, max: null, score: 0 },
  ];
  for (const r of rs) {
    const min = Number(r.min);
    const max = r.max == null ? Infinity : Number(r.max);
    if (d >= min && d <= max) return r.score;
  }
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }
  try {
    const supabase = adminClient();
    const payload = req.body || {};

    // Lấy từ body:
    const {
      date, workerId, workerName,
      approverId, approverName,
      area, line, ca,
      workHours, stopHours, lineTargetPerHour,
      defects, oe, compliance
    } = payload;

    // Tính điểm server-side (tránh fake)
    const pScore = scoreProductivity(oe);
    const qScore = scoreQuality(defects);
    const raw = Number(pScore) + Number(qScore);
    const dayScore = Math.min(15, raw);
    const overflow = Math.max(0, raw - 15);

    const { data, error } = await supabase
      .from('kpi.kpi_entries')
      .insert([{
        date,
        worker_id: workerId,
        worker_name: workerName,
        approver_id: approverId,
        approver_name: approverName,
        area,
        line,
        ca,
        work_hours: workHours,
        stop_hours: stopHours,
        line_target_per_hour: lineTargetPerHour,
        defects,
        oe,
        compliance_code: compliance,
        p_score: pScore,
        q_score: qScore,
        day_score: dayScore,
        overflow,
        status: 'pending'
      }])
      .select('id');

    if (error) throw error;
    res.json({ ok: true, id: data?.[0]?.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
