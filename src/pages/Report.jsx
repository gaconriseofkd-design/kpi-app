import { useState } from "react";

export default function Report() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Demo dữ liệu mock
  const rows = [
    {
      date: "2025-09-30",
      workerId: "W001",
      workerName: "Nguyen Van A",
      line: "LEAN-D1",
      ca: "Ca 1",
      workHours: 8,
      stopHours: 0,
      oe: 108,
      defects: 2,
      compliance: "NONE",
      pScore: 9,
      qScore: 8,
      dayScore: 15,
      monthScore: 14.5,
      overflow: 1,
    },
    {
      date: "2025-09-30",
      workerId: "W002",
      workerName: "Le Thi B",
      line: "LEAN-D2",
      ca: "Ca 2",
      workHours: 7.5,
      stopHours: 0.5,
      oe: 104,
      defects: 0,
      compliance: "PPE",
      pScore: 8,
      qScore: 10,
      dayScore: 15,
      monthScore: 13,
      overflow: 3,
    },
  ];

  function exportCSV() {
    const headers = [
      "Date",
      "MSNV",
      "Họ và tên",
      "Line",
      "Ca",
      "Giờ LV",
      "Giờ dừng",
      "%OE",
      "Số đôi phế",
      "Vi phạm",
      "Điểm SL",
      "Điểm CL",
      "Điểm ngày",
      "Điểm tháng",
      "Điểm dư",
    ];
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          [
            r.date,
            r.workerId,
            r.workerName,
            r.line,
            r.ca,
            r.workHours,
            r.stopHours,
            r.oe,
            r.defects,
            r.compliance,
            r.pScore,
            r.qScore,
            r.dayScore,
            r.monthScore,
            r.overflow,
          ].join(",")
        )
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpi_report_${from || "all"}_${to || "all"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Báo cáo KPI chi tiết</h2>
        <button
          className="ml-auto px-3 py-2 rounded bg-blue-600 text-white"
          onClick={exportCSV}
        >
          ⬇ Tải Excel (CSV)
        </button>
      </div>

      <div className="flex gap-2">
        <label className="text-sm">
          Từ ngày:
          <input
            type="date"
            className="border rounded px-2 py-1 ml-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Đến ngày:
          <input
            type="date"
            className="border rounded px-2 py-1 ml-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 border-b text-left">Ngày</th>
              <th className="px-3 py-2 border-b text-left">MSNV</th>
              <th className="px-3 py-2 border-b text-left">Họ và tên</th>
              <th className="px-3 py-2 border-b text-left">Line</th>
              <th className="px-3 py-2 border-b text-left">Ca</th>
              <th className="px-3 py-2 border-b text-left">Giờ LV</th>
              <th className="px-3 py-2 border-b text-left">Giờ dừng</th>
              <th className="px-3 py-2 border-b text-left">%OE</th>
              <th className="px-3 py-2 border-b text-left">Số đôi phế</th>
              <th className="px-3 py-2 border-b text-left">Vi phạm</th>
              <th className="px-3 py-2 border-b text-left">Điểm SL</th>
              <th className="px-3 py-2 border-b text-left">Điểm CL</th>
              <th className="px-3 py-2 border-b text-left">Điểm ngày</th>
              <th className="px-3 py-2 border-b text-left">Điểm tháng</th>
              <th className="px-3 py-2 border-b text-left">Điểm dư</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="odd:bg-white even:bg-neutral-50/40"
              >
                <td className="px-3 py-2 border-t">{r.date}</td>
                <td className="px-3 py-2 border-t">{r.workerId}</td>
                <td className="px-3 py-2 border-t">{r.workerName}</td>
                <td className="px-3 py-2 border-t">{r.line}</td>
                <td className="px-3 py-2 border-t">{r.ca}</td>
                <td className="px-3 py-2 border-t">{r.workHours}</td>
                <td className="px-3 py-2 border-t">{r.stopHours}</td>
                <td className="px-3 py-2 border-t">{r.oe}</td>
                <td className="px-3 py-2 border-t">{r.defects}</td>
                <td className="px-3 py-2 border-t">{r.compliance}</td>
                <td className="px-3 py-2 border-t">{r.pScore}</td>
                <td className="px-3 py-2 border-t">{r.qScore}</td>
                <td className="px-3 py-2 border-t">{r.dayScore}</td>
                <td className="px-3 py-2 border-t">{r.monthScore}</td>
                <td className="px-3 py-2 border-t">{r.overflow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
