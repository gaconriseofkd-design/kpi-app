import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import PasswordModal from "../components/PasswordModal";

const SECTIONS = ["All", "Raw_Material_Warehouse", "Lamination", "Prefitting", "Molding", "Leanline_DC", "Leanline_Molded", "Cutting_Die_Warehouse", "Logo_Warehouse", "Finished_Goods_Warehouse"];

export default function MQAAPatrolReport() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({
        section: "All",
        auditor: "All",
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
    });
    const [auditorList, setAuditorList] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [modalMode, setModalMode] = useState("edit"); // 'edit' or 'delete'

    useState(() => {
        const fetchAuditors = async () => {
            const { data } = await supabase.from("mqaa_patrol_logs").select("auditor_name, auditor_id");
            if (data) {
                const unique = [];
                const seen = new Set();
                data.forEach(item => {
                    const label = `${item.auditor_id} - ${item.auditor_name}`;
                    if (!seen.has(label)) {
                        seen.add(label);
                        unique.push({ id: item.auditor_id, name: item.auditor_name, label });
                    }
                });
                 setAuditors(unique);
            }
        };
        fetchAuditors();
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("mqaa_patrol_logs")
                .select("*")
                .gte("date", filters.startDate)
                .lte("date", filters.endDate)
                .order("date", { ascending: false });

            if (filters.section && filters.section !== "All") {
                query = query.eq("section", filters.section);
            }

            if (filters.auditor && filters.auditor !== "All") {
                query = query.eq("auditor_id", filters.auditor);
            }

            const { data, error } = await query;

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
        const perfCell = worksheet.getCell("C7");
        perfCell.value = Number(record.overall_performance) / 100;
        perfCell.font = { bold: true, color: { argb: "FFEF4444" } };
        perfCell.numFmt = '0%';

        // Table Header
        const headerRow = worksheet.getRow(9);
        headerRow.values = ["No.", "Criteria", "Score", "Level", "Image Link", "Description"];
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });

        // Data Rows
        record.evaluation_data.forEach((item) => {
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

            if (item.image_url) {
                row.getCell(5).font = { color: { argb: '0000FF' }, underline: true };
            }

            row.eachCell((cell) => {
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                cell.alignment = { wrapText: true, vertical: "middle" };
            });
            row.getCell(5).alignment = { horizontal: 'center' };
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

    const confirmDeleteRecord = async () => {
        if (!selectedRecord) return;
        try {
            const { error } = await supabase
                .from("mqaa_patrol_logs")
                .delete()
                .eq("id", selectedRecord.id);

            if (error) throw error;

            // Refresh results
            setResults(prev => prev.filter(r => r.id !== selectedRecord.id));
            alert("Đã xóa bản lưu thành công.");
        } catch (error) {
            alert("Lỗi khi xóa: " + error.message);
        } finally {
            setSelectedRecord(null);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto p-6 bg-white shadow-xl rounded-xl mt-8">
            <PasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                onSuccess={() => {
                    if (modalMode === "edit" && selectedRecord) {
                        navigate(`/mqaa-patrol/entry/${selectedRecord.section}/${selectedRecord.id}`);
                    } else if (modalMode === "delete") {
                        confirmDeleteRecord();
                    }
                }}
                initialTitle={modalMode === "edit" ? "Chỉnh sửa phiếu" : "Xác nhận xóa phiếu"}
            />
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

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10 p-6 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
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
                    <label className="text-sm font-bold text-indigo-700">Auditor</label>
                    <select
                        className="p-2.5 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filters.auditor}
                        onChange={(e) => setFilters({ ...filters, auditor: e.target.value })}
                    >
                        <option value="All">All Auditors</option>
                        {auditors.map((a) => (
                            <option key={a.id} value={a.id}>{a.label}</option>
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
                            <th className="p-4 border-b text-center">Section</th>
                            <th className="p-4 border-b text-center">Score</th>
                            <th className="p-4 border-b text-center">Level</th>
                            <th className="p-4 border-b text-center">Hiệu suất</th>
                            <th className="p-4 border-b text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {results.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="p-10 text-center text-gray-500 italic">
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
                                        <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                                            {res.section?.replace(/_/g, " ")}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center font-black text-red-600">{res.total_score}</td>
                                    <td className="p-4 text-center font-black text-red-600">{res.total_level}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${Number(res.overall_performance) >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {res.overall_performance}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedRecord(res);
                                                setShowPasswordModal(true);
                                            }}
                                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1 shadow-sm border border-indigo-200"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Chỉnh sửa
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedRecord(res);
                                                setModalMode("delete");
                                                setShowPasswordModal(true);
                                            }}
                                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-1.5 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1 shadow-sm border border-red-100"
                                            title="Xóa bản lưu"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Xóa
                                        </button>
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
