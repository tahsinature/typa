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
}

const statConfig = [
  { key: "characters" as const, label: "Characters", color: "#4d9fff" },
  { key: "charactersNoSpaces" as const, label: "No Spaces", color: "#6c8fff" },
  { key: "words" as const, label: "Words", color: "#34d058" },
  { key: "lines" as const, label: "Lines", color: "#a855f7" },
  { key: "sentences" as const, label: "Sentences", color: "#f59e0b" },
  { key: "paragraphs" as const, label: "Paragraphs", color: "#f472b6" },
];

/* -- Animated Number -- */

function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = Math.round(v).toLocaleString();
      },
    });

    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span ref={ref} className="text-[28px] font-mono font-bold tabular-nums leading-none" style={{ color }}>
      {value.toLocaleString()}
    </span>
  );
}

/* -- Stat Card -- */

function StatCard({ value, label, color, index }: { value: number; label: string; color: string; index: number }) {
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
