import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subjectService } from "../services/subjectService";
import { Subject } from "../types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FormInput, FormSelect } from "../components/FormInput";
import { DataTable, Column } from "../components/DataTable";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { BookOpen, Plus, Edit2, Trash2, FileDown, TableProperties } from "lucide-react";

const gradeOptions = [
  { value: "7", label: "VII" },
  { value: "8", label: "VIII" },
  { value: "9", label: "IX" }
] as const;

const subjectSchema = z.object({
  code: z.string().min(2, { message: "Kode mapel minimal 2 karakter" }),
  name: z.string().min(3, { message: "Nama mapel minimal 3 karakter" }),
  group: z.enum(["A", "B", "C"], { message: "Pilih kelompok mata pelajaran" }),
  kkm: z.coerce.number().min(0).max(100, { message: "KKM bernilai 0 - 100" }),
  grades: z.array(z.enum(["7", "8", "9"])).min(1, { message: "Pilih peruntukan kelas" })
});

type SubjectFormValues = any;

const defaultSubjectValues: SubjectFormValues = {
  code: "",
  name: "",
  group: "A",
  kkm: 75,
  grades: ["7", "8", "9"]
};

const normalizeGrades = (subject: Subject): SubjectFormValues["grades"] => {
  if (Array.isArray(subject.grades) && subject.grades.length > 0) {
    return subject.grades;
  }

  if (subject.grade === "Semua") {
    return ["7", "8", "9"];
  }

  if (subject.grade === "7" || subject.grade === "8" || subject.grade === "9") {
    return [subject.grade];
  }

  return ["7", "8", "9"];
};

const formatGrades = (subject: Subject) => {
  const grades = normalizeGrades(subject);
  if (grades.length === 3) return "Semua Tingkat";

  const romanGrades: Record<(typeof grades)[number], string> = {
    "7": "VII",
    "8": "VIII",
    "9": "IX"
  };

  return grades.map((grade) => `Kelas ${romanGrades[grade]}`).join(", ");
};

const GradeCheckboxes: React.FC<{
  register: ReturnType<typeof useForm<any>>["register"];
  error?: string;
}> = ({ register, error }) => (
  <div className="space-y-2">
    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
      Diberikan Untuk Tingkat Kelas <span className="text-rose-500 font-bold">*</span>
    </label>
    <div className="flex flex-wrap gap-3">
      {gradeOptions.map((option) => (
        <label
          key={option.value}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl cursor-pointer"
        >
          <input
            type="checkbox"
            value={option.value}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            {...register("grades")}
          />
          {option.label}
        </label>
      ))}
    </div>
    {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
  </div>
);

export const Subjects: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const createForm = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: defaultSubjectValues
  });

  const editForm = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: defaultSubjectValues
  });

  const createMutation = useMutation({
    mutationFn: subjectService.createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast("Mata Pelajaran berhasil ditambahkan!", "success");
      setIsCreateOpen(false);
      createForm.reset(defaultSubjectValues);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal menambahkan data", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subject> }) =>
      subjectService.updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast("Mata Pelajaran berhasil diperbarui!", "success");
      setIsEditOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal memperbarui data", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: subjectService.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast("Mata Pelajaran berhasil dihapus!", "success");
      setIsDeleteOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal menghapus data", "error");
    }
  });

  const handleCreateOpen = () => {
    createForm.reset(defaultSubjectValues);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (data: SubjectFormValues) => {
    createMutation.mutate(data);
  };

  const handleEditOpen = (subject: Subject) => {
    setSelectedSubject(subject);
    editForm.reset({
      code: subject.code,
      name: subject.name,
      group: subject.group,
      kkm: subject.kkm,
      grades: normalizeGrades(subject)
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (data: SubjectFormValues) => {
    if (selectedSubject) {
      updateMutation.mutate({ id: selectedSubject.id, data });
    }
  };

  const handleDeleteOpen = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedSubject) {
      deleteMutation.mutate(selectedSubject.id);
    }
  };

  const handleExportExcel = () => {
    const formatted = subjects.map((subject) => ({
      "Kode Mapel": subject.code,
      "Nama Mapel": subject.name,
      "Kelompok (Group)":
        subject.group === "A"
          ? "Group A (Wajib)"
          : subject.group === "B"
            ? "Group B (Kepesantrenan)"
            : "Group C (Muatan Lokal)",
      "KKM": subject.kkm,
      "Peruntukan Tingkat": formatGrades(subject)
    }));
    exportToExcel(formatted, "Daftar_Mata_Pelajaran_SMP_Alkarim", "Mata Pelajaran");
    toast("Excel berhasil diunduh!", "success");
  };

  const handleExportPDF = () => {
    const headers = ["Kode", "Nama Mata Pelajaran", "Kelompok", "KKM", "Tingkat"];
    const rows = subjects.map((subject) => [
      subject.code,
      subject.name,
      subject.group === "A" ? "A (Wajib)" : subject.group === "B" ? "B (Kepesantrenan)" : "C (Mulok)",
      String(subject.kkm),
      formatGrades(subject)
    ]);
    exportToPDF("DAFTAR MATA PELAJARAN", headers, rows, "Daftar_Mata_Pelajaran_SMP_Alkarim");
    toast("PDF berhasil diunduh!", "success");
  };

  const columns: Column<Subject>[] = [
    { header: "Kode", accessor: "code", sortable: true },
    { header: "Mata Pelajaran", accessor: "name", sortable: true },
    {
      header: "Kelompok",
      accessor: (item) => {
        const labels = {
          A: "Kelompok A (Wajib)",
          B: "Kelompok B (Kepesantrenan)",
          C: "Kelompok C (Muatan Lokal)"
        };
        const colors = {
          A: "text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400",
          B: "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400",
          C: "text-purple-700 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400"
        };
        return (
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${colors[item.group]}`}>
            {labels[item.group]}
          </span>
        );
      },
      sortable: true,
      sortKey: "group"
    },
    {
      header: "KKM",
      accessor: (item) => <span className="font-mono font-bold text-gray-900 dark:text-white">{item.kkm}</span>,
      sortable: true,
      sortKey: "kkm"
    },
    {
      header: "Kelas Tingkat",
      accessor: (item) => formatGrades(item),
      sortable: false
    }
  ];

  if (isLoading) {
    return <Loading variant="full" text="Memuat daftar mata pelajaran..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-zinc-850 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Mata Pelajaran (Kurikulum)
          </h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Kelola daftar mata pelajaran kurikulum beserta ketuntasan minimal (KKM) sekolah
          </p>
        </div>
        <button
          onClick={handleCreateOpen}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Mata Pelajaran
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs">
        <DataTable
          data={subjects}
          columns={columns}
          rowKey={(subject) => subject.id}
          searchKeys={["code", "name"]}
          searchPlaceholder="Cari berdasarkan kode atau nama mapel..."
          rightHeaderActions={
            <div className="flex items-center gap-1.5 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1 bg-gray-50/50 dark:bg-zinc-900">
              <button
                onClick={handleExportExcel}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke Excel"
              >
                <TableProperties className="h-4 w-4" />
              </button>
              <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-800" />
              <button
                onClick={handleExportPDF}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke PDF"
              >
                <FileDown className="h-4 w-4" />
              </button>
            </div>
          }
          actions={(item) => (
            <>
              <button
                onClick={() => handleEditOpen(item)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Edit data"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteOpen(item)}
                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Hapus data"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />
      </div>

      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Mata Pelajaran Baru"
        size="md"
      >
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Kode Mata Pelajaran"
              placeholder="E.g., MAPEL-IND"
              required
              register={createForm.register("code")}
              error={createForm.formState.errors.code?.message}
            />
            <FormInput
              label="Nama Mata Pelajaran"
              placeholder="E.g., Bahasa Indonesia"
              required
              register={createForm.register("name")}
              error={createForm.formState.errors.name?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Kelompok Mapel"
              options={[
                { value: "A", label: "Kelompok A (Wajib Umum)" },
                { value: "B", label: "Kelompok B (Kepesantrenan)" },
                { value: "C", label: "Kelompok C (Muatan Lokal)" }
              ]}
              required
              register={createForm.register("group")}
              error={createForm.formState.errors.group?.message}
            />
            <FormInput
              label="KKM Kelulusan"
              type="number"
              placeholder="75"
              required
              register={createForm.register("kkm")}
              error={createForm.formState.errors.kkm?.message}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan Mapel"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Mata Pelajaran"
        size="md"
      >
        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Kode Mata Pelajaran"
              placeholder="E.g., MAPEL-IND"
              required
              register={editForm.register("code")}
              error={editForm.formState.errors.code?.message}
            />
            <FormInput
              label="Nama Mata Pelajaran"
              placeholder="E.g., Bahasa Indonesia"
              required
              register={editForm.register("name")}
              error={editForm.formState.errors.name?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Kelompok Mapel"
              options={[
                { value: "A", label: "Kelompok A (Wajib Umum)" },
                { value: "B", label: "Kelompok B (Kepesantrenan)" },
                { value: "C", label: "Kelompok C (Muatan Lokal)" }
              ]}
              required
              register={editForm.register("group")}
              error={editForm.formState.errors.group?.message}
            />
            <FormInput
              label="KKM Kelulusan"
              type="number"
              placeholder="75"
              required
              register={editForm.register("kkm")}
              error={editForm.formState.errors.kkm?.message}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Mata Pelajaran"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
            Apakah Anda yakin ingin menghapus Mata Pelajaran{" "}
            <strong className="text-gray-900 dark:text-white">
              {selectedSubject?.name} ({selectedSubject?.code})
            </strong>
            ? Seluruh data relasi guru pengampu yang terikat dengan mapel ini akan dilepaskan secara permanen.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Mapel"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Subjects;
