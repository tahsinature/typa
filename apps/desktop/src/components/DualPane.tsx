import { useEffect, useCallback, useState, useMemo } from "react";
import { Allotment } from "allotment";
import { getTransform, CATEGORY_META } from "@typa/engine";
import { useTabStore } from "@/stores/tabStore";
import { useEngineStore } from "@/stores/engineStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { FullscreenIcon, ExitFullscreenIcon, InfoIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getOutputViewsForTransform } from "@/viewers";
import { getInputViewsForTransform } from "@/widgets";

/* -- Pane Header -- */

function PaneHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 h-[32px] shrink-0 border-b border-border-subtle/50 bg-bg-surface/60">
      {children}
    </div>
  );
}

function PaneLabel({ children, accentColor }: { children: React.ReactNode; accentColor?: string }) {
  return (
    <div className="flex items-center gap-2">
      {accentColor && (
        <span
          className="size-[5px] rounded-full"
          style={{ background: accentColor, boxShadow: `0 0 5px ${accentColor}30` }}
        />
      )}
      <span className="text-[10px] text-text-muted font-semibold tracking-[0.08em] uppercase select-none">
        {children}
      </span>
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSep() {
  return <div className="w-px h-3 bg-white/[0.06] mx-1" />;
}

/* -- Preset Dropdown -- */

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PresetDropdown({ presets, activeId, onSelect }: { presets: { id: string; label: string }[]; activeId: string | undefined; onSelect: (id: string) => void }) {
  const active = presets.find((p) => p.id === activeId) ?? presets[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 h-[24px] px-2 rounded-md text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-all duration-150 cursor-pointer outline-none">
          <span>{active.label}</span>
          <ChevronDownIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={preset.id === active.id ? "text-accent" : ""}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -- Input Tips -- */

function renderTipText(tip: string) {
  // Render backtick-delimited spans as styled inline code.
  return tip.split("`").map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="px-1 py-0.5 rounded bg-bg-secondary font-mono text-[11px] text-text">
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function InputTips({ title, tips }: { title: string; tips: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton variant="subtle" aria-label={`${title} tips`}>
          <InfoIcon />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] max-w-[80vw]">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {title} tips
          </span>
          <ul className="flex flex-col gap-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-text-secondary">
                <span className="text-text-faint select-none">&bull;</span>
                <span className="min-w-0">{renderTipText(tip)}</span>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -- Transform Error -- */

function TransformError({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center select-none p-6">
      <div className="max-w-md w-full">
        <div
          className="rounded-xl px-5 py-4 flex items-start gap-4"
          style={{
            background: "rgba(248, 81, 73, 0.04)",
            border: "1px solid rgba(248, 81, 73, 0.12)",
          }}
        >
          <div className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(248, 81, 73, 0.08)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cl-danger)" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[12px] font-semibold" style={{ color: "var(--cl-danger)" }}>
              Transform Error
            </span>
            <code className="text-[11.5px] font-mono text-text-secondary/80 leading-relaxed break-all select-text">
              {message}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Empty State -- */

function EmptyOutput() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-faint/50">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[12px] text-text-faint/60">No output yet</p>
        <p className="text-[10.5px] text-text-faint/35 mt-0.5">Type in the input pane to see results</p>
      </div>
    </div>
  );
}

/* -- View Tab Button -- */

function ViewTab({ label, icon: Icon, active, disabled, errorTooltip, onClick }: { label: string; icon: React.ComponentType; active: boolean; disabled?: boolean; errorTooltip?: string; onClick: () => void }) {
  return (
    <IconButton tooltip={disabled && errorTooltip ? errorTooltip : label} active={active} onClick={disabled ? undefined : onClick} className={disabled ? "cursor-not-allowed opacity-40" : undefined}>
      <Icon />
    </IconButton>
  );
}

/* -- Main Component -- */

export function DualPane({ tabId }: { tabId: string }) {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateInput = useTabStore((s) => s.updateInput);
  const updateOutput = useTabStore((s) => s.updateOutput);
  const updateExecTime = useTabStore((s) => s.updateExecTime);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const layout = useSettingsStore((s) => s.layout);

  const [activeInputViewId, setActiveInputViewId] = useState<string | null>(null);
  const [activeOutputViewId, setActiveOutputViewId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [outputFullscreen, setOutputFullscreen] = useState(false);

  // Listen for ⌘⇧⏎ fullscreen toggle (only active tab responds)
  useEffect(() => {
    const handler = () => {
      if (useTabStore.getState().activeTabId === tabId) {
        setOutputFullscreen((f) => !f);
      }
    };
    window.addEventListener('toggle-fullscreen', handler);
    return () => window.removeEventListener('toggle-fullscreen', handler);
  }, [tabId]);

  if (!tab) return null;

  const inputs = tab?.inputs ?? [""];
  const output = tab?.output ?? "";
  const outputData = tab?.outputData;
  const selectedTransformId = tab?.selectedTransformId ?? "calculator";

  const transform = selectedTransformId !== "calculator" ? getTransform(selectedTransformId) : undefined;
  const inputCount = transform?.inputs ?? 1;
  const category = transform?.category ?? "Math";
  const accentColor = CATEGORY_META[category]?.color;

  // Resolve available views
  const inputViewIds = transform?.inputViews ?? ["raw-input"];
  const outputViewIds = transform?.outputViews ?? ["raw-output"];
  const availableInputViews = getInputViewsForTransform(inputViewIds);
  const availableOutputViews = getOutputViewsForTransform(outputViewIds);

  // Active views — default to first available
  const activeInputView = availableInputViews.find((v) => v.id === activeInputViewId) ?? availableInputViews[0] ?? null;
  const activeOutputView = availableOutputViews.find((v) => v.id === activeOutputViewId) ?? availableOutputViews[0] ?? null;

  // Active preset — default to first defined
  const presets = transform?.presets ?? [];
  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0] ?? null;

  // Reset active view + preset when transform changes
  useEffect(() => {
    setActiveInputViewId(null);
    setActiveOutputViewId(null);
    setActivePresetId(null);
  }, [selectedTransformId]);

  const parsedData = useMemo(() => {
    if (!activeOutputView) return null;
    try {
      return activeOutputView.parse(output, outputData);
    } catch {
      return null;
    }
  }, [activeOutputView, output, outputData]);

  const runTransform = useCallback(
    async (transformId: string, presetId: string | null, ...texts: string[]) => {
      const start = performance.now();
      if (transformId === "calculator") {
        const engine = useEngineStore.getState().engine;
        const results = engine.evaluateDocument(texts[0]);
        const outputLines = texts[0].split("\n").map((_, i) => {
          const r = results[i];
          if (!r || r.result === null) return "";
          return String(r.result);
        });
        updateOutput(tabId, outputLines.join("\n"));
      } else {
        const t = getTransform(transformId);
        if (!t) return;
        try {
          const args = t.presets && presetId ? [...texts, presetId] : texts;
          const result = await t.fn(...args);
          if (typeof result === "string") {
            updateOutput(tabId, result);
          } else {
            updateOutput(tabId, result.text, result.data);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          updateOutput(tabId, `Error: ${msg}`);
        }
      }
      updateExecTime(tabId, performance.now() - start);
    },
    [tabId, updateOutput, updateExecTime],
  );

  useEffect(() => {
    // Debounce large inputs so each keystroke doesn't re-parse everything;
    // small inputs run immediately to stay snappy.
    const total = inputs.reduce((n, s) => n + s.length, 0);
    const delay = total > 50_000 ? 150 : 0;
    const handle = setTimeout(() => {
      runTransform(selectedTransformId, activePreset?.id ?? null, ...inputs.slice(0, inputCount));
    }, delay);
    return () => clearTimeout(handle);
  }, [inputs, inputCount, selectedTransformId, activePreset?.id, runTransform]);

  const themeMode: "dark" | "light" = resolvedTheme === "dark" ? "dark" : "light";
  const hasInputPane = availableInputViews.length > 0;
  const hasError = output.startsWith("Error: ");

  /* -- Render input pane content -- */
  const renderInputPane = () => {
    if (!activeInputView) return null;

    if (inputCount > 1) {
      return (
        <Allotment key={`input-${layout}`} vertical={layout === "horizontal"}>
          {Array.from({ length: inputCount }, (_, idx) => {
            const label = String.fromCharCode(65 + idx);
            const value = inputs[idx] ?? "";
            return (
              <Allotment.Pane key={idx}>
                <div className="flex flex-col h-full">
                  <PaneHeader>
                    <PaneLabel>Input {label}</PaneLabel>
                    {availableInputViews.length > 1 && (
                      <ToolbarGroup>
                        {availableInputViews.map((view) => (
                          <ViewTab key={view.id} label={view.name} icon={view.icon} active={activeInputView.id === view.id} onClick={() => setActiveInputViewId(view.id)} />
                        ))}
                      </ToolbarGroup>
                    )}
                  </PaneHeader>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <activeInputView.component input={value} onInputChange={(v) => updateInput(tabId, idx, v)} theme={themeMode} />
                  </div>
                </div>
              </Allotment.Pane>
            );
          })}
        </Allotment>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <PaneHeader>
          <PaneLabel>Input</PaneLabel>
          {(availableInputViews.length > 1 || (transform?.tips?.length ?? 0) > 0) && (
            <ToolbarGroup>
              {availableInputViews.length > 1 &&
                availableInputViews.map((view) => (
                  <ViewTab key={view.id} label={view.name} icon={view.icon} active={activeInputView.id === view.id} onClick={() => setActiveInputViewId(view.id)} />
                ))}
              {transform?.tips && transform.tips.length > 0 && (
                <InputTips title={transform.name} tips={transform.tips} />
              )}
            </ToolbarGroup>
          )}
        </PaneHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <activeInputView.component input={inputs[0] ?? ""} onInputChange={(value) => updateInput(tabId, 0, value)} theme={themeMode} />
        </div>
      </div>
    );
  };

  /* -- Render output pane content -- */
  const renderOutputPane = () => (
    <div className={`flex flex-col ${outputFullscreen ? "fixed inset-0 z-50 bg-bg" : "h-full"}`}>
      <PaneHeader>
        <PaneLabel accentColor={accentColor}>Output</PaneLabel>
        <ToolbarGroup>
          <IconButton tooltip={outputFullscreen ? "Exit fullscreen ⌘⇧⏎" : "Fullscreen ⌘⇧⏎"} active={outputFullscreen} onClick={() => setOutputFullscreen((f) => !f)}>
            {outputFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </IconButton>
          {presets.length > 0 && <ToolbarSep />}
          {presets.length > 0 && (
            <PresetDropdown presets={presets} activeId={activePreset?.id} onSelect={setActivePresetId} />
          )}
          {availableOutputViews.length > 1 && <ToolbarSep />}
          {availableOutputViews.length > 1 && (
            <div
              className="flex items-center gap-0.5 rounded-md px-1 py-0.5 -mx-1 transition-colors duration-150"
              style={hasError ? { background: "rgba(248, 81, 73, 0.08)" } : undefined}
            >
              {availableOutputViews.map((view) => (
                <ViewTab key={view.id} label={view.name} icon={view.icon} active={activeOutputView?.id === view.id} disabled={hasError} errorTooltip="Output unavailable" onClick={() => setActiveOutputViewId(view.id)} />
              ))}
            </div>
          )}
        </ToolbarGroup>
      </PaneHeader>
      <div className="flex-1 min-h-0 overflow-hidden">
        {hasError ? (
          <TransformError message={output.slice(7)} />
        ) : activeOutputView && parsedData !== null ? (
          <activeOutputView.component
            data={parsedData}
            theme={themeMode}
            input={inputCount === 1 ? (inputs[0] ?? "") : undefined}
            onInputChange={inputCount === 1 ? (v) => updateInput(tabId, 0, v) : undefined}
            transform={transform}
          />
        ) : (
          <EmptyOutput />
        )}
      </div>
    </div>
  );

  /* -- Layout -- */
  if (!hasInputPane) {
    return renderOutputPane();
  }

  return (
    <Allotment key={layout} vertical={layout === "vertical"}>
      <Allotment.Pane>{renderInputPane()}</Allotment.Pane>
      <Allotment.Pane>{renderOutputPane()}</Allotment.Pane>
    </Allotment>
  );
}
