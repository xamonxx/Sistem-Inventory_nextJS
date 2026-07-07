"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Indonesian translations
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAYS_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  defaultValue?: string; // YYYY-MM-DD
  onChange?: (value: string) => void;
  name?: string; // for form submission
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  align?: "left" | "right";
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  className,
  disabled = false,
  placeholder = "Pilih tanggal...",
  align = "left",
}: DatePickerProps) {
  // Handle both controlled and uncontrolled states
  const [internalValue, setInternalValue] = useState<string>(() => {
    return value !== undefined ? value : (defaultValue || "");
  });

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number; visibility: "hidden" | "visible" }>({
    top: 0,
    left: 0,
    width: 290,
    visibility: "hidden",
  });

  // Parse current date values or default to today
  const parsedDate = useMemo(() => {
    if (!internalValue) return new Date();
    const d = new Date(internalValue);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [internalValue]);

  // Calendar view state (which month/year is currently being viewed)
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate.getMonth());
  const [viewYear, setViewYear] = useState<number>(() => parsedDate.getFullYear());

  // Sync view month/year when calendar is opened
  useEffect(() => {
    if (isOpen) {
      setViewMonth(parsedDate.getMonth());
      setViewYear(parsedDate.getFullYear());
    }
  }, [isOpen, parsedDate]);

  // Handle clicking outside to close calendar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = containerRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (
        !insideTrigger &&
        !insidePanel
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function updatePanelPosition() {
      const trigger = containerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const panelWidth = Math.min(290, window.innerWidth - viewportPadding * 2);
      let left = align === "right" ? rect.right - panelWidth : rect.left;
      left = Math.min(Math.max(left, viewportPadding), window.innerWidth - panelWidth - viewportPadding);

      let top = rect.bottom + 8;
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      if (panelHeight) {
        const bottomOverflow = top + panelHeight - (window.innerHeight - viewportPadding);
        if (bottomOverflow > 0) {
          const aboveTop = rect.top - panelHeight - 8;
          top = aboveTop >= viewportPadding ? aboveTop : Math.max(viewportPadding, top - bottomOverflow);
        }
      }

      setPanelStyle({
        top,
        left,
        width: panelWidth,
        visibility: panelHeight ? "visible" : "hidden",
      });
    }

    updatePanelPosition();
    const frame = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [align, isOpen, viewMonth, viewYear, internalValue]);

  // Format date for display in Indonesian format, e.g. "26 Juni 2026"
  const formattedDisplay = useMemo(() => {
    if (!internalValue) return "";
    const d = new Date(internalValue);
    if (isNaN(d.getTime())) return "";
    const day = d.getDate().toString().padStart(2, "0");
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }, [internalValue]);

  // Helper: Format date object to YYYY-MM-DD
  function toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Handle selecting a day
  function handleSelectDay(day: number, isCurrentMonth: boolean, offsetMonth: number) {
    if (disabled) return;
    let targetMonth = viewMonth + offsetMonth;
    let targetYear = viewYear;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }

    const selectedDate = new Date(targetYear, targetMonth, day);
    const ymdValue = toYmd(selectedDate);
    
    setInternalValue(ymdValue);
    setIsOpen(false);
    if (onChange) {
      onChange(ymdValue);
    }
  }

  // Handle setting to today
  function handleSelectToday() {
    const today = new Date();
    const ymdValue = toYmd(today);
    setInternalValue(ymdValue);
    setIsOpen(false);
    if (onChange) {
      onChange(ymdValue);
    }
  }

  // Handle clearing value
  function handleClear() {
    setInternalValue("");
    setIsOpen(false);
    if (onChange) {
      onChange("");
    }
  }

  // Navigation handlers
  function prevMonth() {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }

  function nextMonth() {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }

  // Generate calendar grid cells (42 cells: 6 rows of 7 days)
  const calendarCells = useMemo(() => {
    const cells: { day: number; isCurrentMonth: boolean; offsetMonth: number; isToday: boolean; isSelected: boolean }[] = [];
    
    // First day of current view month
    const firstDayIdx = new Date(viewYear, viewMonth, 1).getDay();
    // Total days in current month
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Total days in previous month
    const prevMonthTotalDays = new Date(viewYear, viewMonth, 0).getDate();

    const todayYmd = toYmd(new Date());
    const selectedYmd = internalValue;

    // 1. Previous month trailing days
    for (let i = firstDayIdx - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const dateObj = new Date(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1, dayNum);
      const ymd = toYmd(dateObj);
      cells.push({
        day: dayNum,
        isCurrentMonth: false,
        offsetMonth: -1,
        isToday: ymd === todayYmd,
        isSelected: ymd === selectedYmd
      });
    }

    // 2. Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dateObj = new Date(viewYear, viewMonth, i);
      const ymd = toYmd(dateObj);
      cells.push({
        day: i,
        isCurrentMonth: true,
        offsetMonth: 0,
        isToday: ymd === todayYmd,
        isSelected: ymd === selectedYmd
      });
    }

    // 3. Next month leading days to fill up to 42 cells
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const dateObj = new Date(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, i);
      const ymd = toYmd(dateObj);
      cells.push({
        day: i,
        isCurrentMonth: false,
        offsetMonth: 1,
        isToday: ymd === todayYmd,
        isSelected: ymd === selectedYmd
      });
    }

    return cells;
  }, [viewMonth, viewYear, internalValue]);

  // Year choices for selector
  const yearsList = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let y = current - 10; y <= current + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative inline-block w-full", 
        !className?.split(/\s+/).some((w) => w.startsWith("h-")) && "h-11", 
        className,
        isOpen ? "z-40" : "z-10"
      )}
    >
      {/* Hidden input for standard HTML form submissions */}
      {name && <input type="hidden" name={name} value={internalValue} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-full w-full items-center justify-between px-4 text-xs font-semibold text-left outline-none transition-all cursor-pointer shadow-sm select-none",
          "border border-border rounded-lg bg-card dark:bg-slate-900 hover:bg-[#f6faf8] dark:hover:bg-slate-950",
          isOpen && "border-[var(--primary)] ring-4 ring-[var(--primary)]/10",
          disabled && "opacity-50 pointer-events-none bg-slate-50 dark:bg-slate-950 text-slate-400"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon size={14} className="text-slate-500 shrink-0" />
          <span className={cn("truncate font-bold", !internalValue ? "text-slate-400" : "text-foreground dark:text-slate-100")}>
            {formattedDisplay || placeholder}
          </span>
        </div>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform ml-1 shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[120] rounded-lg border border-border bg-card p-4 shadow-xl dark:bg-card"
          style={{
            top: panelStyle.top,
            left: panelStyle.left,
            width: panelStyle.width,
            visibility: panelStyle.visibility,
            backgroundColor: "var(--card)",
          }}
        >
          {/* Header Month/Year Navigator */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-600 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-0 outline-none p-0 cursor-pointer focus:ring-0 [&_option]:bg-card [&_option]:dark:bg-card [&_option]:text-foreground [&_option]:dark:text-slate-100"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-0 outline-none p-0 cursor-pointer focus:ring-0 font-mono [&_option]:bg-card [&_option]:dark:bg-card [&_option]:text-foreground [&_option]:dark:text-slate-100"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-600 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Days Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center py-2 text-[10px] font-bold text-slate-400">
            {DAYS_HEADER.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectDay(cell.day, cell.isCurrentMonth, cell.offsetMonth)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none",
                  cell.isCurrentMonth ? "text-foreground dark:text-slate-200" : "text-slate-300 dark:text-slate-700",
                  cell.isToday && !cell.isSelected && "border border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5",
                  cell.isSelected && "bg-[var(--primary)] text-white font-extrabold shadow-sm",
                  !cell.isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {cell.day}
              </button>
            ))}
          </div>

          {/* Footer Shortcuts */}
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-border">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded transition cursor-pointer"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[10px] font-bold text-[var(--primary)] hover:text-[var(--primary-strong)] px-2 py-1 rounded bg-[var(--primary)]/10 transition cursor-pointer"
            >
              Hari Ini
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
