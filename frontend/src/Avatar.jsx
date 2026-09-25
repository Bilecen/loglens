// Ad + soyad baş harfleri (tek kelimeyse tek harf). E-posta ise ilk harf.
function initials(label) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

// Kullanıcı avatarı: fotoğraf (data-URI) varsa resim, yoksa gradient baş harf(ler)i.
export default function Avatar({ user, size = 32, className = "" }) {
  const label = user?.name || user?.email || "?";
  if (user?.avatar) {
    return (
      <img src={user.avatar} alt={label}
        className={`rounded-lg object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }} />
    );
  }
  return (
    <span className={`avatar shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(label)}
    </span>
  );
}
