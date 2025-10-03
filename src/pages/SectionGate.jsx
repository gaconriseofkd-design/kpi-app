import { useKpiSection } from "../context/KpiSectionContext";

export default function SectionGate() {
  const { section, setSection, SECTIONS } = useKpiSection();
  if (section) return null;  // đã chọn rồi -> cho app chạy tiếp

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <h1 className="text-2xl font-semibold mb-4">Chọn khối (Section) để vào APP KPI</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="p-6 rounded-xl border shadow hover:bg-gray-50 text-left"
            >
              <div className="text-lg font-semibold">{s.label}</div>
              <div className="text-xs text-gray-500">{s.key}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
