import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { registerOutputView } from "../registry";
import { PresentEmpty } from "./empty";

function useQrSvg(text: string) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!text) {
      setSvg("");
      setError(null);
      return;
    }
    let cancelled = false;
    // Always black on white: inverted QR codes don't scan on many phones.
    QRCode.toString(text, { type: "svg", margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((result) => {
        if (cancelled) return;
        setSvg(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSvg("");
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return { svg, error };
}

function QrCodeView({ data }: { data: string; theme: "dark" | "light" }) {
  const text = data.trim();
  const { svg, error } = useQrSvg(text);

  if (!text) return <PresentEmpty message="Enter text to generate a QR code" />;
  if (error) return <PresentEmpty message={`Can't make a QR code: ${error}`} />;

  return (
    <div className="h-full p-8 flex items-center justify-center bg-bg">
      <div
        className="h-full aspect-square max-w-full rounded-lg overflow-hidden [&>svg]:w-full [&>svg]:h-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="2" width="4.5" height="4.5" />
      <rect x="9.5" y="2" width="4.5" height="4.5" />
      <rect x="2" y="9.5" width="4.5" height="4.5" />
      <path d="M9.5 9.5h2v2h-2zM12 12h2v2h-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

registerOutputView({
  id: "present-qr-code",
  name: "QR Code",
  icon: QrIcon,
  parse: (output) => output,
  component: QrCodeView,
});
