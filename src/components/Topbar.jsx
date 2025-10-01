export default function Topbar() {
  return (
    <div className="w-full bg-white border-b shadow px-4 py-3 flex items-center">
      <h2 className="font-bold">KPI Worker System</h2>

      <div className="ml-auto flex items-center gap-3">
        {/* Role hiển thị giả lập, sau này kết nối state/DB */}
        <span className="text-sm text-neutral-600">MSNV: W001</span>
        <span className="px-2 py-1 rounded bg-neutral-100 border text-xs">
          Role: worker
        </span>
      </div>
    </div>
  );
}
