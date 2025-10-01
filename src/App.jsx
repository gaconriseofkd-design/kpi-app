import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";

// Pages
import Home from "./pages/HomePage.jsx";
import Entry from "./pages/EntryPage.jsx";
import Approve from "./pages/ApprovePage.jsx";
import Pending from "./pages/Pending.jsx";
import Report from "./pages/Report.jsx";
import Summary from "./pages/Summarypage.jsx";
import Admin from "./pages/AdminPage.jsx";


export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-neutral-100">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex flex-col flex-1">
          {/* Topbar */}
          <Topbar />

          {/* Routes */}
          <main className="flex-1 overflow-y-auto p-4">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/entry" element={<Entry />} />
              <Route path="/approve" element={<Approve />} />
              <Route path="/pending" element={<Pending />} />
              <Route path="/report" element={<Report />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
