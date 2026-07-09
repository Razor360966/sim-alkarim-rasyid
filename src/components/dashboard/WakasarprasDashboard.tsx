import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { executiveDashboardService, SarprasInventory, SarprasMaintenance } from "../../services/executiveDashboard.service";
import { 
  Building2, 
  Wrench, 
  Plus, 
  Trash2, 
  Activity, 
  DollarSign, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Package
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const WakasarprasDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeSubTab, setActiveSubTab] = React.useState<"overview" | "inventory" | "maintenance">("overview");

  // Form States
  const [showAssetForm, setShowAssetForm] = React.useState(false);
  const [showMaintForm, setShowMaintForm] = React.useState(false);
  
  // Asset Form
  const [assetName, setAssetName] = React.useState("");
  const [assetCat, setAssetCat] = React.useState<"Elektronik" | "Mebel" | "Kitab" | "Fasilitas">("Elektronik");
  const [assetQty, setAssetQty] = React.useState(10);
  const [assetLocation, setAssetLocation] = React.useState("");

  // Maintenance Form
  const [maintItemName, setMaintItemName] = React.useState("");
  const [maintReporter, setMaintReporter] = React.useState("");
  const [maintDesc, setMaintDesc] = React.useState("");

  // Queries
  const { data: inventory = [], refetch: refetchInventory } = useQuery<SarprasInventory[]>({
    queryKey: ["sarpras_inventory"],
    queryFn: executiveDashboardService.getInventory
  });

  const { data: maintenance = [], refetch: refetchMaintenance } = useQuery<SarprasMaintenance[]>({
    queryKey: ["sarpras_maintenance"],
    queryFn: executiveDashboardService.getMaintenance
  });

  // Mutations
  const assetMutation = useMutation({
    mutationFn: executiveDashboardService.addInventory,
    onSuccess: () => {
      refetchInventory();
      setShowAssetForm(false);
      resetAssetForm();
    }
  });

  const maintMutation = useMutation({
    mutationFn: executiveDashboardService.addMaintenance,
    onSuccess: () => {
      refetchMaintenance();
      setShowMaintForm(false);
      resetMaintForm();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, cost }: { id: string; status: any; cost?: number }) => 
      executiveDashboardService.updateMaintenanceStatus(id, status, cost),
    onSuccess: () => {
      refetchMaintenance();
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: executiveDashboardService.deleteInventory,
    onSuccess: () => refetchInventory()
  });

  const resetAssetForm = () => {
    setAssetName("");
    setAssetCat("Elektronik");
    setAssetQty(10);
    setAssetLocation("");
  };

  const resetMaintForm = () => {
    setMaintItemName("");
    setMaintReporter("");
    setMaintDesc("");
  };

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    assetMutation.mutate({
      itemName: assetName,
      category: assetCat,
      quantity: Number(assetQty),
      goodConditionCount: Number(assetQty),
      damagedConditionCount: 0,
      location: assetLocation
    });
  };

  const handleAddMaint = (e: React.FormEvent) => {
    e.preventDefault();
    maintMutation.mutate({
      itemName: maintItemName,
      reporterName: maintReporter,
      issueDescription: maintDesc,
      status: "Dilaporkan",
      cost: 0,
      date: new Date().toISOString().split("T")[0]
    });
  };

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    let nextStatus: "Dilaporkan" | "Sedang Diperbaiki" | "Selesai" = "Sedang Diperbaiki";
    let cost = undefined;

    if (currentStatus === "Dilaporkan") {
      nextStatus = "Sedang Diperbaiki";
    } else if (currentStatus === "Sedang Diperbaiki") {
      nextStatus = "Selesai";
      const userCost = prompt("Masukkan total biaya perbaikan (IDR):", "150000");
      if (userCost !== null) {
        cost = Number(userCost) || 0;
      } else {
        return; // canceled
      }
    }

    updateStatusMutation.mutate({ id, status: nextStatus, cost });
  };

  // Stats computation
  const stats = React.useMemo(() => {
    let totalItems = 0;
    let goodItems = 0;
    let damagedItems = 0;
    let activeMaintCount = 0;
    let totalSpent = 0;

    inventory.forEach(i => {
      totalItems += i.quantity;
      goodItems += i.goodConditionCount;
      damagedItems += i.damagedConditionCount;
    });

    maintenance.forEach(m => {
      if (m.status !== "Selesai") {
        activeMaintCount++;
      }
      totalSpent += m.cost;
    });

    // Chart category distribution
    const catMap = { Elektronik: 0, Mebel: 0, Kitab: 0, Fasilitas: 0 };
    inventory.forEach(i => {
      catMap[i.category] += i.quantity;
    });

    const chartData = [
      { name: "Elektronik", Jumlah: catMap.Elektronik },
      { name: "Mebel/Sofa", Jumlah: catMap.Mebel },
      { name: "Kitab/Buku", Jumlah: catMap.Kitab },
      { name: "Fasilitas Umum", Jumlah: catMap.Fasilitas }
    ];

    return {
      totalAssetTypes: inventory.length,
      totalItems,
      goodItems,
      damagedItems,
      activeMaintCount,
      totalSpent,
      chartData
    };
  }, [inventory, maintenance]);

  const filteredInventory = inventory.filter(i => 
    i.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaintenance = maintenance.filter(m => 
    m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.reporterName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Dashboard Sarpras & Inventaris Aset Pesantren
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Pantau ketersediaan barang, log kerusakan fasilitas pondok, dan pengawasan pemeliharaan secara real-time.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowAssetForm(true)}
            className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-3.5 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Tambah Aset Baru
          </button>
          <button
            onClick={() => setShowMaintForm(true)}
            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-3.5 py-2 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Wrench className="h-4 w-4" /> Laporkan Kerusakan
          </button>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            <Package className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Barang Registrasi</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.totalItems} Unit</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Barang Layak Pakai</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.goodItems} Unit</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold">
            <AlertCircle className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Barang Rusak / Rusak Ringan</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.damagedItems} Unit</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
            <Wrench className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Perbaikan Aktif</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.activeMaintCount} Pekerjaan</h3>
          </div>
        </div>
      </div>

      {/* Sub Tabs Toggle */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "overview"
              ? "bg-slate-100 dark:bg-zinc-800 text-amber-600 dark:text-white"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Evaluasi Kondisi & Anggaran
        </button>
        <button
          onClick={() => setActiveSubTab("inventory")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "inventory"
              ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Master Katalog Inventaris
        </button>
        <button
          onClick={() => setActiveSubTab("maintenance")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "maintenance"
              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Alur Pemeliharaan & Servis
        </button>
      </div>

      {/* RENDER CONTENT BY SUB-TAB */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Asset Category Bar Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Sebaran Jumlah Unit Aset per Kategori</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ringkasan kuantitas barang terdaftar berdasarkan pembagian divisi sarana</p>
            </div>

            <div className="h-[220px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="Jumlah" fill="#d97706" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Maintenance Cost Spent panel */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Akumulasi Realisasi Anggaran Servis</h3>
              <p className="text-xs text-slate-400 mt-0.5">Keseluruhan dana yang dialokasikan dan telah terpakai untuk pemeliharaan sarana prasarana</p>
              
              <div className="p-5 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex flex-col items-center justify-center py-8">
                <DollarSign className="h-10 w-10 text-amber-600 mb-2" />
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Dana Terpakai</span>
                <span className="text-2xl font-black text-slate-800 dark:text-amber-400 mt-1 font-mono">
                  Rp {stats.totalSpent.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed pt-4 border-t mt-4 border-slate-100">
              * Anggaran dihitung secara otomatis berdasarkan penutupan status perbaikan sarana asrama dan kelas.
            </div>
          </div>

          {/* Active / Urgent Maintenance Requests */}
          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <Wrench className="h-4.5 w-4.5 text-amber-600" /> Pipeline Pemeliharaan Fasilitas Mendesak
            </h3>

            {maintenance.filter(m => m.status !== "Selesai").length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
                Alhamdulillah! Tidak ada laporan kerusakan fasilitas asrama/sekolah yang aktif saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maintenance.filter(m => m.status !== "Selesai").map((m) => (
                  <div key={m.id} className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-850 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                          m.status === "Dilaporkan"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100"
                        }`}>
                          {m.status}
                        </span>
                        <span className="text-slate-400 font-mono">{m.date}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white">{m.itemName}</h4>
                      <p className="text-[11px] text-slate-400">Pelapor: <strong>{m.reporterName}</strong></p>
                      <p className="text-xs text-slate-500 italic bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                        "{m.issueDescription}"
                      </p>
                    </div>

                    <button
                      onClick={() => handleUpdateStatus(m.id, m.status)}
                      className="w-full text-center py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      {m.status === "Dilaporkan" ? "Mulai Proses Servis" : "Selesaikan Perbaikan (Log Biaya)"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "inventory" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Register Aset & Inventaris</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama aset / lokasi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-700 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/20">
                  <th className="p-3 font-bold text-slate-500">Nama Barang / Aset</th>
                  <th className="p-3 font-bold text-slate-500">Kategori</th>
                  <th className="p-3 font-bold text-slate-500">Lokasi / Ruangan</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Total Kuantitas</th>
                  <th className="p-3 font-bold text-slate-500 text-center text-emerald-600">Layak Pakai</th>
                  <th className="p-3 font-bold text-slate-500 text-center text-rose-600">Rusak</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data barang inventaris ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-all">
                      <td className="p-3 font-bold text-slate-700 dark:text-zinc-200">{i.itemName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {i.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{i.location}</td>
                      <td className="p-3 text-center font-mono font-bold">{i.quantity} Unit</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-600">{i.goodConditionCount}</td>
                      <td className="p-3 text-center font-mono font-bold text-rose-600">{i.damagedConditionCount}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm("Apakah Anda yakin ingin menghapus aset ini secara permanen dari sistem?")) {
                              deleteAssetMutation.mutate(i.id);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-rose-500 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "maintenance" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Buku Catatan Perbaikan & Biaya Pemeliharaan</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari pelapor / item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-700 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/20">
                  <th className="p-3 font-bold text-slate-500">Tanggal</th>
                  <th className="p-3 font-bold text-slate-500">Barang Rusak</th>
                  <th className="p-3 font-bold text-slate-500">Pelapor</th>
                  <th className="p-3 font-bold text-slate-500">Keterangan Kerusakan</th>
                  <th className="p-3 font-bold text-slate-500">Status</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Biaya Servis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {filteredMaintenance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      Tidak ada rekaman perbaikan pemeliharaan ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-all">
                      <td className="p-3 font-mono font-medium text-slate-400">{m.date}</td>
                      <td className="p-3 font-bold text-slate-700 dark:text-zinc-200">{m.itemName}</td>
                      <td className="p-3 text-slate-500">{m.reporterName}</td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{m.issueDescription}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.status === "Selesai"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : m.status === "Sedang Diperbaiki"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-350">
                        {m.cost > 0 ? `Rp ${m.cost.toLocaleString("id-ID")}` : "Menunggu Selesai / Rp 0"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POPUP MODAL: REGISTER NEW ASSET */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl max-w-md w-full border border-slate-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" /> Registrasi Inventaris Sarpras
              </h3>
              <button
                onClick={() => setShowAssetForm(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Nama Barang / Fasilitas</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  placeholder="Contoh: Meja Guru Jati, AC Daikin, Proyektor, dll..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Kategori</label>
                  <select
                    value={assetCat}
                    onChange={(e) => setAssetCat(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  >
                    <option value="Elektronik">Elektronik</option>
                    <option value="Mebel">Mebel & Kursi</option>
                    <option value="Kitab">Kitab & Buku Paket</option>
                    <option value="Fasilitas">Fasilitas Umum</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Jumlah Unit (Awal)</label>
                  <input
                    type="number"
                    value={assetQty}
                    onChange={(e) => setAssetQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Lokasi Penempatan</label>
                <input
                  type="text"
                  value={assetLocation}
                  onChange={(e) => setAssetLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  placeholder="Contoh: Seluruh Ruang Kelas VII, Kamar Asrama 3A..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAssetForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={assetMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {assetMutation.isPending ? "Mendaftarkan..." : "Daftarkan Aset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: REPORT DAMAGE / NEW MAINTENANCE */}
      {showMaintForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl max-w-md w-full border border-slate-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Wrench className="h-5 w-5 text-rose-500" /> Laporkan Kerusakan Fasilitas
              </h3>
              <button
                onClick={() => setShowMaintForm(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddMaint} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Nama Fasilitas Yang Rusak</label>
                <input
                  type="text"
                  value={maintItemName}
                  onChange={(e) => setMaintItemName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  placeholder="Contoh: AC Kamar 2B, Proyektor Kelas 7A, Engsel Jendela..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Nama Pelapor (Ustadz / Musrif)</label>
                <input
                  type="text"
                  value={maintReporter}
                  onChange={(e) => setMaintReporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  placeholder="Contoh: Ustadz Mansur, Ustadzah Hasanah..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Deskripsi Kerusakan</label>
                <textarea
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 h-20"
                  placeholder="Contoh: AC mengeluarkan air bocor dan suara dengung keras di kamar..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMaintForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={maintMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {maintMutation.isPending ? "Mengirim Laporan..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
