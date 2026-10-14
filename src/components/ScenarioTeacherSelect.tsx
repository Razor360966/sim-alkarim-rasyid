import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Search, 
  X, 
  Check, 
  ChevronDown, 
  UserX, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  UserCheck
} from "lucide-react";
import { Teacher } from "../types";

export interface ScenarioTeacherSelectProps {
  currentTeacherId?: string;
  currentTeacherName?: string;
  teachers: Teacher[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (teacherId: string, teacherName: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  showClearOption?: boolean;
}

export const formatTeacherDisplayName = (t: Partial<Teacher>): string => {
  const front = t.frontTitle && t.frontTitle.trim() ? `${t.frontTitle.trim()} ` : "";
  const back = t.backTitle && t.backTitle.trim() ? `, ${t.backTitle.trim()}` : "";
  const baseName = t.name && t.name.trim() ? t.name.trim() : "";
  return `${front}${baseName}${back}`.trim();
};

export const ScenarioTeacherSelect: React.FC<ScenarioTeacherSelectProps> = ({
  currentTeacherId = "",
  currentTeacherName = "",
  teachers = [],
  isLoading = false,
  isError = false,
  onRetry,
  onSelect,
  disabled = false,
  placeholder = "Pilih guru dari database master SIMAK...",
  label,
  showClearOption = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [listMaxHeight, setListMaxHeight] = useState<number>(240);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Dynamic positioning calculation: determines whether to open upwards or downwards
  // based on trigger position in viewport and available clearance.
  const calculatePlacement = () => {
    if (!triggerButtonRef.current) return;
    const rect = triggerButtonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // A comfortable dropdown height is ~240-280px total (including ~50px search box)
    const requiredTotalHeight = 260;

    if (spaceBelow < requiredTotalHeight && spaceAbove > spaceBelow) {
      setPlacement("top");
      // Space above minus header/margins
      const availableListSpace = Math.max(160, Math.min(260, spaceAbove - 70));
      setListMaxHeight(availableListSpace);
    } else {
      setPlacement("bottom");
      // Space below minus footer/margins
      const availableListSpace = Math.max(160, Math.min(260, spaceBelow - 70));
      setListMaxHeight(availableListSpace);
    }
  };

  // Recalculate position on open, window resize, or scroll
  useEffect(() => {
    if (isOpen) {
      calculatePlacement();
      const handleReposition = () => calculatePlacement();
      window.addEventListener("resize", handleReposition);
      window.addEventListener("scroll", handleReposition, true);
      return () => {
        window.removeEventListener("resize", handleReposition);
        window.removeEventListener("scroll", handleReposition, true);
      };
    }
  }, [isOpen]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Safe matching for legacy data (when only teacherName is present)
  const legacyMatches = useMemo(() => {
    if (!currentTeacherName || currentTeacherId) return [];
    const norm = currentTeacherName.trim().toLowerCase();
    return teachers.filter((t) => {
      const full = formatTeacherDisplayName(t).toLowerCase();
      const base = (t.name || "").trim().toLowerCase();
      return full === norm || base === norm;
    });
  }, [currentTeacherName, currentTeacherId, teachers]);

  // Compute resolved display name and status
  const { displayName, isFoundInMaster, isAmbiguousLegacy } = useMemo(() => {
    if (currentTeacherId) {
      const found = teachers.find((t) => t.id === currentTeacherId || t.teacherId === currentTeacherId);
      if (found) {
        return {
          displayName: formatTeacherDisplayName(found),
          isFoundInMaster: true,
          isAmbiguousLegacy: false
        };
      }
      return {
        displayName: currentTeacherName || "Guru tidak ditemukan di master",
        isFoundInMaster: false,
        isAmbiguousLegacy: false
      };
    }

    if (currentTeacherName) {
      if (legacyMatches.length === 1) {
        return {
          displayName: formatTeacherDisplayName(legacyMatches[0]),
          isFoundInMaster: true,
          isAmbiguousLegacy: false
        };
      }
      if (legacyMatches.length > 1) {
        return {
          displayName: currentTeacherName,
          isFoundInMaster: false,
          isAmbiguousLegacy: true
        };
      }
      return {
        displayName: currentTeacherName,
        isFoundInMaster: false,
        isAmbiguousLegacy: false
      };
    }

    return {
      displayName: "",
      isFoundInMaster: false,
      isAmbiguousLegacy: false
    };
  }, [currentTeacherId, currentTeacherName, teachers, legacyMatches]);

  // Filtered teachers list based on active status, non-deleted, and search query
  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // Base active list (include currently assigned teacher even if marked inactive)
    const activeTeachers = teachers.filter((t) => {
      if (t.isDeleted) return false;
      if (t.id === currentTeacherId || t.teacherId === currentTeacherId) return true;
      if (t.status === false || t.status === "nonaktif" || t.status === "inactive" || t.status === "NONAKTIF") {
        return false;
      }
      return true;
    });

    if (!query) return activeTeachers;

    return activeTeachers.filter((t) => {
      const fullName = formatTeacherDisplayName(t).toLowerCase();
      const baseName = (t.name || "").toLowerCase();
      const nick = (t.nickName || "").toLowerCase();
      const niy = (t.niy || "").toLowerCase();
      const nuptk = (t.nuptk || "").toLowerCase();
      const empType = (t.employeeType || "").toLowerCase();

      return (
        fullName.includes(query) ||
        baseName.includes(query) ||
        nick.includes(query) ||
        niy.includes(query) ||
        nuptk.includes(query) ||
        empType.includes(query)
      );
    });
  }, [teachers, searchQuery, currentTeacherId]);

  const handleSelectTeacher = (t: Teacher) => {
    const formatted = formatTeacherDisplayName(t);
    onSelect(t.id || t.teacherId, formatted);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClearTeacher = () => {
    onSelect("", "");
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        ref={triggerButtonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-zinc-800 border rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
          !currentTeacherId && !currentTeacherName
            ? "border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-emerald-500 dark:hover:border-emerald-500"
            : !currentTeacherId && currentTeacherName
            ? "border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 bg-amber-50/40 dark:bg-amber-950/20"
            : "border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white hover:border-emerald-500"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate flex items-center gap-2">
          {currentTeacherId ? (
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : currentTeacherName ? (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <UserX className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
          )}

          {displayName ? (
            <span className="truncate">
              {displayName}
              {!currentTeacherId && currentTeacherName && (
                <span className="ml-1.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                  (Perlu verifikasi master)
                </span>
              )}
            </span>
          ) : (
            <span className="italic text-slate-400 dark:text-zinc-500 font-normal">
              {placeholder}
            </span>
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Ambiguous or unlinked legacy warning badge */}
      {isAmbiguousLegacy && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Ada beberapa guru dengan nama serupa di master. Silakan pilih guru kanonis agar identitas tersimpan resmi.
        </p>
      )}

      {/* Dropdown Menu - auto flips top or bottom, contains scroll internally */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[70] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-150 ${
            placement === "top"
              ? "bottom-full mb-1.5 origin-bottom"
              : "top-full mt-1.5 origin-top"
          }`}
          style={{
            maxHeight: `${listMaxHeight + 56}px`
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Search Box - sticky at top */}
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800 shrink-0 flex items-center gap-2 bg-slate-50 dark:bg-zinc-850 sticky top-0 z-10">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari nama guru, NIY, NUPTK, atau gelar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-none p-0.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Body Options with internal scroll and overscroll-contain */}
          <div 
            className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-zinc-800/60 pb-3"
            style={{ maxHeight: `${listMaxHeight}px` }}
          >
            {/* Clear Assignment Option */}
            {showClearOption && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearTeacher();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                  !currentTeacherId && !currentTeacherName
                    ? "bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-semibold"
                    : "hover:bg-rose-50/50 dark:hover:bg-rose-950/15 text-rose-600 dark:text-rose-400"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <UserX className="w-4 h-4 shrink-0 text-rose-500" />
                  <div>
                    <div className="font-bold">Kosongkan (Belum Ditugaskan)</div>
                    <div className="text-[10px] text-rose-500/80">Hapus penugasan guru dari rancangan ini</div>
                  </div>
                </div>
                {!currentTeacherId && !currentTeacherName && (
                  <Check className="h-4 w-4 text-rose-600 shrink-0" />
                )}
              </button>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="p-5 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span>Memuat database guru SIMAK...</span>
              </div>
            )}

            {/* Error Indicator & Retry Button */}
            {isError && !isLoading && (
              <div className="p-4 flex flex-col items-center justify-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold text-center">Gagal memuat daftar guru dari database.</span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRetry();
                    }}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold hover:bg-rose-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Coba Lagi</span>
                  </button>
                )}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && filteredTeachers.length === 0 && (
              <div className="p-5 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-zinc-300">
                  Guru tidak ditemukan untuk pencarian &quot;{searchQuery}&quot;
                </div>
                <div className="text-[10px] leading-relaxed">
                  Pastikan nama, NIY, atau NUPTK telah terdaftar di master SDM SIMAK. Form ini tidak dapat membuat akun guru baru.
                </div>
              </div>
            )}

            {/* Teachers List */}
            {!isLoading &&
              !isError &&
              filteredTeachers.map((t) => {
                const formattedName = formatTeacherDisplayName(t);
                const isSelected = t.id === currentTeacherId || t.teacherId === currentTeacherId;

                return (
                  <button
                    key={t.id || t.teacherId}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectTeacher(t);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <span className="truncate">{formattedName}</span>
                        {t.nickName && (
                          <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-400 shrink-0">
                            ({t.nickName})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-400 flex items-center gap-2 mt-0.5 font-normal">
                        {t.niy && <span>NIY: {t.niy}</span>}
                        {t.nuptk && <span>NUPTK: {t.nuptk}</span>}
                        {t.employeeType && (
                          <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded text-[9px] font-medium">
                            {t.employeeType}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
