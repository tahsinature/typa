import { useState, useEffect } from "react";
import { CalendarIcon } from "@/components/Icons";
import { registerInputWidget } from "./registry";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputs(date: Date) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

function DatePickerWidget({
  input,
  onInputChange,
  theme,
}: {
  input: string;
  onInputChange: (value: string) => void;
  theme: "dark" | "light";
}) {
  const isDark = theme === "dark";

  // Try to parse current input as a date
  const parsedFromInput = (() => {
    if (!input.trim()) return new Date();
    // Try as timestamp
    const asNum = Number(input.trim());
    if (!isNaN(asNum) && asNum > 0) {
      return new Date(asNum < 1e12 ? asNum * 1000 : asNum);
    }
    // Try as date string
    const d = new Date(input.trim());
    return isNaN(d.getTime()) ? new Date() : d;
  })();

  const initial = toLocalInputs(parsedFromInput);
  const [dateStr, setDateStr] = useState(initial.date);
  const [timeStr, setTimeStr] = useState(initial.time);

  // Sync back to input when date/time changes
  useEffect(() => {
    const d = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(d.getTime())) return;
    onInputChange(d.toISOString());
  }, [dateStr, timeStr]);

  const setNow = () => {
    const now = new Date();
    const vals = toLocalInputs(now);
    setDateStr(vals.date);
    setTimeStr(vals.time);
  };

  const inputStyle = {
    backgroundColor: isDark ? "#35373d" : "#ffffff",
    borderColor: isDark ? "#4a4a4e" : "#d1d1d6",
    color: isDark ? "#cccccc" : "#1d1d1f",
  };

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-5 p-6 select-none"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <label className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Date</label>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-[14px] focus:outline-none focus:border-accent"
          style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', monospace" }}
        />

        <label className="text-[11px] text-text-muted font-medium uppercase tracking-wide mt-2">Time</label>
        <input
          type="time"
          value={timeStr}
          step="1"
          onChange={(e) => setTimeStr(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-[14px] focus:outline-none focus:border-accent"
          style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', monospace" }}
        />

        <button
          onClick={setNow}
          className="mt-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
          style={{
            backgroundColor: isDark ? "rgba(0,122,255,0.15)" : "rgba(0,122,255,0.1)",
            color: "var(--cl-accent)",
          }}
        >
          Now
        </button>
      </div>

      <div className="text-[11px] text-text-faint text-center">
        Pick a date &amp; time, or type directly in the editor
      </div>
    </div>
  );
}

registerInputWidget({
  id: "date-picker",
  name: "Date Picker",
  icon: CalendarIcon,
  component: DatePickerWidget,
});
