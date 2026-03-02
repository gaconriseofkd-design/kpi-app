import { useNavigate } from "react-router-dom";

const SECTIONS = [
    { id: "Lamination", name: "LAMINATION" },
    { id: "Prefitting", name: "PREFITTING" },
    { id: "Molding", name: "MOLDING" },
    { id: "Leanline_DC", name: "LEANLINE DC" },
    { id: "Leanline_Molded", name: "LEANLINE MOLDED" },
];

export default function MQAAPatrolSelection() {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-indigo-900">MQAA Patrol Selection</h1>
                <button
                    onClick={() => navigate("/mqaa-patrol/report")}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all"
                >
                    Xuất báo cáo
                </button>
            </div>

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
