import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import PasswordModal from "../components/PasswordModal";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const SECTIONS = ["All", "Raw_Material_Warehouse", "Lamination", "Prefitting", "Molding", "Leanline_DC", "Leanline_Molded", "Cutting_Die_Warehouse", "Logo_Warehouse", "Finished_Goods_Warehouse"];

export default function MQAAPatrolReport() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("logs"); // "logs" or "summary"
    
    return (
        <div className="max-w-[1200px] mx-auto p-6 bg-white shadow-xl rounded-xl mt-8">
            <div className="flex items-center justify-between mb-8 border-b pb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/mqaa-patrol")}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all"
                        title="Quay lại"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h2 className="text-3xl font-black text-indigo-900 tracking-tight">MQAA Patrol Reports</h2>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        📋 Chi tiết phiếu
                    </button>
                    <button 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        📊 Tổng hợp tháng
                    </button>
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === "logs" ? <PatrolLogsTab navigate={navigate} /> : <PatrolSummaryTab />}
            </div>
        </div>
    );
}

/* ======================================================================
   TAB 1: PATROL LOGS (EXISTING LOGIC)
   ====================================================================== */
function PatrolLogsTab({ navigate }) {
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
    const [modalMode, setModalMode] = useState("edit");

    useEffect(() => {
        const fetchAuditors = async () => {
            const { data } = await supabase.from("mqaa_patrol_auditors").select("*");
            if (data) {
                setAuditorList(data.map(a => ({
                    id: a.id,
                    name: a.name,
                    label: `${a.id} - ${a.name}`
                })));
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

    const confirmDeleteRecord = async () => {
        if (!selectedRecord) return;
        try {
            const { error } = await supabase
                .from("mqaa_patrol_logs")
                .delete()
                .eq("id", selectedRecord.id);
            if (error) throw error;
            setResults(prev => prev.filter(r => r.id !== selectedRecord.id));
            alert("Đã xóa bản lưu thành công.");
        } catch (error) {
            alert("Lỗi khi xóa: " + error.message);
        } finally {
            setSelectedRecord(null);
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
        worksheet.getCell("A3").value = "Auditor:";
        worksheet.getCell("C3").value = record.auditor_name;
        worksheet.getCell("A4").value = "ID:";
        worksheet.getCell("C4").value = record.auditor_id;
        worksheet.getCell("A5").value = "Date of Audit:";
        worksheet.getCell("C5").value = record.date;
        worksheet.getCell("A6").value = "Section:";
        worksheet.getCell("C6").value = record.section;
        worksheet.getCell("A7").value = "Overall Performance:";
        const perfCell = worksheet.getCell("C7");
        perfCell.value = Number(record.overall_performance) / 100;
        perfCell.font = { bold: true, color: { argb: "FFEF4444" } };
        perfCell.numFmt = '0%';

        // Fetch subLabel
        const { data: dbCriteria } = await supabase.from("mqaa_patrol_criteria").select("no, sub_label").eq("section_id", record.section);
        const criteriaMap = {};
        (dbCriteria || []).forEach(c => criteriaMap[c.no] = c.sub_label);

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
            const isHeader = item.is_header || item.isHeader;
            const scoreVal = (!isHeader && item.score !== null && item.score !== undefined && item.score !== "") ? Number(item.score) : "";
            const levelVal = (!isHeader && item.level !== null && item.level !== undefined && item.level !== "") ? Number(item.level) : "";
            const englishText = item.sub_label || item.subLabel || criteriaMap[item.no] || "";

            const row = worksheet.addRow([
                item.no,
                englishText ? {
                    richText: [
                        { text: item.label, font: { bold: !!isHeader, size: 10, color: { argb: 'FF000000' } } },
                        { text: "\n" + englishText, font: { italic: true, size: 9, color: { argb: 'FF2563EB' } } }
                    ]
                } : item.label,
                scoreVal,
                levelVal,
                item.image_url ? { text: "Link hình ảnh", hyperlink: item.image_url } : "",
                item.description || ""
            ]);

            if (isHeader) {
                row.eachCell((cell, colNumber) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDBA74" } };
                    if (colNumber !== 2) cell.font = { bold: true };
                });
            }

            row.eachCell((cell) => {
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                cell.alignment = { wrapText: true, vertical: "middle" };
            });
        });

        // Column Widths
        worksheet.getColumn(1).width = 10;
        worksheet.getColumn(2).width = 60;
        worksheet.getColumn(3).width = 10;
        worksheet.getColumn(4).width = 10;
        worksheet.getColumn(5).width = 20;
        worksheet.getColumn(6).width = 30;

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `MQAA_Patrol_${record.section}_${record.date}.xlsx`);
    };

    return (
        <>
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
                        {auditorList.map((a) => (
                            <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-indigo-700">Từ ngày</label>
                    <input type="date" className="p-2.5 border rounded-lg" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-indigo-700">Đến ngày</label>
                    <input type="date" className="p-2.5 border rounded-lg" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                </div>
                <div className="flex items-end">
                    <button onClick={handleSearch} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2">
                        {loading ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span> : "Tìm kiếm"}
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
                            <th className="p-4 border-b text-center">Hiệu suất</th>
                            <th className="p-4 border-b text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {results.length === 0 ? (
                            <tr><td colSpan="7" className="p-10 text-center text-gray-500 italic">Không tìm thấy dữ liệu</td></tr>
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
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${Number(res.overall_performance) >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {res.overall_performance}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => { setSelectedRecord(res); setModalMode("edit"); setShowPasswordModal(true); }} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border border-indigo-200">Sửa</button>
                                        <button onClick={() => { setSelectedRecord(res); setModalMode("delete"); setShowPasswordModal(true); }} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border border-red-100">Xóa</button>
                                        <button onClick={() => exportToExcel(res)} className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border border-green-200">Tải (.xlsx)</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

/* ======================================================================
   TAB 2: PATROL SUMMARY (MONTHLY)
   ====================================================================== */
function PatrolSummaryTab() {
    const [monthFrom, setMonthFrom] = useState(new Date().toISOString().slice(0, 7));
    const [monthTo, setMonthTo] = useState(new Date().toISOString().slice(0, 7));
    const [data, setData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadSummary = async () => {
        setLoading(true);
        try {
            const dateFrom = `${monthFrom}-01`;
            const [yearTo, moTo] = monthTo.split("-").map(Number);
            const dateTo = new Date(yearTo, moTo, 0).toISOString().slice(0, 10);

            const { data: logs, error } = await supabase
                .from("mqaa_patrol_logs")
                .select("section, overall_performance, date")
                .gte("date", dateFrom)
                .lte("date", dateTo);

            if (error) throw error;

            const stats = {};
            logs.forEach(l => {
                const s = l.section || "Unknown";
                if (!stats[s]) stats[s] = { count: 0, sum: 0 };
                stats[s].count++;
                stats[s].sum += Number(l.overall_performance || 0);
            });

            const result = Object.entries(stats).map(([sec, val]) => ({
                key: sec,
                sectionName: sec.replace(/_/g, " "),
                count: val.count,
                avgPerformance: val.count ? (val.sum / val.count) : 0
            })).sort((a, b) => b.avgPerformance - a.avgPerformance);

            setData(result);

            // Generate list of months in range
            const monthsList = [];
            let current = new Date(`${monthFrom}-02`);
            const end = new Date(`${monthTo}-02`);
            while (current <= end) {
                monthsList.push(current.toISOString().slice(0, 7));
                current.setMonth(current.getMonth() + 1);
            }

            const monthlyTrend = monthsList.map(m => {
                const [year, month] = m.split("-");
                const dataPoint = {
                    name: `Tháng ${month}/${year}`,
                    rawMonth: m
                };

                const monthLogs = logs.filter(l => l.date && l.date.startsWith(m));

                // Overall average
                if (monthLogs.length > 0) {
                    const sum = monthLogs.reduce((acc, l) => acc + Number(l.overall_performance || 0), 0);
                    dataPoint["Trung bình chung"] = parseFloat((sum / monthLogs.length).toFixed(1));
                } else {
                    dataPoint["Trung bình chung"] = null;
                }

                // Section averages
                SECTIONS.forEach(sec => {
                    if (sec === "All") return;
                    const secLogs = monthLogs.filter(l => l.section === sec);
                    const displayName = sec.replace(/_/g, " ");
                    if (secLogs.length > 0) {
                        const sum = secLogs.reduce((acc, l) => acc + Number(l.overall_performance || 0), 0);
                        dataPoint[displayName] = parseFloat((sum / secLogs.length).toFixed(1));
                    } else {
                        dataPoint[displayName] = null;
                    }
                });

                return dataPoint;
            });

            setTrendData(monthlyTrend);
        } catch (err) {
            alert("Lỗi tải tổng hợp: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSummary(); }, [monthFrom, monthTo]);

    const exportSummary = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("MQAA Summary");

        const columns = [
            { header: "Khu vực / Section", key: "section", width: 30 }
        ];

        trendData.forEach(m => {
            columns.push({
                header: m.name,
                key: m.rawMonth,
                width: 18
            });
        });

        worksheet.columns = columns;

        SECTIONS.forEach(sec => {
            if (sec === "All") return;
            const displayName = sec.replace(/_/g, " ");
            const rowData = { section: displayName };
            
            trendData.forEach(m => {
                const val = m[displayName];
                rowData[m.rawMonth] = val !== null ? `${val}%` : "-";
            });
            worksheet.addRow(rowData);
        });

        const overallRowData = { section: "Trung bình chung" };
        trendData.forEach(m => {
            const val = m["Trung bình chung"];
            overallRowData[m.rawMonth] = val !== null ? `${val}%` : "-";
        });
        worksheet.addRow(overallRowData);

        // Style Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF4F46E5" } // Indigo
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
        });

        // Style Data Rows
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const isOverall = row.getCell(1).value === "Trung bình chung";

            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };

                if (colNumber > 1) {
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                } else {
                    cell.alignment = { horizontal: "left", vertical: "middle" };
                }

                if (isOverall) {
                    cell.font = { bold: true, color: { argb: "FF92400E" } }; // Dark amber text
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFDE68A" } // Amber 200
                    };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `MQAA_Patrol_Summary_${monthFrom}_to_${monthTo}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-wrap items-end gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Từ tháng</label>
                    <input type="month" className="p-2 border rounded-lg w-full md:w-48" value={monthFrom} onChange={e => setMonthFrom(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Đến tháng</label>
                    <input type="month" className="p-2 border rounded-lg w-full md:w-48" value={monthTo} onChange={e => setMonthTo(e.target.value)} />
                </div>
                <button onClick={loadSummary} disabled={loading} className="btn bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                    {loading ? "Đang tải..." : "Cập nhật dữ liệu"}
                </button>
                <button onClick={exportSummary} disabled={loading || data.length === 0} className="btn bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all">
                    📥 Tải báo cáo tổng hợp (.xlsx)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b">
                        <h3 className="font-bold text-slate-700 uppercase text-sm">Bảng hiệu suất ({monthFrom} → {monthTo})</h3>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 text-xs font-black">
                            <tr>
                                <th className="p-3">Section</th>
                                <th className="p-3 text-center">Lượt Audit</th>
                                <th className="p-3 text-center">% Hiệu suất TB</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map(d => (
                                <tr key={d.key} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-bold text-slate-800">{d.sectionName}</td>
                                    <td className="p-3 text-center text-slate-600">{d.count}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${d.avgPerformance >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {d.avgPerformance.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!data.length && !loading && (
                                <tr><td colSpan="3" className="p-10 text-center text-slate-400 italic">Không có dữ liệu trong khoảng này</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-slate-700 mb-6 uppercase text-sm">Biểu đồ % Compliance ({monthFrom} → {monthTo})</h3>
                    <div className="space-y-5">
                        {data.map(d => (
                            <div key={d.key}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-bold text-slate-600">{d.sectionName}</span>
                                    <span className="font-black text-indigo-700">{d.avgPerformance.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3.5 shadow-inner">
                                    <div 
                                        className={`h-3.5 rounded-full transition-all duration-700 ${d.avgPerformance >= 90 ? 'bg-green-500' : 'bg-red-500'}`}
                                        style={{ width: `${d.avgPerformance}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {!data.length && <div className="h-40 flex items-center justify-center text-slate-400 italic border-2 border-dashed rounded-lg">Không có dữ liệu biểu đồ</div>}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-slate-700 mb-6 uppercase text-sm">Biểu đồ xu hướng hiệu suất theo tháng ({monthFrom} → {monthTo})</h3>
                {data.length > 0 ? (
                    <div className="h-[400px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`${value}%`]}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="Trung bình chung" 
                                    stroke="#1e293b" 
                                    strokeWidth={3} 
                                    strokeDasharray="5 5"
                                    dot={{ r: 5, strokeWidth: 2, fill: 'white' }} 
                                    activeDot={{ r: 7 }} 
                                    connectNulls 
                                />
                                {SECTIONS.filter(s => s !== "All").map((s, idx) => {
                                    const sectionColors = {
                                        "Raw_Material_Warehouse": "#10b981",
                                        "Lamination": "#8b5cf6",
                                        "Prefitting": "#3b82f6",
                                        "Molding": "#f97316",
                                        "Leanline_DC": "#ec4899",
                                        "Leanline_Molded": "#14b8a6",
                                        "Cutting_Die_Warehouse": "#f59e0b",
                                        "Logo_Warehouse": "#ef4444",
                                        "Finished_Goods_Warehouse": "#6366f1"
                                    };
                                    const displayName = s.replace(/_/g, " ");
                                    return (
                                        <Line 
                                            key={s} 
                                            type="monotone" 
                                            dataKey={displayName} 
                                            stroke={sectionColors[s] || `hsl(${idx * 40}, 70%, 50%)`} 
                                            strokeWidth={2} 
                                            dot={{ r: 3, strokeWidth: 1.5, fill: 'white' }} 
                                            activeDot={{ r: 5 }} 
                                            connectNulls 
                                        />
                                    );
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 italic border-2 border-dashed rounded-lg">Không có dữ liệu xu hướng</div>
                )}
            </div>
        </div>
    );
}
