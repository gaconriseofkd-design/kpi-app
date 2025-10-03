// src/App.jsx
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

// Các trang hiện có
import EntryPage from "./pages/EntryPage";
import QuickEntry from "./pages/QuickEntry";      // 👈 Trang mới
import Pending from "./pages/Pending";
import ApprovePage from "./pages/ApprovePage";
import AdminPage from "./pages/AdminPage";
import ReportPage from "./pages/ReportPage";
import RulesPage from "./pages/RulesPage";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded hover:bg-gray-100 ${isActive ? "font-semibold text-blue-600" : "text-gray-700"}`
      }
    >
      {children}
    </NavLink>
    
  );
}

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top menu */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="text-lg font-bold mr-3">APP KPI</div>
          <nav className="flex items-center gap-1">
            <NavItem to="/entry">Nhập KPI</NavItem>
            <NavItem to="/quick">Nhập KPI nhanh</NavItem> {/* 👈 Thêm vào menu */}
            <NavItem to="/pending">Chờ duyệt</NavItem>
            <NavItem to="/approve">Xét duyệt</NavItem>
            <NavItem to="/report">Báo cáo KPI</NavItem> {/* 👈 thêm */}
            <NavItem to="/admin">Quản lý User</NavItem>
            <NavItem to="/rules">Rules điểm SX</NavItem>
          </nav>
        </div>
      </header>

      {/* Nội dung */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/entry" replace />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/quick" element={<QuickEntry />} />     {/* 👈 Route mới */}
          <Route path="/pending" element={<Pending />} />
          <Route path="/approve" element={<ApprovePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/report" element={<ReportPage />} /> {/* 👈 thêm */}
          <Route path="*" element={<div>404 - Không tìm thấy trang</div>} />
          <Route path="/rules" element={<RulesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
