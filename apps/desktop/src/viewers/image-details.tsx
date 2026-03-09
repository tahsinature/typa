import { InfoIcon } from "@/components/Icons";
import { ImageDetailsTable } from "./ImageDetailsTable";
import { useTabImages } from "./useTabImages";
import { registerViewer } from "./registry";

function ImageDetailsViewer({ theme }: { data: string; theme: "dark" | "light" }) {
  const { imageA, imageB } = useTabImages();

  const images = [
    ...(imageA ? [{ src: imageA, label: "Image A" }] : []),
    ...(imageB ? [{ src: imageB, label: "Image B" }] : []),
  ];

  if (images.length === 0) {
    return <div className="p-3 text-text-muted text-[13px]">No images loaded</div>;
  }

  return (
    <div className="h-full overflow-auto p-3" style={{ backgroundColor: "var(--bg)" }}>
      <ImageDetailsTable images={images} theme={theme} />
    </div>
  );
}

registerViewer({
  parse: (output) => output,
  id: "image-details",
  name: "File Details",
  icon: InfoIcon,
  component: ImageDetailsViewer,
});
