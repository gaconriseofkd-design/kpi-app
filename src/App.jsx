// src/App.jsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { KpiSectionProvider, useKpiSection } from "./context/KpiSectionContext";
import SectionGate from "./pages/SectionGate";

import EntryPage from "./pages/EntryPage";
import EntryPageMolding from "./pages/EntryPageMolding";   // <-- thêm dòng này
import QuickEntry from "./pages/QuickEntry";
import Pending from "./pages/Pending";
import ApprovePage from "./pages/ApprovePage";
import AdminPage from "./pages/AdminPage";
import ReportPage from "./pages/ReportPage";
import RulesPage from "./pages/RulesPage";

function Shell() {
  const { section, clearSection, SECTIONS } = useKpiSection();
  const label = SECTIONS.find(s => s.key === section)?.label || section;

  if (!section) return <SectionGate />;

  // Chọn EntryPage theo section
  const EntryComponent = section === "MOLDING" ? EntryPageMolding : EntryPage;

  return (
    <>
      <nav className="p-3 flex items-center gap-3 border-b">
        <Link to="/" className="font-semibold">APP KPI</Link>
        <Link to="/entry">Nhập KPI</Link>
        <Link to="/quick">Nhập KPI nhanh</Link>
        <Link to="/pending">Xét duyệt KPI</Link>
        <Link to="/approve">Tra cứu đơn KPI</Link>
        <Link to="/report">Báo cáo</Link>
        <Link to="/admin">Quản lý User</Link>
        <Link to="/rules">Rules điểm SX</Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded bg-slate-100">{label}</span>
          <button className="btn" onClick={clearSection}>Đổi section</button>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<EntryComponent />} />
        <Route path="/entry" element={<EntryComponent />} />
        <Route path="/quick" element={<QuickEntry />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/approve" element={<ApprovePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/rules" element={<RulesPage />} />
      </Routes>
    </>
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
