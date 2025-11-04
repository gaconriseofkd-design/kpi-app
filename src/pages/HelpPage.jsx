// src/pages/HelpPage.jsx
import { useKpiSection } from "../context/KpiSectionContext";
import { Link } from "react-router-dom"; // Thêm Link

export default function HelpPage() {
  const { section } = useKpiSection();

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Hướng Dẫn Sử Dụng Hệ Thống KPI Worker</h1>
      <p className="text-lg text-gray-700">Section hiện tại: <span className="font-semibold">{section}</span></p>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">I. Chức Năng Nhập Liệu KPI</h2>
        
        {/* Nhập KPI */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">1. Nhập KPI (Thường)</h3>
          <p>Dùng cho việc nhập liệu hàng ngày, từng bản ghi một cho chính nhân viên đó.</p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Input:</span> MSNV, Ngày, Ca, Giờ làm việc, Giờ dừng máy, Phế, Tuân thủ.</li>
            <li><span className="font-semibold">Tính điểm:</span> Hệ thống tự động tra cứu Rule điểm Sản lượng (P) và Chất lượng (Q) để tính Điểm KPI ngày.</li>
            <li><span className="font-semibold">Luồng dữ liệu:</span> Sau khi gửi, dữ liệu sẽ được chuyển sang trạng thái <span className="font-medium text-blue-600">PENDING</span> và chờ Người duyệt phê duyệt.</li>
          </ul>
        </div>

        {/* CẬP NHẬT: Nhập KPI Nhanh */}
        <div className="border p-4 rounded-lg bg-white space-y-2 shadow-md border-indigo-200">
          <h3 className="font-bold text-lg text-indigo-700">2. Nhập KPI Nhanh (Nâng cao)</h3>
          <p>Dành cho Người duyệt hoặc Admin để nhập dữ liệu cho **nhiều nhân viên cùng lúc**. <span className="font-medium text-red-600">(Cần Mật khẩu để đăng nhập)</span></p>
          <p className="text-sm text-gray-600">
            Dữ liệu tạo ở đây sẽ được lưu ngay lập tức dưới trạng thái <span className="font-medium text-green-600">APPROVED</span>.
          </p>
          
          <div className="pt-2 space-y-2">
            <h4 className="font-semibold">Quy trình 3 bước:</h4>
            
            <details className="text-sm p-2 border rounded bg-gray-50">
              <summary className="cursor-pointer font-medium">Bước 1: Chọn Nhân Viên</summary>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Sử dụng 1 trong 2 cách để tìm và thêm nhân viên vào "Danh sách Đã chọn":</li>
                <li>
                  <span className="font-semibold">Cách 1 (Tìm theo Người duyệt):</span> 
                  Nhập MSNV hoặc Tên của Người duyệt (vd: "David Tu") để tải tất cả nhân viên thuộc quyền quản lý của người đó.
                </li>
                <li>
                  <span className="font-semibold">Cách 2 (Tìm theo Nhân viên):</span> 
                  Nhập MSNV hoặc Tên của Nhân viên (vd: "Nguyễn Văn A") để tìm đích danh.
                </li>
                <li>
                  <span className="font-semibold">Checkbox "All sections":</span> 
                  Mặc định (không check), hệ thống chỉ tìm nhân viên thuộc section hiện tại (ví dụ: `MOLDING`). 
                  Nếu check, hệ thống sẽ tìm trong toàn bộ danh sách Users.
                </li>
              </ul>
            </details>

            <details className="text-sm p-2 border rounded bg-gray-50">
              <summary className="cursor-pointer font-medium">Bước 2: Áp dụng Template</summary>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Chọn Ngày, Ca, Máy làm việc, Giờ làm, Giờ dừng, Sản lượng/OE, Phế, và Tuân thủ.</li>
                <li>Hệ thống sẽ hiển thị điểm KPI (P, Q, Total) dự kiến cho các thông số này.</li>
                <li>Nhấn "Tạo danh sách Review" để chuyển sang bước 3.</li>
              </ul>
            </details>

            <details className="text-sm p-2 border rounded bg-gray-50">
              <summary className="cursor-pointer font-medium">Bước 3: Review và Lưu</summary>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Một bảng chi tiết hiện ra, liệt kê tất cả nhân viên bạn đã chọn ở Bước 1.</li>
                <li>Bạn có thể chỉnh sửa lại thông số (ví dụ: Sản lượng, Phế) cho từng nhân viên nếu cần.</li>
                <li>Hệ thống sẽ tự động tính lại điểm KPI cho dòng đó.</li>
                <li>Chọn các dòng bạn muốn lưu (mặc định chọn tất cả).</li>
                <li>Nhấn <span className="font-semibold">"Lưu đã chọn"</span> để lưu dữ liệu.</li>
              </ul>
            </details>
          </div>
        </div>

        <h2 className="text-xl font-semibold border-b pb-2">II. Chức Năng Xét Duyệt & Quản Lý</h2>
        
        {/* Xét duyệt KPI */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">1. Xét duyệt KPI (Pending)</h3>
          <p>Màn hình cho phép Người duyệt phê duyệt hoặc từ chối các đơn KPI đang chờ. <span className="font-medium text-red-600">(Cần Mật khẩu để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Bộ lọc:</span> Lọc theo MSNV người duyệt, khoảng ngày.</li>
            <li><span className="font-semibold">Thao tác:</span> Duyệt từng dòng, Từ chối từng dòng (cần ghi chú lý do), Duyệt hàng loạt các dòng đã chọn, hoặc Duyệt TẤT CẢ các đơn đang chờ theo bộ lọc hiện tại.</li>
            <li><span className="font-semibold text-green-700">Chìa khóa vạn năng (Molding):</span> Nếu người duyệt là `03892` (Molding) và nhập đúng mật khẩu phụ, có thể xem/duyệt tất cả đơn pending của Molding.</li>
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
            <li><span className="font-semibold">Xuất dữ liệu:</span> Cho phép xuất báo cáo chi tiết và danh sách ngày thiếu KPI ra file XLSX.</li>
            <li><span className="font-semibold">Phân tích:</span> Biểu đồ điểm ngày theo nhân viên, điểm trung bình baseline và Top 5 nhân viên.</li>
          </ul>
        </div>
        
        {/* Quản lý User */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">2. Quản lý User</h3>
          <p>Quản lý danh sách MSNV, Họ tên, Section, Role và Người duyệt phụ trách. <span className="font-medium text-red-600">(Cần Mật khẩu Admin để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li><span className="font-semibold">Nhập liệu:</span> Thêm/sửa từng dòng, Import/Upsert hàng loạt từ file Excel, hoặc Xuất toàn bộ User ra Excel.</li>
            <li><span className="font-semibold">Phân quyền:</span> Gán vai trò (worker, approver, admin).</li>
            <li><span className="font-semibold">Section:</span> Quản lý section cho từng nhân viên (ảnh hưởng đến bộ lọc của "Nhập KPI Nhanh").</li>
          </ul>
        </div>
        
        {/* Rules điểm SX */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">3. Rules điểm Sản xuất (P)</h3>
          <p>Cấu hình công thức tính điểm Sản lượng (P-score) dựa trên ngưỡng %OE hoặc Tỷ lệ năng suất/giờ (cho các section Hybrid). <span className="font-medium text-red-600">(Cần Mật khẩu Admin để đăng nhập)</span></p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li>Hỗ trợ cấu hình riêng cho từng Section (Molding, Leanline DC, Lamination...).</li>
            <li>Hỗ trợ nhập/xuất (Import/Export) các rule bằng file Excel.</li>
            <li>Cung cấp bộ test nhanh để kiểm tra điểm P-score theo %OE / Tỷ lệ NS.</li>
          </ul>
        </div>

        {/* Rules điểm Q */}
        <div className="border p-4 rounded-lg bg-white space-y-2">
          <h3 className="font-bold text-lg">4. Xem Rule điểm Chất lượng (Q)</h3>
          <p>Trang tra cứu (chỉ xem) quy tắc tính điểm Q-score dựa trên số phế.</p>
          <ul className="list-disc list-inside ml-4 text-sm space-y-1">
            <li>0 phế: 10 điểm</li>
            <li>&lt;= 2 phế: 8 điểm</li>
            <li>&lt;= 4 phế: 6 điểm</li>
            <li>&lt;= 6 phế: 4 điểm</li>
            <li>Trên 6 phế: 0 điểm</li>
          </ul>
          <p className="text-xs text-gray-500">
            * Để thay đổi rule này, bạn cần liên hệ người phát triển để chỉnh sửa code (hiện tại đang code cứng trong file 
            <Link to="/view-rules-quality" className="text-blue-600 hover:underline"> ViewRulesQuality.jsx </Link> 
            và các file `EntryPage.jsx`, `EntryPageMolding.jsx`, `QuickEntry.jsx`...).
          </p>
        </div>
      </div>
    </div>
  );
}