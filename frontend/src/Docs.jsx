import { useState } from "react";
import { marked } from "marked";
import Icon from "./Icon";
import { useLocale } from "./i18n";

// Tüm dokümanlar build'e gömülür (offline). ?raw ile ham markdown gelir.
// "NN-slug.md" = Türkçe, "NN-slug-en.md" = İngilizce; name'den "-en" soyulur ki
// aynı doküman iki dilde aynı anahtarla eşleşsin (dil değişince aynı sayfada kalınır).
const files = import.meta.glob("./docs/*.md", { query: "?raw", import: "default", eager: true });

const allDocs = Object.entries(files).map(([path, content]) => {
  const raw = path.split("/").pop().replace(".md", "");
  const isEn = raw.endsWith("-en");
  const name = isEn ? raw.slice(0, -3) : raw;
  const title = (content.match(/^#\s+(.+)$/m)?.[1] || name).trim();
  return { name, lang: isEn ? "en" : "tr", title, content, order: name === "README" ? 0 : (parseInt(name, 10) || 99) };
});

export default function Docs() {
  const { t, locale } = useLocale();
  // Henüz çevrilmemiş bir sayfa varsa tr'ye düş (boş ekran yerine).
  const localized = allDocs.filter((d) => d.lang === locale);
  const docs = (localized.length ? localized : allDocs.filter((d) => d.lang === "tr")).sort((a, b) => a.order - b.order);
  const [active, setActive] = useState(docs[0]?.name);
  const doc = docs.find((d) => d.name === active) || docs[0];

  // İç bağlantılar (…md ya da …md#çapa) tıklanınca sayfa değiştirsin, gerçek gezinme yapmasın.
  // "-en" soyulur ki hangi dilden link edilmişse edilsin aynı doküman anahtarına düşsün.
  const onClick = (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/\.md(#.*)?$/.test(href)) {
      e.preventDefault();
      setActive(href.replace(/\.md(#.*)?$/, "").replace(/-en$/, ""));
    }
  };

  return (
    <div className="anim-in">
      <div className="mb-5">
        <h2 className="text-[22px] font-extrabold tracking-tight flex items-center gap-2">
          <Icon icon="lucide:book-open" size={20} /> {t("docs.title")}
        </h2>
        <p className="text-muted text-[13px] mt-1">{t("docs.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5 items-start">
        {/* Konu listesi */}
        <nav className="card-surface p-2 flex flex-col gap-0.5 lg:sticky lg:top-20">
          {docs.map((d) => (
            <button key={d.name} onClick={() => setActive(d.name)}
              className={`text-left px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors
                ${active === d.name ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>
              {d.title}
            </button>
          ))}
        </nav>

        {/* İçerik */}
        <article className="card-surface p-6 prose-doc min-w-0"
          onClick={onClick} dangerouslySetInnerHTML={{ __html: marked.parse(doc.content) }} />
      </div>
    </div>
  );
}
