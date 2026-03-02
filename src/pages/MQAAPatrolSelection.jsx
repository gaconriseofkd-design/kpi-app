import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const SECTIONS = [
    { id: "Raw_Material_Warehouse", name: "RAW MATERIAL WAREHOUSE" },
    { id: "Lamination", name: "LAMINATION" },
    { id: "Prefitting", name: "PREFITTING" },
    { id: "Molding", name: "MOLDING" },
    { id: "Leanline_DC", name: "LEANLINE DC" },
    { id: "Leanline_Molded", name: "LEANLINE MOLDED" },
    { id: "Cutting_Die_Warehouse", name: "CUTTING DIE & BOARD WAREHOUSE" },
    { id: "Logo_Warehouse", name: "LOGO WAREHOUSE" },
    { id: "Finished_Goods_Warehouse", name: "FINISHED GOODS WAREHOUSE" },
];

export default function MQAAPatrolSelection() {
    const navigate = useNavigate();
    const [showSettings, setShowSettings] = useState(false);
    const [auditorList, setAuditorList] = useState([]);
    const [newAuditor, setNewAuditor] = useState({ id: "", name: "" });
    const [cleaning, setCleaning] = useState(false);

    useEffect(() => {
        fetchAuditors();
    }, []);

    const fetchAuditors = async () => {
        const { data, error } = await supabase.from("mqaa_patrol_auditors").select("*");
        if (data) setAuditorList(data);
    };

    const handleAddAuditor = async () => {
        if (!newAuditor.id || !newAuditor.name) return alert("Vui lòng nhập đủ ID và Tên");
        const { error } = await supabase.from("mqaa_patrol_auditors").insert([newAuditor]);
        if (error) {
            alert("Lỗi: " + error.message);
        } else {
            setNewAuditor({ id: "", name: "" });
            fetchAuditors();
        }
    };

    const handleDeleteAuditor = async (id) => {
        if (!confirm("Xóa auditor này?")) return;
        const { error } = await supabase.from("mqaa_patrol_auditors").delete().eq("id", id);
        if (!error) fetchAuditors();
    };

    const handleCleanup = async () => {
        const days = prompt("Xóa tất cả ảnh vật lý cũ hơn bao nhiêu ngày? (Ví dụ: 30)", "30");
        if (!days) return;

        setCleaning(true);
        try {
            const { data: files, error } = await supabase.storage.from("mqaa-images").list("mqaa_patrol");
            if (error) throw error;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

            const filesToDelete = files
                .filter(f => f.created_at && new Date(f.created_at) < cutoffDate)
                .map(f => `mqaa_patrol/${f.name}`);

            if (filesToDelete.length === 0) {
                alert("Không có ảnh nào cũ hơn thời gian đã chọn.");
                return;
            }

            if (confirm(`Tìm thấy ${filesToDelete.length} ảnh cũ. Bạn có chắc chắn muốn xóa vĩnh viễn không?`)) {
                const { error: delError } = await supabase.storage.from("mqaa-images").remove(filesToDelete);
                if (delError) throw delError;
                alert(`Đã dọn dẹp thành công ${filesToDelete.length} ảnh!`);
            }
        } catch (error) {
            alert("Lỗi khi dọn dẹp: " + error.message);
        } finally {
            setCleaning(false);
        }
    };

    const handleOpenSettings = () => {
        const pw = prompt("Nhập mật mã để vào Cài đặt:");
        if (pw === "04672") {
            setShowSettings(true);
        } else if (pw !== null) {
            alert("Sai mật mã!");
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/")}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all"
                        title="Quay lại trang chủ"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-bold text-indigo-900">MQAA Patrol Selection</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleOpenSettings}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-lg transition-all"
                        title="Cài đặt Auditor"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => navigate("/mqaa-patrol/report")}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all"
                    >
                        Xuất báo cáo
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 text-indigo-800">Cài đặt Danh sách Auditor</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="ID (MSNV)"
                                className="w-1/3 p-2 border rounded"
                                value={newAuditor.id}
                                onChange={(e) => setNewAuditor({ ...newAuditor, id: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Tên Auditor"
                                className="flex-1 p-2 border rounded"
                                value={newAuditor.name}
                                onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })}
                            />
                            <button
                                onClick={handleAddAuditor}
                                className="bg-indigo-600 text-white px-4 py-2 rounded font-bold"
                            >
                                Thêm
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto border rounded divide-y">
                            {auditorList.map((a) => (
                                <div key={a.id} className="p-2 flex justify-between items-center text-sm">
                                    <span><strong>{a.id}</strong> - {a.name}</span>
                                    <button onClick={() => handleDeleteAuditor(a.id)} className="text-red-500 font-bold px-2">X</button>
                                </div>
                            ))}
                            {auditorList.length === 0 && <p className="p-4 text-center text-gray-400">Chưa có dữ liệu</p>}
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Quản lý bộ nhớ hình ảnh (1GB Free)
                            </h4>
                            <p className="text-[11px] text-gray-500 mb-3 italic">* Ảnh được nén cực nhỏ (~100KB), 1GB có thể chứa ~10,000 ảnh.</p>
                            <button
                                onClick={handleCleanup}
                                disabled={cleaning}
                                className={`w-full py-2 ${cleaning ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-lg font-bold text-sm transition-all shadow-md`}
                            >
                                {cleaning ? "ĐANG DỌN DẸP..." : "DỌN DẸP ẢNH CŨ GIẢI PHÓNG BỘ NHỚ"}
                            </button>
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full mt-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            <p className="text-gray-600 mb-6 italic text-center text-lg">
                Vui lòng chọn Section để bắt đầu đánh giá
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => navigate(`/mqaa-patrol/entry/${section.id}`)}
                        className="h-32 bg-white border-2 border-indigo-100 hover:border-indigo-500 rounded-xl shadow-sm hover:shadow-xl transition-all flex items-center justify-center text-xl font-bold text-indigo-700 group hover:bg-indigo-50"
                    >
                        <div className="flex flex-col items-center">
                            <span className="mb-2 transition-transform group-hover:scale-110">
                                {section.name}
                            </span>
                            <div className="w-12 h-1 bg-indigo-200 group-hover:w-20 group-hover:bg-indigo-500 transition-all duration-300 rounded-full"></div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
