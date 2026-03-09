import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { getAllTransforms, CATEGORY_META, type TransformCategory } from "@typa/engine";
import { useTabStore } from "@/stores/tabStore";
import { useSettingsStore, type PaletteStyle } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface TransformItem {
  id: string;
  name: string;
  description: string;
  category: TransformCategory;
}

/* ── Category helpers ── */

const FALLBACK_META = { color: "#6e6e73", gradient: ["#6e6e73", "#525252"] as [string, string], iconPath: "M4 7h16M4 12h10M4 17h16" };

function cat(category: TransformCategory) {
  return CATEGORY_META[category] ?? FALLBACK_META;
}

function CategoryIcon({ category, size = 15 }: { category: TransformCategory; size?: number }) {
  const { iconPath } = cat(category);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={iconPath} />
    </svg>
  );
}

/* ── Shared data ── */

function useTransformData() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setSelectedTransform = useTabStore((s) => s.setSelectedTransform);
  const currentTransformId = useTabStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.selectedTransformId ?? "calculator"
  );

  const { flat, grouped } = useMemo(() => {
    const all = getAllTransforms();
    const map = new Map<string, TransformItem[]>();
    const calcItem: TransformItem = {
      id: "calculator", name: "Calculator",
      description: "Math expressions, variables, unit conversions", category: "Math",
    };
    map.set("Math", [calcItem]);
    const flatList: TransformItem[] = [calcItem];
    for (const t of all) {
      const item: TransformItem = { id: t.id, name: t.name, description: t.description, category: t.category };
      const list = map.get(t.category) ?? [];
      list.push(item);
      map.set(t.category, list);
      flatList.push(item);
    }
    return { flat: flatList, grouped: map };
  }, []);

  // Map id → searchable text for custom cmdk filter
  const searchMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of flat) m.set(t.id, `${t.name} ${t.description} ${t.category}`.toLowerCase());
    return m;
  }, [flat]);

  const filter = useCallback(
    (value: string, search: string) => {
      const text = searchMap.get(value) ?? "";
      return text.includes(search.toLowerCase()) ? 1 : 0;
    },
    [searchMap]
  );

  return { flat, grouped, activeTabId, setSelectedTransform, currentTransformId, filter };
}

/* ── Scroll selected item into view ── */

function useScrollSelected(focusedId: string, listRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [focusedId, listRef]);
}

/* ── Shared search input ── */

function SearchInput() {
  return (
    <div className="flex items-center gap-3 px-5 h-[52px] border-b border-white/[0.06]">
      <svg className="size-4 shrink-0 text-text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <CommandPrimitive.Input
        placeholder="Search transforms..."
        className="flex-1 h-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
      />
      <kbd className="hidden sm:inline-flex items-center rounded-[5px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
        esc
      </kbd>
    </div>
  );
}

/* ── Group heading classes ── */

const groupCls = "px-2 py-1 text-text [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-text-faint [&_[cmdk-group-heading]]:uppercase";

/* ── Keyboard hints ── */

function KeyboardHints({ extra }: { extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-text-faint select-none">
      {[
        { key: "↑↓", label: "navigate" },
        { key: "↵", label: "select" },
        { key: "esc", label: "close" },
      ].map((h) => (
        <span key={h.key} className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-px font-mono text-[10px] leading-[16px] min-w-[20px] text-center">
            {h.key}
          </kbd>
          <span className="text-text-faint/70">{h.label}</span>
        </span>
      ))}
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

/* ── Style switcher ── */

function StyleSwitcher() {
  const style = useSettingsStore((s) => s.paletteStyle);
  const set = useSettingsStore((s) => s.setPaletteStyle);
  const styles: { value: PaletteStyle; label: string }[] = [
    { value: "raycast", label: "Split" },
    { value: "linear", label: "Inline" },
    { value: "arc", label: "Vivid" },
  ];

  return (
    <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
      {styles.map((s) => (
        <button
          key={s.value}
          onClick={(e) => { e.stopPropagation(); set(s.value); }}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all duration-150",
            style === s.value
              ? "bg-white/[0.1] text-text shadow-sm"
              : "text-text-faint hover:text-text-muted"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/* ── Dialog shell ── */

function PaletteShell({
  open,
  onOpenChange,
  width,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  width: number;
  children: React.ReactNode;
}) {
  // Keep mounted briefly after close so exit animation can play
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      // Wait for exit animation to finish before unmounting
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay
          className="palette-overlay fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]"
          data-state={open ? "open" : "closed"}
        />
        <DialogPrimitive.Content
          className="palette-content fixed top-[50%] left-[50%] z-50 outline-none"
          style={{ width, maxWidth: "calc(100vw - 2rem)" }}
          aria-describedby={undefined}
          data-state={open ? "open" : "closed"}
          onAnimationEnd={(e) => {
            // Ensure clean unmount after exit animation
            if (!open && e.animationName === "palette-content-out") {
              setMounted(false);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
          <div className="rounded-2xl border border-white/[0.1] bg-[var(--bg-elevated)] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)_inset] overflow-hidden backdrop-blur-xl">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ═══════════════════════════════════════════════
   A — Raycast / Split
   ═══════════════════════════════════════════════ */

function RaycastPalette({ open, onOpenChange, onSelect }: PaletteProps) {
  const { grouped, currentTransformId, flat, filter } = useTransformData();
  const [focusedId, setFocusedId] = useState(flat[0]?.id ?? "");
  const focused = flat.find((t) => t.id === focusedId) ?? flat[0];
  const { color, gradient } = cat(focused.category);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollSelected(focusedId, listRef);

  return (
    <PaletteShell open={open} onOpenChange={onOpenChange} width={660}>
      <CommandPrimitive
        filter={filter}
        value={focusedId}
        onValueChange={setFocusedId}
      >
        <SearchInput />

        <div className="flex" style={{ height: 360 }}>
          {/* List */}
          <CommandPrimitive.List ref={listRef} className="w-[300px] overflow-y-auto overflow-x-hidden scroll-py-1 border-r border-white/[0.06] scrollbar-none">
            <CommandPrimitive.Empty className="py-10 text-center text-[13px] text-text-faint">
              No transforms found.
            </CommandPrimitive.Empty>
            {Array.from(grouped).map(([category, items]) => (
              <CommandPrimitive.Group key={category} heading={category} className={groupCls}>
                {items.map((t) => (
                  <CommandPrimitive.Item
                    key={t.id}
                    value={t.id}
                    onSelect={() => onSelect(t.id)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] cursor-default select-none outline-none transition-colors duration-75 data-[selected=true]:bg-white/[0.07]"
                  >
                    <span style={{ color: cat(t.category).color }} className="shrink-0 opacity-70">
                      <CategoryIcon category={t.category} />
                    </span>
                    <span className="flex-1 truncate text-text/90">{t.name}</span>
                    {t.id === currentTransformId && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold text-accent">
                        active
                      </span>
                    )}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>

          {/* Detail pane */}
          <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Ambient glow */}
            <div
              className="absolute inset-0 transition-all duration-500 ease-out opacity-[0.07]"
              style={{ background: `radial-gradient(ellipse at 50% 40%, ${color}, transparent 70%)` }}
            />
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(${color}40 1px, transparent 1px), linear-gradient(90deg, ${color}40 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative flex flex-col items-center gap-5 px-8">
              {/* Icon container */}
              <div
                className="flex items-center justify-center rounded-[18px] p-4 transition-all duration-300"
                style={{
                  color,
                  background: `linear-gradient(135deg, ${gradient[0]}18, ${gradient[1]}10)`,
                  border: `1px solid ${color}20`,
                  boxShadow: `0 8px 32px ${color}12, 0 0 0 1px ${color}08 inset`,
                }}
              >
                <CategoryIcon category={focused.category} size={32} />
              </div>

              {/* Text */}
              <div className="text-center space-y-1.5">
                <h3 className="text-[15px] font-semibold text-text tracking-[-0.01em]">{focused.name}</h3>
                <p className="text-[11.5px] text-text-muted/80 leading-[1.6] max-w-[200px]">
                  {focused.description}
                </p>
              </div>

              {/* Pills */}
              <div className="flex flex-wrap justify-center gap-1.5">
                <span
                  className="rounded-full px-2.5 py-[3px] text-[10px] font-medium"
                  style={{ color, background: `${color}12`, border: `1px solid ${color}18` }}
                >
                  {focused.category}
                </span>
                {focused.id === currentTransformId && (
                  <span className="rounded-full px-2.5 py-[3px] text-[10px] font-medium bg-accent/10 text-accent border border-accent/15">
                    Currently Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <KeyboardHints extra={<StyleSwitcher />} />
      </CommandPrimitive>
    </PaletteShell>
  );
}

/* ═══════════════════════════════════════════════
   B — Linear / Inline expand
   ═══════════════════════════════════════════════ */

function LinearPalette({ open, onOpenChange, onSelect }: PaletteProps) {
  const { grouped, currentTransformId, flat, filter } = useTransformData();
  const [focusedId, setFocusedId] = useState(flat[0]?.id ?? "");
  const focused = flat.find((t) => t.id === focusedId) ?? flat[0];
  const listRef = useRef<HTMLDivElement>(null);
  useScrollSelected(focusedId, listRef);

  return (
    <PaletteShell open={open} onOpenChange={onOpenChange} width={480}>
      <CommandPrimitive
        filter={filter}
        value={focusedId}
        onValueChange={setFocusedId}
      >
        <SearchInput />

        <CommandPrimitive.List ref={listRef} className="max-h-[400px] overflow-y-auto overflow-x-hidden scroll-py-1 scrollbar-none">
          <CommandPrimitive.Empty className="py-10 text-center text-[13px] text-text-faint">
            No transforms found.
          </CommandPrimitive.Empty>

          {Array.from(grouped).map(([category, items]) => (
            <CommandPrimitive.Group key={category} heading={category} className={groupCls}>
              {items.map((t) => {
                const isExpanded = focused?.id === t.id;
                const { color } = cat(t.category);
                return (
                  <CommandPrimitive.Item
                    key={t.id}
                    value={t.id}
                    onSelect={() => onSelect(t.id)}
                    className="flex flex-col cursor-default rounded-lg px-3 text-[13px] outline-none select-none transition-all duration-100 data-[selected=true]:bg-white/[0.06]"
                  >
                    {/* Row */}
                    <div className="flex items-center gap-2.5 py-2">
                      <span style={{ color }} className="shrink-0 opacity-70">
                        <CategoryIcon category={t.category} />
                      </span>
                      <span className="flex-1 truncate text-text/90">{t.name}</span>
                      {t.id === currentTransformId && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold text-accent">
                          active
                        </span>
                      )}
                    </div>

                    {/* Inline detail */}
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-200 ease-out",
                        isExpanded ? "max-h-[72px] opacity-100 pb-2.5" : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="flex items-center gap-3 ml-[30px] rounded-lg p-2.5" style={{ background: `${color}06`, border: `1px solid ${color}10` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-text-muted/80 leading-[1.55] line-clamp-2">{t.description}</p>
                          <span
                            className="inline-block mt-1.5 rounded-full px-2 py-px text-[9px] font-semibold"
                            style={{ color, background: `${color}15` }}
                          >
                            {t.category}
                          </span>
                        </div>
                        <div className="shrink-0 rounded-lg p-1.5" style={{ color, opacity: 0.5 }}>
                          <CategoryIcon category={t.category} size={20} />
                        </div>
                      </div>
                    </div>
                  </CommandPrimitive.Item>
                );
              })}
            </CommandPrimitive.Group>
          ))}
        </CommandPrimitive.List>

        <KeyboardHints extra={<StyleSwitcher />} />
      </CommandPrimitive>
    </PaletteShell>
  );
}

/* ═══════════════════════════════════════════════
   C — Arc / Vivid gradient preview
   ═══════════════════════════════════════════════ */

function ArcPalette({ open, onOpenChange, onSelect }: PaletteProps) {
  const { grouped, currentTransformId, flat, filter } = useTransformData();
  const [focusedId, setFocusedId] = useState(flat[0]?.id ?? "");
  const focused = flat.find((t) => t.id === focusedId) ?? flat[0];
  const { color, gradient } = cat(focused.category);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollSelected(focusedId, listRef);

  return (
    <PaletteShell open={open} onOpenChange={onOpenChange} width={700}>
      <CommandPrimitive
        filter={filter}
        value={focusedId}
        onValueChange={setFocusedId}
      >
        <SearchInput />

        <div className="flex" style={{ height: 380 }}>
          {/* Minimal list */}
          <CommandPrimitive.List ref={listRef} className="w-[260px] overflow-y-auto overflow-x-hidden scroll-py-1 border-r border-white/[0.06] scrollbar-none">
            <CommandPrimitive.Empty className="py-10 text-center text-[13px] text-text-faint">
              No transforms found.
            </CommandPrimitive.Empty>
            {Array.from(grouped).map(([category, items]) => (
              <CommandPrimitive.Group key={category} heading={category} className={groupCls}>
                {items.map((t) => (
                  <CommandPrimitive.Item
                    key={t.id}
                    value={t.id}
                    onSelect={() => onSelect(t.id)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] cursor-default select-none outline-none transition-colors duration-75 data-[selected=true]:bg-white/[0.07]"
                  >
                    <span
                      className="size-[7px] rounded-full shrink-0 transition-colors duration-300"
                      style={{ background: cat(t.category).color }}
                    />
                    <span className="flex-1 truncate text-text/90">{t.name}</span>
                    {t.id === currentTransformId && (
                      <span className="size-[5px] rounded-full bg-accent shrink-0" />
                    )}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>

          {/* Vivid preview */}
          <div className="flex-1 relative overflow-hidden">
            {/* Layered gradient */}
            <div
              className="absolute inset-0 transition-all duration-700 ease-out"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 20%, ${gradient[0]}15 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, ${gradient[1]}12 0%, transparent 50%),
                  radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 70%)
                `,
              }}
            />

            {/* Floating orb */}
            <div
              className="absolute top-8 right-8 w-28 h-28 rounded-full blur-3xl transition-all duration-700 opacity-20"
              style={{ background: gradient[0] }}
            />
            <div
              className="absolute bottom-12 left-8 w-20 h-20 rounded-full blur-2xl transition-all duration-700 opacity-15"
              style={{ background: gradient[1] }}
            />

            {/* Content */}
            <div className="relative flex flex-col items-center justify-center h-full gap-6 px-10">
              {/* Icon with glow */}
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-full blur-2xl transition-all duration-500 opacity-25"
                  style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
                />
                <div
                  className="relative flex items-center justify-center rounded-[20px] p-5 transition-all duration-400"
                  style={{
                    color,
                    background: `linear-gradient(145deg, ${gradient[0]}20, ${gradient[1]}12)`,
                    border: `1.5px solid ${color}25`,
                    boxShadow: `0 12px 40px ${color}15, 0 0 0 1px ${color}08 inset`,
                  }}
                >
                  <CategoryIcon category={focused.category} size={40} />
                </div>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h3 className="text-[18px] font-bold text-text tracking-[-0.02em]">{focused.name}</h3>
                <p className="text-[12px] text-text-muted/70 leading-[1.65] max-w-[240px] mx-auto">
                  {focused.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide"
                  style={{
                    color,
                    background: `linear-gradient(135deg, ${gradient[0]}15, ${gradient[1]}10)`,
                    border: `1px solid ${color}20`,
                  }}
                >
                  {focused.category}
                </span>
                {focused.id === currentTransformId && (
                  <span className="rounded-full px-3 py-1 text-[10px] font-semibold bg-accent/12 text-accent border border-accent/18">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <KeyboardHints extra={<StyleSwitcher />} />
      </CommandPrimitive>
    </PaletteShell>
  );
}

/* ═══════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════ */

interface PaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string) => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const paletteStyle = useSettingsStore((s) => s.paletteStyle);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setSelectedTransform = useTabStore((s) => s.setSelectedTransform);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
      if (mod && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedTransform(activeTabId, id);
      setOpen(false);
    },
    [activeTabId, setSelectedTransform]
  );

  const props: PaletteProps = { open, onOpenChange: setOpen, onSelect: handleSelect };

  switch (paletteStyle) {
    case "raycast": return <RaycastPalette {...props} />;
    case "linear":  return <LinearPalette {...props} />;
    case "arc":     return <ArcPalette {...props} />;
  }
}
