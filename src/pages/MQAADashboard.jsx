// src/pages/MQAADashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const SECTIONS = ["ALL", "Leanline_DC", "Leanline_Molded", "Lamination", "Prefitting", "Molding", "Hàng bù"];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function MQAADashboard() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("ALL"); // For List Mode
    const [viewMode, setViewMode] = useState("LIST");  // "LIST" or "CHART"

    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
    });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("mqaa_logs")
                .select("*")
                .gte("date", filters.startDate)
                .lte("date", filters.endDate)
                .order("date", { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Error fetching MQAA logs:", error);
            alert("Lỗi tải dữ liệu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    // --- DATA PROCESSING FOR CHARTS ---
    const { pieData, barData, top5Lines } = useMemo(() => {
        if (!logs.length) return { pieData: [], barData: [], top5Lines: [] };

        // 1. Pie Data: Count by Section
        const sectionCounts = {};
        logs.forEach(l => {
            const s = l.section || "Unknown";
            sectionCounts[s] = (sectionCounts[s] || 0) + 1;
        });
        const pieData = Object.keys(sectionCounts).map(k => ({ name: k, value: sectionCounts[k] }));

        // 2. Bar Data: Group by Date then Section
        // Need a list of all unique dates involved, sorted asc
        const dates = [...new Set(logs.map(l => l.date))].sort();
        const barData = dates.map(d => {
            const dayLogs = logs.filter(l => l.date === d);
            const row = { date: d };
            // Initialize all known sections to 0 (optional, but good for stacked)
            // Or just count what we have
            dayLogs.forEach(l => {
                const s = l.section || "Unknown";
                row[s] = (row[s] || 0) + 1;
            });
            return row;
        });

        // 3. Top 5 Lines
        const lineCounts = {};
        logs.forEach(l => {
            // Normalizing input (uppercase, trim) might be good if data is messy
            const line = (l.line || "N/A").toUpperCase().trim();
            lineCounts[line] = (lineCounts[line] || 0) + 1;
        });
        const sortedLines = Object.entries(lineCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([line, count]) => ({ line, count }));

        return { pieData, barData, top5Lines: sortedLines };
    }, [logs]);

    // Lọc dữ liệu cho List View
    const filteredLogs = logs.filter(log => activeTab === "ALL" || log.section === activeTab);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const exportToExcel = () => {
        if (filteredLogs.length === 0) return alert("Không có dữ liệu để xuất!");
        // ... (Export logic unchanged)
        const worksheet = XLSX.utils.json_to_sheet(filteredLogs.map(log => ({
            "Ngày": log.date,
            "Bộ phận": log.section,
            "Ca": log.shift,
            "Line": log.line,
            "Leader": log.leader_name,
            "MSNV": log.worker_id || "",
            "Họ tên": log.worker_name || "",
            "Loại": log.issue_type,
            "Mô tả": log.description,
            "Link ảnh": Array.isArray(log.image_url) ? log.image_url.join(", ") : log.image_url,
            "Thời gian tạo": log.created_at
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MQAA_Logs");
        const fileName = `MQAA_${activeTab}_${filters.startDate}_to_${filters.endDate}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Dashboard MQAA</h2>

                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Từ ngày</label>
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                                className="block p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Đến ngày</label>
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                                className="block p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        {viewMode === "LIST" && (
                            <button
                                onClick={exportToExcel}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-green-700 transition"
                            >
                                Xuất Excel ({activeTab === "ALL" ? "Toàn bộ" : activeTab})
                            </button>
                        )}
                    </div>
                </div>

                {/* Main View Switcher */}
                <div className="flex border-b">
                    <button
                        onClick={() => setViewMode("LIST")}
                        className={`px-6 py-2 font-bold text-sm border-b-2 transition ${viewMode === "LIST" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        DANH SÁCH & BÁO CÁO
                    </button>
                    <button
                        onClick={() => setViewMode("CHART")}
                        className={`px-6 py-2 font-bold text-sm border-b-2 transition ${viewMode === "CHART" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        BIỂU ĐỒ & THỐNG KÊ
                    </button>
                </div>

                {/* Sub-tabs for List View */}
                {viewMode === "LIST" && (
                    <div className="flex overflow-x-auto pb-2 gap-2 mt-2">
                        {SECTIONS.map(sec => (
                            <button
                                key={sec}
                                onClick={() => setActiveTab(sec)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${activeTab === sec
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                            >
                                {sec === "ALL" ? "Toàn bộ" : sec}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* CONTENT AREA */}
            {viewMode === "LIST" ? (
                /* --- LIST VIEW --- */
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="p-4 font-semibold text-gray-600">Ngày</th>
                                    <th className="p-4 font-semibold text-gray-600">Bộ phận</th>
                                    <th className="p-4 font-semibold text-gray-600">Ca</th>
                                    <th className="p-4 font-semibold text-gray-600">Line</th>
                                    <th className="p-4 font-semibold text-gray-600">Leader</th>
                                    <th className="p-4 font-semibold text-gray-600">MSNV</th>
                                    <th className="p-4 font-semibold text-gray-600">Họ tên</th>
                                    <th className="p-4 font-semibold text-gray-600">Loại</th>
                                    <th className="p-4 font-semibold text-gray-600">Mô tả</th>
                                    <th className="p-4 font-semibold text-gray-600 text-center">Ảnh</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="12" className="p-10 text-center text-gray-400">Đang tải dữ liệu...</td></tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr><td colSpan="12" className="p-10 text-center text-gray-400">Không tìm thấy bản ghi nào.</td></tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="p-4">{log.date}</td>
                                            <td className="p-4 font-medium text-blue-600">{log.section}</td>
                                            <td className="p-4 text-indigo-700 font-bold">{log.shift}</td>
                                            <td className="p-4 font-medium">{log.line}</td>
                                            <td className="p-4 text-gray-600">{log.leader_name}</td>
                                            <td className="p-4 text-gray-500">{log.worker_id || "-"}</td>
                                            <td className="p-4 font-medium text-gray-900">{log.worker_name || "-"}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.issue_type === 'Tuân thủ' ? 'bg-blue-100 text-blue-700' :
                                                        log.issue_type === 'Chất lượng' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {log.issue_type}
                                                </span>
                                            </td>
                                            <td className="p-4 max-w-xs truncate" title={log.description}>{log.description}</td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {Array.isArray(log.image_url) ? (
                                                        log.image_url.map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-block p-0.5 border rounded hover:border-indigo-400 transition">
                                                                <img src={url} alt={`Proof ${i}`} className="w-8 h-8 object-cover rounded" />
                                                            </a>
                                                        ))
                                                    ) : log.image_url ? (
                                                        <a href={log.image_url} target="_blank" rel="noreferrer" className="inline-block p-0.5 border rounded hover:border-indigo-400 transition">
                                                            <img src={log.image_url} alt="Proof" className="w-8 h-8 object-cover rounded" />
                                                        </a>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* --- CHART VIEW --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. PIE CHART */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Tỷ lệ Lỗi theo Bộ phận</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. TOP 5 LOCATIONS */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Top 5 Vị trí/Line Vi phạm nhiều nhất</h3>
                        <div className="space-y-3">
                            {top5Lines.length > 0 ? (
                                top5Lines.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white ${idx === 0 ? "bg-red-500" : idx === 1 ? "bg-orange-500" : idx === 2 ? "bg-yellow-500" : "bg-gray-400"
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="font-semibold text-gray-700">{item.line}</span>
                                        </div>
                                        <span className="font-bold text-red-600">{item.count} lỗi</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-400 py-10">Chưa có dữ liệu thống kê.</p>
                            )}
                        </div>
                    </div>

                    {/* 3. BAR CHART (TREND) */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 lg:col-span-2">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Xu hướng Lỗi theo Ngày & Bộ phận</h3>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={barData}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis allowDecimals={false} />
                                    <RechartsTooltip />
                                    <Legend />
                                    {/* Generate Bars dynamically based on SECTIONS (excl ALL) */}
                                    {SECTIONS.filter(s => s !== "ALL").map((sec, idx) => (
                                        <Bar key={sec} dataKey={sec} stackId="a" fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
