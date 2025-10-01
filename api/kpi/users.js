import { adminClient } from "./_client.js";

// API quản lý User
export default async function handler(req, res) {
  try {
    const supabase = adminClient();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("KPI_ListEntry")
        .select("*")
        .order("worker_id");

      if (error) throw error;
      return res.json({ ok: true, rows: data });
    }

    if (req.method === "POST") {
      // Nhận danh sách users từ body và lưu (upsert)
      const { users } = req.body;
      const { data, error } = await supabase
        .from("KPI_ListEntry")
        .upsert(users, { onConflict: "worker_id" });

      if (error) throw error;
      return res.json({ ok: true, rows: data });
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("API error", e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
