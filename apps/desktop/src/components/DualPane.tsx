import { useEffect, useCallback, useState, useMemo } from "react";
import { Allotment } from "allotment";
import { getTransform } from "@typa/engine";
import { useTabStore } from "@/stores/tabStore";
import { useEngineStore } from "@/stores/engineStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { FullscreenIcon, ExitFullscreenIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { getOutputViewsForTransform } from "@/viewers";
import { getInputViewsForTransform } from "@/widgets";

/* -- Pane Header -- */

function PaneHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between px-3 h-[32px] shrink-0 border-b border-border-subtle bg-bg-secondary/40">{children}</div>;
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-text-muted font-medium tracking-wide uppercase">{children}</span>;
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSep() {
  return <div className="w-px h-3.5 bg-border-subtle mx-1" />;
}

/* -- Transform Error -- */

function TransformError({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center select-none">
      <div className="max-w-lg w-full px-6">
        <div
          className="rounded-xl px-5 py-4 flex items-start gap-4"
          style={{
            background: "rgba(248, 81, 73, 0.04)",
            border: "1px solid rgba(248, 81, 73, 0.12)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="shrink-0 mt-0.5">
            <circle cx="16" cy="16" r="15" stroke="var(--cl-danger)" strokeWidth="1.5" opacity="0.25" />
            <circle cx="16" cy="16" r="11" fill="var(--cl-danger)" opacity="0.1" />
            <path d="M12.5 12.5L19.5 19.5M19.5 12.5L12.5 19.5" stroke="var(--cl-danger)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold" style={{ color: "var(--cl-danger)" }}>
              Transform Error
            </span>
            <code className="text-[12px] font-mono text-text-secondary leading-relaxed break-all select-text">{message}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- View Tab Button -- */

function ViewTab({ label, icon: Icon, active, disabled, errorTooltip, onClick }: { label: string; icon: React.ComponentType; active: boolean; disabled?: boolean; errorTooltip?: string; onClick: () => void }) {
  return (
    <IconButton tooltip={disabled && errorTooltip ? errorTooltip : label} active={active} onClick={disabled ? undefined : onClick} className={disabled ? "cursor-not-allowed opacity-50" : undefined}>
      <Icon />
    </IconButton>
  );
}

/* -- Main Component -- */

export function DualPane() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateInput = useTabStore((s) => s.updateInput);
  const updateOutput = useTabStore((s) => s.updateOutput);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const layout = useSettingsStore((s) => s.layout);

  const [activeInputViewId, setActiveInputViewId] = useState<string | null>(null);
  const [activeOutputViewId, setActiveOutputViewId] = useState<string | null>(null);
  const [outputFullscreen, setOutputFullscreen] = useState(false);

  const inputs = tab?.inputs ?? [""];
  const output = tab?.output ?? "";
  const selectedTransformId = tab?.selectedTransformId ?? "calculator";

  const transform = selectedTransformId !== "calculator" ? getTransform(selectedTransformId) : undefined;
  const inputCount = transform?.inputs ?? 1;

  // Resolve available views
  const inputViewIds = transform?.inputViews ?? ["raw-input"];
  const outputViewIds = transform?.outputViews ?? ["raw-output"];
  const availableInputViews = getInputViewsForTransform(inputViewIds);
  const availableOutputViews = getOutputViewsForTransform(outputViewIds);

  // Active views — default to first available
  const activeInputView = availableInputViews.find((v) => v.id === activeInputViewId) ?? availableInputViews[0] ?? null;
  const activeOutputView = availableOutputViews.find((v) => v.id === activeOutputViewId) ?? availableOutputViews[0] ?? null;

  // Reset active view when transform changes
  useEffect(() => {
    setActiveInputViewId(null);
    setActiveOutputViewId(null);
  }, [selectedTransformId]);

  const parsedData = useMemo(() => {
    if (!activeOutputView) return null;
    try {
      return activeOutputView.parse(output);
    } catch {
      return null;
    }
  }, [activeOutputView, output]);

  const runTransform = useCallback(
    async (transformId: string, ...texts: string[]) => {
      if (transformId === "calculator") {
        const engine = useEngineStore.getState().engine;
        const results = engine.evaluateDocument(texts[0]);
        const outputLines = texts[0].split("\n").map((_, i) => {
          const r = results[i];
          if (!r || r.result === null) return "";
          return String(r.result);
        });
        updateOutput(activeTabId, outputLines.join("\n"));
      } else {
        const t = getTransform(transformId);
        if (!t) return;
        try {
          const result = await t.fn(...texts);
          updateOutput(activeTabId, result);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          updateOutput(activeTabId, `Error: ${msg}`);
        }
      }
    },
    [activeTabId, updateOutput],
  );

  useEffect(() => {
    runTransform(selectedTransformId, ...inputs.slice(0, inputCount));
  }, [inputs, inputCount, selectedTransformId, runTransform]);

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
                    <activeInputView.component input={value} onInputChange={(v) => updateInput(activeTabId, idx, v)} theme={themeMode} />
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
          {availableInputViews.length > 1 && (
            <ToolbarGroup>
              {availableInputViews.map((view) => (
                <ViewTab key={view.id} label={view.name} icon={view.icon} active={activeInputView.id === view.id} onClick={() => setActiveInputViewId(view.id)} />
              ))}
            </ToolbarGroup>
          )}
        </PaneHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <activeInputView.component input={inputs[0] ?? ""} onInputChange={(value) => updateInput(activeTabId, 0, value)} theme={themeMode} />
        </div>
      </div>
    );
  };

  /* -- Render output pane content -- */
  const renderOutputPane = () => (
    <div className={`flex flex-col ${outputFullscreen ? "fixed inset-0 z-50 bg-bg" : "h-full"}`}>
      <PaneHeader>
        <PaneLabel>Output</PaneLabel>
        <ToolbarGroup>
          <IconButton tooltip={outputFullscreen ? "Exit fullscreen" : "Fullscreen"} active={outputFullscreen} onClick={() => setOutputFullscreen((f) => !f)}>
            {outputFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </IconButton>
          {availableOutputViews.length > 1 && <ToolbarSep />}
          {availableOutputViews.length > 1 && (
            <div
              className="flex items-center gap-0.5 rounded-md px-1 py-0.5 -mx-1 transition-colors"
              style={hasError ? { background: "rgba(248, 81, 73, 0.1)" } : undefined}
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
          <activeOutputView.component data={parsedData} theme={themeMode} />
        ) : (
          <div className="h-full flex items-center justify-center text-text-faint text-[13px]">No output</div>
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
