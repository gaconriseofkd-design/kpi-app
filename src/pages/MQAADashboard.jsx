// src/pages/MQAADashboard.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";

export default function MQAADashboard() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const exportToExcel = () => {
        if (logs.length === 0) return alert("Không có dữ liệu để xuất!");

        const worksheet = XLSX.utils.json_to_sheet(logs.map(log => ({
            "Ngày": log.date,
            "Ca": log.shift,
            "Line": log.line,
            "Leader": log.leader_name,
            "Loại": log.issue_type,
            "Mô tả": log.description,
            "Link ảnh": Array.isArray(log.image_url) ? log.image_url.join(", ") : log.image_url,
            "Thời gian tạo": log.created_at
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MQAA_Logs");
        XLSX.writeFile(workbook, `MQAA_Report_${filters.startDate}_to_${filters.endDate}.xlsx`);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
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
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-green-700 transition"
                    >
                        Xuất Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="p-4 font-semibold text-gray-600">Ngày</th>
                                <th className="p-4 font-semibold text-gray-600">Ca</th>
                                <th className="p-4 font-semibold text-gray-600">Line</th>
                                <th className="p-4 font-semibold text-gray-600">Leader</th>
                                <th className="p-4 font-semibold text-gray-600">Loại</th>
                                <th className="p-4 font-semibold text-gray-600">Mô tả</th>
                                <th className="p-4 font-semibold text-gray-600 text-center">Ảnh</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-400">Đang tải dữ liệu...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-400">Không tìm thấy bản ghi nào.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="p-4">{log.date}</td>
                                        <td className="p-4 text-indigo-700 font-bold">{log.shift}</td>
                                        <td className="p-4 font-medium">{log.line}</td>
                                        <td className="p-4 text-gray-600">{log.leader_name}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.issue_type === 'Tuân thủ' ? 'bg-blue-100 text-blue-700' :
                                                log.issue_type === 'Chất lượng' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {log.issue_type}
                                            </span>
                                        </td>
                                        <td className="p-4 max-w-xs truncate" title={log.description}>
                                            {log.description}
                                        </td>
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
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
