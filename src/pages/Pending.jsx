// src/pages/Pending.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/* =============== Helper Logic =============== */
const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (s) => HYBRID_SECTIONS.includes(s);

function getTableName(s) {
  const sectionKey = (s || "").toUpperCase();
  if (sectionKey === "MOLDING") return "kpi_entries_molding";
  if (isHybridSection(sectionKey)) return "kpi_lps_entries";
  return "kpi_entries"; 
}
const isBaseLeanline = (s) => (s === "LEANLINE_DC" || s === "LEANLINE_MOLDED");

function fmt(dt) {
  if (!dt) return "";
  try { return new Date(dt).toLocaleString(); } catch { return String(dt); }
}

export default function Pending() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";
  const isHybrid = isHybridSection(section);

  // 🔐 Password
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState("");

  // Lọc dữ liệu
  const [approverId, setApproverId] = useState(""); // MSNV người duyệt
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dữ liệu hiển thị
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Chọn nhiều
  const [selected, setSelected] = useState(() => new Set());

  // Phân trang
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [totalCount, setTotalCount] = useState(0); // <-- THAY ĐỔI 1: State đếm tổng số dòng

  // THAY ĐỔI 2: Reset về trang 1 khi bộ lọc thay đổi
  useEffect(() => { 
    setPage(1); 
    setSelected(new Set()); 
  }, [approverId, dateFrom, dateTo, section]);

  // THAY ĐỔI 3: Tính totalPages dựa trên totalCount
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  // THAY ĐỔI 4: pageRows bây giờ chính là 'rows' (vì 'rows' đã được phân trang từ server)
  const pageRows = useMemo(() => rows, [rows]);

  const allOnPageSelected = useMemo(() => {
    if (!pageRows.length) return false;
    return pageRows.every(r => selected.has(r.id));
  }, [pageRows, selected]);

  // ----------------------------------------------------------------
  // THAY ĐỔI 5: Tải dữ liệu khi CÓ THAY ĐỔI Ở BỘ LỌC hoặc CHUYỂN TRANG
  useEffect(() => {
    if (!auth) return; // Chưa đăng nhập
    
    const approver = approverId.trim();
    if (!approver) { // Không có MSNV duyệt -> Xóa dữ liệu
       setRows([]);
       setTotalCount(0);
       return;
    }
    
    load(); // Gọi hàm load
    
  }, [page, approverId, dateFrom, dateTo, section, auth]); // Phụ thuộc vào các state này
  // ----------------------------------------------------------------


  // Đăng nhập mật khẩu
  if (!auth) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-3">Đăng nhập Xét duyệt KPI</h2>
        <input
          type="password"
          className="input mr-2"
          placeholder="Nhập password..."
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => {
            if (pw === "davidtu") setAuth(true);
            else alert("Sai mật khẩu!");
          }}
        >
          Đăng nhập
        </button>
      </div>
    );
  }

  // THAY ĐỔI 6: Hàm load() được sửa để dùng .range() (phân trang server)
  async function load() {
    const approver = approverId.trim();
    if (!approver) return; // Đã check ở useEffect, nhưng vẫn giữ an toàn

    const table = getTableName(section);
    const approverCol = isMolding ? "approver_msnv" : "approver_id";

    // Tính toán phân trang
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(table)
      .select("*", { count: "exact" }) // Yêu cầu đếm tổng số (count)
      .eq("status", "pending")
      .eq(approverCol, approver);

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);

    setLoading(true);
    const { data, error, count } = await query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to); // CHỈ LẤY ĐÚNG PHẠM VI TRANG
    setLoading(false);

    if (error) return alert("Lỗi tải dữ liệu: " + error.message);
    
    setRows(data || []);
    setTotalCount(count || 0); // Cập nhật tổng số dòng từ server
    // Không reset 'selected' ở đây, vì hàm này chạy mỗi khi chuyển trang
  }

  // Chọn dòng
  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Chọn tất cả trang
  function toggleSelectAllOnPage() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach(r => next.delete(r.id));
      else pageRows.forEach(r => next.add(r.id));
      return next;
    });
  }

  // ✅ Duyệt hoặc Từ chối 1 dòng
  async function approve(row, type) {
    const note = type === "reject"
      ? prompt("Lý do từ chối:", "")
      : prompt("Ghi chú (tuỳ chọn):", "");
    const status = type === "reject" ? "rejected" : "approved";
    
    const table = getTableName(section);
    const isBaseLeanline = table === "kpi_entries";
    
    let updatePayload = {
      status,
      approver_note: note || null,
      approved_at: new Date().toISOString(),
    };
    
    if (!isBaseLeanline) {
        const violations = row?.compliance_code === "NONE" ? 0 : 1;
        updatePayload.violations = violations;
    }


    const { error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq("id", row.id);

    if (error) return alert("Lỗi khi duyệt: " + error.message);
    await load(); // Tải lại trang hiện tại
  }

  // ✅ Duyệt các dòng được chọn
  async function approveSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return alert("Chưa chọn đơn nào.");
    const note = prompt("Ghi chú chung (tuỳ chọn):", "") || null;
    
    const table = getTableName(section);
    const isBaseLeanline = table === "kpi_entries";

    const idZero = rows.filter(r => selected.has(r.id) && r.compliance_code === "NONE").map(r => r.id);
    const idOne  = rows.filter(r => selected.has(r.id) && r.compliance_code !== "NONE").map(r => r.id);

    setLoading(true);
    
    const baseUpdatePayload = { status: "approved", approver_note: note, approved_at: new Date().toISOString() };

    if (idZero.length) {
      let payload0 = { ...baseUpdatePayload };
      if (!isBaseLeanline) payload0.violations = 0;
      
      const { error } = await supabase.from(table).update(payload0).in("id", idZero);
      if (error) { setLoading(false); return alert("Lỗi khi duyệt nhóm 0: " + error.message); }
    }
    
    if (idOne.length) {
      let payload1 = { ...baseUpdatePayload };
      if (!isBaseLeanline) payload1.violations = 1;
      
      const { error } = await supabase.from(table).update(payload1).in("id", idOne);
      if (error) { setLoading(false); return alert("Lỗi khi duyệt nhóm 1: " + error.message); }
    }
    
    setLoading(false);
    await load(); // Tải lại trang hiện tại
  }

  // THAY ĐỔI 7: Sửa hàm "Duyệt tất cả" để tôn trọng bộ lọc ngày
  async function approveAllFiltered() {
    const approver = approverId.trim();
    if (!approver) return alert("Nhập MSNV người duyệt trước.");
    if (!confirm("Duyệt TẤT CẢ đơn đang chờ của người duyệt này (theo bộ lọc ngày)?")) return;

    const note = prompt("Ghi chú chung (tuỳ chọn):", "") || null;
    const table = getTableName(section);
    const approverCol = isMolding ? "approver_msnv" : "approver_id";
    const isBaseLeanline = table === "kpi_entries";

    const now = new Date().toISOString();
    setLoading(true);

    const baseUpdatePayload = { status: "approved", approver_note: note, approved_at: now };

    // 1. Duyệt nhóm NONE (violations = 0)
    {
      let payload0 = { ...baseUpdatePayload };
      if (!isBaseLeanline) payload0.violations = 0;
      
      let query0 = supabase.from(table)
        .update(payload0)
        .eq("status", "pending").eq(approverCol, approver).eq("compliance_code", "NONE");
      
      // Thêm bộ lọc ngày
      if (dateFrom) query0 = query0.gte("date", dateFrom);
      if (dateTo) query0 = query0.lte("date", dateTo);

      const { error } = await query0;
      if (error) { setLoading(false); return alert("Lỗi duyệt (NONE): " + error.message); }
    }
    
    // 2. Duyệt nhóm VIOLATION (violations = 1)
    {
      let payload1 = { ...baseUpdatePayload };
      if (!isBaseLeanline) payload1.violations = 1;
      
      let query1 = supabase.from(table)
        .update(payload1)
        .eq("status", "pending").eq(approverCol, approver).neq("compliance_code", "NONE");

      // Thêm bộ lọc ngày
      if (dateFrom) query1 = query1.gte("date", dateFrom);
      if (dateTo) query1 = query1.lte("date", dateTo);

      const { error } = await query1;
      if (error) { setLoading(false); return alert("Lỗi duyệt (!NONE): " + error.message); }
    }

    setLoading(false);
    await load(); // Tải lại trang hiện tại (sẽ trống vì đã duyệt hết)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Xét duyệt KPI ({section})</h2>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input
          className="input"
          placeholder="Nhập MSNV người duyệt"
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
        />
        <label>Từ:</label>
        <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label>Đến:</label>
        <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        {/* Nút tải dữ liệu không cần thiết vì nó tự động tải */}
        <span className="text-sm text-gray-500">{loading ? "Đang tải..." : ""}</span>

        <div className="ml-auto flex gap-2">
          <button onClick={approveSelected} className="btn btn-primary" disabled={!selected.size || loading}>
            Duyệt đã chọn ({selected.size})
          </button>
          <button onClick={approveAllFiltered} className="btn bg-green-600 text-white" disabled={totalCount === 0 || loading}>
            Duyệt TẤT CẢ ({totalCount})
          </button>
        </div>
      </div>

      {/* Phân trang */}
      <div className="mb-3 flex items-center gap-3">
        <span>Tổng: {totalCount} dòng</span>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        <button className="btn" onClick={() => setSelected(new Set())} disabled={!selected.size}>Bỏ chọn</button>
      </div>

      {/* Bảng dữ liệu */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100 text-xs uppercase">
            <tr>
              <th><input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} /></th>
              <th>Ngày</th>
              <th>MSNV</th>
              <th>Họ tên</th>
              <th>Ca</th>
              <th>Loại hàng</th>
              <th>Sản lượng/ca</th>
              <th>Q</th>
              <th>P</th>
              <th>KPI</th>
              <th>Tuân thủ</th>
              <th>Thao tác</th>
              <th>Ghi chú duyệt</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                <td>{r.date}</td>
                <td>{r.worker_id}</td>
                <td>{r.worker_name}</td>
                <td>{r.ca}</td>
                <td>{r.category}</td>
                <td>{r.output}</td>
                <td>{r.q_score}</td>
                <td>{r.p_score}</td>
                <td className="font-semibold">{r.day_score}</td>
                <td>{r.compliance_code}</td>
                <td>
                  <button onClick={() => approve(r, "approve")} className="btn btn-primary btn-sm mr-2">Duyệt</button>
                  <button onClick={() => approve(r, "reject")} className="btn bg-red-600 text-white btn-sm">Từ chối</button>
                </td>
                <td>{r.approver_note || ""}</td>
                <td>{fmt(r.updated_at || r.created_at)}</td>
              </tr>
            ))}
            {!pageRows.length && !loading && ( // Chỉ hiển thị khi không tải và không có dòng
              <tr><td colSpan={14} className="text-center p-4 text-gray-500">Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}