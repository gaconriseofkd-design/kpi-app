// src/pages/HelpPage.jsx
import { useKpiSection } from "../context/KpiSectionContext";

export default function HelpPage() {
  const { section } = useKpiSection();

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Hướng Dẫn Sử Dụng Hệ Thống KPI Worker</h1>
      <p className="text-lg text-gray-700">Section hiện tại: <span className="font-semibold">{section}</span></p>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">I. Chức Năng Nhập Liệu KPI (Cho Worker)</h2>
        
        {/* Nhập KPI */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">1. Nhập KPI (Thường)</h3>
          <p>Dùng cho việc nhập liệu hàng ngày, từng bản ghi một.</p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Input:</span> MSNV, Ngày, Ca, Giờ làm việc, Giờ dừng máy, Phế, Tuân thủ.</li>
            <li><span className="font-semibold">Tính điểm:</span> Hệ thống tự động tra cứu Rule điểm Sản lượng (P) và Chất lượng (Q) để tính Điểm KPI ngày.</li>
            <li><span className="font-semibold">Luồng dữ liệu:</span> Sau khi gửi, dữ liệu sẽ được chuyển sang trạng thái <span className="font-medium text-blue-600">PENDING</span> và chờ Người duyệt phê duyệt.</li>
          </ul>
        </div>

        {/* Nhập KPI Nhanh */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">2. Nhập KPI Nhanh</h3>
          <p>Dành cho Người duyệt hoặc Admin để nhập dữ liệu cho nhiều nhân viên cùng lúc. <span className="font-medium text-red-600">(Cần Mật khẩu để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Chế độ Người duyệt:</span> Nhập MSNV người duyệt để tải danh sách nhân viên.</li>
            <li><span className="font-semibold">Luồng dữ liệu:</span> Dữ liệu được tạo ở chế độ này sẽ được lưu ngay lập tức dưới trạng thái <span className="font-medium text-green-600">APPROVED</span>.</li>
            <li><span className="font-semibold">Quy trình:</span> Chọn nhân viên → Áp dụng Template chung (Ngày, Ca, Output/OE, Phế,...) → Tạo danh sách Review → Lưu.</li>
          </ul>
        </div>

        <h2 className="text-xl font-semibold border-b pb-2">II. Chức Năng Xét Duyệt & Quản Lý</h2>
        
        {/* Xét duyệt KPI */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">1. Xét duyệt KPI (Pending)</h3>
          <p>Màn hình cho phép Người duyệt phê duyệt hoặc từ chối các đơn KPI đang chờ. <span className="font-medium text-red-600">(Cần Mật khẩu để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Bộ lọc:</span> Lọc theo MSNV người duyệt, khoảng ngày.</li>
            <li><span className="font-semibold">Thao tác:</span> Duyệt từng dòng, Từ chối từng dòng (cần ghi chú lý do), Duyệt hàng loạt các dòng đã chọn, hoặc Duyệt TẤT CẢ các đơn đang chờ theo bộ lọc hiện tại.</li>
          </ul>
        </div>
        
        {/* Tra cứu đơn KPI */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">2. Tra cứu đơn KPI</h3>
          <p>Dùng để tra cứu lịch sử KPI của một nhân viên bất kỳ.</p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Bộ lọc:</span> MSNV nhân viên, khoảng ngày.</li>
            <li><span className="font-semibold">Hiển thị:</span> Xem trạng thái (pending/approved/rejected) và ghi chú của người duyệt.</li>
          </ul>
        </div>

        <h2 className="text-xl font-semibold border-b pb-2">III. Báo Cáo & Cấu Hình</h2>

        {/* Báo cáo */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">1. Báo cáo</h3>
          <p>Tổng hợp dữ liệu KPI chi tiết. <span className="font-medium text-red-600">(Cần Mật khẩu để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Chức năng mới:</span> Tra cứu ngày thiếu KPI theo MSNV Người duyệt.</li>
            <li><span className="font-semibold">Xuất dữ liệu:</span> Cho phép xuất dữ liệu báo cáo chi tiết và danh sách ngày thiếu KPI ra file XLSX.</li>
            <li><span className="font-semibold">Phân tích:</span> Biểu đồ điểm ngày theo nhân viên, điểm trung bình baseline và Top 5 nhân viên.</li>
          </ul>
        </div>
        
        {/* Quản lý User */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">2. Quản lý User</h3>
          <p>Quản lý danh sách MSNV, Họ tên, Role và Người duyệt phụ trách. <span className="font-medium text-red-600">(Cần Mật khẩu Admin để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Nhập liệu:</span> Thêm/sửa từng dòng hoặc Import/Upsert hàng loạt từ file Excel.</li>
            <li><span className="font-semibold">Phân quyền:</span> Gán vai trò (worker, approver, admin).</li>
          </ul>
        </div>
        
        {/* Rules điểm SX */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">3. Rules điểm Sản xuất</h3>
          <p>Cấu hình công thức tính điểm Sản lượng (P-score) dựa trên ngưỡng %OE hoặc Tỷ lệ năng suất/giờ (cho các section Hybrid). <span className="font-medium text-red-600">(Cần Mật khẩu Admin để đăng nhập)</span></p>
        </div>
      </div>
    </div>
  );
}