import { SplitIcon } from "@/components/Icons";
import { useTabImages } from "./useTabImages";
import { registerViewer } from "./registry";

function ImageSplitViewer({ theme }: { data: string; theme: "dark" | "light" }) {
  const { imageA, imageB } = useTabImages();
  const border = theme === "dark" ? "#2d2d30" : "#e5e5ea";

  if (!imageA || !imageB) {
    return <div className="p-3 text-text-muted text-[13px]">Both images required</div>;
  }

  return (
    <div className="h-full flex" style={{ backgroundColor: "var(--bg)" }}>
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden" style={{ borderRight: `1px solid ${border}` }}>
        <img src={imageA} alt="Image A" className="max-w-full max-h-full object-contain" />
      </div>
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <img src={imageB} alt="Image B" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
}

registerViewer({
  parse: (output) => output,
  id: "image-split",
  name: "Split View",
  icon: SplitIcon,
  component: ImageSplitViewer,
});
