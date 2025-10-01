// api/kpi/pending.js
import { adminClient } from "./_client.js";

export default async function handler(req, res) {
  try {
    const supabase = adminClient();

    // Lấy KPI có trạng thái pending
    const { data, error } = await supabase
      .from("kpi.kpi_entries")
      .select("*")
      .eq("status", "pending");

    if (error) throw error;

    res.json({ ok: true, rows: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
