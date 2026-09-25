// Offline Iconify ikon bileşeni. @iconify/tailwind4 dinamik plugin'i build-time'da
// ikon class'ından CSS mask üretir (runtime fetch YOK, currentColor'la renklenir →
// tema + neo-stillere uyar). Kullanım: <Icon icon="lucide:settings" size={16} />
export default function Icon({ icon, size = 16, className = "", style, ...rest }) {
  const cls = `icon-[${icon.replace(":", "--")}]`;
  return (
    <span
      className={`${cls} inline-block shrink-0 align-[-0.125em] ${className}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}
