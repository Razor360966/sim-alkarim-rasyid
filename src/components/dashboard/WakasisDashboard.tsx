import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Student } from "../../types";
import { executiveDashboardService, StudentViolation, StudentReward } from "../../services/executiveDashboard.service";
import { studentService } from "../../services/studentService";
import { classService } from "../../services/classService";
import { 
  ShieldAlert, 
  Award, 
  Plus, 
  Trash2, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Calendar,
  Search,
  Filter,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const WakasisDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeSubTab, setActiveSubTab] = React.useState<"overview" | "violations" | "rewards">("overview");

  // Form States
  const [showViolForm, setShowViolForm] = React.useState(false);
  const [showRewForm, setShowRewForm] = React.useState(false);
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [violType, setViolType] = React.useState<"Ringan" | "Sedang" | "Berat">("Ringan");
  const [violDesc, setViolDesc] = React.useState("");
  const [violPoints, setViolPoints] = React.useState(5);
  const [rewType, setRewType] = React.useState<"Akademik" | "Akhlak" | "Tahfidz">("Tahfidz");
  const [rewDesc, setRewDesc] = React.useState("");
  const [rewPoints, setRewPoints] = React.useState(10);

  // Queries
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: studentService.getStudents
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  const { data: violations = [], refetch: refetchViolations } = useQuery<StudentViolation[]>({
    queryKey: ["violations"],
    queryFn: executiveDashboardService.getViolations
  });

  const { data: rewards = [], refetch: refetchRewards } = useQuery<StudentReward[]>({
    queryKey: ["rewards"],
    queryFn: executiveDashboardService.getRewards
  });

  // Mutations
  const violationMutation = useMutation({
    mutationFn: executiveDashboardService.addViolation,
    onSuccess: () => {
      refetchViolations();
      setShowViolForm(false);
      resetViolForm();
    }
  });

  const rewardMutation = useMutation({
    mutationFn: executiveDashboardService.addReward,
    onSuccess: () => {
      refetchRewards();
      setShowRewForm(false);
      resetRewForm();
    }
  });

  const deleteViolMutation = useMutation({
    mutationFn: executiveDashboardService.deleteViolation,
    onSuccess: () => refetchViolations()
  });

  const deleteRewMutation = useMutation({
    mutationFn: executiveDashboardService.deleteReward,
    onSuccess: () => refetchRewards()
  });

  const resetViolForm = () => {
    setSelectedStudentId("");
    setViolType("Ringan");
    setViolDesc("");
    setViolPoints(5);
  };

  const resetRewForm = () => {
    setSelectedStudentId("");
    setRewType("Tahfidz");
    setRewDesc("");
    setRewPoints(10);
  };

  const handleAddViolation = (e: React.FormEvent) => {
    e.preventDefault();
    const stud = students.find(s => s.id === selectedStudentId);
    if (!stud) return;

    violationMutation.mutate({
      studentId: stud.id,
      studentName: stud.name,
      className: stud.className || "Tanpa Kelas",
      violationType: violType,
      description: violDesc,
      points: Number(violPoints),
      date: new Date().toISOString().split("T")[0]
    });
  };

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    const stud = students.find(s => s.id === selectedStudentId);
    if (!stud) return;

    rewardMutation.mutate({
      studentId: stud.id,
      studentName: stud.name,
      className: stud.className || "Tanpa Kelas",
      rewardType: rewType,
      description: rewDesc,
      points: Number(rewPoints),
      date: new Date().toISOString().split("T")[0]
    });
  };

  // Memoized Stats Calculations
  const stats = React.useMemo(() => {
    const totalViolPoints = violations.reduce((sum, v) => sum + v.points, 0);
    const totalRewPoints = rewards.reduce((sum, r) => sum + r.points, 0);

    const violBreakdown = { Ringan: 0, Sedang: 0, Berat: 0 };
    violations.forEach(v => {
      if (v.violationType === "Ringan") violBreakdown.Ringan++;
      else if (v.violationType === "Sedang") violBreakdown.Sedang++;
      else if (v.violationType === "Berat") violBreakdown.Berat++;
    });

    const rewBreakdown = { Akademik: 0, Akhlak: 0, Tahfidz: 0 };
    rewards.forEach(r => {
      if (r.rewardType === "Akademik") rewBreakdown.Akademik++;
      else if (r.rewardType === "Akhlak") rewBreakdown.Akhlak++;
      else if (r.rewardType === "Tahfidz") rewBreakdown.Tahfidz++;
    });

    // Student Leaderboard (Rewards)
    const studRewardsMap: Record<string, { name: string; class: string; points: number }> = {};
    rewards.forEach(r => {
      if (!studRewardsMap[r.studentId]) {
        studRewardsMap[r.studentId] = { name: r.studentName, class: r.className, points: 0 };
      }
      studRewardsMap[r.studentId].points += r.points;
    });
    const topRewards = Object.values(studRewardsMap)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // Student Risk Board (Violations)
    const studViolMap: Record<string, { name: string; class: string; points: number }> = {};
    violations.forEach(v => {
      if (!studViolMap[v.studentId]) {
        studViolMap[v.studentId] = { name: v.studentName, class: v.className, points: 0 };
      }
      studViolMap[v.studentId].points += v.points;
    });
    const topViolations = Object.values(studViolMap)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    return {
      totalViolations: violations.length,
      totalRewards: rewards.length,
      totalViolPoints,
      totalRewPoints,
      violData: [
        { name: "Ringan", value: violBreakdown.Ringan, color: "#eab308" },
        { name: "Sedang", value: violBreakdown.Sedang, color: "#f97316" },
        { name: "Berat", value: violBreakdown.Berat, color: "#ef4444" }
      ].filter(item => item.value > 0),
      rewData: [
        { name: "Tahfidz", value: rewBreakdown.Tahfidz },
        { name: "Akhlak Mulia", value: rewBreakdown.Akhlak },
        { name: "Akademik", value: rewBreakdown.Akademik }
      ],
      topRewards,
      topViolations
    };
  }, [violations, rewards]);

  const filteredViolations = violations.filter(v => 
    v.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRewards = rewards.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Dashboard Bidang Kesiswaan (Disiplin & Prestasi)
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Pantau tingkat ketertiban, mutabaah akhlak, pelanggaran, dan rekor prestasi santri secara live.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowViolForm(true)}
            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-3.5 py-2 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Log Pelanggaran
          </button>
          <button
            onClick={() => setShowRewForm(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-3.5 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Catat Prestasi
          </button>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold">
            <ShieldAlert className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Kasus Pelanggaran</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.totalViolations} Kasus</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
            <AlertCircle className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Akumulasi Poin Pelanggaran</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.totalViolPoints} Poin</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
            <Award className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rekor Prestasi</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.totalRewards} Piagam</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
          <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            <TrendingUp className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Akumulasi Poin Apresiasi</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.totalRewPoints} Poin</h3>
          </div>
        </div>
      </div>

      {/* Sub Tabs Toggle */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "overview"
              ? "bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-white"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Ringkasan Mutu Disiplin
        </button>
        <button
          onClick={() => setActiveSubTab("violations")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "violations"
              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Buku Pelanggaran Santri
        </button>
        <button
          onClick={() => setActiveSubTab("rewards")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "rewards"
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-250"
          }`}
        >
          Buku Prestasi & Karakter
        </button>
      </div>

      {/* RENDER CONTENT BY SUB-TAB */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Charts block */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Persentase Tingkat Pelanggaran Santri</h3>
              <p className="text-xs text-slate-400 mt-0.5">Klasifikasi kasus kedisiplinan yang terjadi di asrama & sekolah</p>
            </div>

            {stats.violData.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic flex-1 flex items-center justify-center">
                Belum ada data kasus pelanggaran tercatat. Alhamdulillah asrama aman!
              </div>
            ) : (
              <div className="flex-1 min-h-[220px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.violData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.violData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-w-44 shrink-0">
                  {stats.violData.map((v, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-450">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                      <span>{v.name}: <strong>{v.value} Kasus</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reward Categories distribution chart */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-4">Grafik Sebaran Prestasi Santri</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.rewData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard blocks */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider text-rose-600 flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" /> Santri Skor Pelanggaran Tertinggi
              </h3>
            </div>
            {stats.topViolations.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">Bersih dari pelanggaran.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.topViolations.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/30 dark:bg-rose-950/5 border border-rose-100/35 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{v.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{v.class}</div>
                    </div>
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/30">
                      {v.points} Poin
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                <Award className="h-4 w-4" /> Santri Skor Prestasi Tertinggi
              </h3>
            </div>
            {stats.topRewards.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">Belum ada prestasi tercatat.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.topRewards.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/30 dark:bg-emerald-950/5 border border-emerald-100/35 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{r.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{r.class}</div>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                      {r.points} Poin
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extracurriculars Board */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider text-indigo-600 mb-4 flex items-center gap-1">
              <Users className="h-4 w-4" /> Partisipasi Ekskul Pesantren
            </h3>
            <div className="space-y-3">
              {[
                { name: "Pramuka Boarding", count: 120, status: "Wajib", color: "bg-blue-500" },
                { name: "Seni Kaligrafi Islam", count: 42, status: "Pilihan", color: "bg-emerald-500" },
                { name: "Thibbun Nabawi (Kesehatan)", count: 35, status: "Pilihan", color: "bg-amber-500" },
                { name: "Tapak Suci (Bela Diri)", count: 68, status: "Pilihan", color: "bg-indigo-500" }
              ].map((eks, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-zinc-350">
                    <span>{eks.name} <span className="text-[10px] text-slate-400">({eks.status})</span></span>
                    <span>{eks.count} Santri</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                    <div className={`h-full ${eks.color}`} style={{ width: `${(eks.count / 150) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "violations" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Buku Register Kasus Pelanggaran</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama santri / kasus..."
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
                  <th className="p-3 font-bold text-slate-500">Nama Santri</th>
                  <th className="p-3 font-bold text-slate-500">Kelas</th>
                  <th className="p-3 font-bold text-slate-500">Tingkat</th>
                  <th className="p-3 font-bold text-slate-500">Deskripsi Kasus</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Poin Bobot</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {filteredViolations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data kasus pelanggaran ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredViolations.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-all">
                      <td className="p-3 font-mono font-medium text-slate-400">{v.date}</td>
                      <td className="p-3 font-bold text-slate-700 dark:text-zinc-200">{v.studentName}</td>
                      <td className="p-3 text-slate-500">{v.className}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.violationType === "Berat" 
                            ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" 
                            : v.violationType === "Sedang"
                            ? "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                            : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400"
                        }`}>
                          {v.violationType}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{v.description}</td>
                      <td className="p-3 text-center font-bold text-rose-600 font-mono">{v.points}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm("Apakah Anda yakin ingin menghapus catatan pelanggaran ini?")) {
                              deleteViolMutation.mutate(v.id);
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

      {activeSubTab === "rewards" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Buku Register Penghargaan & Akhlak Santri</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama santri / prestasi..."
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
                  <th className="p-3 font-bold text-slate-500">Nama Santri</th>
                  <th className="p-3 font-bold text-slate-500">Kelas</th>
                  <th className="p-3 font-bold text-slate-500">Kategori</th>
                  <th className="p-3 font-bold text-slate-500">Deskripsi Prestasi</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Poin Bobot</th>
                  <th className="p-3 font-bold text-slate-500 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {filteredRewards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data penghargaan prestasi ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredRewards.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-all">
                      <td className="p-3 font-mono font-medium text-slate-400">{r.date}</td>
                      <td className="p-3 font-bold text-slate-700 dark:text-zinc-200">{r.studentName}</td>
                      <td className="p-3 text-slate-500">{r.className}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                          {r.rewardType}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{r.description}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 font-mono">{r.points}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm("Apakah Anda yakin ingin menghapus catatan prestasi ini?")) {
                              deleteRewMutation.mutate(r.id);
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

      {/* POPUP MODAL: LOG VIOLATION */}
      {showViolForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl max-w-md w-full border border-slate-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-500" /> Log Pelanggaran Santri
              </h3>
              <button
                onClick={() => setShowViolForm(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddViolation} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Pilih Santri</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  required
                >
                  <option value="">-- Pilih Santri --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Kategori</label>
                  <select
                    value={violType}
                    onChange={(e) => setViolType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  >
                    <option value="Ringan">Ringan</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Berat">Berat</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Poin Pelanggaran</label>
                  <input
                    type="number"
                    value={violPoints}
                    onChange={(e) => setViolPoints(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Deskripsi Kasus & Tindakan</label>
                <textarea
                  value={violDesc}
                  onChange={(e) => setViolDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 h-20"
                  placeholder="Contoh: Terlambat mengikuti jamaah shalat subuh 3x berturut-turut..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowViolForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={violationMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {violationMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: RECORD REWARD */}
      {showRewForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl max-w-md w-full border border-slate-150 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-500" /> Catat Penghargaan & Akhlak Mulia
              </h3>
              <button
                onClick={() => setShowRewForm(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddReward} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Pilih Santri</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  required
                >
                  <option value="">-- Pilih Santri --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Kategori Prestasi</label>
                  <select
                    value={rewType}
                    onChange={(e) => setRewType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                  >
                    <option value="Tahfidz">Tahfidz (Hafalan)</option>
                    <option value="Akhlak">Akhlak Mulia / Kedisiplinan</option>
                    <option value="Akademik">Akademik & Minat Bakat</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500">Poin Apresiasi</label>
                  <input
                    type="number"
                    value={rewPoints}
                    onChange={(e) => setRewPoints(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500">Deskripsi Penghargaan</label>
                <textarea
                  value={rewDesc}
                  onChange={(e) => setRewDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 h-20"
                  placeholder="Contoh: Menjuarai lomba pidato bahasa Arab atau menyelesaikan hafalan Surah Al-Waqi'ah..."
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRewForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={rewardMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {rewardMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
