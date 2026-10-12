import React from "react";
import { 
  Printer, 
  X, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Building2 
} from "lucide-react";
import { 
  ScheduleScenario, 
  ScenarioCurriculumMatrix, 
  ScenarioSchedule, 
  Class, 
  Teacher, 
  LessonPeriod, 
  ScenarioConflict 
} from "../types";

interface Props {
  scenario: ScheduleScenario;
  curriculums: ScenarioCurriculumMatrix[];
  schedules: ScenarioSchedule[];
  classes: Class[];
  teachers: Teacher[];
  periods: LessonPeriod[];
  conflicts: ScenarioConflict[];
  onClose: () => void;
}

export const ScenarioPrintModal: React.FC<Props> = ({
  scenario,
  curriculums,
  schedules,
  classes,
  teachers,
  periods,
  conflicts,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);
  const totalVii = activeCurriculums.reduce((s, c) => s + (c.jp_vii || 0), 0);
  const totalViii = activeCurriculums.reduce((s, c) => s + (c.jp_viii || 0), 0);
  const totalIx = activeCurriculums.reduce((s, c) => s + (c.jp_ix || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Top Floating Action Bar (Hidden during Print) */}
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xl mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-slate-800 dark:text-white text-sm">
            Pratinjau Bahan Rapat & Konsultasi Kurikulum
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Cetak / Simpan PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 print:shadow-none print:p-2 print:max-w-none print:w-full print:rounded-none relative overflow-hidden">
        {/* BIG WATERMARK */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none rotate-[-30deg]">
          <span className="text-6xl sm:text-7xl font-black uppercase text-center tracking-widest leading-relaxed">
            DOKUMEN RANCANGAN<br />BUKAN JADWAL OPERASIONAL
          </span>
        </div>

        {/* Top Warning Banner */}
        <div className="border-2 border-dashed border-amber-400 bg-amber-50/80 rounded-xl p-3 text-center mb-6">
          <span className="text-xs font-black uppercase tracking-wider text-amber-900">
            ⚠️ PERINGATAN: DOKUMEN RANCANGAN — BUKAN JADWAL OPERASIONAL RESMI
          </span>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Dokumen ini dicetak khusus untuk bahan rapat, diskusi, dan konsultasi perencanaan struktur kurikulum & alokasi jadwal.
          </p>
        </div>

        {/* Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              SIMAK SMP ALKARIM RASYID
            </h1>
            <h2 className="text-sm font-semibold text-slate-700">
              Jadwal Bayangan: Simulasi Perencanaan Kurikulum dan Jadwal
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tahun Ajaran: {scenario.academicYearName} • {scenario.semesterName}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-bold uppercase px-2.5 py-1 rounded bg-slate-900 text-white mb-1">
              STATUS: {scenario.status}
            </span>
            <p className="text-[11px] text-slate-500">
              Snapshot: {new Date(scenario.sourceSnapshotMeta.snapshotAt).toLocaleDateString("id-ID")}
            </p>
            <p className="text-[11px] text-slate-500">
              Penyusun: {scenario.createdByName}
            </p>
          </div>
        </div>

        {/* Scenario Overview */}
        <div className="mb-6 space-y-2">
          <h3 className="text-base font-bold text-slate-900">
            Nama Rancangan: {scenario.name}
          </h3>
          {scenario.description && (
            <p className="text-xs text-slate-600 italic">
              Deskripsi / Tujuan: {scenario.description}
            </p>
          )}
          {scenario.consultationNotes && (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <strong className="block text-slate-700 mb-0.5">Catatan Bahan Konsultasi:</strong>
              <p className="text-slate-600">{scenario.consultationNotes}</p>
            </div>
          )}
        </div>

        {/* KPI Totals */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 border rounded-lg bg-slate-50 text-center">
            <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas VII</span>
            <span className="text-xl font-bold">{totalVii} JP</span>
            <span className="text-[10px] text-slate-500 block">per pekan</span>
          </div>
          <div className="p-3 border rounded-lg bg-slate-50 text-center">
            <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas VIII</span>
            <span className="text-xl font-bold">{totalViii} JP</span>
            <span className="text-[10px] text-slate-500 block">per pekan</span>
          </div>
          <div className="p-3 border rounded-lg bg-slate-50 text-center">
            <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas IX</span>
            <span className="text-xl font-bold">{totalIx} JP</span>
            <span className="text-[10px] text-slate-500 block">per pekan</span>
          </div>
        </div>

        {/* Curriculum Matrix Summary Table */}
        <div className="mb-8">
          <h4 className="font-bold text-sm uppercase tracking-wider text-slate-800 mb-2">
            I. Struktur Kurikulum & Distribusi Jam Pelajaran (JP)
          </h4>
          <table className="w-full text-xs border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-8">No</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Mata Pelajaran</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-12">Kel.</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-16">VII</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-16">VIII</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-16">IX</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-16">Total</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Status di Rancangan</th>
              </tr>
            </thead>
            <tbody>
              {curriculums.map((item, idx) => {
                const totalItem = (item.jp_vii || 0) + (item.jp_viii || 0) + (item.jp_ix || 0);
                return (
                  <tr key={item.id} className={!item.isActiveInScenario ? "opacity-50 line-through" : ""}>
                    <td className="border border-slate-300 py-1 px-2 text-center">{idx + 1}</td>
                    <td className="border border-slate-300 py-1 px-2 font-medium">
                      {item.subjectName} {item.isCustomSubject && "(Mapel Baru)"}
                    </td>
                    <td className="border border-slate-300 py-1 px-2 text-center">{item.subjectGroup}</td>
                    <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_vii}</td>
                    <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_viii}</td>
                    <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_ix}</td>
                    <td className="border border-slate-300 py-1 px-2 text-center font-bold">{totalItem}</td>
                    <td className="border border-slate-300 py-1 px-2">
                      {item.isCustomSubject ? "Ditambahkan Baru" : item.isActiveInScenario ? "Aktif" : "Dinonaktifkan"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Validation & Conflict Notes */}
        <div className="mb-8">
          <h4 className="font-bold text-sm uppercase tracking-wider text-slate-800 mb-2">
            II. Catatan Hasil Analisis & Konflik Jadwal
          </h4>
          {conflicts.length === 0 ? (
            <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200">
              ✅ Analisis Validasi: Rancangan jadwal tidak memiliki tabrakan guru maupun kelas. Distribusi JP terpenuhi sesuai matriks.
            </p>
          ) : (
            <div className="space-y-1.5">
              {conflicts.map((cf, idx) => (
                <div key={idx} className="p-2 border border-slate-200 bg-slate-50 text-xs rounded">
                  <strong>• {cf.title}</strong>: {cf.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signature Box */}
        <div className="mt-12 pt-4 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <p className="font-semibold text-slate-700">Wakakur / Penyusun,</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
          </div>
        </div>
      </div>
    </div>
  );
};
