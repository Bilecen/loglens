import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Icon from "./Icon";
import { useLocale } from "./i18n";

// Bu sunucunun herkese açık adresi — mobil uygulama bunu okuyup kendi
// sunucusu olarak ekler. Deep link şeması: loglens://add-server?url=<origin>
const serverUrl = window.location.origin;
const deepLink = `loglens://add-server?url=${encodeURIComponent(serverUrl)}`;

export default function ServerQR() {
  const { t } = useLocale();
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, deepLink, {
      width: 176,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm p-4 flex items-center gap-4">
      <div className="rounded-xl bg-white p-2 shrink-0">
        <canvas ref={canvasRef} className="block w-[88px] h-[88px]" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Icon icon="lucide:smartphone" size={15} />
          {t("serverQr.connectToMobile")}
        </div>
        <p className="text-[12px] opacity-80 mt-1 leading-snug">
          {t("serverQr.scanHint")}
        </p>
        <button
          onClick={copy}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-medium opacity-90 hover:opacity-100 max-w-full"
        >
          <Icon icon={copied ? "lucide:check" : "lucide:copy"} size={13} className="shrink-0" />
          <span className="truncate">{copied ? t("serverQr.copied") : serverUrl}</span>
        </button>
      </div>
    </div>
  );
}
