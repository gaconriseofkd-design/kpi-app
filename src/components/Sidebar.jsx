import { Link } from "react-router-dom";

export default function Sidebar() {
  const menus = [
    { path: "/", label: "🏠 Home" },
    { path: "/entry", label: "📝 Nhập KPI" },
    { path: "/approve", label: "✅ Xét duyệt KPI" },
    { path: "/pending", label: "⏳ Chờ duyệt" },
    { path: "/report", label: "📊 Báo cáo KPI" },
    { path: "/summary", label: "📈 Tổng hợp KPI" },
    { path: "/admin", label: "⚙️ Quản lý User" },
  ];

  return (
    <div className="w-56 bg-white border-r shadow h-screen p-4">
      <h1 className="text-lg font-bold mb-6">KPI Worker</h1>
      <nav className="space-y-2">
        {menus.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className="block px-3 py-2 rounded hover:bg-neutral-100"
          >
            {m.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
