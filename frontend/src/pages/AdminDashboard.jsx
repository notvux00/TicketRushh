import { ShieldCheck } from "lucide-react";

function AdminDashboard() {
  return (
    <div className="p-10">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-800">
          Tổng quan hệ thống
        </h1>
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm">
          <ShieldCheck size={18} /> Verified ADMIN Session
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-bold uppercase">
            Total Revenue
          </p>
          <p className="text-3xl font-black text-primary">$12,450</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-bold uppercase">
            Tickets Sold
          </p>
          <p className="text-3xl font-black text-primary">1,204</p>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
