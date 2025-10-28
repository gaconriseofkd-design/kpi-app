// src/App.jsx
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import { KpiSectionProvider, useKpiSection } from "./context/KpiSectionContext";
import SectionGate from "./pages/SectionGate";


import EntryPage from "./pages/EntryPage";
import EntryPageMolding from "./pages/EntryPageMolding";
import QuickEntry from "./pages/QuickEntry";
import Pending from "./pages/Pending";
import ApprovePage from "./pages/ApprovePage";
import AdminPage from "./pages/AdminPage";
import ReportPage from "./pages/ReportPage";
import RulesPage from "./pages/RulesPage";
import HelpPage from "./pages/HelpPage";
import ViewRulesQuality from "./pages/ViewRulesQuality"; // <-- 1. IMPORT TRANG MỚI

function Shell() {
  const { section, clearSection, SECTIONS } = useKpiSection();
  const label = SECTIONS.find(s => s.key === section)?.label || section;

  if (!section) return <SectionGate />;

  // Chọn EntryPage theo section
  const EntryComponent = section === "MOLDING" ? EntryPageMolding : EntryPage;

  return (
    <>
      <nav className="p-3 flex items-center gap-4 border-b bg-gray-50">
        <NavLink
          to="/"
          className="font-bold text-lg text-indigo-700"
        >
          APP KPI
        </NavLink>

        {[ // <-- 2. THÊM LINK VÀO NAV BAR
          { to: "/entry", label: "Nhập KPI" },
          { to: "/quick", label: "Nhập KPI nhanh" },
          { to: "/pending", label: "Xét duyệt KPI" },
          { to: "/approve", label: "Tra cứu đơn KPI" },
          { to: "/report", label: "Báo cáo" },
          { to: "/admin", label: "Quản lý User" },
          { to: "/rules", label: "Rules điểm SX" },
          { to: "/view-rules-quality", label: "Xem Rule (Q)" }, // <-- Dòng mới
          { to: "/help", label: "Hướng dẫn" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-1 rounded-md transition-colors duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "text-gray-700 hover:bg-indigo-100 hover:text-indigo-700"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded bg-indigo-50 border text-indigo-700">
            {label}
          </span>
          <button className="px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 font-medium transition" onClick={clearSection}>
            Đổi section
          </button>
        </div>
      </nav>


      <Routes> {/* <-- 3. THÊM ROUTE MỚI */}
        <Route path="/" element={<EntryComponent />} />
        <Route path="/entry" element={<EntryComponent />} />
        <Route path="/quick" element={<QuickEntry />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/approve" element={<ApprovePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/view-rules-quality" element={<ViewRulesQuality />} /> {/* <-- Dòng mới */}
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <KpiSectionProvider>
        <Shell />
      </KpiSectionProvider>
    </BrowserRouter>
  );
}