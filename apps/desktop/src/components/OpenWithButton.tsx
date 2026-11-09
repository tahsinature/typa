import { useEffect, useState } from "react";
import { listImageApps, openImageWith, type ImageApp, type ImageFileBaseName } from "@/lib/image-file";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandShortcut } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Finder-style "Open With" menu that opens the current image in an app chosen by the user. */
export function OpenWithButton({ createPng, baseName }: { createPng: () => Promise<Blob>; baseName: ImageFileBaseName }) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<ImageApp[] | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || apps) return;
    listImageApps().then(setApps, (cause) => setError(messageOf(cause)));
  }, [open, apps]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError("");
  }

  async function openWith(app: ImageApp) {
    if (openingPath) return;
    setOpeningPath(app.path);
    setError("");
    try {
      await openImageWith(await createPng(), baseName, app);
      setOpen(false);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setOpeningPath(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 h-[24px] px-2 rounded-md text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer"
        >
          <OpenIcon />
          <span>Open with</span>
          <ChevronIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 overflow-hidden">
        <Command>
          <div className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium text-text-faint">Open With</div>
          <CommandList className="max-h-[280px] px-1.5 pb-1.5">
            {error && <div className="px-2.5 py-2 text-[12px] text-red-400">{error}</div>}
            {!apps && !error && <div className="px-2.5 py-2 text-[12px] text-text-faint">Loading apps…</div>}
            {apps && <CommandEmpty>No apps found</CommandEmpty>}
            {apps?.map((app) => (
              <CommandItem key={app.path} value={app.name} onSelect={() => openWith(app)} disabled={openingPath !== null}>
                {app.icon ? <img src={app.icon} alt="" className="size-[18px] shrink-0" /> : <span className="size-[18px] shrink-0" />}
                <span className="truncate">{app.name}</span>
                {openingPath === app.path ? <CommandShortcut>Opening…</CommandShortcut> : app.isDefault && <CommandShortcut>Default</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandList>
          <CommandInput autoFocus placeholder="Search applications…" wrapperClassName="h-10 border-b-0 border-t" />
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
