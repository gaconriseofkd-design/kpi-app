// src/App.jsx
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

// Các trang hiện có
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { KpiSectionProvider, useKpiSection } from "./context/KpiSectionContext";
import SectionGate from "./pages/SectionGate";
import EntryPage from "./pages/EntryPage";
import QuickEntry from "./pages/QuickEntry";      // 👈 Trang mới
import Pending from "./pages/Pending";
import ApprovePage from "./pages/ApprovePage";
import AdminPage from "./pages/AdminPage";
import ReportPage from "./pages/ReportPage";
import RulesPage from "./pages/RulesPage";

function Shell() {
  const { section, clearSection, SECTIONS } = useKpiSection();
  const label = SECTIONS.find(s => s.key === section)?.label || section;

  if (!section) return <SectionGate />; // chặn vào app cho tới khi chọn

  return (
    <>
      <nav className="p-3 flex items-center gap-3 border-b">
        <Link to="/" className="font-semibold">APP KPI</Link>
        <Link to="/entry">Nhập KPI</Link>
        <Link to="/quick">Nhập KPI nhanh</Link>
        <Link to="/report">Báo cáo</Link>
        <Link to="/admin">Quản lý User</Link>
        <Link to="/rules">Rules điểm SX</Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded bg-slate-100">{label}</span>
          <button className="btn" onClick={clearSection}>Đổi section</button>
        </div>
      </nav>
      <div>
        <Routes>
          <Route path="/" element={<EntryPage />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/quick" element={<QuickEntry />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Routes>
      </div>
    </>
  );
}


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
    <KpiSectionProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </KpiSectionProvider>
  );
}
