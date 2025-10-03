import { createContext, useContext, useEffect, useState } from "react";

export const SECTIONS = [
  { key: "LEANLINE_DC",      label: "Leanline DC" },
  { key: "LEANLINE_MOLDED",  label: "Leanline Molded" },
  { key: "MOLDING",          label: "Molding" },
  { key: "LAMINATION",              label: "LAMINATION" },
  { key: "PREFITTING",              label: "PREFITTING" },
  { key: "TÁCH",              label: "TÁCH" },
  { key: "BÀO",              label: "BÀO" },
];

const Ctx = createContext(null);

export function KpiSectionProvider({ children }) {
  const [section, setSection] = useState(() => localStorage.getItem("kpi_section") || "");
  useEffect(() => { if (section) localStorage.setItem("kpi_section", section); }, [section]);
  function clearSection() { localStorage.removeItem("kpi_section"); setSection(""); }

  return (
    <Ctx.Provider value={{ section, setSection, clearSection, SECTIONS }}>
      {children}
    </Ctx.Provider>
  );
}
export const useKpiSection = () => useContext(Ctx);
