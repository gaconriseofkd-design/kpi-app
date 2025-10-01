import { useEffect, useMemo, useState } from "react";

export default function Summarypage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState("month"); // 'day' | 'month'
  const [rows, setRows] = useState([]);

  async function load() {
    const url = new URL("/api/kpi/report", window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to)   url.searchParams.set("to", to);
    const res = await fetch(url);
    const json = await res.json();
    setRows(json.ok ? (json.rows || []) : []);
  }

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [from, to]);

  const grouped = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const period = groupBy === "day" ? r.date : r.date.slice(0,7); // YYYY-MM
      const key = `${period}|${r.line}|${r.worker_id}`;
      if (!map[key]) {
        map[key] = {
          period,
          line: r.line,
          worker_id: r.worker_id,
          worker_name: r.worker_name,
          work_hours: 0,
          stop_hours: 0,
          day_score_sum: 0,
          violations: 0,
          count: 0
        };
      }
      map[key].work_hours += Number(r.work_hours || 0);
      map[key].stop_hours += Number(r.stop_hours || 0);
      map[key].day_score_sum += Number(r.day_score || 0);
      map[key].violations += Number(r.violations || 0);
      map[key].count += 1;
    }
    return Object.values(map);
  }, [rows, groupBy]);

  function exportCSV() {
    const headers = ["Kỳ","Line","MSNV","Họ & tên","Tổng giờ LV","Tổng dừng","Tổng điểm ngày","Số bản ghi","Vi phạm (tổng)"];
    const csv = [headers.join(",")]
      .concat(grouped.map(g => [
        g.period, g.line, g.worker_id, quote(g.worker_name),
        g.work_hours, g.stop_hours, g.day_score_sum, g.count, g.violations
      ].join(","))).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `kpi_summary_${groupBy}_${from||"all"}_${to||"all"}.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Tổng hợp KPI theo {groupBy === "day" ? "ngày" : "tháng"}</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="text-neutral-500 mb-1">Từ ngày</div>
          <input type="date" className="border rounded px-2 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-neutral-500 mb-1">Đến ngày</div>
          <input type="date" className="border rounded px-2 py-2" value={to} onChange={e=>setTo(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-neutral-500 mb-1">Nhóm theo</div>
          <select className="border rounded px-2 py-2" value={groupBy} onChange={e=>setGroupBy(e.target.value)}>
            <option value="month">Tháng (YYYY-MM)</option>
            <option value="day">Ngày (YYYY-MM-DD)</option>
          </select>
        </label>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={exportCSV}>Tải Excel (CSV)</button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>{["Kỳ","Line","MSNV","Họ & tên","Tổng giờ LV","Tổng dừng","Tổng điểm ngày","Số bản ghi","Vi phạm (tổng)"].map((h,i)=>
              <th key={i} className="text-left px-3 py-2 border-b">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {grouped.length===0 && <tr><td className="px-3 py-2" colSpan={9}>Không có dữ liệu</td></tr>}
            {grouped.map((g,idx)=>(
              <tr key={idx} className="odd:bg-white even:bg-neutral-50/40">
                <td className="px-3 py-2 border-t">{g.period}</td>
                <td className="px-3 py-2 border-t">{g.line}</td>
                <td className="px-3 py-2 border-t">{g.worker_id}</td>
                <td className="px-3 py-2 border-t">{g.worker_name}</td>
                <td className="px-3 py-2 border-t">{g.work_hours}</td>
                <td className="px-3 py-2 border-t">{g.stop_hours}</td>
                <td className="px-3 py-2 border-t">{g.day_score_sum}</td>
                <td className="px-3 py-2 border-t">{g.count}</td>
                <td className="px-3 py-2 border-t">{g.violations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function quote(x){ if (x==null) return ""; const s=String(x); return (s.includes(",")||s.includes('"')||s.includes("\n"))?('"'+s.replaceAll('"','""')+'"'):s; }
