import { Link } from "react-router-dom";

export default function HomePage() {
  const cards = [
    { path: "/entry", label: "Nhập KPI", desc: "Nhân viên nhập KPI hàng ngày" },
    { path: "/approve", label: "Xét duyệt KPI", desc: "Người duyệt KPI phê duyệt / trả về" },
    { path: "/pending", label: "Danh sách chờ duyệt", desc: "Xem toàn bộ KPI đang pending" },
    { path: "/report", label: "Báo cáo KPI", desc: "Xem chi tiết KPI theo nhân viên" },
    { path: "/summary", label: "Tổng hợp KPI", desc: "Tổng hợp KPI theo ngày/tháng" },
    { path: "/admin", label: "Quản lý user", desc: "Quản lý danh sách nhân viên và phân quyền" },
  ];

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Link
          key={c.path}
          to={c.path}
          className="p-6 rounded-xl border bg-white shadow hover:shadow-lg transition flex flex-col"
        >
          <div className="text-lg font-semibold">{c.label}</div>
          <div className="text-neutral-500 text-sm mt-1">{c.desc}</div>
        </Link>
      ))}
    </div>
  );
}
