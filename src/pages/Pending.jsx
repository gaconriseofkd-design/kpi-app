import { useState, useEffect } from "react";

export default function Pending() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const resp = await fetch("/api/kpi/pending").then((r) => r.json());
      if (resp.ok) {
        setRows(resp.rows || []);
      } else {
        alert("Lỗi load pending: " + resp.error);
      }
    } catch (e) {
      console.error(e);
      alert("Không kết nối được API pending");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Danh sách KPI chờ duyệt</h2>

      {loading && <p className="text-neutral-500">Đang tải...</p>}

      <div className="overflow-auto border rounded bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 border-b text-left">Ngày</th>
              <th className="px-3 py-2 border-b text-left">MSNV</th>
              <th className="px-3 py-2 border-b text-left">Họ và tên</th>
              <th className="px-3 py-2 border-b text-left">Line</th>
              <th className="px-3 py-2 border-b text-left">Ca</th>
              <th className="px-3 py-2 border-b text-left">%OE</th>
              <th className="px-3 py-2 border-b text-left">Số đôi phế</th>
              <th className="px-3 py-2 border-b text-left">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan="8" className="px-3 py-2 text-center">
                  Không có KPI nào đang chờ duyệt
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="odd:bg-white even:bg-neutral-50/40"
              >
                <td className="px-3 py-2 border-t">{r.date}</td>
                <td className="px-3 py-2 border-t">{r.worker_id}</td>
                <td className="px-3 py-2 border-t">{r.worker_name}</td>
                <td className="px-3 py-2 border-t">{r.line}</td>
                <td className="px-3 py-2 border-t">{r.ca}</td>
                <td className="px-3 py-2 border-t">{r.oe}</td>
                <td className="px-3 py-2 border-t">{r.defects}</td>
                <td className="px-3 py-2 border-t">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="px-3 py-2 rounded bg-blue-600 text-white"
        onClick={load}
      >
        🔄 Tải lại
      </button>
    </div>
  );
}
