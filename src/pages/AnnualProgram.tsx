import React, { useState, useEffect } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { curriculumPlanningService } from "../services/curriculumPlanning.service";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import type {
  Semester, 
  Class, 
  CurriculumMatrix, 
  AnnualProgram as AnnualProgramData, 
  ProtaTopic, 
  ProtaSubTopic 
} from "../types";
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Upload, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Save, 
  Info,
  AlertTriangle,
  FolderOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";

export const AnnualProgram: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Master Data States
  const [classes, setClasses] = useState<Class[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [curriculumMatrix, setCurriculumMatrix] = useState<CurriculumMatrix[]>([]);

  // Selection States
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");

  // Calculated and Loaded States
  const [prota, setProta] = useState<AnnualProgramData | null>(null);
  const [weeklyJp, setWeeklyJp] = useState<number>(0);
  const [effectiveWeeksYear, setEffectiveWeeksYear] = useState<number>(0);
  const [effectiveJpYear, setEffectiveJpYear] = useState<number>(0);
  const [teacherName, setTeacherName] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");

  // Interactive UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ProtaTopic | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Form States for Modal
  const [topicTitle, setTopicTitle] = useState("");
  const [topicJp, setTopicJp] = useState<number>(0);
  const [topicSemester, setTopicSemester] = useState<"Ganjil" | "Genap" | "Ganjil & Genap">("Ganjil");
  const [topicDescription, setTopicDescription] = useState("");
  const [subTopics, setSubTopics] = useState<ProtaSubTopic[]>([]);

  // Subtopic Inline Adding Form State
  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubJp, setNewSubJp] = useState<number>(0);
  const [newSubDesc, setNewSubDesc] = useState("");

  // Load classes, semesters, matrix
  useEffect(() => {
    setLoading(true);
    Promise.all([
      classService.getClasses(),
      semesterService.getSemesters(),
      curriculumMatrixService.getCurriculumMatrix()
    ])
      .then(([clsList, semList, matrixList]) => {
        const activeCls = clsList.filter(c => c.status === "Aktif" && !c.isDeleted);
        setClasses(activeCls);
        setSemesters(semList);
        setCurriculumMatrix(matrixList);

        // Group unique academic years from semesters
        const yearsMap = new Map<string, string>();
        semList.forEach(s => {
          yearsMap.set(s.academicYearId, s.academicYearName);
        });
        const yearsArray = Array.from(yearsMap.entries()).map(([id, name]) => ({ id, name }));
        setAcademicYears(yearsArray);

        // Select defaults
        const activeSem = semList.find(s => s.isActive);
        if (activeSem) {
          setSelectedAcademicYearId(activeSem.academicYearId);
        } else if (yearsArray.length > 0) {
          setSelectedAcademicYearId(yearsArray[0].id);
        }

        if (activeCls.length > 0) {
          setSelectedClassId(activeCls[0].id);
        }
      })
      .catch((err) => showToast("Gagal memuat master data: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  // Filter offered subjects when selected class changes
  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const gradeLevel = selectedClassObj?.gradeLevel || "VII";

  const allOfferedSubjects = curriculumMatrix.map(m => ({
    id: m.subjectId,
    name: m.subjectName,
    teacherId: m.teacherId,
    teacherName: m.teacherName,
    jp: gradeLevel === "VII" ? m.jp_vii : gradeLevel === "VIII" ? m.jp_viii : m.jp_ix
  })).filter(s => s.jp > 0);

  const currentRole = user?.role?.toLowerCase() || "";
  const isGuru = user?.roles?.includes("guru") || currentRole === "guru";

  const offeredSubjects = isGuru
    ? allOfferedSubjects.filter(s => s.teacherId === user?.teacherId)
    : allOfferedSubjects;

  // Auto-select subject and set details
  useEffect(() => {
    if (offeredSubjects.length > 0) {
      // Keep existing selection if valid
      const isValid = offeredSubjects.some(s => s.id === selectedSubjectId);
      if (!isValid) {
        setSelectedSubjectId(offeredSubjects[0].id);
      }
    } else {
      setSelectedSubjectId("");
    }
  }, [selectedClassId, curriculumMatrix]);

  const selectedSubjectObj = offeredSubjects.find(s => s.id === selectedSubjectId);

  // Load effective weeks and calculate effective JP
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedClassId || !selectedSubjectId) {
      setEffectiveJpYear(0);
      setEffectiveWeeksYear(0);
      setWeeklyJp(0);
      setTeacherName("");
      return;
    }

    setLoading(true);
    // Find semesters for this academic year
    const semsForYear = semesters.filter(s => s.academicYearId === selectedAcademicYearId);
    
    if (semsForYear.length === 0) {
      setLoading(false);
      return;
    }

    // Calculate effective weeks for both semesters of the year
    Promise.all(
      semsForYear.map(sem => 
        academicPlanningService.analyzeEffectiveWeeks(sem.startDate, sem.endDate, sem.academicYearId, sem.id)
      )
    )
      .then((analyses) => {
        const totalWeeks = analyses.reduce((sum, current) => sum + current.effectiveWeeks, 0);
        setEffectiveWeeksYear(totalWeeks);

        const currentWeeklyJp = selectedSubjectObj ? selectedSubjectObj.jp : 0;
        setWeeklyJp(currentWeeklyJp);
        setTeacherName(selectedSubjectObj?.teacherName || "Belum Ditentukan");
        setTeacherId(selectedSubjectObj?.teacherId || "");

        // Calculated effective JP Year
        setEffectiveJpYear(currentWeeklyJp * totalWeeks);
      })
      .catch((err) => showToast("Gagal menganalisis JP Efektif: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [selectedAcademicYearId, selectedClassId, selectedSubjectId, semesters, selectedSubjectId]);

  // Load the annual program (Prota) from Firestore
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedClassId || !selectedSubjectId) {
      setProta(null);
      return;
    }

    curriculumPlanningService.getAnnualProgram(selectedAcademicYearId, selectedClassId, selectedSubjectId)
      .then((data) => {
        if (data) {
          setProta(data);
          // Set initial expanded states
          const expanded: Record<string, boolean> = {};
          data.topics.forEach(t => {
            if (t.subtopics && t.subtopics.length > 0) {
              expanded[t.id] = true;
            }
          });
          setExpandedTopics(expanded);
        } else {
          // Initialize empty Prota structure
          const yearName = academicYears.find(y => y.id === selectedAcademicYearId)?.name || "";
          setProta({
            id: `${selectedAcademicYearId}_${selectedClassId}_${selectedSubjectId}`,
            academicYearId: selectedAcademicYearId,
            academicYearName: yearName,
            classId: selectedClassId,
            className: selectedClassObj?.name || "",
            subjectId: selectedSubjectId,
            subjectName: selectedSubjectObj?.name || "",
            teacherId: selectedSubjectObj?.teacherId || "",
            teacherName: selectedSubjectObj?.teacherName || "",
            effectiveJpYear: 0, // Will be computed or kept up to date
            topics: [],
            createdAt: "",
            updatedAt: "",
            createdBy: "",
            updatedBy: ""
          });
        }
      })
      .catch((err) => showToast("Gagal memuat Program Tahunan: " + err.message, "error"));
  }, [selectedAcademicYearId, selectedClassId, selectedSubjectId]);

  // Calculations for Indicators
  const currentTopics = prota?.topics || [];
  const usedJp = currentTopics.reduce((sum, t) => sum + t.jp, 0);
  const remainingJp = effectiveJpYear - usedJp;
  const progressPercent = effectiveJpYear > 0 ? Math.min(100, (usedJp / effectiveJpYear) * 100) : 0;

  // Sync calculations back to prota object when values update
  useEffect(() => {
    if (prota && effectiveJpYear > 0 && prota.effectiveJpYear !== effectiveJpYear) {
      setProta(prev => prev ? { ...prev, effectiveJpYear } : null);
    }
  }, [effectiveJpYear, prota]);

  // Save changes to Firestore helper
  const handleSaveToFirestore = async (updatedTopics: ProtaTopic[]) => {
    if (!prota || !user) return;

    try {
      const yearName = academicYears.find(y => y.id === selectedAcademicYearId)?.name || "";
      const toSave: AnnualProgramData = {
        ...prota,
        academicYearId: selectedAcademicYearId,
        academicYearName: yearName,
        classId: selectedClassId,
        className: selectedClassObj?.name || "",
        subjectId: selectedSubjectId,
        subjectName: selectedSubjectObj?.name || "",
        teacherId,
        teacherName,
        effectiveJpYear,
        topics: updatedTopics
      };

      const result = await curriculumPlanningService.saveAnnualProgram(toSave, user.uid, user.displayName);
      setProta(result);
      showToast("Program Tahunan berhasil disimpan!", "success");
    } catch (error: any) {
      showToast("Gagal menyimpan Program Tahunan: " + error.message, "error");
    }
  };

  // Open modal for adding / editing topic
  const handleOpenModal = (topic: ProtaTopic | null = null) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicTitle(topic.title);
      setTopicJp(topic.jp);
      setTopicSemester(topic.semester);
      setTopicDescription(topic.description || "");
      setSubTopics(topic.subtopics || []);
    } else {
      setEditingTopic(null);
      setTopicTitle("");
      setTopicJp(0);
      setTopicSemester("Ganjil");
      setTopicDescription("");
      setSubTopics([]);
    }
    // Reset subtopic form fields
    setNewSubTitle("");
    setNewSubJp(0);
    setNewSubDesc("");
    setIsModalOpen(true);
  };

  // Save Topic (Add / Edit)
  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prota) return;

    // Validation: Total JP should not exceed effective JP
    const otherTopicsJp = currentTopics
      .filter(t => t.id !== editingTopic?.id)
      .reduce((sum, t) => sum + t.jp, 0);

    const targetTopicJp = subTopics.length > 0 ? subTopics.reduce((sum, s) => sum + s.jp, 0) : topicJp;

    if (otherTopicsJp + targetTopicJp > effectiveJpYear) {
      showToast(`Gagal: Total alokasi JP (${otherTopicsJp + targetTopicJp} JP) melebihi JP Efektif Tahunan (${effectiveJpYear} JP)!`, "error");
      return;
    }

    let updatedTopics = [...currentTopics];

    if (editingTopic) {
      // Edit
      updatedTopics = updatedTopics.map(t => {
        if (t.id === editingTopic.id) {
          return {
            ...t,
            title: topicTitle,
            jp: targetTopicJp,
            semester: topicSemester,
            description: topicDescription,
            subtopics: subTopics
          };
        }
        return t;
      });
    } else {
      // Add
      const newTopic: ProtaTopic = {
        id: "topic_" + Math.random().toString(36).substring(2, 9),
        title: topicTitle,
        jp: targetTopicJp,
        semester: topicSemester,
        description: topicDescription,
        order: currentTopics.length + 1,
        subtopics: subTopics
      };
      updatedTopics.push(newTopic);
    }

    setIsModalOpen(false);
    handleSaveToFirestore(updatedTopics);
  };

  // Add subtopic in modal list
  const handleAddSubTopic = () => {
    if (!newSubTitle.trim()) {
      showToast("Judul sub-topik tidak boleh kosong", "warning");
      return;
    }
    const newSub: ProtaSubTopic = {
      id: "subtopic_" + Math.random().toString(36).substring(2, 9),
      title: newSubTitle,
      jp: newSubJp,
      description: newSubDesc
    };
    const updatedSubtopics = [...subTopics, newSub];
    setSubTopics(updatedSubtopics);
    
    // Auto calculate main topic JP based on subtopics sum
    const totalSubJp = updatedSubtopics.reduce((sum, s) => sum + s.jp, 0);
    setTopicJp(totalSubJp);

    setNewSubTitle("");
    setNewSubJp(0);
    setNewSubDesc("");
  };

  // Delete subtopic in modal list
  const handleDeleteSubTopic = (subId: string) => {
    const updatedSubtopics = subTopics.filter(s => s.id !== subId);
    setSubTopics(updatedSubtopics);
    const totalSubJp = updatedSubtopics.reduce((sum, s) => sum + s.jp, 0);
    setTopicJp(totalSubJp);
  };

  // Delete topic from main list
  const handleDeleteTopic = (topicId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus topik ini?")) {
      const updatedTopics = currentTopics.filter(t => t.id !== topicId);
      handleSaveToFirestore(updatedTopics);
    }
  };

  // Reordering topics (Move Up / Down)
  const handleMoveTopic = (index: number, direction: "up" | "down") => {
    if (!prota) return;
    const updatedTopics = [...currentTopics];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= updatedTopics.length) return;

    // Swap items
    const temp = updatedTopics[index];
    updatedTopics[index] = updatedTopics[targetIndex];
    updatedTopics[targetIndex] = temp;

    // Update order key
    updatedTopics.forEach((t, idx) => {
      t.order = idx + 1;
    });

    handleSaveToFirestore(updatedTopics);
  };

  // Copy Topic (Duplicates topic structure with new random IDs)
  const handleCopyTopic = (topic: ProtaTopic) => {
    if (!prota) return;

    const copiedTopic: ProtaTopic = {
      ...topic,
      id: "topic_" + Math.random().toString(36).substring(2, 9),
      title: `${topic.title} (Salinan)`,
      order: currentTopics.length + 1,
      subtopics: topic.subtopics?.map(sub => ({
        ...sub,
        id: "subtopic_" + Math.random().toString(36).substring(2, 9)
      })) || []
    };

    if (usedJp + copiedTopic.jp > effectiveJpYear) {
      showToast(`Gagal menduplikasi: Total alokasi melebihi JP Efektif Tahunan (${effectiveJpYear} JP)!`, "error");
      return;
    }

    const updatedTopics = [...currentTopics, copiedTopic];
    handleSaveToFirestore(updatedTopics);
    showToast("Topik berhasil diduplikasi!", "success");
  };

  // Toggle Collapse / Expand
  const toggleExpand = (id: string) => {
    setExpandedTopics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // --- EXCEL IMPORT ---
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let importedTopicsCount = 0;
        let importedJpCount = 0;

        const parsedTopics: ProtaTopic[] = data.map((row, index) => {
          const title = row["Topik"] || row["Materi"] || row["Nama Topik"] || "";
          const jp = parseInt(row["Alokasi JP"] || row["JP"] || "0") || 0;
          let semStr = row["Semester"] || "Ganjil";
          if (!["Ganjil", "Genap", "Ganjil & Genap"].includes(semStr)) {
            semStr = "Ganjil";
          }
          const description = row["Keterangan"] || row["Deskripsi"] || "";

          importedTopicsCount++;
          importedJpCount += jp;

          return {
            id: "topic_" + Math.random().toString(36).substring(2, 9),
            title,
            jp,
            semester: semStr as any,
            description,
            order: index + 1,
            subtopics: []
          };
        }).filter(t => t.title !== "");

        if (usedJp + importedJpCount > effectiveJpYear) {
          showToast(`Gagal Impor: Jumlah JP hasil impor (${importedJpCount} JP) melebihi kapasitas JP Efektif Tahunan tersisa!`, "error");
          return;
        }

        const updatedTopics = [...currentTopics, ...parsedTopics];
        await handleSaveToFirestore(updatedTopics);
        showToast(`Berhasil mengimpor ${importedTopicsCount} topik dari Excel!`, "success");
      } catch (error: any) {
        showToast("Gagal mengimpor Excel: " + error.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // reset input
  };

  // --- EXPORTS ---

  // Export to Excel
  const exportToExcel = () => {
    if (currentTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const rows: any[] = [];
      currentTopics.forEach((t, idx) => {
        rows.push({
          "No": idx + 1,
          "Topik / Tema / Materi": t.title,
          "Alokasi JP": t.jp,
          "Semester": t.semester,
          "Keterangan": t.description || ""
        });

        if (t.subtopics && t.subtopics.length > 0) {
          t.subtopics.forEach((sub, subIdx) => {
            rows.push({
              "No": `${idx + 1}.${subIdx + 1}`,
              "Topik / Tema / Materi": `  - ${sub.title}`,
              "Alokasi JP": sub.jp,
              "Semester": t.semester,
              "Keterangan": sub.description || ""
            });
          });
        }
      });

      // Add Summary Row
      rows.push({
        "No": "",
        "Topik / Tema / Materi": "TOTAL JP DIALOKASIKAN",
        "Alokasi JP": usedJp,
        "Semester": "",
        "Keterangan": `Dari JP Efektif Tahunan: ${effectiveJpYear}`
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Program Tahunan");
      XLSX.writeFile(wb, `Program_Tahunan_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.xlsx`);
      showToast("Unduh data Excel berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export Excel: " + error.message, "error");
    }
  };

  // Export to Word (.doc XML format)
  const exportToWord = () => {
    if (currentTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    const yearName = academicYears.find(y => y.id === selectedAcademicYearId)?.name || "";
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Program Tahunan</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 25px; }
          h2 { margin: 0; font-size: 16pt; text-transform: uppercase; }
          h3 { margin: 5px 0; font-size: 12pt; }
          .metadata-table { width: 100%; margin-bottom: 20px; font-size: 11pt; border: none; }
          .metadata-table td { padding: 4px; border: none; }
          .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11pt; }
          .main-table th, .main-table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .main-table th { background-color: #f2f2f2; font-weight: bold; }
          .sub-row { font-style: italic; color: #555; background-color: #fafafa; }
          .total-row { font-weight: bold; background-color: #eaeaea; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PROGRAM TAHUNAN (PROTA)</h2>
          <h3>SMP ALKARIM RASYID</h3>
        </div>
        
        <table class="metadata-table">
          <tr>
            <td width="25%"><b>Tahun Pelajaran</b></td><td>: ${yearName}</td>
            <td width="25%"><b>Mata Pelajaran</b></td><td>: ${selectedSubjectObj?.name || "-"}</td>
          </tr>
          <tr>
            <td><b>Kelas</b></td><td>: ${selectedClassObj?.name || "-"} (Tingkat ${selectedClassObj?.gradeLevel || "-"})</td>
            <td><b>Guru Pengampu</b></td><td>: ${teacherName}</td>
          </tr>
          <tr>
            <td><b>JP Efektif Setahun</b></td><td>: ${effectiveJpYear} JP</td>
            <td><b>Pekan Efektif Setahun</b></td><td>: ${effectiveWeeksYear} Pekan</td>
          </tr>
        </table>

        <table class="main-table">
          <thead>
            <tr>
              <th width="8%">No</th>
              <th width="50%">Topik / Tema / Materi Pembelajaran</th>
              <th width="12%">Alokasi JP</th>
              <th width="15%">Semester</th>
              <th width="15%">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${currentTopics.map((t, idx) => `
              <tr>
                <td><b>${idx + 1}</b></td>
                <td><b>${t.title}</b></td>
                <td><b>${t.jp} JP</b></td>
                <td>${t.semester}</td>
                <td>${t.description || "-"}</td>
              </tr>
              ${t.subtopics?.map((sub, subIdx) => `
                <tr class="sub-row">
                  <td>${idx + 1}.${subIdx + 1}</td>
                  <td style="padding-left: 20px;">- ${sub.title}</td>
                  <td>${sub.jp} JP</td>
                  <td>${t.semester}</td>
                  <td>${sub.description || "-"}</td>
                </tr>
              `).join("") || ""}
            `).join("")}
            <tr class="total-row">
              <td colspan="2">TOTAL JP DIALOKASIKAN</td>
              <td>${usedJp} JP</td>
              <td colspan="2">Sisa JP: ${remainingJp} JP</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Program_Tahunan_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Unduh dokumen Word berhasil!", "success");
  };

  // Export to PDF
  const exportToPDF = () => {
    if (currentTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const yearName = academicYears.find(y => y.id === selectedAcademicYearId)?.name || "";

      // Header Text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PROGRAM TAHUNAN (PROTA)", 105, 15, { align: "center" });
      doc.setFontSize(11);
      doc.text("SMP ALKARIM RASYID", 105, 21, { align: "center" });

      // Border line
      doc.setDrawColor(180);
      doc.line(14, 25, 196, 25);

      // Metadata Section
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tahun Pelajaran: ${yearName}`, 14, 31);
      doc.text(`Mata Pelajaran : ${selectedSubjectObj?.name || "-"}`, 14, 36);
      doc.text(`Kelas / Tingkat: ${selectedClassObj?.name || "-"} (${selectedClassObj?.gradeLevel || "-"})`, 14, 41);

      doc.text(`Guru Pengampu  : ${teacherName}`, 115, 31);
      doc.text(`JP Efektif / Th : ${effectiveJpYear} JP`, 115, 36);
      doc.text(`Pekan Efektif   : ${effectiveWeeksYear} Pekan`, 115, 41);

      doc.line(14, 45, 196, 45);

      // Table Draw
      let y = 52;
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 5, 182, 7, "F");
      
      doc.text("No", 16, y);
      doc.text("Topik / Tema / Materi Pembelajaran", 32, y);
      doc.text("JP", 140, y);
      doc.text("Semester", 155, y);
      doc.text("Ket", 182, y);

      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      doc.setFont("helvetica", "normal");
      currentTopics.forEach((t, idx) => {
        // Page break logic
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}`, 16, y);
        // Truncate long title
        const shortTitle = t.title.length > 55 ? t.title.substring(0, 52) + "..." : t.title;
        doc.text(shortTitle, 32, y);
        doc.text(`${t.jp}`, 140, y);
        doc.setFont("helvetica", "normal");
        doc.text(t.semester, 155, y);
        doc.text(t.description ? t.description.substring(0, 8) : "-", 182, y);

        doc.line(14, y + 2, 196, y + 2);
        y += 7;

        if (t.subtopics && t.subtopics.length > 0) {
          t.subtopics.forEach((sub, subIdx) => {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.setFont("helvetica", "italic");
            doc.text(`${idx + 1}.${subIdx + 1}`, 20, y);
            const shortSubTitle = sub.title.length > 50 ? sub.title.substring(0, 47) + "..." : sub.title;
            doc.text(`- ${shortSubTitle}`, 32, y);
            doc.text(`${sub.jp}`, 140, y);
            doc.text(t.semester, 155, y);
            doc.text(sub.description ? sub.description.substring(0, 8) : "-", 182, y);
            
            doc.line(14, y + 2, 196, y + 2);
            y += 7;
          });
        }
      });

      // Total row
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y - 5, 182, 7, "F");
      doc.text("TOTAL ALOKASI JP", 32, y);
      doc.text(`${usedJp} JP`, 140, y);
      doc.text(`Sisa: ${remainingJp} JP`, 155, y);

      doc.save(`Program_Tahunan_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.pdf`);
      showToast("Unduh dokumen PDF berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  return (
    <div className="space-y-6" id="annual-program-view">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Calendar className="h-6.5 w-6.5 text-blue-500" />
            Program Tahunan (PROTA)
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manajemen master topik, tema, materi pokok, dan alokasi JP dalam kurun waktu satu tahun ajaran.
          </p>
        </div>

        {/* Action Controls for Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Academic Year Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Tahun Ajaran</span>
            <select
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>TP {y.name}</option>
              ))}
            </select>
          </div>

          {/* Class Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Kelas</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Tingkat {c.gradeLevel})</option>
              ))}
            </select>
          </div>

          {/* Subject Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Mata Pelajaran</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={offeredSubjects.length === 0}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs disabled:opacity-50"
            >
              {offeredSubjects.length === 0 ? (
                <option value="">Tidak ada mapel ditawarkan</option>
              ) : (
                offeredSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.jp} JP/Minggu)</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* RPE and JP Indicators Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total JP Efektif */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">JP Efektif Tahunan</span>
            <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">{effectiveJpYear} JP</div>
            <p className="text-[10px] text-slate-500">{weeklyJp} JP/Minggu &bull; {effectiveWeeksYear} Pekan</p>
          </div>
          <div className="h-10 w-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
            {weeklyJp}
          </div>
        </div>

        {/* JP Terpakai */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">JP Dialokasikan</span>
            <div className={`text-2xl font-black ${usedJp > effectiveJpYear ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-zinc-100'}`}>{usedJp} JP</div>
            <p className="text-[10px] text-slate-500">{currentTopics.length} Topik Pembelajaran</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${usedJp > effectiveJpYear ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
            {usedJp}
          </div>
        </div>

        {/* Sisa JP */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Sisa Alokasi JP</span>
            <div className={`text-2xl font-black ${remainingJp < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-zinc-100'}`}>{remainingJp} JP</div>
            <p className="text-[10px] text-slate-500">Tingkat kecukupan materi</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs ${remainingJp < 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {remainingJp}
          </div>
        </div>

        {/* Progress Bar and Alert */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-1.5 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kecukupan Kurikulum</span>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-850 h-3 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-350 rounded-full ${usedJp > effectiveJpYear ? 'bg-rose-500' : 'bg-blue-600'}`} 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
          
          {usedJp > effectiveJpYear && (
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[10px] font-bold mt-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Alokasi melebihi batas JP efektif!
            </div>
          )}
        </div>
      </div>

      {/* Document Information Card (Portrait Frame) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-150 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight">INFORMASI DOKUMEN</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rincian parameter program tahunan yang aktif saat ini.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-xl text-[11px] font-semibold text-blue-700 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-500" />
            Format Cetak: Portrait (Satu Halaman Penuh)
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahun Pelajaran</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              TP {academicYears.find(y => y.id === selectedAcademicYearId)?.name || "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mata Pelajaran & Kelas</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              {selectedSubjectObj?.name || "-"} ({selectedClassObj?.name || "-"})
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru Pengampu</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{teacherName}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alokasi & Pekan Efektif</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              {effectiveJpYear} JP ({effectiveWeeksYear} Pekan Belajar)
            </div>
          </div>
        </div>
      </div>

      {/* Main Prota Table and Actions */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="px-5 py-4 border-b border-slate-150 dark:border-zinc-850/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/40 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-tight">Daftar Rincian Materi Pokok</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Import from Excel input */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors">
              <Upload className="h-3.5 w-3.5 text-blue-500" />
              Impor Excel
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleImportExcel} 
                className="hidden" 
              />
            </label>

            {/* Export Dropdown / Buttons */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-rose-500" />
              PDF
            </button>
            <button
              onClick={exportToWord}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-blue-500" />
              Word
            </button>

            <button
              onClick={() => handleOpenModal(null)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/15 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Tambah Topik
            </button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-150 dark:border-zinc-850">
                <th className="py-3 px-4 text-center w-[60px]">No</th>
                <th className="py-3 px-4">Topik / Tema / Materi Pembelajaran</th>
                <th className="py-3 px-4 w-[120px] text-center">Alokasi JP</th>
                <th className="py-3 px-4 w-[150px] text-center">Semester</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 text-center w-[160px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FolderOpen className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
                      <span className="font-semibold text-xs">Belum ada topik pembelajaran yang terdaftar</span>
                      <p className="text-[10px] text-slate-400 max-w-xs">Silakan tambah topik baru atau impor melalui file Excel standar sekolah Anda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTopics.map((topic, index) => {
                  const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
                  const isExpanded = expandedTopics[topic.id];

                  return (
                    <React.Fragment key={topic.id}>
                      {/* Main Topic Row */}
                      <tr className="border-b border-slate-150 dark:border-zinc-850 hover:bg-slate-50/20 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-zinc-300 text-center">{index + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">
                          <div className="flex items-center gap-1.5">
                            {hasSubtopics && (
                              <button 
                                onClick={() => toggleExpand(topic.id)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-all cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                            <span>{topic.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/20 rounded-lg text-xs font-extrabold text-blue-700 dark:text-blue-300">
                            {topic.jp} JP
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-zinc-400">
                            Semester {topic.semester}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs dark:text-zinc-400 max-w-xs truncate">{topic.description || "-"}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Reordering Controls */}
                            <button
                              disabled={index === 0}
                              onClick={() => handleMoveTopic(index, "up")}
                              title="Geser Ke Atas"
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={index === currentTopics.length - 1}
                              onClick={() => handleMoveTopic(index, "down")}
                              title="Geser Ke Bawah"
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>

                            {/* Actions */}
                            <button
                              onClick={() => handleCopyTopic(topic)}
                              title="Duplikat Topik"
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenModal(topic)}
                              title="Edit Topik"
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTopic(topic.id)}
                              title="Hapus Topik"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Subtopics Listing */}
                      {hasSubtopics && isExpanded && (
                        <AnimatePresence>
                          {topic.subtopics?.map((sub, subIdx) => (
                            <tr 
                              key={sub.id} 
                              className="border-b border-slate-100 dark:border-zinc-850/40 bg-slate-50/30 dark:bg-zinc-900/10 italic text-xs text-slate-500 dark:text-zinc-400"
                            >
                              <td className="py-2.5 px-4 text-center text-slate-400">{index + 1}.{subIdx + 1}</td>
                              <td className="py-2.5 px-4 pl-10 text-slate-600 dark:text-zinc-400 font-medium">- {sub.title}</td>
                              <td className="py-2.5 px-4 text-center font-bold text-slate-700 dark:text-zinc-300">{sub.jp} JP</td>
                              <td className="py-2.5 px-4 text-center text-slate-400">Semester {topic.semester}</td>
                              <td className="py-2.5 px-4 max-w-xs truncate text-[11px]">{sub.description || "-"}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span className="text-[10px] text-slate-400">Terkunci (Edit via Topik Utama)</span>
                              </td>
                            </tr>
                          ))}
                        </AnimatePresence>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DIALOG UNTUK ADD / EDIT TOPIK & SUBTOPIK --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-zinc-800 shrink-0">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-blue-500" />
                  {editingTopic ? "Edit Rincian Topik" : "Tambah Topik Pembelajaran Baru"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <form onSubmit={handleSaveTopic} className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Topic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Topik / Tema / Materi Utama</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bab 1 Aljabar Linier"
                      value={topicTitle}
                      onChange={(e) => setTopicTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Penempatan Semester</label>
                    <select
                      value={topicSemester}
                      onChange={(e) => setTopicSemester(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                      <option value="Ganjil & Genap">Ganjil & Genap</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Keterangan Tambahan</label>
                    <input
                      type="text"
                      placeholder="Opsional"
                      value={topicDescription}
                      onChange={(e) => setTopicDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alokasi JP Utama</label>
                    <input
                      type="number"
                      required
                      disabled={subTopics.length > 0}
                      value={topicJp}
                      onChange={(e) => setTopicJp(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 disabled:opacity-55"
                    />
                    {subTopics.length > 0 && (
                      <p className="text-[9px] text-amber-500 font-semibold mt-1">Dihitung otomatis dari akumulasi sub-topik</p>
                    )}
                  </div>
                </div>

                {/* Subtopic Management (Inline Structure) */}
                <div className="border-t border-slate-100 dark:border-zinc-850 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">Pengaturan Sub-Topik (Opsional)</span>
                    <span className="text-[10px] text-slate-400">Total Sub-Topik: {subTopics.length}</span>
                  </div>

                  {/* Add Subtopic Form Panel */}
                  <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 p-3.5 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-6">
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Materi / Sub-Topik</label>
                      <input
                        type="text"
                        placeholder="Contoh: 1.1 Persamaan Kuadrat"
                        value={newSubTitle}
                        onChange={(e) => setNewSubTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">JP</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newSubJp}
                        onChange={(e) => setNewSubJp(parseInt(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-xs"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Ket</label>
                      <input
                        type="text"
                        placeholder="Opsional"
                        value={newSubDesc}
                        onChange={(e) => setNewSubDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-xs"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <button
                        type="button"
                        onClick={handleAddSubTopic}
                        className="w-full h-[32px] bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subtopics Preview List */}
                  {subTopics.length > 0 && (
                    <div className="border border-slate-150 dark:border-zinc-850 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-zinc-950 text-[10px] font-bold text-slate-400 dark:text-zinc-500 border-b border-slate-150 dark:border-zinc-850">
                            <th className="py-2 px-3 text-center w-[50px]">No</th>
                            <th className="py-2 px-3">Sub-Materi</th>
                            <th className="py-2 px-3 w-[80px] text-center">JP</th>
                            <th className="py-2 px-3">Ket</th>
                            <th className="py-2 px-3 text-center w-[60px]">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subTopics.map((sub, idx) => (
                            <tr key={sub.id} className="border-b border-slate-100 dark:border-zinc-850/40 bg-white dark:bg-zinc-900/40">
                              <td className="py-2 px-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-zinc-300">{sub.title}</td>
                              <td className="py-2 px-3 text-center font-extrabold text-blue-600 dark:text-blue-400">{sub.jp} JP</td>
                              <td className="py-2 px-3 text-[10px] text-slate-500 truncate max-w-[120px]">{sub.description || "-"}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubTopic(sub.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-2.5 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Topik
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnnualProgram;
