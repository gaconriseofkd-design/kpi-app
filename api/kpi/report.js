// /api/kpi/report.js
import { adminClient } from './_client.js';

export default async function handler(req, res) {
  try {
    const supabase = adminClient();
    const { from, to } = req.query;

    let q = supabase
      .from('kpi.kpi_entries')
      .select('*')
      .eq('status', 'approved')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (from) q = q.gte('date', from);
    if (to)   q = q.lte('date', to);

    const { data, error } = await q;
    if (error) throw error;

    // (Tuỳ chọn) Tính KPI tháng tổng theo worker & tháng (để gán vào mỗi dòng)
    // Ở đây mình tính theo phạm vi filter hiện tại:
    const byWorkerMonth = {};
    for (const r of data) {
      const key = `${r.worker_id}-${r.date.slice(0,7)}`; // YYYY-MM
      byWorkerMonth[key] ??= { totalDay: 0, viol: 0 };
      byWorkerMonth[key].totalDay += Number(r.day_score || 0);
      byWorkerMonth[key].viol += Number(r.violations || 0);
    }
    function applyPenalty(total, viol) {
      if (viol >= 3) return +(total * 0.8).toFixed(2);
      if (viol > 0)  return +(total * 0.95).toFixed(2);
      return +(+total).toFixed(2);
    }
    const rows = data.map(r => {
      const key = `${r.worker_id}-${r.date.slice(0,7)}`;
      const agg = byWorkerMonth[key];
      const month_score_total = applyPenalty(agg.totalDay, agg.viol);
      return { ...r, month_score_total };
    });

    res.json({ ok: true, rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
