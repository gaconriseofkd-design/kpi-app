import { useNavigate } from "react-router-dom";

export default function MQAAPatrolGuide() {
    const navigate = useNavigate();

    const sections = [
        {
            title: "1. Bắt đầu đánh giá (Auditing)",
            icon: "📋",
            content: [
                "Tại màn hình chính, chọn Xưởng (Section) bạn cần đánh giá (VD: Lamination, Molding).",
                "Nhập ID nhân viên (MSNV) của người đánh giá. Hệ thống sẽ tự động hiển thị tên nếu đã có trong danh sách.",
                "Đối với mỗi tiêu chí (No.), nhập điểm thực tế (Level) và ghi chú (Description) nếu cần.",
                "Chụp ảnh hoặc tải lên bằng chứng (Reference Image). Hệ thống sẽ tự động nén ảnh để tiết kiệm dung lượng.",
                "Bấm 'LƯU ĐÁNH GIÁ' để hoàn tất. Điểm % Overall Performance sẽ tự động tính toán."
            ]
        },
        {
            title: "2. Xem báo cáo & Chỉnh sửa",
            icon: "📊",
            content: [
                "Bấm nút 'REPORT' tại màn hình chính để xem danh sách các bản đánh giá đã lưu.",
                "Sử dụng bộ lọc Ngày hoặc Xưởng để tìm kiếm nhanh.",
                "Nhấn 'Xuất Excel' để tải báo cáo về máy tính.",
                "Để chỉnh sửa một bản ghi, bấm nút 'Chỉnh sửa'. Hệ thống sẽ yêu cầu mật mã bảo mật để đảm bảo tính an toàn dữ liệu."
            ]
        },
        {
            title: "3. Dashboard & Thống kê",
            icon: "📈",
            content: [
                "Bấm nút 'DASHBOARD' để xem biểu đồ hiệu suất.",
                "Theo dõi xu hướng chất lượng qua 15 ngày gần nhất.",
                "Xem bảng tổng kết điểm Overall Performance của tất cả các xưởng trong ngày được chọn.",
                "Xác định các Top Section có điểm cao nhất để khen thưởng hoặc chia sẻ kinh nghiệm."
            ]
        },
        {
            title: "4. Quản lý hệ thống (Admin Settings)",
            icon: "⚙️",
            content: [
                "Bấm biểu tượng Bánh răng (Gear) và nhập mật mã bảo mật để vào cài đặt.",
                "Thẻ AUDITORS: Thêm/Xóa danh sách nhân viên đánh giá hoặc dọn dẹp ảnh cũ.",
                "Thẻ MANAGE FORMS: Thay đổi cấu trúc biểu mẫu (No., Nội dung, Điểm trọng số).",
                "Sử dụng nút 'Sync All' để nạp nhanh toàn bộ biểu mẫu chuẩn từ hệ thống vào Database."
            ]
        },
        {
            title: "5. Các tính năng thông minh",
            icon: "💡",
            content: [
                "HOÀN TÁC (UNDO): Sau khi xóa một tiêu chí, bạn có 8 giây để bấm 'Hoàn tác' nếu lỡ tay xóa nhầm.",
                "MỞ KHÓA ĐIỂM (UNLOCK): Tại trang nhập liệu, bấm biểu tượng ổ khóa cạnh cột 'Score' để thay đổi trọng số điểm (Yêu cầu mật mã).",
                "TỰ ĐỘNG NÉN: Ảnh chụp 4K sẽ được tự động xử lý về kích thước tối ưu để đảm bảo ứng dụng luôn chạy nhanh."
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header Area */}
            <div className="bg-indigo-900 pt-16 pb-32 px-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -ml-20 -mt-20"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl -mr-20 -mb-20"></div>
                </div>

                <div className="max-w-4xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2 uppercase">Hướng dẫn sử dụng</h1>
                        <p className="text-indigo-200 font-bold uppercase tracking-widest text-sm">Hệ thống Quản lý Chất lượng MQAA Patrol</p>
                    </div>
                    <button
                        onClick={() => navigate("/mqaa-patrol")}
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 border border-white/10"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        QUAY LẠI
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-4xl mx-auto -mt-16 relative z-20 px-4 space-y-6">
                {sections.map((section, idx) => (
                    <div key={idx} className="bg-white rounded-[40px] shadow-2xl shadow-indigo-100/50 border border-slate-100 overflow-hidden group hover:border-indigo-300 transition-all duration-500">
                        <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8">
                            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-slate-100 group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-500">
                                {section.icon}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight flex items-center gap-4">
                                    {section.title}
                                    <div className="h-1 flex-1 bg-slate-100 rounded-full hidden md:block">
                                        <div className="h-full bg-indigo-500 w-0 group-hover:w-1/4 transition-all duration-1000"></div>
                                    </div>
                                </h2>
                                <ul className="space-y-4">
                                    {section.content.map((item, i) => (
                                        <li key={i} className="flex gap-4 items-start text-slate-600 font-medium leading-relaxed">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-black mt-0.5 border border-indigo-200 shadow-sm">
                                                {i + 1}
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Security Note */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center text-white text-2xl shadow-lg shadow-amber-200">
                        🔒
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="font-black text-amber-900 text-xl tracking-tight mb-1">Mật mã bảo mật hệ thống</h3>
                        <p className="text-amber-700 font-bold italic text-sm">Cần mật mã để truy cập các thao tác Cài đặt và Chỉnh sửa. Vui lòng liên hệ Người quản lý để được hỗ trợ.</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
