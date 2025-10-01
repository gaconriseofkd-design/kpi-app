import { useEffect, useState } from "react";

export default function ApprovePage() {
  const [approverId, setApproverId] = useState("A101");   // nhập MSNV người duyệt
  const [date, setDate] = useState("");                   // lọc theo ngày (optional)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!approverId) return;
    setLoading(true);
    try {
      const url = new URL("/api/kpi/pending", window.location.origin);
      url.searchParams.set("approver_id", approverId);
      if (date) url.searchParams.set("date", date);
      const res = await fetch(url);
      const json = await res.json();
      setRows(json.ok ? (json.rows || []) : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function act(id, decision) {
    const ok = confirm(`${decision === "approve" ? "Duyệt" : "Trả về"} bản ghi này?`);
    if (!ok) return;
    const res = await fetch("/api/kpi/approve", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id, decision })
    }).then(r=>r.json());
    if (!res.ok) { alert(res.error || "Thao tác thất bại"); return; }
    load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Xét duyệt KPI</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="text-neutral-500 mb-1">MSNV Người duyệt</div>
          <input className="border rounded px-2 py-2" value={approverId} onChange={e=>setApproverId(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-neutral-500 mb-1">Lọc theo ngày</div>
          <input type="date" className="border rounded px-2 py-2" value={date} onChange={e=>setDate(e.target.value)} />
        </label>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={load} disabled={loading}>
          {loading ? "Đang tải..." : "Tải danh sách"}
        </button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["Ngày","MSNV","Họ tên","Line","Ca","Giờ LV","Giờ dừng","%OE","Phế","Vi phạm","Điểm SL","Điểm CL","Điểm ngày","Dư","Thao tác"].map((h,i)=>
                <th key={i} className="text-left px-3 py-2 border-b">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length===0 && <tr><td className="px-3 py-2" colSpan={15}>Không có dữ liệu</td></tr>}
            {rows.map(r=>(
              <tr key={r.id} className="odd:bg-white even:bg-neutral-50/40">
                <td className="px-3 py-2 border-t">{r.date}</td>
                <td className="px-3 py-2 border-t">{r.worker_id}</td>
                <td className="px-3 py-2 border-t">{r.worker_name}</td>
                <td className="px-3 py-2 border-t">{r.line}</td>
                <td className="px-3 py-2 border-t">{r.ca}</td>
                <td className="px-3 py-2 border-t">{r.work_hours}</td>
                <td className="px-3 py-2 border-t">{r.stop_hours}</td>
                <td className="px-3 py-2 border-t">{r.oe}</td>
                <td className="px-3 py-2 border-t">{r.defects}</td>
                <td className="px-3 py-2 border-t">{r.compliance_code}</td>
                <td className="px-3 py-2 border-t">{r.p_score}</td>
                <td className="px-3 py-2 border-t">{r.q_score}</td>
                <td className="px-3 py-2 border-t">{r.day_score}</td>
                <td className="px-3 py-2 border-t">{r.overflow}</td>
                <td className="px-3 py-2 border-t">
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>act(r.id,"approve")}>Duyệt</button>
                    <button className="px-3 py-1 rounded bg-white border" onClick={()=>act(r.id,"reject")}>Trả về</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
