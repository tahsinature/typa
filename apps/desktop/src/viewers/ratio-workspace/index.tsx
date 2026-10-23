import { evaluateRatioWorkspace, readRatioWorkspace, type RatioMode } from "@typa/engine";
import { CounterIcon } from "@/components/Icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registerOutputView } from "../registry";
import { buttonClass, ResultPanel } from "./controls";
import { examples, modeInfo } from "./examples";
import { DimensionsPanel, PercentagesPanel, ProportionPanel, RatioPanel, SplitPanel } from "./panels";
import { ResultPreview } from "./previews";

const panels = {
  simplify: RatioPanel,
  scale: DimensionsPanel,
  proportion: ProportionPanel,
  split: SplitPanel,
  shares: PercentagesPanel,
};

function RatioWorkspaceView({
  input = "",
  onInputChange,
}: {
  data: string;
  theme: "dark" | "light";
  input?: string;
  onInputChange?: (value: string) => void;
}) {
  const state = readRatioWorkspace(input);
  const result = evaluateRatioWorkspace(state);
  const Panel = panels[state.mode];
  const update = (next: typeof state) => onInputChange?.(JSON.stringify(next));
  return (
    <div className="h-full overflow-auto bg-bg text-text">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
              Numbers / Everyday calculations
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight">Ratio & Proportion</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              Find the relationship. Scale it, share it, or solve for what’s missing.
            </p>
          </div>
          <span className="mt-1 hidden rounded-full border border-border-subtle px-2.5 py-1 text-[10px] text-text-muted sm:block">
            Updates as you edit
          </span>
        </header>
        <Tabs
          value={state.mode}
          onValueChange={(mode) => update({ ...state, mode: mode as RatioMode })}
          className="flex flex-col gap-6"
        >
          <div className="overflow-x-auto border-b border-border-subtle pb-3">
            <TabsList aria-label="Ratio calculation modes" className="gap-1.5">
              {modeInfo.map((mode) => (
                <TabsTrigger
                  key={mode.id}
                  value={mode.id}
                  className="gap-2 px-3 py-2 data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none"
                >
                  <span aria-hidden="true" className="font-mono text-[10px] opacity-50">
                    {mode.number}
                  </span>
                  {mode.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {modeInfo.map((mode) => (
            <TabsContent key={mode.id} value={mode.id} className="flex flex-col gap-6 data-[state=inactive]:hidden">
              {state.mode === mode.id && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[11px] text-text-faint">Try an example</span>
                    {examples[state.mode].map((example) => (
                      <button
                        type="button"
                        key={example.label}
                        className={buttonClass}
                        onClick={() => update({ ...state, ...example.patch })}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid items-start gap-7 min-[800px]:grid-cols-[1fr_0.95fr]">
                    <div className="min-w-0 py-1">
                      <Panel state={state} onChange={update} />
                    </div>
                    <ResultPanel result={result}>
                      <ResultPreview state={state} result={result} />
                    </ResultPanel>
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
        <footer className="border-t border-border-subtle pt-4 text-[10px] leading-relaxed text-text-faint">
          Decimals welcome · Up to 12 parts · All calculations run locally
        </footer>
      </div>
    </div>
  );
}

registerOutputView({
  id: "ratio-workspace",
  name: "Calculator",
  icon: CounterIcon,
  parse: (output) => output,
  component: RatioWorkspaceView,
});
