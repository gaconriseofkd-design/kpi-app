import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const REPORTS = [
    { id: "daily_report", name: "Báo Cáo Nhập Kho Hằng Ngày", dbKey: "is_daily_report_enabled", time: "Liên tục" },
    { id: "hang_bu", name: "Báo Cáo Hàng Bù", dbKey: "is_hang_bu_enabled", time: "16:00" },
    { id: "delay_xuat_gap", name: "Báo Cáo Delay - Xuất Gấp", dbKey: "is_delay_enabled", time: "10:00 & 16:00" },
    { id: "wip_report", name: "Báo Cáo WIP", dbKey: "is_wip_enabled", time: "08:00 & 16:00" },
    { id: "mqaa_patrol", name: "Báo Cáo MQAA Patrol", dbKey: "is_mqaa_patrol_enabled", time: "08:00" },
];

export default function ReportAdmin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) fetchSettings();
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === "Deplao.1305") {
            setIsAuthenticated(true);
        } else {
            alert("Mật khẩu không đúng!");
        }
    };

    const fetchSettings = async () => {
        const { data, error } = await supabase.from("system_settings").select("*").eq("id", 1).single();
        if (error) {
            console.error(error);
        } else if (data) {
            setSettings(data);
        }
    };

    const toggleReport = async (dbKey, currentValue) => {
        setLoading(true);
        const { error } = await supabase
            .from("system_settings")
            .update({ [dbKey]: !currentValue })
            .eq("id", 1);
        
        if (error) {
            alert("Lỗi khi cập nhật cài đặt!");
        } else {
            setSettings(prev => ({ ...prev, [dbKey]: !currentValue }));
        }
        setLoading(false);
    };

    const triggerManualReport = async (reportId, reportName) => {
        if (!confirm(`Bạn có chắc muốn gửi NGAY LẬP TỨC báo cáo: ${reportName}?`)) return;
        
        setLoading(true);
        const { error } = await supabase
            .from("report_requests")
            .insert([{ report_type: reportId, status: "pending" }]);
        
        if (error) {
            alert("Lỗi khi gửi yêu cầu báo cáo!");
        } else {
            alert(`Đã gửi yêu cầu gửi ${reportName}. Script PowerShell sẽ nhận diện trong vài giây tới.`);
        }
        setLoading(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="max-w-[400px] mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-2xl font-black text-indigo-900 mb-6">Xác Thực Quản Trị</h2>
                <form onSubmit={handleLogin}>
                    <input
                        type="password"
                        className="w-full p-3 border rounded-lg mb-4 text-center text-xl tracking-widest"
                        placeholder="Nhập mật khẩu..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all">
                        ĐĂNG NHẬP
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto p-6 bg-white shadow-xl rounded-xl mt-8">
            <h2 className="text-3xl font-black text-indigo-900 mb-8 border-b pb-4">Bảng Điều Khiển Báo Cáo Chi Tiết</h2>
            
            <div className="grid grid-cols-1 gap-6">
                {REPORTS.map((report) => {
                    const isEnabled = settings[report.dbKey] !== false; // Default true if null
                    return (
                        <div key={report.id} className="border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between hover:shadow-md transition-shadow bg-gray-50">
                            <div className="mb-4 md:mb-0 flex-1">
                                <h3 className="text-xl font-bold text-gray-800">{report.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">Lịch trình tự động: <span className="font-semibold">{report.time}</span></p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Trạng thái tự động:</span>
                                    {isEnabled ? (
                                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">ĐANG BẬT</span>
                                    ) : (
                                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">ĐANG TẮT</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex gap-4 w-full md:w-auto">
                                <button
                                    onClick={() => toggleReport(report.dbKey, isEnabled)}
                                    disabled={loading}
                                    className={`flex-1 md:flex-none px-6 py-3 rounded-lg font-bold text-white transition-all min-w-[140px] ${
                                        isEnabled ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                                    } disabled:opacity-50`}
                                >
                                    {isEnabled ? "TẮT TỰ ĐỘNG" : "BẬT TỰ ĐỘNG"}
                                </button>
                                
                                <button
                                    onClick={() => triggerManualReport(report.id, report.name)}
                                    disabled={loading}
                                    className="flex-1 md:flex-none px-6 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all min-w-[140px] flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <span>🚀 GỬI NGAY</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-8 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                <strong>Lưu ý:</strong> Cần chạy <code>ReportWatcher.ps1</code> trên máy tính để xử lý các báo cáo được kích hoạt.
            </div>
        </div>
    );
}
