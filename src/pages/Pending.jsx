import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

function fmt(dt) {
  if (!dt) return "";
  try { return new Date(dt).toLocaleString(); } catch { return String(dt); }
}

export default function Pending() {
  const [approverId, setApproverId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // chọn nhiều
  const [selected, setSelected] = useState(() => new Set());

  // (tuỳ chọn) phân trang đơn giản nếu cần
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => { setPage(1); setSelected(new Set()); }, [approverId]); // đổi filter → về trang 1 + clear chọn

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page]
  );

  const allOnPageSelected = useMemo(() => {
    if (!pageRows.length) return false;
    return pageRows.every(r => selected.has(r.id));
  }, [pageRows, selected]);

  async function load() {
    if (!approverId.trim()) {
      setRows([]);
      setSelected(new Set());
      return alert("Nhập MSNV người duyệt để xem các đơn chờ duyệt.");
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("status", "pending")
      .eq("approver_id", approverId.trim())
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Lỗi tải danh sách: " + error.message);
    setRows(data || []);
    setSelected(new Set());
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageRows.forEach(r => next.delete(r.id));
      } else {
        pageRows.forEach(r => next.add(r.id));
      }
      return next;
    });
  }

  async function approve(row) {
    const note = prompt("Ghi chú (tuỳ chọn):", "");
    const violations = row?.compliance_code === "NONE" ? 0 : 1;
    const { error } = await supabase
      .from("kpi_entries")
      .update({
        status: "approved",
        violations,
        approver_note: note || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return alert("Duyệt lỗi: " + error.message);
    await load();
  }

  async function reject(row) {
    const note = prompt("Lý do từ chối:", "");
    const { error } = await supabase
      .from("kpi_entries")
      .update({
        status: "rejected",
        approver_note: note || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return alert("Từ chối lỗi: " + error.message);
    await load();
  }

  async function approveSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return alert("Chưa chọn đơn nào.");

    const note = prompt("Ghi chú chung cho các đơn (tuỳ chọn):", "") || null;

    // tách theo compliance để set violations 0/1
    const idZero = rows.filter(r => selected.has(r.id) && r.compliance_code === "NONE").map(r => r.id);
    const idOne  = rows.filter(r => selected.has(r.id) && r.compliance_code !== "NONE").map(r => r.id);

    setLoading(true);
    if (idZero.length) {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ status: "approved", violations: 0, approver_note: note, approved_at: new Date().toISOString() })
        .in("id", idZero);
      if (error) { setLoading(false); return alert("Duyệt (0) lỗi: " + error.message); }
    }
    if (idOne.length) {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ status: "approved", violations: 1, approver_note: note, approved_at: new Date().toISOString() })
        .in("id", idOne);
      if (error) { setLoading(false); return alert("Duyệt (1) lỗi: " + error.message); }
    }
    setLoading(false);
    await load();
  }

  async function approveAllFiltered() {
    if (!approverId.trim()) return alert("Nhập MSNV người duyệt trước.");
    if (!confirm("Duyệt TẤT CẢ đơn đang chờ của người duyệt này?")) return;

    const note = prompt("Ghi chú chung cho các đơn (tuỳ chọn):", "") || null;
    const now = new Date().toISOString();

    setLoading(true);
    // compliance = NONE → violations 0
    {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ status: "approved", violations: 0, approver_note: note, approved_at: now })
        .eq("status", "pending")
        .eq("approver_id", approverId.trim())
        .eq("compliance_code", "NONE");
      if (error) { setLoading(false); return alert("Duyệt tất cả (NONE) lỗi: " + error.message); }
    }
    // compliance != NONE → violations 1
    {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ status: "approved", violations: 1, approver_note: note, approved_at: now })
        .eq("status", "pending")
        .eq("approver_id", approverId.trim())
        .neq("compliance_code", "NONE");
      if (error) { setLoading(false); return alert("Duyệt tất cả (!NONE) lỗi: " + error.message); }
    }

    setLoading(false);
    await load();
  }

  useEffect(() => { /* auto-load khi có approverId? nếu muốn: */ }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Chờ duyệt KPI (lọc theo MSNV người duyệt)</h2>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input
          className="input"
          placeholder="Nhập MSNV người duyệt (VD: A101)"
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button onClick={load} className="btn">{loading ? "Đang tải..." : "Tải danh sách"}</button>

        {/* Bulk actions */}
        <div className="ml-auto flex gap-2">
          <button onClick={approveSelected} className="btn btn-primary" disabled={!selected.size || loading}>
            Duyệt đã chọn ({selected.size})
          </button>
          <button onClick={approveAllFiltered} className="btn bg-green-600 text-white hover:bg-green-700" disabled={!rows.length || loading}>
            Duyệt TẤT CẢ (lọc hiện tại)
          </button>
        </div>
      </div>

      <div className="mt-2 mb-3 flex items-center gap-3">
        <span>Tổng: {rows.length} dòng</span>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        <button className="btn" onClick={() => setSelected(new Set())} disabled={!selected.size}>Bỏ chọn</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
              </th>
              <th className="p-2">Ngày</th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">%OE</th>
              <th className="p-2">Phế</th>
              <th className="p-2">P</th>
              <th className="p-2">Q</th>
              <th className="p-2">KPI</th>
              <th className="p-2">Vi phạm</th>
              <th className="p-2">Thao tác</th>
              <th className="p-2">Ghi chú duyệt</th>
              <th className="p-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.id} className="border-b">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleRow(r.id)}
                  />
                </td>
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.worker_id}</td>
                <td className="p-2">{r.worker_name}</td>
                <td className="p-2">{r.oe}</td>
                <td className="p-2">{r.defects}</td>
                <td className="p-2">{r.p_score}</td>
                <td className="p-2">{r.q_score}</td>
                <td className="p-2 font-semibold">{r.day_score}</td>
                <td className="p-2">{r.compliance_code}</td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => approve(r)} className="btn btn-primary">Duyệt</button>
                  <button onClick={() => reject(r)} className="btn bg-red-600 text-white hover:bg-red-700">Từ chối</button>
                </td>
                <td className="p-2">{r.approver_note || ""}</td>
                <td className="p-2">{fmt(r.updated_at || r.created_at)}</td>
              </tr>
            ))}
            {!pageRows.length && (
              <tr><td colSpan={13} className="p-4 text-center text-gray-500">
                {approverId ? "Không có bản ghi chờ duyệt." : "Nhập MSNV người duyệt để xem danh sách."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
