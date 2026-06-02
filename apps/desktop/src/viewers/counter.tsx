import { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";
import { CounterIcon } from "@/components/Icons";
import { registerOutputView } from "./registry";

/* -- Types -- */

interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
}

type SizeUnit = "auto" | "B" | "KB" | "MB" | "GB";

const UNIT_CYCLE: SizeUnit[] = ["auto", "B", "KB", "MB", "GB"];

function formatBytesParts(n: number, unit: SizeUnit): { value: string; unit: string } {
  switch (unit) {
    case "auto":
      if (n < 1024) return { value: String(Math.round(n)), unit: "B" };
      if (n < 1024 * 1024) return { value: (n / 1024).toFixed(2), unit: "KB" };
      if (n < 1024 * 1024 * 1024) return { value: (n / (1024 * 1024)).toFixed(3), unit: "MB" };
      return { value: (n / (1024 * 1024 * 1024)).toFixed(4), unit: "GB" };
    case "B":
      return { value: Math.round(n).toLocaleString(), unit: "B" };
    case "KB":
      return { value: (n / 1024).toFixed(3), unit: "KB" };
    case "MB":
      return { value: (n / (1024 * 1024)).toFixed(4), unit: "MB" };
    case "GB":
      return { value: (n / (1024 * 1024 * 1024)).toFixed(6), unit: "GB" };
  }
}

const SIZE_COLOR = "#22d3ee";

const statConfig = [
  { key: "characters" as const, label: "Characters", color: "#4d9fff" },
  { key: "charactersNoSpaces" as const, label: "No Spaces", color: "#6c8fff" },
  { key: "words" as const, label: "Words", color: "#34d058" },
  { key: "lines" as const, label: "Lines", color: "#a855f7" },
  { key: "sentences" as const, label: "Sentences", color: "#f59e0b" },
  { key: "paragraphs" as const, label: "Paragraphs", color: "#f472b6" },
];

/* -- Cycle Icon -- */

function CycleIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/* -- Animated Number -- */

function AnimatedNumber({
  value,
  color,
  format,
}: {
  value: number;
  color: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);
  const formatter = format ?? ((n: number) => Math.round(n).toLocaleString());

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = formatter(v);
      },
    });

    prevValue.current = value;
    return () => controls.stop();
  }, [value, formatter]);

  return (
    <span ref={ref} className="text-[28px] font-mono font-bold tabular-nums leading-none" style={{ color }}>
      {formatter(value)}
    </span>
  );
}

/* -- Stat Card -- */

function StatCard({
  value,
  label,
  color,
  index,
}: {
  value: number;
  label: string;
  color: string;
  index: number;
}) {
  const [pulse, setPulse] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 250);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: pulse ? 1.04 : 1,
      }}
      transition={{
        delay: index * 0.06,
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        scale: { type: "spring", stiffness: 400, damping: 20 },
      }}
      className="flex flex-col items-center justify-center gap-2.5 rounded-xl px-3 py-5"
      style={{
        background: `color-mix(in srgb, ${color} 5%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <AnimatedNumber value={value} color={color} />
      <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">{label}</span>
    </motion.div>
  );
}

/* -- Animated Size (number + unit suffix) -- */

function AnimatedSize({ value, unit, color }: { value: number; unit: SizeUnit; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = formatBytesParts(v, unit).value;
      },
    });

    prevValue.current = value;
    return () => controls.stop();
  }, [value, unit]);

  const parts = formatBytesParts(value, unit);

  return (
    <div className="flex items-baseline justify-center gap-1.5 leading-none w-full whitespace-nowrap">
      <span
        ref={ref}
        className="text-[28px] font-mono font-bold tabular-nums"
        style={{ color }}
      >
        {parts.value}
      </span>
      <span
        className="text-[14px] font-mono font-semibold leading-none"
        style={{ color, opacity: 0.65 }}
      >
        {parts.unit}
      </span>
    </div>
  );
}

/* -- Size Card (clickable, cycles units) -- */

function SizeCard({ value, index }: { value: number; index: number }) {
  const [unit, setUnit] = useState<SizeUnit>("auto");
  const [pulse, setPulse] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 250);
    return () => clearTimeout(t);
  }, [value]);

  const cycle = () => {
    const i = UNIT_CYCLE.indexOf(unit);
    setUnit(UNIT_CYCLE[(i + 1) % UNIT_CYCLE.length]);
  };

  return (
    <motion.button
      type="button"
      onClick={cycle}
      title="Click to cycle units"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: pulse ? 1.04 : 1,
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{
        delay: index * 0.06,
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        scale: { type: "spring", stiffness: 400, damping: 20 },
      }}
      className="group col-span-3 flex flex-col items-center justify-center gap-2.5 rounded-xl px-3 py-5 cursor-pointer focus:outline-none transition-[background,border-color] duration-200 hover:[background:color-mix(in_srgb,var(--size-color)_9%,transparent)] hover:[border-color:color-mix(in_srgb,var(--size-color)_28%,transparent)] overflow-hidden"
      style={
        {
          "--size-color": SIZE_COLOR,
          background: `color-mix(in srgb, ${SIZE_COLOR} 5%, transparent)`,
          border: `1px solid color-mix(in srgb, ${SIZE_COLOR} 10%, transparent)`,
        } as React.CSSProperties
      }
    >
      <AnimatedSize value={value} unit={unit} color={SIZE_COLOR} />
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">
        <span>Size · {unit === "auto" ? "AUTO" : unit}</span>
        <span className="opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: SIZE_COLOR }}>
          <CycleIcon />
        </span>
      </span>
    </motion.button>
  );
}

/* -- Main Component -- */

function CounterViewer({ data }: { data: TextStats; theme: "dark" | "light" }) {
  if (!data) {
    return <div className="h-full flex items-center justify-center text-text-faint text-[13px]">Enter text to count</div>;
  }

  return (
    <div className="h-full overflow-auto flex items-center justify-center select-none">
      <div className="max-w-md w-full px-6 py-8">
        <div className="grid grid-cols-3 gap-3">
          {statConfig.map((s, i) => (
            <StatCard key={s.key} value={data[s.key] ?? 0} label={s.label} color={s.color} index={i} />
          ))}
          <SizeCard value={data.bytes ?? 0} index={statConfig.length} />
        </div>
      </div>
    </div>
  );
}

/* -- Register -- */

registerOutputView({
  id: "counter",
  name: "Counter",
  parse: (output): TextStats => JSON.parse(output),
  icon: CounterIcon,
  component: CounterViewer,
});
