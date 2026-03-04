import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, Cell
} from "recharts";

export default function MQAAPatrolDashboard() {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [summaryData, setSummaryData] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("table"); // 'table' or 'chart'

    // Dynamic Sections
    const [sections, setSections] = useState([]);
    const SECTION_MAP = useMemo(() => {
        const map = {};
        sections.forEach(s => map[s.id] = s.name);
        return map;
    }, [sections]);
    const SECTION_IDS = useMemo(() => sections.map(s => s.id), [sections]);

    useEffect(() => {
        const loadAll = async () => {
            await fetchSections();
            await fetchData();
        }
        loadAll();
    }, [selectedDate]);

    const fetchSections = async () => {
        const { data } = await supabase.from("mqaa_patrol_sections").select("*").order("sort_order", { ascending: true });
        if (data) setSections(data);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: dayData, error: dayError } = await supabase
                .from("mqaa_patrol_logs")
                .select("section, overall_performance, total_score, total_level, auditor_name, auditor_id, id")
                .eq("date", selectedDate);

            if (dayError) throw dayError;

            const summary = {};
            dayData.forEach(row => {
                if (!summary[row.section] || row.id > summary[row.section].id) {
                    summary[row.section] = row;
                }
            });
            setSummaryData(summary);

            const { data: histData, error: histError } = await supabase
                .from("mqaa_patrol_logs")
                .select("date, section, overall_performance")
                .order("date", { ascending: true });

            if (histError) throw histError;

            const dates = [...new Set(histData.map(d => d.date))].slice(-15);
            const trend = dates.map(date => {
                const dayPoints = { name: date };
                sections.forEach(s => {
                    const match = histData.find(d => d.date === date && d.section === s.id);
                    if (match) dayPoints[s.name] = match.overall_performance;
                });
                return dayPoints;
            });
            setHistoryData(trend);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const overallTotals = useMemo(() => {
        let level = 0;
        let score = 0;
        let count = 0;
        SECTION_IDS.forEach(id => {
            if (summaryData[id]) {
                level += Number(summaryData[id].total_level) || 0;
                score += Number(summaryData[id].total_score) || 0;
                count++;
            }
        });
        const performance = score > 0 ? ((level / score) * 100).toFixed(0) : 0;
        return { level, score, performance };
    }, [summaryData, SECTION_IDS]);

    const topSectionData = useMemo(() => {
        return SECTION_IDS
            .map(id => ({
                name: SECTION_MAP[id],
                score: summaryData[id]?.overall_performance || 0
            }))
            .sort((a, b) => b.score - a.score);
    }, [summaryData, SECTION_IDS, SECTION_MAP]);

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("MQAA Summary");

        worksheet.getColumn(1).width = 45;
        worksheet.getColumn(2).width = 25;

        const titleRow = worksheet.addRow(["PHIẾU TỔNG KẾT MQAA - INSOLE PRODUCTION"]);
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
        titleRow.getCell(1).font = { color: { argb: 'FFFFFF' }, bold: true, size: 14 };
        titleRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(`A${titleRow.number}:B${titleRow.number}`);

        const subTitleRow = worksheet.addRow(["(tổng hợp theo ID và theo ngày)"]);
        subTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DC2626' } };
        subTitleRow.getCell(1).font = { color: { argb: 'FFFFFF' }, bold: true, size: 9 };
        subTitleRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(`A${subTitleRow.number}:B${subTitleRow.number}`);

        const auditors = [...new Set(SECTION_IDS.map(id => summaryData[id]?.auditor_name).filter(Boolean))].join(", ") || "***";
        const auditorIds = [...new Set(SECTION_IDS.map(id => summaryData[id]?.auditor_id).filter(Boolean))].join(", ") || "***";

        worksheet.addRow(["Auditor:", auditors]);
        worksheet.addRow(["ID:", auditorIds]);
        worksheet.addRow(["Date of Audit:", selectedDate]);
        worksheet.addRow(["Production:", "Insole"]);

        // Header for subsections
        const headerRow = worksheet.addRow(["Section", "Level", "Score", "Section Performance"]);
        headerRow.font = { bold: true, color: { argb: 'EF4444' } };
        headerRow.eachCell(c => {
            c.alignment = { horizontal: 'center' };
            c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        SECTION_IDS.forEach(id => {
            const data = summaryData[id];
            const row = worksheet.addRow([
                SECTION_MAP[id],
                data ? data.total_level : 0,
                data ? data.total_score : 0,
                data ? `${data.overall_performance}%` : "0%"
            ]);

            row.eachCell((c, colNumber) => {
                c.alignment = { horizontal: colNumber === 1 ? 'left' : 'center' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (data) {
                    c.font = { color: { argb: 'EF4444' }, bold: true };
                } else {
                    c.font = { color: { argb: 'CBD5E1' } };
                }
            });
        });

        const summaryRow = worksheet.addRow(["Overall Insole Performance:", overallTotals.level, overallTotals.score, `${overallTotals.performance}%`]);
        summaryRow.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FDE68A' } };
            c.font = { bold: true, size: 12, color: { argb: '92400E' } };
            c.alignment = { horizontal: 'center' };
            c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        summaryRow.getCell(1).alignment = { horizontal: 'left' };

        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `MQAA_Summary_Insole_${selectedDate}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/mqaa-patrol")} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h1 className="text-2xl font-black text-indigo-900 tracking-tight text-center md:text-left">MQAA DASHBOARD</h1>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                        <button onClick={() => setView("table")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Bản Tổng Kết
                        </button>
                        <button onClick={() => setView("chart")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Biểu Đồ
                        </button>
                        {view === "table" && (
                            <button onClick={exportToExcel} className="px-4 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 shadow-sm flex items-center gap-1 transition-all active:scale-95">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 5l-4-4-4 4M12 1v13" /></svg>
                                Xuất Excel
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-100 border-none rounded-xl px-4 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>

                {view === "table" ? (
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
                        <div className="bg-indigo-600 p-6 text-center">
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">PHIẾU TỔNG KẾT MQAA - INSOLE PRODUCTION</h2>
                        </div>
                        <div className="bg-red-600 p-2 text-center text-white text-[10px] uppercase font-black tracking-widest">(tổng hợp theo ID và theo ngày)</div>

                        <div className="p-8 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-200">
                                <thead>
                                    <tr className="bg-slate-50 text-red-600 font-black uppercase text-xs">
                                        <th className="border border-slate-200 p-4 text-left">Section</th>
                                        <th className="border border-slate-200 p-4 text-center">Level</th>
                                        <th className="border border-slate-200 p-4 text-center">Score</th>
                                        <th className="border border-slate-200 p-4 text-center">Section Performance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100"><td className="p-4 font-bold text-slate-500">Auditor:</td><td colSpan="3" className="p-4 text-slate-900 font-black">{[...new Set(SECTION_IDS.map(id => summaryData[id]?.auditor_name).filter(Boolean))].join(", ") || "***"}</td></tr>
                                    <tr className="border-b border-slate-100"><td className="p-4 font-bold text-slate-500">ID:</td><td colSpan="3" className="p-4 text-slate-900 font-black">{[...new Set(SECTION_IDS.map(id => summaryData[id]?.auditor_id).filter(Boolean))].join(", ") || "***"}</td></tr>
                                    <tr className="border-b border-slate-100"><td className="p-4 font-bold text-slate-500">Date of Audit:</td><td colSpan="3" className="p-4 text-slate-900 font-black">{selectedDate}</td></tr>
                                    <tr className="border-b border-slate-100"><td className="p-4 font-bold text-slate-500">Production:</td><td colSpan="3" className="p-4 text-slate-900 font-black">Insole</td></tr>

                                    {sections.map((s) => (
                                        <tr key={s.id} className="border border-slate-200 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-700 font-bold">{s.name}</td>
                                            <td className="p-4 text-center font-black text-red-600 border border-slate-200">{summaryData[s.id]?.total_level || 0}</td>
                                            <td className="p-4 text-center font-black text-red-600 border border-slate-200">{summaryData[s.id]?.total_score || 0}</td>
                                            <td className="p-4 text-center font-black text-red-600 border border-slate-200">{summaryData[s.id] ? `${summaryData[s.id].overall_performance}%` : "0%"}</td>
                                        </tr>
                                    ))}

                                    <tr className="bg-amber-400 border border-slate-300">
                                        <td className="p-4 font-black text-amber-900 text-lg">Overall Insole Performance:</td>
                                        <td className="p-4 text-center text-amber-900 font-black text-xl border border-slate-300">{overallTotals.level}</td>
                                        <td className="p-4 text-center text-amber-900 font-black text-xl border border-slate-300">{overallTotals.score}</td>
                                        <td className="p-4 text-center text-amber-900 font-black text-xl border border-slate-300">{overallTotals.performance}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black text-slate-800 mb-8">Xu Hướng 15 Ngày</h3>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                                        <Legend />
                                        {sections.map((s, idx) => (
                                            <Line key={s.id} type="monotone" dataKey={s.name} stroke={`hsl(${idx * 45}, 70%, 50%)`} strokeWidth={4} dot={{ r: 5, strokeWidth: 3, fill: 'white' }} activeDot={{ r: 8 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black text-slate-800 mb-8">Xếp Hạng Điểm Cao</h3>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topSectionData} layout="vertical">
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={150} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                                        <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={24}>
                                            {topSectionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.score >= 90 ? '#22c55e' : entry.score >= 70 ? '#f59e0b' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 flex flex-col justify-center">
                                <p className="opacity-70 font-bold uppercase tracking-widest text-xs mb-2">Trung Bình Insole</p>
                                <p className="text-6xl font-black">{overallTotals.performance}%</p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Đã Hoàn Thành</p>
                                <p className="text-5xl font-black text-slate-800">{Object.keys(summaryData).length} / {sections.length}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
