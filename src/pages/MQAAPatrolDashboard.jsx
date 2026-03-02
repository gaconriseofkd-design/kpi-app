import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, Cell
} from "recharts";

const SECTION_MAP = {
    "Raw_Material_Warehouse": "Raw Material Warehouse",
    "Lamination": "Lamination",
    "Prefitting": "Pre-fitting",
    "Molding": "Molding",
    "Leanline_Molded": "M Lean Line",
    "Leanline_DC": "DC Lean Line",
    "Cutting_Die_Warehouse": "Cutting Die and Board Warehouse",
    "Logo_Warehouse": "Logo Warehouse",
    "Finished_Goods_Warehouse": "FGs Warehouse"
};

const SECTIONS = Object.keys(SECTION_MAP);

export default function MQAAPatrolDashboard() {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [summaryData, setSummaryData] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("table"); // 'table' or 'chart'

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch summary for selected date
            const { data: dayData, error: dayError } = await supabase
                .from("mqaa_patrol_logs")
                .select("section, overall_performance, auditor_name, id")
                .eq("date", selectedDate);

            if (dayError) throw dayError;

            // Group by section and take latest
            const summary = {};
            dayData.forEach(row => {
                if (!summary[row.section] || row.id > summary[row.section].id) {
                    summary[row.section] = row;
                }
            });
            setSummaryData(summary);

            // Fetch history (last 15 days)
            const { data: histData, error: histError } = await supabase
                .from("mqaa_patrol_logs")
                .select("date, section, overall_performance")
                .order("date", { ascending: true });

            if (histError) throw histError;

            // Process for trend chart
            const dates = [...new Set(histData.map(d => d.date))].slice(-15);
            const trend = dates.map(date => {
                const dayPoints = { name: date };
                SECTIONS.forEach(s => {
                    const match = histData.find(d => d.date === date && d.section === s);
                    if (match) dayPoints[SECTION_MAP[s]] = match.overall_performance;
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

    const overallInsoleScore = useMemo(() => {
        const scores = SECTIONS.map(s => summaryData[s]?.overall_performance).filter(s => s !== undefined);
        if (scores.length === 0) return 0;
        return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    }, [summaryData]);

    const topSectionData = useMemo(() => {
        return SECTIONS
            .map(s => ({
                name: SECTION_MAP[s],
                score: summaryData[s]?.overall_performance || 0
            }))
            .sort((a, b) => b.score - a.score);
    }, [summaryData]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/mqaa-patrol")}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h1 className="text-2xl font-black text-indigo-900 tracking-tight">MQAA DASHBOARD</h1>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                        <button
                            onClick={() => setView("table")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Bản Tổng Kết
                        </button>
                        <button
                            onClick={() => setView("chart")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Biểu Đồ Thống Kê
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-slate-100 border-none rounded-xl px-4 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {view === "table" ? (
                    /* Summary Table View */
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                        <div className="bg-indigo-600 p-4 text-center">
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">PHIẾU TỔNG KẾT MQAA - INSOLE PRODUCTION</h2>
                        </div>
                        <div className="bg-red-600 p-2 text-center text-white text-xs font-bold">
                            (tổng hợp theo ID và theo ngày)
                        </div>

                        <div className="p-6 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-3 font-semibold text-slate-600 w-1/3">Auditor:</td>
                                        <td className="py-3 text-slate-800 font-bold">
                                            {[...new Set(SECTIONS.map(s => summaryData[s]?.auditor_name).filter(Boolean))].join(", ") || "***"}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-3 font-semibold text-slate-600">Date of Audit:</td>
                                        <td className="py-3 text-slate-800 font-bold">{selectedDate}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-3 font-semibold text-slate-600">Production:</td>
                                        <td className="py-3 text-slate-800 font-bold">Insole</td>
                                    </tr>
                                    <tr className="bg-amber-100 border-b-2 border-amber-200">
                                        <td className="py-4 px-4 font-black text-amber-900">Overall Insole Performance:</td>
                                        <td className="py-4 px-4 text-amber-900 font-black text-xl">{overallInsoleScore}%</td>
                                    </tr>
                                    {SECTIONS.map((s) => (
                                        <tr key={s} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-slate-700 font-medium">{SECTION_MAP[s]}</td>
                                            <td className={`py-3 px-4 font-bold ${summaryData[s] ? 'text-green-600' : 'text-slate-300'}`}>
                                                {summaryData[s] ? `${summaryData[s].overall_performance}%` : "0% (No data)"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Charts View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Trend Chart */}
                        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                                Xu Hướng Điểm Overall (15 ngày qua)
                            </h3>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend />
                                        {SECTIONS.map((s, idx) => (
                                            <Line
                                                key={s}
                                                type="monotone"
                                                dataKey={SECTION_MAP[s]}
                                                stroke={`hsl(${idx * 40}, 70%, 50%)`}
                                                strokeWidth={3}
                                                dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                                                activeDot={{ r: 6 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Performance Chart */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Top Section Điểm Cao (Ngày {selectedDate})</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topSectionData} layout="vertical">
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 11 }}
                                            width={140}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none' }}
                                        />
                                        <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={20}>
                                            {topSectionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.score >= 90 ? '#22c55e' : entry.score >= 70 ? '#f59e0b' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Summary Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
                                <p className="opacity-80 text-sm font-medium">Trung Bình Insole</p>
                                <p className="text-4xl font-black mt-1">{overallInsoleScore}%</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-slate-500 text-sm font-medium">Số Section Đã Lưu</p>
                                <p className="text-4xl font-black text-slate-800 mt-1">
                                    {Object.keys(summaryData).length} / {SECTIONS.length}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
