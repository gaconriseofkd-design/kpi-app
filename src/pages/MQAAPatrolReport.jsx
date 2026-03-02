import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const SECTIONS = ["Raw_Material_Warehouse", "Lamination", "Prefitting", "Molding", "Leanline_DC", "Leanline_Molded"];

export default function MQAAPatrolReport() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({
        section: "Raw_Material_Warehouse",
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
    });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("mqaa_patrol_logs")
                .select("*")
                .eq("section", filters.section)
                .gte("date", filters.startDate)
                .lte("date", filters.endDate)
                .order("date", { ascending: false });

            if (error) throw error;
            setResults(data || []);
        } catch (error) {
            alert("Lỗi tìm kiếm: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async (record) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("MQAA Patrol Report");

        // Title
        worksheet.mergeCells("A1:F1");
        const titleCell = worksheet.getCell("A1");
        titleCell.value = `PHIẾU ĐÁNH GIÁ MQAA - SECTION ${record.section.toUpperCase()}`;
        titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

        // Header Info
        worksheet.mergeCells("A3:B3");
        worksheet.getCell("A3").value = "Auditor:";
        worksheet.mergeCells("C3:F3");
        worksheet.getCell("C3").value = record.auditor_name;

        worksheet.mergeCells("A4:B4");
        worksheet.getCell("A4").value = "ID:";
        worksheet.mergeCells("C4:F4");
        worksheet.getCell("C4").value = record.auditor_id;

        worksheet.mergeCells("A5:B5");
        worksheet.getCell("A5").value = "Date of Audit:";
        worksheet.mergeCells("C5:F5");
        worksheet.getCell("C5").value = record.date;

        worksheet.mergeCells("A6:B6");
        worksheet.getCell("A6").value = "Section:";
        worksheet.mergeCells("C6:F6");
        worksheet.getCell("C6").value = record.section;

        worksheet.mergeCells("A7:B7");
        worksheet.getCell("A7").value = "Overall Performance:";
        worksheet.mergeCells("C7:F7");
        worksheet.getCell("C7").value = `${record.overall_performance}%`;
        worksheet.getCell("C7").font = { bold: true, color: { argb: "FFEF4444" } };

        // Table Header
        const headerRow = worksheet.getRow(9);
        headerRow.values = ["No.", "Criteria", "Score", "Level", "Image Link", "Description"];
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });

        // Data Rows
        record.evaluation_data.forEach((item, idx) => {
            const row = worksheet.addRow([
                item.no,
                item.label,
                item.score || "",
                item.level || "",
                item.image_url ? { text: "Link hình ảnh", hyperlink: item.image_url } : "",
                item.description || ""
            ]);

            // Highlight main headers
            if (item.is_header) {
                row.eachCell((cell) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDBA74" } }; // Orange
                    cell.font = { bold: true };
                });
            }

            row.eachCell((cell) => {
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                cell.alignment = { wrapText: true, vertical: "middle" };
            });
        });

        // Totals Row
        const totalRow = worksheet.addRow(["", "TOTAL", record.total_score, record.total_level, "", ""]);
        totalRow.font = { bold: true };
        totalRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });

        // Column Widths
        worksheet.getColumn(1).width = 10;
        worksheet.getColumn(2).width = 60;
        worksheet.getColumn(3).width = 10;
        worksheet.getColumn(4).width = 10;
        worksheet.getColumn(5).width = 20;
        worksheet.getColumn(6).width = 30;

        // Buffer and save
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `MQAA_Patrol_${record.section}_${record.date}.xlsx`);
    };

    return (
        <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-xl mt-8">
            <div className="flex items-center gap-4 mb-8 border-b pb-4">
                <button
                    onClick={() => navigate("/mqaa-patrol")}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all"
                    title="Quay lại"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h2 className="text-3xl font-bold text-indigo-900">Xuất Báo Cáo MQAA Patrol</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 p-6 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-indigo-700">Section</label>
                    <select
                        className="p-2.5 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filters.section}
                        onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                    >
                        {SECTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-indigo-700">Từ ngày</label>
                    <input
                        type="date"
                        className="p-2.5 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-indigo-700">Đến ngày</label>
                    <input
                        type="date"
                        className="p-2.5 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    />
                </div>
                <div className="flex items-end">
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                        ) : "Tìm kiếm"}
                    </button>
                </div>
            </div>

            <div className="overflow-hidden border rounded-xl shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-black">
                        <tr>
                            <th className="p-4 border-b">STT</th>
                            <th className="p-4 border-b">Ngày</th>
                            <th className="p-4 border-b">Auditor</th>
                            <th className="p-4 border-b text-center">Hiệu suất</th>
                            <th className="p-4 border-b text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {results.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="p-10 text-center text-gray-500 italic">
                                    Không tìm thấy dữ liệu trong khoảng thời gian này
                                </td>
                            </tr>
                        ) : (
                            results.map((res, idx) => (
                                <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-700">{idx + 1}</td>
                                    <td className="p-4 text-gray-600">{res.date}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-indigo-900">{res.auditor_name}</div>
                                        <div className="text-xs text-gray-400">ID: {res.auditor_id}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${Number(res.overall_performance) >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {res.overall_performance}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => exportToExcel(res)}
                                            className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1 shadow-sm border border-green-200"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 5l-4-4-4 4M12 1v13" /></svg>
                                            Tải về (.xlsx)
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
