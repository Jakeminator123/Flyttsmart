import { useState, useEffect, useRef } from "react";

// ─── SEO HEAD INJECTION ────────────────────────────────────────────────────────
function SEOHead({ title, description, canonical, articleSchema }) {
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = "sv";
    document.documentElement.setAttribute("dir", "ltr");

    const setMeta = (name, content, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };

    // Charset
    if (!document.querySelector('meta[charset]')) {
      const charMeta = document.createElement("meta");
      charMeta.setAttribute("charset", "UTF-8");
      document.head.insertBefore(charMeta, document.head.firstChild);
    }
    setMeta("description", description);
    setMeta("robots", "index, follow");
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", articleSchema ? "article" : "website", true);
    setMeta("og:url", canonical || "https://flytt.io", true);
    setMeta("og:locale", "sv_SE", true);
    setMeta("og:site_name", "Flytt.io", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = canonical || "https://flytt.io";

    // Preconnect to Google Fonts for performance
    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
      const pc1 = document.createElement("link"); pc1.rel = "preconnect"; pc1.href = "https://fonts.googleapis.com"; document.head.appendChild(pc1);
      const pc2 = document.createElement("link"); pc2.rel = "preconnect"; pc2.href = "https://fonts.gstatic.com"; pc2.crossOrigin = "anonymous"; document.head.appendChild(pc2);
      const font = document.createElement("link"); font.rel = "stylesheet"; font.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&family=Playfair+Display:wght@700;800&display=swap"; document.head.appendChild(font);
    }

    let jsonLd = document.querySelector("#flytt-jsonld");
    if (!jsonLd) { jsonLd = document.createElement("script"); jsonLd.id = "flytt-jsonld"; jsonLd.type = "application/ld+json"; document.head.appendChild(jsonLd); }
    const schema = articleSchema || {
      "@context": "https://schema.org", "@type": "WebApplication",
      "name": "Flytt.io", "url": "https://flytt.io",
      "description": description, "inLanguage": "sv-SE",
      "applicationCategory": "UtilityApplication",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SEK" },
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "47000", "bestRating": "5" }
    };
    jsonLd.textContent = JSON.stringify(schema);
  }, [title, description, canonical]);
  return null;
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  /* DM Sans & Playfair Display loaded with font-display:swap via Google Fonts URL param */
  body { margin: 0; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; background: #fff; color: #1A1A2E; }

  /* Skip navigation link for screen readers */
  .skip-link {
    position: absolute; top: -100%; left: 16px; background: #1A1A2E; color: #7EE8A2;
    padding: 10px 20px; border-radius: 0 0 8px 8px; font-weight: 700; font-size: 14px;
    z-index: 9999; text-decoration: none; transition: top 0.15s;
  }
  .skip-link:focus { top: 0; }

  /* WCAG 2.1 AA focus styles */
  :focus-visible { outline: 3px solid #7EE8A2; outline-offset: 2px; border-radius: 4px; }

  /* Card hover helper */
  .card-hover { transition: box-shadow 0.2s, transform 0.2s; }
  .card-hover:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.10); transform: translateY(-2px); }

  /* Error message – sufficient contrast */
  .error-msg { font-size: 12px; color: #B91C1C; margin: 4px 0 0; display: flex; align-items: center; gap: 4px; }

  /* Reduce motion for vestibular disorders */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }

  /* Print */
  @media (max-width: 700px) {
    footer > div > div:first-of-type > div { grid-template-columns: 1fr !important; gap: 28px !important; }
  }
  @media print {
    header, .dev-bar, .mobile-nav-menu { display: none !important; }
  }

  /* ── Responsive grid helpers ── */
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .grid-split { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .grid-stats4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .admin-row { display: grid; grid-template-columns: 80px 120px 1fr 1fr 1fr 90px 40px; gap: 0; }
  .admin-row-head { display: grid; grid-template-columns: 80px 120px 1fr 1fr 1fr 90px 40px; gap: 0; }
  .partner-row { display: grid; grid-template-columns: 1fr 140px 1fr 80px 100px 90px; gap: 0; }
  .partner-head { display: grid; grid-template-columns: 1fr 140px 1fr 80px 100px 90px; gap: 0; }
  .add-partner-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
  .trust-bar { display: flex; justify-content: center; gap: 28px; margin-top: 36px; flex-wrap: wrap; }
  .hero-tags { display: flex; justify-content: center; gap: 8px; margin-bottom: 22px; flex-wrap: wrap; }
  .nav-links { display: flex; gap: 20px; align-items: center; }
  .nav-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 8px; }
  .nav-mobile-lang { display: none; }
  .mobile-nav-menu { display: none; }
  .testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .blog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .about-split { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .article-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .mid-cta-btn { display: inline-flex; align-items: center; gap: 10px; }
  .bottom-trust { display: flex; justify-content: center; gap: 24px; margin-top: 20px; flex-wrap: wrap; }
  .confirm-share-btns { display: flex; gap: 8px; }
  .checklist-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .review-flex { display: flex; gap: 12px; align-items: flex-start; }
  .insurance-cta-inner { display: flex; gap: 12px; }

  @media (max-width: 700px) {
    .grid-3 { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
    .grid-split { grid-template-columns: 1fr; gap: 24px; }
    .grid-stats4 { grid-template-columns: 1fr 1fr; }
    .testimonial-grid { grid-template-columns: 1fr; }
    .how-grid { grid-template-columns: 1fr; }
    .blog-grid { grid-template-columns: 1fr; }
    .about-split { grid-template-columns: 1fr; gap: 24px; }
    .trust-bar { gap: 14px; }
    .hero-tags { gap: 6px; }
    .nav-links { display: none; }
    .nav-mobile-toggle { display: block; }
    .mobile-nav-menu { flex-direction: column; gap: 0; background: #fff; border-top: 1.5px solid #F3F4F6; padding: 8px 0; }
    .mobile-nav-menu.open { display: flex; position: fixed; top: 57px; left: 0; right: 0; z-index: 200; box-shadow: 0 8px 24px rgba(0,0,0,0.10); }
    .mobile-nav-item { padding: 14px 24px; font-size: 15px; font-weight: 600; color: #1A1A2E; cursor: pointer; border-bottom: 1px solid #F3F4F6; }
    .admin-row { grid-template-columns: 1fr 1fr; }
    .admin-row-head { display: none; }
    .admin-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; }
    .partner-row { grid-template-columns: 1fr 1fr; }
    .partner-head { display: none; }
    .add-partner-grid { grid-template-columns: 1fr; }
    .article-cta-inner { flex-direction: column; }
    .confirm-share-btns { flex-wrap: wrap; }
    .checklist-header { flex-direction: column; align-items: flex-start; gap: 10px; }
    .review-flex { flex-wrap: wrap; }
    .bottom-trust { gap: 12px; }
    .hero-h1 { font-size: 30px !important; }
    .hero-sub { font-size: 16px !important; }
    .section-h2 { font-size: 22px !important; }
    .usp-padding { padding: 16px 24px 0 !important; }
    .how-padding { padding: 40px 16px !important; }
    .testimonial-padding { padding: 40px 16px !important; }
    .about-padding { padding: 40px 16px !important; }
    .mid-cta { padding: 36px 16px !important; }
    .bottom-cta { padding: 36px 16px !important; }
    .hero-pad { padding: 40px 16px 32px !important; }
    .form-pad { padding: 24px 16px !important; }
    .blog-pad { padding: 28px 16px 80px !important; }
    .article-pad { padding: 28px 16px 80px !important; }
    .about-page-pad { padding: 32px 16px 80px !important; }
    .admin-pad { padding: 20px 12px !important; }
    .confirm-pad { padding: 24px 16px 100px !important; }
    .review-pad { padding: 24px 16px !important; }
    .bankid-pad { padding: 28px 16px !important; }
    .featured-post { padding: 24px 20px !important; }
    .blog-index-header { margin-bottom: 28px !important; }
    .progress-label { display: none; }
    .nav-cta-btn { display: none; }
    footer > div > div:first-of-type { grid-template-columns: 1fr !important; gap: 28px !important; }
    .nav-mobile-lang { display: flex; }
  }

  @media (min-width: 701px) and (max-width: 1024px) {
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .testimonial-grid { grid-template-columns: 1fr 1fr; }
    .grid-stats4 { grid-template-columns: 1fr 1fr; }
    .admin-row { grid-template-columns: 80px 100px 1fr 1fr 80px 40px; }
    .admin-row-head { grid-template-columns: 80px 100px 1fr 1fr 80px 40px; }
  }

  /* Touch targets – WCAG 2.5.5 */
  button, [role="button"] { min-height: 44px; }
  input, select, textarea { min-height: 48px; font-size: 16px !important; }
`;

const steps = ["landing", "form", "bankid", "review", "confirm"];

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="10" fill="#1A1A2E" />
    <path d="M5.5 10.5l3 3 6-6" stroke="#7EE8A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BankIDIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="6" fill="#235971" />
    <rect x="7" y="14" width="18" height="12" rx="2" fill="white" />
    <path d="M11 14V11a5 5 0 0110 0v3" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="16" cy="20" r="2" fill="#235971" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
    <path d="M11 2L3 6v5c0 4.5 3.3 8.7 8 9.9C15.7 19.7 19 15.5 19 11V6l-8-4z" stroke="#7EE8A2" strokeWidth="1.8" fill="none" />
    <path d="M7.5 11l2.5 2.5 4.5-4.5" stroke="#7EE8A2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HouseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
    <path d="M3 10.5L11 3l8 7.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" stroke="#7EE8A2" strokeWidth="1.8" fill="none" />
    <path d="M8 20v-7h6v7" stroke="#7EE8A2" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="8" stroke="#7EE8A2" strokeWidth="1.8" />
    <path d="M11 7v4l2.5 2.5" stroke="#7EE8A2" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const stepLabels = ["Start", "Dina uppgifter", "BankID", "Granska", "Klart"];

function ProgressBar({ current }) {
  return (
    <nav aria-label="Steg i processen" style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {stepLabels.map((label, i) => {
        const idx = i + 1;
        const active = idx === current;
        const done = idx < current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < stepLabels.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: done ? "#7EE8A2" : active ? "#1A1A2E" : "#E5E7EB",
                border: active ? "2.5px solid #1A1A2E" : done ? "none" : "2px solid #D1D5DB",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13,
                color: done ? "#1A1A2E" : active ? "#fff" : "#9CA3AF",
                transition: "all 0.3s"
              }}>
                {done ? "✓" : idx}
              </div>
              <span className="progress-label" style={{ fontSize: 11, color: active ? "#1A1A2E" : "#9CA3AF", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#7EE8A2" : "#E5E7EB", margin: "0 6px", marginBottom: 18, transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0",
      borderRadius: 99, padding: "4px 12px", fontSize: 13, fontWeight: 600
    }}>{children}</span>
  );
}

// ─── PAGE 1: LANDING ───────────────────────────────────────────────────────────
function Landing({ onNext, onBlog, onAbout, lang = "sv" }) {
  const tl = T[lang] || T.sv;
  const PAGE_DESC = "Gör din officiella flyttanmälan till Skatteverket gratis på under 1 minut. Signera med BankID och få 3 månaders gratis hemförsäkring på köpet.";

  // ── Cities list with weighted first 15 ──────────────────────────────────
  const CITIES_PRIMARY = ["Stockholm","Göteborg","Malmö","Uppsala","Västerås","Örebro","Linköping","Helsingborg","Jönköping","Norrköping","Lund","Umeå","Gävle","Borås","Södertälje"];
  const CITIES_ALL = [...CITIES_PRIMARY,"Eskilstuna","Halmstad","Växjö","Karlstad","Sundsvall","Luleå","Trollhättan","Östersund","Borlänge","Falun","Skövde","Karlskrona","Kristianstad","Kalmar","Karlskoga","Skellefteå","Piteå","Kiruna","Boden","Örnsköldsvik","Härnösand","Hudiksvall","Söderhamn","Bollnäs","Ljusdal","Mora","Avesta","Hedemora","Ludvika","Fagersta","Sala","Köping","Arboga","Enköping","Bålsta","Nyköping","Oxelösund","Katrineholm","Flen","Strängnäs","Mariefred","Trosa","Västervik","Vimmerby","Oskarshamn","Nybro","Emmaboda","Torsås","Ronneby","Karlshamn","Sölvesborg","Hässleholm","Ängelholm","Höganäs","Landskrona","Eslöv","Ystad","Trelleborg","Simrishamn","Svedala","Staffanstorp","Lomma","Kävlinge","Löddeköpinge","Bjuv","Klippan","Åstorp","Perstorp","Markaryd","Ljungby","Alvesta","Lessebo","Hultsfred","Mönsterås","Borgholm","Färjestaden","Visby","Slite","Hemse","Kungsbacka","Varberg","Falkenberg","Laholm","Hyltebruk","Gislaved","Värnamo","Nässjö","Eksjö","Vetlanda","Tranås","Motala","Mjölby","Finspång","Åtvidaberg","Valdemarsvik","Söderköping","Askersund","Hallsberg","Kumla","Lindesberg","Nora","Filipstad","Kristinehamn","Arvika","Säffle","Torsby","Sunne","Åmål","Bengtsfors","Mellerud","Vänersborg","Uddevalla","Lysekil","Strömstad","Tanumshede","Alingsås","Lerum","Partille","Mölndal","Kungälv","Stenungsund","Tjörn","Orust","Skara","Lidköping","Mariestad","Götene","Falköping","Tidaholm","Karlsborg","Hjo","Degerfors","Laxå","Haparanda","Kalix","Pajala","Gällivare","Jokkmokk","Arvidsjaur","Arjeplog","Vilhelmina","Storuman","Lycksele"];

  function randomCity(excludeFrom = null) {
    // 60% chance of picking a primary city for destination (inflyttning bias)
    const pool = Math.random() < 0.6 ? CITIES_PRIMARY : CITIES_ALL;
    let city;
    do { city = pool[Math.floor(Math.random() * pool.length)]; } while (city === excludeFrom && Math.random() > 0.15);
    return city;
  }
  function randomPair() {
    const from = CITIES_ALL[Math.floor(Math.random() * CITIES_ALL.length)];
    const to = randomCity();
    return { from, to };
  }

  const [ticker, setTicker] = useState(() => randomPair());
  const [tickerVisible, setTickerVisible] = useState(true);
  const [tickerFading, setTickerFading] = useState(false);

  useEffect(() => {
    function schedule() {
      // Random interval: 8–28 seconds (ensures at least 2 per minute on average, max ~7)
      const delay = 8000 + Math.random() * 20000;
      return setTimeout(() => {
        // Fade out
        setTickerFading(true);
        setTimeout(() => {
          setTicker(randomPair());
          setTickerFading(false);
          setTickerVisible(true);
        }, 500);
        timerId = schedule();
      }, delay);
    }
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, []);

  const CTAButton = ({ label, large = false }) => (
    <button
      type="button"
      onClick={onNext}
      style={{
        background: "#1A1A2E", color: "#fff", border: "none", borderRadius: 12,
        padding: large ? "17px 40px" : "14px 30px",
        fontSize: large ? 17 : 15, fontWeight: 700, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 10,
        boxShadow: "0 4px 24px rgba(26,26,46,0.18)", transition: "transform 0.15s"
      }}
      onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      {label || tl.ctaDefault} <ArrowRight />
    </button>
  );

  return (
    <>
      <SEOHead
        title="Flytt.io – Gratis Flyttanmälan till Skatteverket | BankID | 1 minut"
        description={PAGE_DESC}
        canonical="https://flytt.io"
      />
    <div style={{ color: "#1A1A2E" }}>
      {/* ── HERO ── */}
      <section aria-label="Introduktion" className="hero-pad" style={{ textAlign: "center", padding: "60px 24px 48px", background: "linear-gradient(160deg, #f4f8ff 0%, #eaf6ef 100%)" }}>

        {/* Live ticker */}
        <div style={{ marginBottom: 18, minHeight: 32, display: "flex", justifyContent: "center" }}>
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "#EFF6FF", color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              borderRadius: 99, padding: "5px 14px",
              fontSize: 12.5, fontWeight: 600,
              opacity: tickerFading ? 0 : 1,
              transform: tickerFading ? "translateY(-4px) scale(0.97)" : "translateY(0) scale(1)",
              transition: "opacity 0.45s ease, transform 0.45s ease",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, animation: "pulse-dot 1.8s ease-in-out infinite" }} aria-hidden="true" />
            {tl.tickerPrefix} {ticker.from} {tl.tickerMid} {ticker.to}.
          </span>
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
          }
        `}</style>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 22 }}>
          <Tag>{tl.tag1}</Tag>
          <Tag>{tl.tag2}</Tag>
          <Tag>{tl.tag3}</Tag>
        </div>
        <h1 className="hero-h1" style={{ fontSize: 42, fontWeight: 800, color: "#1A1A2E", lineHeight: 1.12, margin: "0 0 18px", fontFamily: "'Playfair Display', Georgia, serif" }}>
          {tl.h1a}<br />{tl.h1b}
        </h1>
        <p style={{ fontSize: 18, color: "#4B5563", maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.65 }}>
          {lang === "en" ? (
            <>File your official change of address with Skatteverket and get{" "}
            <span style={{
              backgroundImage: "linear-gradient(120deg, #BBF7D0 0%, #6EE7B7 100%)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 35%",
              backgroundPosition: "0 88%",
              fontWeight: 700,
              color: "#1A1A2E",
            }}>free home insurance for three months</span>{" "}
            plus a smart moving checklist tailored to your move.</>
          ) : (
            <>Gör din officiella flyttanmälan mot Skatteverket och få{" "}
            <span style={{
              backgroundImage: "linear-gradient(120deg, #BBF7D0 0%, #6EE7B7 100%)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 35%",
              backgroundPosition: "0 88%",
              fontWeight: 700,
              color: "#1A1A2E",
            }}>gratis hemförsäkring i tre månader</span>{" "}
            och en smart checklista anpassad för din flytt.</>
          )}
        </p>

        <div style={{ display: "block" }}>
          <CTAButton large />
        </div>
        <p style={{ marginTop: 14, fontSize: 13, color: "#9CA3AF" }}>
          {tl.heroNote}
        </p>

        {/* Trust bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 36, flexWrap: "wrap" }}>
          {[
            { icon: "🔒", text: tl.trust1 },
            { icon: "🛡️", text: tl.trust2 },
            { icon: "⭐", text: tl.trust3 },
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
              <span aria-hidden="true">{t.icon}</span>{t.text}
            </div>
          ))}
        </div>
      </section>

      {/* ── USP CARDS ── */}
      <div className="grid-3 usp-padding" style={{ padding: "40px 24px 0", maxWidth: 760, margin: "0 auto" }}>
        {[
          { icon: <ClockIcon />, title: tl.usp1Title, desc: tl.usp1Desc },
          { icon: <ShieldIcon />, title: tl.usp2Title, desc: tl.usp2Desc },
          { icon: <HouseIcon />, title: tl.usp3Title, desc: tl.usp3Desc },
        ].map((u, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "26px 22px", border: "1.5px solid #E5E7EB", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
            <div style={{ marginBottom: 14 }}>{u.icon}</div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E", margin: "0 0 8px" }}>{u.title}</h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>{u.desc}</p>
          </div>
        ))}
      </div>

      {/* ── HOW IT WORKS ── */}
      <section aria-label="Hur det funkar" style={{ background: "#F9FAFB", padding: "56px 24px", marginTop: 40, borderTop: "1.5px solid #F3F4F6" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <span style={{ background: "#E8F5E9", color: "#1B5E20", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase" }}>{tl.howLabel}</span>
            <h2 className="section-h2" style={{ fontSize: 30, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif" }}>{tl.howH2}</h2>
            <p style={{ color: "#6B7280", fontSize: 15, maxWidth: 440, margin: "0 auto" }}>{tl.howSub}</p>
          </div>

          <div className="how-grid">
            {[
              {
                n: "01", emoji: "📝",
                t: tl.step1t,
                d: tl.step1d,
              },
              {
                n: "02", emoji: "🔐",
                t: tl.step2t,
                d: tl.step2d,
              },
              {
                n: "03", emoji: "👨‍👩‍👧",
                t: tl.step3t,
                d: tl.step3d,
              },
              {
                n: "04", emoji: "🎉",
                t: tl.step4t,
                d: tl.step4d,
              },
            ].map((s, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "26px 24px", border: "1.5px solid #E5E7EB", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1A1A2E", color: "#7EE8A2", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
                  <span style={{ fontSize: 22 }}>{s.emoji}</span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 15.5, color: "#1A1A2E", margin: "0 0 8px" }}>{s.t}</h3>
                <p style={{ fontSize: 13.5, color: "#4B5563", margin: 0, lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <CTAButton label={tl.howCta} large />
            <p style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>{tl.howCtaNote}</p>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <div style={{ padding: "56px 24px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span style={{ background: "#FFF7ED", color: "#C2410C", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase" }}>{tl.testimonialLabel}</span>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 0", fontFamily: "'Playfair Display', Georgia, serif" }}>{tl.testimonialH2}</h2>
        </div>

        <div className="testimonial-grid">
          {[
            { name: "Sara L.", location: "Göteborg → Stockholm", stars: 5, text: tl.t1 },
            { name: "Erik T.", location: "Uppsala → Västerås", stars: 5, text: tl.t2 },
            { name: "Ahmed S.", location: "Örebro → Stockholm", stars: 5, text: tl.t3 },
            { name: "Petra & Jonas", location: "Stockholm → Nacka", stars: 5, text: tl.t4 },
          ].map((t, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1.5px solid #E5E7EB", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                {"★★★★★".split("").map((s, j) => <span key={j} style={{ color: "#F59E0B", fontSize: 14 }}>{s}</span>)}
              </div>
              <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65, margin: "0 0 16px", fontStyle: "italic" }}>"{t.text}"</p>
              <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1A2E" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MID-PAGE CTA ── */}
      <div style={{ background: "#1A1A2E", padding: "52px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>
          {tl.midCtaH2}
        </h2>
        <p style={{ color: "#9CA3AF", fontSize: 15, margin: "0 auto 28px", maxWidth: 420, lineHeight: 1.6 }}>
          {tl.midCtaSub}
        </p>
        <button
          onClick={onNext}
          style={{
            background: "#7EE8A2", color: "#1A1A2E", border: "none", borderRadius: 12,
            padding: "16px 36px", fontSize: 16, fontWeight: 800, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(126,232,162,0.3)", transition: "transform 0.15s"
          }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          {tl.midCtaBtn} <ArrowRight />
        </button>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "#4B5563" }}>{tl.midCtaNote}</p>
      </div>

      {/* ── ABOUT ── */}
      <section aria-label="Om oss" style={{ padding: "56px 24px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ maxWidth: 560 }}>
            <span style={{ background: "#E8F5E9", color: "#1B5E20", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase" }}>{tl.aboutLabel}</span>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 16px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.25 }}>
              {tl.aboutH2}
            </h2>
            <p style={{ fontSize: 14.5, color: "#4B5563", lineHeight: 1.75, margin: "0 0 14px" }}>
              {tl.aboutP1}
            </p>
            <p style={{ fontSize: 14.5, color: "#4B5563", lineHeight: 1.75, margin: "0 0 20px" }}>
              {tl.aboutP2}
            </p>
            <button onClick={onAbout} style={{ background: "none", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              {tl.aboutReadMore}
            </button>
          </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section aria-label="Kom igång" style={{ background: "#F9FAFB", borderTop: "1.5px solid #F3F4F6", padding: "48px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1A1A2E", margin: "0 0 10px", fontFamily: "'Playfair Display', Georgia, serif" }}>{tl.bottomCtaH2}</h2>
        <p style={{ color: "#6B7280", fontSize: 15, margin: "0 auto 26px", maxWidth: 380, lineHeight: 1.6 }}>{tl.bottomCtaSub}</p>
        <CTAButton label={tl.bottomCtaBtn} large />
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 20, flexWrap: "wrap" }}>
          {[tl.check1, tl.check2, tl.check3].map((p, i) => (
            <span key={i} style={{ fontSize: 13, color: "#6B7280" }}>{p}</span>
          ))}
        </div>
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #E5E7EB" }}>
          <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 12 }}>{tl.blogTeaser}</p>
          <button onClick={onBlog} style={{ background: "none", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            {tl.blogTeaserBtn}
          </button>
        </div>
      </section>
    </div>
    </>
  );
}

// ─── PAGE 2: FORM ──────────────────────────────────────────────────────────────
function validateEmail(v) {
  if (!v) return "E-post krävs";
  if (!v.includes("@")) return "E-postadressen måste innehålla @";
  const [local, domain] = v.split("@");
  if (!local || !domain) return "Ogiltig e-postadress";
  if (!domain.includes(".")) return "E-postdomänen verkar felaktig";
  const tld = domain.split(".").pop();
  if (tld.length < 2) return "Ogiltig toppdomän";
  // Common typos
  const typos = ["gmial", "gmaill", "gmali", "yahooo", "hotmial", "outlok"];
  if (typos.some(t => domain.toLowerCase().includes(t))) return "Kontrollera stavningen på e-postadressen";
  return "";
}

function validatePhone(v) {
  if (!v) return "Telefonnummer krävs";
  const digits = v.replace(/[\s\-]/g, "");
  if (!/^(\+46|0)\d{8,10}$/.test(digits)) return "Ange ett giltigt svenskt mobilnummer (t.ex. 070-123 45 67)";
  return "";
}

function luhnCheck(pnr) {
  // Strip non-digits
  const digits = pnr.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) return false;
  const d = digits.length === 12 ? digits.slice(2) : digits;
  // Luhn on first 9 digits, check against 10th
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = parseInt(d[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  const ctrl = (10 - (sum % 10)) % 10;
  return ctrl === parseInt(d[9]);
}

function validatePnr(v) {
  if (!v) return "Personnummer krävs";
  const cleaned = v.replace(/[\s]/g, "");
  const match = cleaned.match(/^(\d{6,8})[-+]?(\d{4})$/);
  if (!match) return "Format: ÅÅMMDD-XXXX eller YYYYMMDD-XXXX";
  const full = match[1] + match[2];
  if (!luhnCheck(full)) return "Ogiltigt personnummer – kontrollsiffran stämmer inte";
  return "";
}

function FormField({ id, label, placeholder, hint, value, onChange, error, type = "text", optional = false }) {
  const [touched, setTouched] = useState(false);
  const showError = touched && error;
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={fieldId} style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>
        {label} {optional && <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(valfritt)</span>}
      </label>
      <input
        id={fieldId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
        aria-invalid={showError ? "true" : undefined}
        autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10, boxSizing: "border-box",
          border: `1.5px solid ${showError ? "#B91C1C" : touched && !error ? "#15803D" : "#D1D5DB"}`,
          fontSize: 16, color: "#1A1A2E", background: "#FAFAFA", outline: "none", transition: "border 0.2s"
        }}
      />
      {showError && <p id={errorId} role="alert" className="error-msg">⚠ {error}</p>}
      {!showError && hint && <p id={hintId} style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

function Form({ onNext }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pnr, setPnr] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailErr = validateEmail(email);
  const phoneErr = validatePhone(phone);
  const pnrErr = validatePnr(pnr);
  const canSubmit = !emailErr && !phoneErr && !pnrErr && terms;

  function handleSubmit() {
    setSubmitted(true);
    if (canSubmit) onNext();
  }

  return (
    <article className="form-pad" aria-label="Formulär för flyttanmälan" style={{ padding: "40px 28px", maxWidth: 520, margin: "0 auto" }}>
      <ProgressBar current={2} />
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>Din nya adress</h2>
      <p style={{ color: "#6B7280", marginBottom: 28, fontSize: 14.5 }}>Fyll i uppgifterna om din flytt så hämtar vi resten via BankID.</p>

      {/* Address autocomplete */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="ny-adress" style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>Ny adress</label>
        <div style={{ position: "relative" }}>
          <input
            id="ny-adress"
            aria-label="Sök ny adress"
            placeholder="Sök adress, t.ex. Storgatan 12, Stockholm"
            style={{
              width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #1A1A2E",
              fontSize: 15, color: "#1A1A2E", background: "#FAFAFA", boxSizing: "border-box", outline: "none"
            }}
          />
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="7.5" cy="7.5" r="5" stroke="#9CA3AF" strokeWidth="1.8"/>
            <path d="M11.5 11.5l3 3" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, marginTop: 4, background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {["Storgatan 12, 113 44 Stockholm", "Storgatan 12B, 113 44 Stockholm", "Storgatan 120, 116 31 Stockholm"].map((s, i) => (
            <div key={i} style={{ padding: "10px 14px", fontSize: 14, color: "#374151", borderBottom: i < 2 ? "1px solid #F3F4F6" : "none", cursor: "pointer", background: i === 0 ? "#F8FAFC" : "#fff" }}>
              📍 {s}
            </div>
          ))}
        </div>

      </div>

      {/* Apartment number */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="lagenhetsnummer" style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>
          Lägenhetsnummer <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(valfritt)</span>
        </label>
        <input id="lagenhetsnummer" aria-label="Lägenhetsnummer (valfritt)" placeholder="t.ex. 1101" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB", fontSize: 15, color: "#1A1A2E", background: "#FAFAFA", boxSizing: "border-box", outline: "none" }} />
      </div>

      {/* Fastighetsbeteckning */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="fastighetsbeteckning" style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>
          Fastighetsbeteckning <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(valfritt)</span>
        </label>
        <input
          id="fastighetsbeteckning"
          placeholder="t.ex. Björken 3:14"
          aria-describedby="fastighetsbeteckning-hint"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB", fontSize: 15, color: "#1A1A2E", background: "#FAFAFA", boxSizing: "border-box", outline: "none" }}
          onFocus={e => e.target.style.border = "1.5px solid #1A1A2E"}
          onBlur={e => e.target.style.border = "1.5px solid #D1D5DB"}
        />
        <p id="fastighetsbeteckning-hint" style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Används vid flytt till villa, radhus eller fritidshus</p>
      </div>

      {/* Date field */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="move-date" style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>Inflyttningsdatum</label>
        <input id="move-date" type="date" aria-describedby="move-date-hint" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB", fontSize: 15, color: "#1A1A2E", background: "#FAFAFA", boxSizing: "border-box", outline: "none" }} />
        <p id="move-date-hint" style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Välj det datum du officiellt bor på den nya adressen</p>
      </div>

      {/* Validated fields */}
      <FormField id="email" label="E-postadress" placeholder="namn@exempel.se" hint="Vi skickar bekräftelse och info om din försäkring hit" value={email} onChange={setEmail} error={emailErr} type="email" />
      <FormField id="phone" label="Telefonnummer" placeholder="070-123 45 67" hint="För att vi ska kunna skicka din checklista via SMS" value={phone} onChange={setPhone} error={phoneErr} type="tel" />
      <FormField id="personnummer" label="Personnummer" placeholder="ÅÅMMDD-XXXX" hint="Behövs för att signera med BankID. Valideras med Luhn-algoritmen." value={pnr} onChange={setPnr} error={pnrErr} />

      {/* Bonus */}
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
          <strong>🎁 Du får:</strong> 3 månaders gratis hemförsäkring när du slutfört din anmälan. Ingen betalning krävs.
        </p>
      </div>

      {/* Terms checkbox */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8, padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${submitted && !terms ? "#B91C1C" : terms ? "#15803D" : "#E5E7EB"}`, background: terms ? "#F0FDF4" : "#FAFAFA", transition: "all 0.2s" }}>
        <input
          type="checkbox"
          id="terms"
          checked={terms}
          onChange={e => setTerms(e.target.checked)}
          aria-describedby={submitted && !terms ? "terms-error" : undefined}
          style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, accentColor: "#1A1A2E", cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); setTerms(t => !t); }}
        />
        <label id="terms-label" htmlFor="terms" style={{ margin: 0, fontSize: 13.5, color: "#374151", lineHeight: 1.55, cursor: "pointer" }}>
          Jag godkänner <span style={{ color: "#1A1A2E", fontWeight: 700, textDecoration: "underline" }}>användarvillkoren</span> och <span style={{ color: "#1A1A2E", fontWeight: 700, textDecoration: "underline" }}>integritetspolicyn</span>, och samtycker till att mina uppgifter används för att skicka min flyttanmälan till Skatteverket.
        </label>
      </div>
      {submitted && !terms && <p id="terms-error" role="alert" className="error-msg" style={{ marginBottom: 16 }}>⚠ Du måste godkänna villkoren för att fortsätta</p>}

      <div style={{ height: 8 }} />

      <button
        onClick={handleSubmit}
        style={{
          width: "100%", background: canSubmit ? "#1A1A2E" : "#6B7280", color: "#fff", border: "none",
          borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "background 0.2s"
        }}
        aria-disabled={!canSubmit}
      >
        Fortsätt till BankID <ArrowRight />
      </button>
      {submitted && !canSubmit && <p style={{ textAlign: "center", fontSize: 12.5, color: "#EF4444", marginTop: 8 }}>Fyll i alla fält korrekt och godkänn villkoren</p>}
    </article>
  );
}

// ─── PAGE 3: BANKID ────────────────────────────────────────────────────────────
function BankID({ onNext }) {
  const [status, setStatus] = useState("idle");

  function simulate() {
    setStatus("loading");
    setTimeout(() => setStatus("success"), 2200);
    setTimeout(() => onNext(), 3200);
  }

  return (
    <div style={{ padding: "40px 28px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <ProgressBar current={3} />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <BankIDIcon />
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", marginBottom: 8, fontFamily: "'Playfair Display', Georgia, serif" }}>Identifiera dig med BankID</h2>
      <p style={{ color: "#6B7280", fontSize: 14.5, marginBottom: 28, lineHeight: 1.6 }}>
        Det här är inloggningen till Skatteverket. Vi hämtar dina aktuella folkbokföringsuppgifter – nuvarande adress, medboendes uppgifter och annat som behövs för anmälan.
      </p>

      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "24px 20px", marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E", marginBottom: 14 }}>Vi hämtar från Skatteverket:</h3>
        {["Personuppgifter och nuvarande adress", "Medboendes uppgifter (sambo, barn)", "Övrig info som krävs för anmälan"].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <CheckIcon />
            <span style={{ fontSize: 14, color: "#374151" }}>{item}</span>
          </div>
        ))}
      </div>

      {status === "idle" && (
        <button
          onClick={simulate}
          style={{
            width: "100%", background: "#235971", color: "#fff", border: "none",
            borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12
          }}
        >
          <BankIDIcon /> Öppna BankID
        </button>
      )}

      {status === "loading" && (
        <div style={{ padding: "20px", color: "#235971", fontWeight: 600 }}>
          <div style={{
            width: 36, height: 36, border: "3px solid #CBD5E1", borderTop: "3px solid #235971",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px"
          }} />
          Väntar på BankID...
        </div>
      )}

      {status === "success" && (
        <div style={{ color: "#166534", fontWeight: 700, fontSize: 16, padding: "12px" }}>
          ✓ Identifiering lyckades! Hämtar uppgifter...
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#9CA3AF" }}>
        Dina uppgifter delas aldrig med tredje part. Vi följer GDPR.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── PAGE 4: REVIEW ────────────────────────────────────────────────────────────
function Review({ onNext }) {
  const [selected, setSelected] = useState(["Anna Lindgren"]);

  const household = [
    { name: "Anna Lindgren", role: "Sambo", pnr: "830412-XXXX" },
    { name: "Liam Lindgren", role: "Barn (7 år)", pnr: "160903-XXXX" },
  ];

  function toggle(name) {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  return (
    <div style={{ padding: "40px 28px", maxWidth: 540, margin: "0 auto" }}>
      <ProgressBar current={4} />
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>Granska din anmälan</h2>
      <p style={{ color: "#6B7280", marginBottom: 24, fontSize: 14.5 }}>Kontrollera att uppgifterna stämmer och välj vem som ska flytta med.</p>

      {/* Move info */}
      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>FLYTT</h3>
        {[
          ["Från", "Kungsgatan 8, 111 22 Stockholm"],
          ["Till", "Storgatan 12, 113 44 Stockholm"],
          ["Datum", "1 juni 2024"],
          ["Sökande", "Erik Lindgren · 820115-XXXX"],
        ].map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid #F1F5F9" : "none" }}>
            <span style={{ fontSize: 13.5, color: "#6B7280", fontWeight: 500 }}>{k}</span>
            <span style={{ fontSize: 13.5, color: "#1A1A2E", fontWeight: 600, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Household */}
      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "20px", marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, fontSize: 12, color: "#1A1A2E", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>VÄLJ VEM SOM FLYTTAR MED</h3>
        {household.map((p) => {
          const on = selected.includes(p.name);
          return (
            <div
              key={p.name}
              onClick={() => toggle(p.name)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px", borderRadius: 10,
                border: on ? "2px solid #1A1A2E" : "2px solid #E5E7EB",
                background: on ? "#F0FDF4" : "#fff", cursor: "pointer", marginBottom: 10, transition: "all 0.2s"
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: on ? "none" : "2px solid #D1D5DB",
                background: on ? "#1A1A2E" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                {on && <span style={{ color: "#7EE8A2", fontSize: 14, fontWeight: 800 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: "#6B7280" }}>{p.role} · {p.pnr}</div>
              </div>
            </div>
          );
        })}
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: "8px 0 0" }}>Bocka i de som ska folkbokföras på den nya adressen.</p>
      </div>

      {/* Insurance */}
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "14px 16px", marginBottom: 24, display: "flex", gap: 12 }}>
        <ShieldIcon />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#166534" }}>3 månaders gratis hemförsäkring ingår</div>
          <div style={{ fontSize: 12.5, color: "#15803D" }}>Aktiveras automatiskt när anmälan är godkänd. Ingen bindning.</div>
        </div>
      </div>

      <button
        onClick={onNext}
        style={{
          width: "100%", background: "#1A1A2E", color: "#fff", border: "none",
          borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10
        }}
      >
        Skicka anmälan till Skatteverket <ArrowRight />
      </button>
      <p style={{ textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 10 }}>Signeras med mobilt BankID · Skickas direkt till Skatteverket</p>
    </div>
  );
}

// ─── PAGE 5: CONFIRM ───────────────────────────────────────────────────────────
function Confirm() {
  // Move date: 1 May 2026
  const moveDate = new Date(2026, 4, 1);
  const fmt = (d) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
  const offset = (days) => { const d = new Date(moveDate); d.setDate(d.getDate() + days); return fmt(d); };

  // Build Bredbandsval URL from mock address "Storgatan 12, 113 44 Stockholm"
  const bbAddress = { gata: "Storgatan", nummer: "12", postnummer: "11344", postort: "Stockholm" };
  const bbUrl = `https://www.bredbandsval.se/?partnerId=flyttio&gata=${encodeURIComponent(bbAddress.gata)}&nummer=${bbAddress.nummer}&postnummer=${bbAddress.postnummer}&postort=${encodeURIComponent(bbAddress.postort)}`;

  const groups = [
    {
      label: "Redan klart ✓",
      sublabel: "Genomfört via flytt.io",
      completed: true,
      items: [
        { text: "Gör din officiella flyttanmälan hos Skatteverket", done: true, partner: false },
        { text: "Skaffa hemförsäkring", done: true, partner: false },
        { text: "Säg upp / flytta hemförsäkring", done: true, partner: false },
      ],
    },
    {
      label: "Abonnemang",
      sublabel: "Ordna i god tid",
      items: [
        { text: "Säg upp / teckna nytt bredband och TV", partner: true, partnerLabel: "Jämför bredband", partnerUrl: bbUrl },
        { text: "Flytta elen till ny adress", partner: true, partnerLabel: "Jämför elavtal →" },
        { text: "Skaffa hemlarm", partner: true, partnerLabel: "Jämför hemlarm →" },
        { text: "Skaffa digital brevlåda och slipp adressändra", partner: true, partnerLabel: "Skaffa digital brevlåda →" },
      ],
    },
    {
      label: "Senast " + offset(-31),
      sublabel: "Minst 1 månad innan",
      items: [
        { text: "Ansök om ledighet på flyttdagen", partner: false },
        { text: "Boka städfirma eller be vänner om hjälp", partner: false },
        { text: "Ställ barn i kö till förskoleplats", partner: false },
        { text: "Säg upp/ansök om ny parkeringsplats", partner: false },
        { text: "Säg upp / teckna nytt fjärrvärmeavtal", partner: false },
        { text: "Säg upp / teckna nytt gasavtal", partner: false },
        { text: "Ta in offerter från flyttfirmor", partner: false },
        { text: "Börja grovstäda och organisera packning", partner: false },
      ],
    },
    {
      label: offset(-30),
      sublabel: "1 månad innan",
      items: [
        { text: "Beställ/avbeställ sophämtning", partner: false },
        { text: "Boka flyttbil", partner: false },
        { text: "Boka flyttfirma", partner: false },
        { text: "Börja rensa – sortera sälj/återvinn", partner: false },
        { text: "Skaffa flyttkartonger och packmaterial", partner: false },
      ],
    },
    {
      label: offset(-14),
      sublabel: "2 veckor innan",
      items: [
        { text: "Börja grovpacka", partner: false },
        { text: "Sälj, skänk bort eller återvinn det du rensat ut", partner: false },
      ],
    },
    {
      label: offset(-7),
      sublabel: "1 vecka innan",
      items: [
        { text: "Börja packa ordentligt", partner: false },
      ],
    },
    {
      label: offset(-4),
      sublabel: "4 dagar innan",
      items: [
        { text: "Organisera flyttlasset", partner: false },
      ],
    },
    {
      label: offset(-3),
      sublabel: "3 dagar innan",
      items: [
        { text: "Slutpacka", partner: false },
      ],
    },
    {
      label: offset(-1),
      sublabel: "Dagen innan",
      items: [
        { text: "Informera din flytthjälp om hur dagen läggs upp", partner: false },
      ],
    },
    {
      label: offset(1),
      sublabel: "Dagen efter",
      items: [
        { text: "Kontrollera att städfirmans städning är godkänd", partner: false },
        { text: "Städa badrum", partner: false },
        { text: "Städa kök", partner: false },
        { text: "Städa övriga bostaden", partner: false },
      ],
    },
  ];

  const allItems = groups.flatMap((g, gi) => g.items.map((item, ii) => `${gi}-${ii}`));
  const preDone = groups.flatMap((g, gi) => g.items.map((item, ii) => item.done ? `${gi}-${ii}` : null)).filter(Boolean);

  const [checked, setChecked] = useState(new Set(preDone));
  const [collapsed, setCollapsed] = useState(new Set());
  const [shareMode, setShareMode] = useState(null);
  const [shareInput, setShareInput] = useState("");
  const [shareSent, setShareSent] = useState(false);

  function toggle(id) {
    setChecked(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleCollapse(gi) {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(gi) ? n.delete(gi) : n.add(gi);
      return n;
    });
  }

  const totalDone = checked.size;
  const totalAll = allItems.length;
  const pct = Math.round((totalDone / totalAll) * 100);

  function handleShare() {
    setShareSent(true);
    setTimeout(() => { setShareSent(false); setShareMode(null); setShareInput(""); }, 2000);
  }

  return (
    <div className="confirm-pad" style={{ maxWidth: 580, margin: "0 auto", padding: "40px 20px 100px" }}>
      {/* Success header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", border: "3px solid #7EE8A2",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28
        }}>✓</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1A1A2E", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>
          Klart! Du har anmält flytt.
        </h2>
        <p style={{ color: "#6B7280", fontSize: 14.5, lineHeight: 1.6 }}>
          Anmälan skickad till Skatteverket · Bekräftelse skickad till din e-post
        </p>
      </div>

      {/* Insurance banner */}
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 14, padding: "16px 18px", marginBottom: 28, display: "flex", gap: 12, alignItems: "center" }}>
        <ShieldIcon />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>Hemförsäkring på Storgatan 12 i Stockholm från 1 juni 2024.</div>
          <div style={{ fontSize: 13, color: "#15803D" }}>3 månader gratis skydd från 1 maj 2026. Detaljer skickade till din e-post.</div>
        </div>
      </div>

      {/* Checklist header */}
      <div className="checklist-header">
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 17, color: "#1A1A2E", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
            Din flyttchecklista
          </h3>
          <p style={{ fontSize: 12.5, color: "#6B7280", margin: "3px 0 0" }}>Anpassad för flytt 1 maj 2026</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShareMode("email"); setShareSent(false); }} style={{ background: shareMode === "email" ? "#1A1A2E" : "#F3F4F6", color: shareMode === "email" ? "#fff" : "#374151", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            ✉️ E-post
          </button>
          <button onClick={() => { setShareMode("sms"); setShareSent(false); }} style={{ background: shareMode === "sms" ? "#1A1A2E" : "#F3F4F6", color: shareMode === "sms" ? "#fff" : "#374151", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            💬 SMS
          </button>
        </div>
      </div>

      {/* Share input */}
      {shareMode && !shareSent && (
        <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8 }}>
          <input
            value={shareInput}
            onChange={e => setShareInput(e.target.value)}
            placeholder={shareMode === "email" ? "Din e-postadress" : "Ditt mobilnummer"}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 14, outline: "none" }}
          />
          <button onClick={handleShare} style={{ background: "#1A1A2E", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Skicka
          </button>
        </div>
      )}
      {shareSent && (
        <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13.5, color: "#166534", fontWeight: 600 }}>
          ✓ Checklistan skickad!
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background: "#F3F4F6", borderRadius: 99, height: 8, marginBottom: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #7EE8A2, #34D399)", borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <p style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 24 }}>{totalDone} av {totalAll} uppgifter klara ({pct}%)</p>

      {/* Groups */}
      {groups.map((group, gi) => {
        const isCollapsed = collapsed.has(gi);
        const groupDone = group.items.filter((_, ii) => checked.has(`${gi}-${ii}`)).length;
        const allDone = groupDone === group.items.length;
        const isCompletedSection = group.completed;
        const isPartnerSection = group.label === "Abonnemang";

        const headerBg = isCompletedSection ? "#F0FDF4" : isPartnerSection ? "#FFFBEB" : allDone ? "#F0FDF4" : "#F8FAFC";
        const headerBorder = isCompletedSection ? "#BBF7D0" : isPartnerSection ? "#FDE68A" : allDone ? "#BBF7D0" : "#E2E8F0";
        const labelColor = isCompletedSection ? "#166534" : isPartnerSection ? "#92400E" : allDone ? "#166534" : "#1A1A2E";
        const subColor = isCompletedSection ? "#15803D" : isPartnerSection ? "#B45309" : allDone ? "#15803D" : "#6B7280";

        return (
          <div key={gi} style={{ marginBottom: 12 }}>
            {/* Group header */}
            <button
              onClick={() => toggleCollapse(gi)}
              style={{
                width: "100%", background: headerBg,
                border: `1.5px solid ${headerBorder}`,
                borderRadius: isCollapsed ? 12 : "12px 12px 0 0",
                padding: "12px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.2s"
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: labelColor, display: "flex", alignItems: "center", gap: 6 }}>
                  {isPartnerSection && <span>🤝</span>}
                  {group.label}
                </div>
                <div style={{ fontSize: 12, color: subColor }}>{group.sublabel} · {groupDone}/{group.items.length} klara</div>
              </div>
              <span style={{ color: "#9CA3AF", fontSize: 16, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
            </button>

            {/* Items */}
            {!isCollapsed && (
              <div style={{ border: "1.5px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                {group.items.map((item, ii) => {
                  const id = `${gi}-${ii}`;
                  const isChecked = checked.has(id);
                  return (
                    <div
                      key={ii}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
                        borderBottom: ii < group.items.length - 1 ? "1px solid #F3F4F6" : "none",
                        background: isChecked ? "#FAFFFE" : "#fff",
                        transition: "background 0.2s"
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => !item.done && toggle(id)}
                        style={{
                          width: 22, height: 22, minHeight: "unset", minWidth: "unset",
                          borderRadius: 6, flexShrink: 0, marginTop: 1,
                          border: isChecked ? "none" : "2px solid #D1D5DB",
                          background: isChecked ? "#1A1A2E" : "#fff",
                          cursor: item.done ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s", padding: 0,
                        }}
                      >
                        {isChecked && <span style={{ color: "#7EE8A2", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                      </button>

                      <div style={{ flex: 1 }}>
                        <span style={{
                          fontSize: 14, color: isChecked ? "#9CA3AF" : "#1A1A2E",
                          textDecoration: isChecked ? "line-through" : "none",
                          lineHeight: 1.5, display: "block"
                        }}>
                          {item.text}
                        </span>
                        {item.partner && !isChecked && (
                          item.partnerUrl ? (
                            <a
                              href={item.partnerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-block", marginTop: 5,
                                background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA",
                                borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", textDecoration: "none",
                              }}
                            >
                              🤝 {item.partnerLabel} →
                            </a>
                          ) : (
                            <span style={{
                              display: "inline-block", marginTop: 5,
                              background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA",
                              borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                            }}>
                              🤝 {item.partnerLabel}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SHARED: IN-ARTICLE CTA ───────────────────────────────────────────────────
function ArticleCTA({ onStartFlow, message = "Gör din flyttanmälan på 1 minut – gratis", sub = "Få 3 månaders gratis hemförsäkring och en personlig checklista för din flytt." }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)", borderRadius: 16, padding: "28px 28px", margin: "36px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#7EE8A2", textTransform: "uppercase", marginBottom: 6 }}>flytt.io</div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>{message}</div>
        <div style={{ fontSize: 13.5, color: "#9CA3AF", lineHeight: 1.5 }}>{sub}</div>
      </div>
      <button onClick={onStartFlow} style={{ background: "#7EE8A2", color: "#1A1A2E", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
        Kom igång →
      </button>
    </div>
  );
}

// ─── BLOG INDEX ───────────────────────────────────────────────────────────────
const blogPosts = [
  {
    slug: "adressandring-gratis",
    category: "Guide",
    readTime: "3 min",
    date: "12 mars 2026",
    title: "Adressändring gratis – så gör du det rätt 2026",
    excerpt: "Visste du att adressändring hos Skatteverket alltid är gratis? Vi reder ut skillnaden mellan folkbokföring och eftersändning – och varför du egentligen bara behöver det ena.",
    tags: ["adressändring", "gratis", "skatteverket"],
  },
  {
    slug: "flyttanmalan-skatteverket",
    category: "Guide",
    readTime: "4 min",
    date: "5 mars 2026",
    title: "Flyttanmälan till Skatteverket – allt du behöver veta",
    excerpt: "Folkbokföringslagen kräver att du anmäler flytt inom en vecka. Här förklarar vi vad som händer om du inte gör det – och hur enkelt det faktiskt är att göra rätt.",
    tags: ["flyttanmälan", "skatteverket", "folkbokföring"],
  },
  {
    slug: "checklista-forsaljning",
    category: "Checklista",
    readTime: "6 min",
    date: "28 feb 2026",
    title: "Checklista inför försäljning och flytt – allt du behöver tänka på",
    excerpt: "Planerar du att sälja och flytta? Här är den kompletta checklistan – från mäklaravtal och packning till bredband, el och hemförsäkring. Spara den och bocka av.",
    tags: ["checklista", "flytt", "försäljning"],
  },
  {
    slug: "adressandra-vid-flytt",
    category: "Tips",
    readTime: "3 min",
    date: "20 feb 2026",
    title: "Adressändra vid flytt – vem behöver du meddela?",
    excerpt: "Det räcker inte med att anmäla flytt till Skatteverket. Vi listar alla ställen du bör meddela din nya adress – bank, arbetsgivare, försäkringsbolag och mer.",
    tags: ["adressändring", "flytt", "tips"],
  },
  {
    slug: "eftersandning-eller-folkbokforing",
    category: "Förklarat",
    readTime: "3 min",
    date: "14 feb 2026",
    title: "Eftersändning vs folkbokföring – vad är skillnaden?",
    excerpt: "Många blandar ihop dessa två. Eftersändning kostar pengar och är tillfällig. Folkbokföring är gratis, permanent och ett lagkrav. Vi förklarar skillnaden en gång för alla.",
    tags: ["eftersändning", "folkbokföring", "adressändring"],
  },
];

function BlogIndex({ onStartFlow, onOpenPost }) {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);

  const categoryColor = (cat) => {
    if (cat === "Guide") return { bg: "#EEF2FF", color: "#4338CA" };
    if (cat === "Checklista") return { bg: "#F0FDF4", color: "#166534" };
    if (cat === "Tips") return { bg: "#FFF7ED", color: "#C2410C" };
    return { bg: "#F8FAFC", color: "#475569" };
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
      <SEOHead title="Blogg – Tips om adressändring och flytt | Flytt.io" description="Guider och råd om adressändring, folkbokföring och allt du behöver tänka på inför din flytt i Sverige." canonical="https://flytt.io/blogg" />
      <div style={{ marginBottom: 40 }}>
        <span style={{ background: "#E8F5E9", color: "#1B5E20", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase" }}>Blogg & guider</span>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif" }}>Allt om adressändring och flytt</h1>
        <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>Guider, tips och checklistor som hjälper dig att flytta smidigt – och förstå skillnaden mellan det som kostar och det som är gratis.</p>
      </div>

      {/* Featured post */}
      <div
        onClick={() => onOpenPost(featured.slug)}
        style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)", borderRadius: 20, padding: "36px 36px", marginBottom: 28, cursor: "pointer", position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(126,232,162,0.07)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <span style={{ background: "#7EE8A2", color: "#1A1A2E", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Utvalt</span>
            <span style={{ background: "rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{featured.readTime} läsning</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 12px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.25 }}>{featured.title}</h2>
          <p style={{ color: "#9CA3AF", fontSize: 14.5, lineHeight: 1.65, margin: "0 0 20px", maxWidth: 480 }}>{featured.excerpt}</p>
          <span style={{ color: "#7EE8A2", fontWeight: 700, fontSize: 14 }}>Läs artikel →</span>
        </div>
      </div>

      {/* Post grid */}
      <div className="blog-grid" style={{ marginBottom: 32 }}>
        {rest.map((post) => {
          const cc = categoryColor(post.category);
          return (
            <div
              key={post.slug}
              onClick={() => onOpenPost(post.slug)}
              style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", border: "1.5px solid #E5E7EB", cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              onMouseOver={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseOut={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{post.category}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{post.readTime}</span>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E", margin: "0 0 10px", lineHeight: 1.35, fontFamily: "'Playfair Display', Georgia, serif" }}>{post.title}</h3>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, margin: "0 0 16px" }}>{post.excerpt}</p>
              <span style={{ fontSize: 13, color: "#1A1A2E", fontWeight: 700 }}>Läs mer →</span>
            </div>
          );
        })}
      </div>

      <ArticleCTA onStartFlow={onStartFlow} />
    </div>
  );
}

// ─── ARTICLE: ADRESSÄNDRING GRATIS ────────────────────────────────────────────
function ArticleAdressandring({ onStartFlow, onBack }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till bloggen</button>
      <span style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Guide</span>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>Adressändring gratis – så gör du det rätt 2026</h1>
      <p style={{ color: "#6B7280", fontSize: 13.5, marginBottom: 32 }}>12 mars 2026 · 3 min läsning</p>

      <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.8 }}>
        <p>Varje år betalar tusentals svenskar onödiga pengar för att "adressändra". Det finns tjänster som tar 200–400 kr för att skicka vidare din post. Det kan kännas bekvämt – men det är sällan vad du egentligen behöver.</p>
        <p>Det du <em>måste</em> göra enligt lag är att göra en <strong>folkbokföringsanmälan hos Skatteverket</strong>. Det är gratis. Det tar en minut. Och det är permanent.</p>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Vad är skillnaden mellan adressändring och folkbokföring?</h2>
        <p><strong>Folkbokföring</strong> är det officiella registret hos Skatteverket. Det styr var du är skriven, var din post levereras, vilken kommun du tillhör och mycket mer. Det är <strong>alltid gratis</strong> och ett <strong>lagkrav</strong> – du måste anmäla flytt inom en vecka.</p>
        <p><strong>Eftersändning</strong> är en tillfällig tjänst från Postnord som vidarebefordrar din post från din gamla adress. Den kostar pengar (från ca 279 kr) och gäller i max 12 månader. Det är ett komplement – inte ett substitut.</p>

        <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "18px 20px", margin: "24px 0" }}>
          <strong style={{ color: "#166534", display: "block", marginBottom: 6 }}>✓ Kort sammanfattning</strong>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#374151", lineHeight: 2 }}>
            <li>Folkbokföring hos Skatteverket = <strong>gratis, lagkrav, permanent</strong></li>
            <li>Eftersändning via Postnord = kostar pengar, tillfällig, valfri</li>
            <li>Du behöver bara göra folkbokföringen – resten är frivilligt</li>
          </ul>
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Vad händer om jag inte anmäler flytt?</h2>
        <p>Om du inte anmäler flytt till Skatteverket inom en vecka från inflyttning kan du drabbas av problem. Din post hamnar på fel adress, du riskerar att missa myndighetspost och i värsta fall kan du bli ansvarig för kommunalskatt i fel kommun.</p>
        <p>Det är alltså inte bara en formalitet – det är något som faktiskt påverkar din vardag.</p>

        <ArticleCTA onStartFlow={onStartFlow} message="Gör folkbokföringen nu – det tar 1 minut" sub="Gratis, officiellt och du slipper papper och krångel. Få 3 månaders hemförsäkring på köpet." />

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Hur gör jag adressändringen gratis?</h2>
        <p>Det enklaste sättet är att använda flytt.io. Du anger din nya adress, signerar med BankID och vi skickar din folkbokföringsanmälan direkt till Skatteverket. Det tar under 60 sekunder och kostar ingenting.</p>
        <p>Du kan också gå direkt till Skatteverkets hemsida och fylla i blanketten där – men det tar lite längre tid och kräver att du navigerar myndighetens webbplats.</p>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Behöver jag eftersändning alls?</h2>
        <p>Det beror på. Om du har gamla prenumerationer, paket som är på väg eller post från avsändare som inte uppdaterat din adress kan eftersändning vara användbart under en kort period. Men <strong>räkna inte med det som en permanent lösning</strong> – se till att uppdatera din adress hos bank, arbetsgivare, försäkringsbolag och prenumerationer direkt.</p>
        <p>Vår smarta checklista hjälper dig att hålla koll på allt det – du får den automatiskt när du gör din anmälan via flytt.io.</p>
      </div>

      <ArticleCTA onStartFlow={onStartFlow} />
    </div>
  );
}

// ─── ARTICLE: FLYTTANMÄLAN SKATTEVERKET ───────────────────────────────────────
function ArticleFlyttanmalan({ onStartFlow, onBack }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till bloggen</button>
      <span style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Guide</span>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>Flyttanmälan till Skatteverket – allt du behöver veta</h1>
      <p style={{ color: "#6B7280", fontSize: 13.5, marginBottom: 32 }}>5 mars 2026 · 4 min läsning</p>

      <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.8 }}>
        <p>Att flytta är en av livets stora händelser. Och mitt i allt kaos med kartonger, städning och nyckelöverlämning är det lätt att glömma en sak: att faktiskt anmäla att du har flyttat.</p>
        <p>Folkbokföringslagen är tydlig: du är <strong>skyldig att anmäla flytt till Skatteverket senast en vecka</strong> efter att du flyttat in på din nya adress. Det gäller alla – oavsett om du köper, hyr eller ärver ett boende.</p>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Vad är en flyttanmälan?</h2>
        <p>En flyttanmälan – officiellt kallad <em>folkbokföringsanmälan</em> – är ett meddelande till Skatteverket om att du har bytt bostad. När Skatteverket godkänt anmälan uppdateras ditt folkbokföringsregister, vilket påverkar:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2.2 }}>
          <li>Var din officiella post levereras</li>
          <li>Vilken kommun du tillhör och betalar skatt i</li>
          <li>Din rätt till kommunal service (förskola, skola, äldreomsorg)</li>
          <li>Ditt personnummer kopplas till rätt adress i alla register</li>
        </ul>

        <ArticleCTA onStartFlow={onStartFlow} message="Gör din flyttanmälan nu – under 1 minut" sub="Vi skickar den direkt till Skatteverket. Signeras med mobilt BankID. Alltid gratis." />

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Vad behöver jag för att göra en flyttanmälan?</h2>
        <p>Egentligen väldigt lite. Du behöver:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2.2 }}>
          <li>Din nya adress</li>
          <li>Datum för inflyttning</li>
          <li>BankID för signering</li>
        </ul>
        <p>Om du använder flytt.io hämtar vi automatiskt dina nuvarande folkbokföringsuppgifter när du loggar in med BankID. Du slipper fylla i information du redan har registrerad.</p>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Kan jag inkludera familjemedlemmar?</h2>
        <p>Ja. Om du har sambo eller barn registrerade på din nuvarande adress kan du inkludera dem i samma anmälan. Du väljer vilka som ska folkbokföras på den nya adressen – praktiskt när hela familjen flyttar.</p>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Vad händer om jag missar att anmäla flytt?</h2>
        <p>Skatteverket kan i teorin böta den som inte anmäler flytt i tid. Mer praktiskt är att du riskerar att missa viktig post, att din folkbokföringsort inte stämmer (vilket kan påverka kommunalskatt) och att myndigheter och banker har fel adress registrerad.</p>
        <p>Det är enkelt att göra rätt – och det tar bokstavligen under en minut.</p>
      </div>

      <ArticleCTA onStartFlow={onStartFlow} />
    </div>
  );
}

// ─── ARTICLE: CHECKLISTA FÖRSÄLJNING ─────────────────────────────────────────
function ArticleChecklista({ onStartFlow, onBack }) {
  const [checked, setChecked] = useState(new Set());
  const [collapsed, setCollapsed] = useState(new Set());
  const toggle = (id) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCollapse = (si) => setCollapsed(prev => { const n = new Set(prev); n.has(si) ? n.delete(si) : n.add(si); return n; });

  const sections = [
    {
      title: "📋 Planera i god tid – minst 1 månad innan",
      items: [
        "Teckna mäklaravtal och boka fotografering av bostaden",
        "Ta in offerter från flyttfirmor",
        "Boka flyttbil om du flyttar själv",
        "Boka städfirma eller be vänner om hjälp på flyttdagen",
        "Beställ eftersändning minst 14 dagar innan flytten",
        "Ta reda på vad som gäller för städning i bostaden du lämnar och den du flyttar till",
        "Boka magasinering om du inte får plats med allt i nya bostaden",
        "Gör en skiss över nya bostaden och planera möbleringen",
        "Om du har barn – kolla plats på förskola och skola i det nya området",
        "Kolla upp parkeringsmöjligheter vid nya bostaden",
      ]
    },
    {
      title: "📦 Packning och praktiskt",
      items: [
        "Köp eller låna flyttkartonger och packmaterial – packa inte för tungt",
        "Hyra eller låna en pirra (säckkärra) för att köra kartonger",
        "Ta fram verktyg: hammare, skruvmejsel, tumstock, vattenpass, borrmaskin",
        "Märk kartongerna med vilket rum de ska till – skriv på kortsidorna",
        "Kolla om det finns hiss och hur stor den är vid nya bostaden",
        "Sälj, skänk eller släng prylar du inte behöver",
        "Börja grovstäda och rensa – tidigt",
        "Tänk på att packa det du behöver första kvällen separat: tandborste, sängkläder, handduk, lampor",
        "Förbered fika eller lunch till de som hjälper dig flytta – och glöm inte vatten",
      ]
    },
    {
      title: "🏠 Boende och kontrakt",
      items: [
        "Se till att du har ett skriftligt kontrakt – alla boende ska stå med",
        "Gör en besiktning av bostaden innan inflyttning och notera eventuella skador",
        "Om du köper: boka besiktning av hus eller lägenhet",
        "Hyr i andrahand? Skriv kontrakt och se till att hyresvärden godkänt uthyrningen",
        "Hyr möblerat? Gör en lista och ta bilder på alla möbler som ingår",
        "Informera grannar på båda adresserna om att du flyttar",
        "Om du ska renovera – börja söka hantverkare tidigt, väntetiderna är långa",
      ]
    },
    {
      title: "⚡ Abonnemang och tjänster",
      items: [
        "Ordna bredband, TV och fast telefoni i god tid – många leverantörer har långa väntetider",
        "Flytta ditt elavtal till den nya adressen från och med inflyttningsdatum",
        "Glöm inte hemförsäkringen – kolla vad som gäller vid flytt",
        "Gas, fjärrvärme, vatten och avlopp: läs av mätare i gamla och nya bostaden",
        "Skaffa hemlarm om du vill ha det",
        "Beställ eller avbeställ sophämtning",
        "Säg upp eller teckna ny parkeringsplats",
      ]
    },
    {
      title: "📬 Adress och folkbokföring",
      items: [
        "Gör din officiella flyttanmälan hos Skatteverket (lagkrav inom 1 vecka)",
        "Meddela din bank om ny adress",
        "Meddela arbetsgivare och försäkringsbolag",
        "Uppdatera prenumerationer och nätbutiker",
        "Kom ihåg att meddela vänner och familj din nya adress",
      ]
    },
    {
      title: "🔧 Övrigt att komma ihåg",
      items: [
        "Du kan göra RUT-avdrag för både flytt och flyttstädning",
        "Kolla Bohag 2010 – de allmänna bestämmelserna för flytt",
        "Husgeråd att ha med om du flyttar hemifrån: kastruller, stekpanna, knivar, glas, tallrikar, bestick",
      ]
    },
  ];

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const doneCount = checked.size;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till bloggen</button>
      <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Checklista</span>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>Checklista inför försäljning och flytt – allt du behöver tänka på</h1>
      <p style={{ color: "#6B7280", fontSize: 13.5, marginBottom: 12 }}>28 feb 2026 · 6 min läsning</p>

      {/* Progress */}
      <div style={{ background: "#F3F4F6", borderRadius: 99, height: 7, marginBottom: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round((doneCount/totalItems)*100)}%`, background: "linear-gradient(90deg, #7EE8A2, #34D399)", borderRadius: 99, transition: "width 0.3s" }} />
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>{doneCount} av {totalItems} uppgifter klara</p>

      <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.8, marginBottom: 32 }}>
        <p>Att flytta är en av de mest omvälvande sakerna du kan göra. Det är mycket att hålla koll på – och väldigt lätt att glömma bort något viktigt. Den här checklistan täcker allt, från mäklaravtal och packning till bredband och folkbokföring.</p>
        <p>Bocka av allteftersom du gör klart varje punkt. Och om du inte redan gjort din officiella flytt­anmälan – det är ett lagkrav och tar under en minut.</p>
      </div>

      {/* flytt.io CTA box */}
      <div style={{ background: "linear-gradient(135deg, #1A1A2E, #16213E)", borderRadius: 16, padding: "24px 24px", marginBottom: 36, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#7EE8A2", textTransform: "uppercase", marginBottom: 6 }}>Spara tid med flytt.io</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>Gör folkbokföringen och få en personlig checklista på köpet</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>När du gör din flyttanmälan via flytt.io får du automatiskt <strong style={{ color: "#7EE8A2" }}>3 månaders gratis hemförsäkring</strong> och en datumbaserad checklista anpassad efter just ditt flyttdatum. Bocka av, dela med familjen och ha koll på allt.</div>
        </div>
        <button onClick={onStartFlow} style={{ background: "#7EE8A2", color: "#1A1A2E", border: "none", borderRadius: 10, padding: "13px 22px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>Kom igång →</button>
      </div>

      {/* Checklist sections */}
      {sections.map((section, si) => {
        const isCollapsed = collapsed.has(si);
        const groupDone = section.items.filter((_, ii) => checked.has(`${si}-${ii}`)).length;
        const allDone = groupDone === section.items.length;
        return (
          <div key={si} style={{ marginBottom: 12 }}>
            <button
              onClick={() => toggleCollapse(si)}
              aria-expanded={!isCollapsed}
              style={{
                width: "100%", background: allDone ? "#F0FDF4" : "#F8FAFC",
                border: `1.5px solid ${allDone ? "#BBF7D0" : "#E2E8F0"}`,
                borderRadius: isCollapsed ? 12 : "12px 12px 0 0",
                padding: "12px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.2s"
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: allDone ? "#166534" : "#1A1A2E" }}>{section.title}</div>
                <div style={{ fontSize: 12, color: allDone ? "#15803D" : "#6B7280" }}>{groupDone}/{section.items.length} klara</div>
              </div>
              <span aria-hidden="true" style={{ color: "#9CA3AF", fontSize: 16, display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
            </button>
            {!isCollapsed && (
              <div style={{ border: "1.5px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                {section.items.map((item, ii) => {
                  const id = `${si}-${ii}`;
                  const isChecked = checked.has(id);
                  return (
                    <div
                      key={ii}
                      onClick={() => toggle(id)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px", borderBottom: ii < section.items.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer", background: isChecked ? "#FAFFFE" : "#fff", transition: "background 0.2s" }}
                    >
                      <div style={{ width: 22, height: 22, minHeight: "unset", minWidth: "unset", borderRadius: 6, flexShrink: 0, marginTop: 1, border: isChecked ? "none" : "2px solid #D1D5DB", background: isChecked ? "#1A1A2E" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", padding: 0 }}>
                        {isChecked && <span style={{ color: "#7EE8A2", fontSize: 13, fontWeight: 800 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14.5, color: isChecked ? "#9CA3AF" : "#1A1A2E", textDecoration: isChecked ? "line-through" : "none", lineHeight: 1.55 }}>{item}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <ArticleCTA onStartFlow={onStartFlow} message="Klar med checklistan? Börja med flytten nu." sub="Gör din officiella folkbokföringsanmälan på 1 minut. Få 3 månaders hemförsäkring och din personliga checklista – gratis." />
    </div>
  );
}

// ─── ARTICLE: ADRESSÄNDRA VID FLYTT ──────────────────────────────────────────
function ArticleAdressandra({ onStartFlow, onBack }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till bloggen</button>
      <span style={{ background: "#FFF7ED", color: "#C2410C", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Tips</span>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>Adressändra vid flytt – vem behöver du meddela?</h1>
      <p style={{ color: "#6B7280", fontSize: 13.5, marginBottom: 32 }}>20 feb 2026 · 3 min läsning</p>

      <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.8 }}>
        <p>Flyttanmälan hos Skatteverket är det officiella och lagstadgade steget. Men det räcker sällan att bara göra det. Din nya adress behöver nå en lång rad aktörer – och det är lätt att missa någon.</p>
        <p>Här är en lista över de viktigaste ställena att uppdatera din adress:</p>

        {[
          { emoji: "🏦", title: "Banken", desc: "Kontakta din bank direkt – viktiga brev och kontohandlingar skickas ofta till din folkbokförda adress, men det kan dröja innan de hinner uppdatera sig." },
          { emoji: "💼", title: "Arbetsgivare och HR", desc: "Löneutbetalningar, pensionsunderlag och annan HR-kommunikation kopplas ofta till din registrerade adress." },
          { emoji: "🛡️", title: "Försäkringsbolag", desc: "Hemförsäkring, fordonsförsäkring och livförsäkring behöver alla uppdateras med ny adress – annars kan skyddet vara ogiltigt." },
          { emoji: "📦", title: "Nätbutiker och prenumerationer", desc: "Amazon, CDON, tidningsprenumerationer och liknande – gå igenom dina konton och uppdatera leveransadressen." },
          { emoji: "🏥", title: "Vård och apotek", desc: "Recept, journaluppgifter och receptbelagda läkemedel är kopplade till din folkbokförda adress. Se till att vårdcentralen känner till flytten." },
          { emoji: "📱", title: "Telekomoperatör", desc: "Räkningar och avtal kan fortfarande skickas per post – uppdatera din adress direkt hos operatören." },
          { emoji: "🗳️", title: "Valmyndigheten", desc: "Din rösträtt och valdistrikt styrs av var du är folkbokförd. Anmälan till Skatteverket löser detta automatiskt." },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 14, margin: "20px 0", padding: "16px 18px", background: "#F8FAFC", borderRadius: 12, border: "1.5px solid #E5E7EB" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{item.emoji}</span>
            <div>
              <strong style={{ color: "#1A1A2E", display: "block", marginBottom: 4 }}>{item.title}</strong>
              <span style={{ fontSize: 14, color: "#6B7280" }}>{item.desc}</span>
            </div>
          </div>
        ))}

        <ArticleCTA onStartFlow={onStartFlow} message="Börja med det viktigaste – folkbokföringen" sub="Gör din officiella anmälan på 1 minut. Gratis. Sedan hjälper vår checklista dig med resten." />

        <p>Tips: Vår smarta checklista (som du får gratis när du gör din anmälan via flytt.io) innehåller alla dessa punkter med datum för när du bör göra dem. Du kan bocka av och dela listan med din partner.</p>
      </div>
    </div>
  );
}

// ─── ARTICLE: EFTERSÄNDNING VS FOLKBOKFÖRING ──────────────────────────────────
function ArticleEftersandning({ onStartFlow, onBack }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till bloggen</button>
      <span style={{ background: "#F8FAFC", color: "#475569", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Förklarat</span>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}>Eftersändning vs folkbokföring – vad är skillnaden?</h1>
      <p style={{ color: "#6B7280", fontSize: 13.5, marginBottom: 32 }}>14 feb 2026 · 3 min läsning</p>

      <div style={{ fontSize: 15.5, color: "#374151", lineHeight: 1.8 }}>
        <p>Varje år förväxlar tusentals svenska flyttare dessa två begrepp. Resultatet? Man betalar för något man kanske inte behöver – och missar det man faktiskt måste göra.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "28px 0" }}>
          {[
            { title: "Folkbokföring", color: "#F0FDF4", border: "#BBF7D0", head: "#166534", items: ["✓ Alltid gratis", "✓ Lagkrav (inom 1 vecka)", "✓ Permanent och officiell", "✓ Uppdaterar alla myndighetsregister", "✓ Kräver BankID"] },
            { title: "Eftersändning", color: "#FFF7ED", border: "#FDE68A", head: "#92400E", items: ["✗ Kostar 279–399 kr", "✗ Frivillig tjänst", "✗ Tillfällig (max 12 mån)", "✗ Vidarebefordrar bara post", "✗ Löser inte registret"] },
          ].map((col, i) => (
            <div key={i} style={{ background: col.color, border: `1.5px solid ${col.border}`, borderRadius: 14, padding: "20px 18px" }}>
              <strong style={{ color: col.head, display: "block", marginBottom: 12, fontSize: 15 }}>{col.title}</strong>
              {col.items.map((item, j) => <div key={j} style={{ fontSize: 13.5, color: "#374151", marginBottom: 8, lineHeight: 1.5 }}>{item}</div>)}
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Varför kostar eftersändning pengar?</h2>
        <p>Eftersändning är en kommersiell tjänst från Postnord. Den innebär att all post som skickas till din gamla adress fysiskt vidarebefordras till din nya adress. Det kräver manuellt arbete och logistik – därav kostnaden.</p>
        <p>Folkbokföring däremot är en statlig tjänst. Det är Skatteverkets register över var du bor. Det är gratis eftersom det finansieras av skattemedel och är ett samhällsintresse.</p>

        <ArticleCTA onStartFlow={onStartFlow} message="Gör det gratis, officiella steget nu" sub="Folkbokföringen hos Skatteverket tar 1 minut via flytt.io. Ingen kostnad, inga krångel." />

        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1A1A2E", margin: "32px 0 12px", fontFamily: "'Playfair Display', Georgia, serif" }}>Behöver jag betala för adressändring?</h2>
        <p>Nej – om du menar den officiella folkbokföringen. Den är alltid gratis och kan göras på under en minut via flytt.io eller Skatteverkets hemsida.</p>
        <p>Eftersändning kan vara ett praktiskt komplement under en övergångsperiod, men det är <strong>aldrig ett krav</strong> och ersätter inte den officiella folkbokföringen.</p>
      </div>

      <ArticleCTA onStartFlow={onStartFlow} />
    </div>
  );
}

// ─── OM OSS PAGE ──────────────────────────────────────────────────────────────
function AboutPage({ onStartFlow }) {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
      <SEOHead title="Om oss – Flytt.io | Gratis Flyttanmälan" description="Flytt.io grundades för att göra den officiella folkbokföringsanmälan enkel och gratis för alla som flyttar i Sverige." canonical="https://flytt.io/om-oss" />
      <span style={{ background: "#E8F5E9", color: "#1B5E20", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase" }}>Om oss</span>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: "#1A1A2E", margin: "16px 0 12px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.15 }}>
        Vi tröttnade på att betala för saker som borde vara gratis
      </h1>
      <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.8, marginBottom: 28 }}>
        Det började med en adressändring och en faktura på 698 kr(!). För pengarna fick man papperspost (och en hel del reklam) eftersänd i ett år – samt den flyttanmälan som redan är gratis på Skatteverkets hemsida.
      </p>
      <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.8, marginBottom: 28 }}>
        När jag läste på om hur det funkar verkade det orimligt. Vem skickar ens papperspost 2026? Många myndigheter och företag är idag anslutna till Kivra, och de som inte är det har ofta en prenumeration på Skatteverkets adressregister (SPAR).
      </p>
      <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.8, marginBottom: 28 }}>
        Det fick oss att tänka – år 2026 ska det gå att flytta utan att behöva navigera gamla myndighetssidor eller betala för onödiga tjänster. Vi byggde Flytt.io för att göra flytten enklare.
      </p>
      <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.8, marginBottom: 40 }}>
        Tjänsten är och förblir gratis. Vi finansieras av partners som erbjuder el, bredband, hemförsäkring och andra tjänster du ändå behöver när du flyttar. Vi väljer partners noggrant – du möter aldrig reklam för saker du inte har nytta av.
      </p>

      <div className="grid-4" style={{ marginBottom: 48 }}>
        {[
          { label: "Användare 2025", value: "47 000+" },
          { label: "Genomsnittlig tid", value: "58 sek" },
          { label: "Nöjda användare", value: "96%" },
          { label: "Kostnad för dig", value: "0 kr" },
        ].map((stat, i) => (
          <div key={i} style={{ padding: "20px", borderRadius: 14, background: i % 2 === 0 ? "#F9FAFB" : "#F0FDF4", border: `1.5px solid ${i % 2 === 0 ? "#E5E7EB" : "#BBF7D0"}`, textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#1A1A2E" }}>{stat.value}</div>
            <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#1A1A2E", borderRadius: 16, padding: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 6, fontFamily: "'Playfair Display', Georgia, serif" }}>Redo att flytta rätt?</div>
          <div style={{ fontSize: 14, color: "#9CA3AF" }}>Gör din officiella anmälan på under 1 minut. Gratis.</div>
        </div>
        <button onClick={onStartFlow} style={{ background: "#7EE8A2", color: "#1A1A2E", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{tl.navCta} →</button>
      </div>
    </article>
  );
}

// ─── ADMIN: MOVES DASHBOARD ───────────────────────────────────────────────────
const mockMoves = [
  { id: "M-1042", date: "2026-03-09", name: "Erik Lindgren", pnr: "820115-XXXX", fromAddr: "Kungsgatan 8, Stockholm", toAddr: "Storgatan 12, Stockholm", email: "erik@exempel.se", phone: "070-123 45 67", status: "done", coPeople: ["Anna Lindgren (sambo)", "Liam Lindgren (barn)"], tasks: ["Bredband tecknat", "El flyttad", "Hemförsäkring aktiverad"] },
  { id: "M-1041", date: "2026-03-08", name: "Sara Johansson", pnr: "900322-XXXX", fromAddr: "Vasagatan 3, Göteborg", toAddr: "Linnégatan 44, Göteborg", email: "sara.j@gmail.com", phone: "073-456 78 90", status: "done", coPeople: [], tasks: ["El flyttad"] },
  { id: "M-1040", date: "2026-03-08", name: "Mohammed Al-Rashid", pnr: "851204-XXXX", fromAddr: "Odengatan 12, Stockholm", toAddr: "Birger Jarlsgatan 55, Stockholm", email: "m.alrashid@outlook.com", phone: "076-234 56 78", status: "pending", coPeople: ["Fatima Al-Rashid (sambo)"], tasks: [] },
  { id: "M-1039", date: "2026-03-07", name: "Petra Svensson", pnr: "780614-XXXX", fromAddr: "Drottninggatan 77, Malmö", toAddr: "Amiralsgatan 22, Malmö", email: "petra.s@hotmail.com", phone: "070-987 65 43", status: "error", coPeople: [], tasks: [] },
  { id: "M-1038", date: "2026-03-07", name: "Jonas Bergström", pnr: "930817-XXXX", fromAddr: "Norrtullsgatan 5, Stockholm", toAddr: "Folkungagatan 110, Stockholm", email: "jonas.b@gmail.com", phone: "072-345 67 89", status: "done", coPeople: ["Emma Bergström (sambo)", "Saga Bergström (barn)", "Noel Bergström (barn)"], tasks: ["Bredband tecknat", "El flyttad", "Hemförsäkring aktiverad", "Hemlarm tecknat"] },
  { id: "M-1037", date: "2026-03-06", name: "Lena Karlsson", pnr: "650923-XXXX", fromAddr: "Värtavägen 14, Stockholm", toAddr: "Lidingövägen 8, Stockholm", email: "lena.k@telia.com", phone: "070-111 22 33", status: "done", coPeople: [], tasks: ["El flyttad"] },
];

function StatusBadge({ status }) {
  const map = { done: { bg: "#F0FDF4", color: "#166534", border: "#BBF7D0", label: "Klar" }, pending: { bg: "#FFF7ED", color: "#92400E", border: "#FDE68A", label: "Pending" }, error: { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA", label: "Error" } };
  const s = map[status] || map.pending;
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{s.label}</span>;
}

function AdminMoves() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = mockMoves.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search) || m.toAddr.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (selected) {
    const m = selected;
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka till listan</button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 22, color: "#1A1A2E", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{m.name}</h2>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>{m.id} · {m.date}</p>
          </div>
          <StatusBadge status={m.status} />
        </div>

        {[
          ["Personnummer", m.pnr],
          ["E-post", m.email],
          ["Telefon", m.phone],
          ["Från adress", m.fromAddr],
          ["Ny adress", m.toAddr],
        ].map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 13.5, color: "#6B7280", fontWeight: 500 }}>{k}</span>
            <span style={{ fontSize: 13.5, color: "#1A1A2E", fontWeight: 600 }}>{v}</span>
          </div>
        ))}

        {m.coPeople.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", marginBottom: 12 }}>Medflyttande</h3>
            {m.coPeople.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>👤</span>
                <span style={{ fontSize: 14, color: "#374151" }}>{p}</span>
              </div>
            ))}
          </div>
        )}

        {m.tasks.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", marginBottom: 12 }}>Genomförda partneraktiviteter</h3>
            {m.tasks.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F0FDF4", borderRadius: 8, marginBottom: 8, border: "1px solid #BBF7D0" }}>
                <span style={{ color: "#166534", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 14, color: "#166534" }}>{t}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, padding: "16px", background: "#F8FAFC", borderRadius: 12, border: "1.5px solid #E2E8F0" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>Lead-status</h3>
          {[
            { label: "Bredband & TV", sent: m.tasks.includes("Bredband tecknat"), partner: "Bredbandsval.se", isLink: true },
            { label: "El", sent: m.tasks.includes("El flyttad"), partner: "Vattenfall" },
            { label: "Hemförsäkring", sent: m.tasks.includes("Hemförsäkring aktiverad"), partner: "Trygg-Hansa" },
            { label: "Hemlarm", sent: m.tasks.includes("Hemlarm tecknat"), partner: "Verisure" },
            { label: "Digital brevlåda", sent: m.tasks.includes("Digital brevlåda"), partner: "Billo" },
          ].map((lead, i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <span style={{ fontSize: 13.5, color: "#374151" }}>{lead.label}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {lead.isLink ? (
                  <span style={{ fontSize: 12, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>🔗 Jämförelselänk</span>
                ) : (
                  <span style={{ fontSize: 12.5, color: "#6B7280" }}>{lead.partner}</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: lead.sent ? "#166534" : "#9CA3AF" }}>{lead.sent ? "✓ Klickad" : "– Ej klickad"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 24, color: "#1A1A2E", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Flyttar</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>{mockMoves.length} totalt · {mockMoves.filter(m => m.status === "done").length} klara</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "done", "pending", "error"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus === s ? "#1A1A2E" : "#F3F4F6", color: filterStatus === s ? "#fff" : "#374151", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {s === "all" ? "Alla" : s === "done" ? "Klara" : s === "pending" ? "Pending" : "Error"}
            </button>
          ))}
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök på namn, ID eller adress..." aria-label="Sök bland flyttar" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />

      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div role="row" className="admin-row-head" style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1.5px solid #E5E7EB" }}>
          {["ID", "Datum", "Namn", "Från", "Till", "Status", ""].map((h, i) => (
            <span key={i} role="columnheader" style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
          ))}
        </div>
        {filtered.map((m, i) => (
          <div key={m.id} onClick={() => setSelected(m)} className="admin-card" style={{ display: "grid", gridTemplateColumns: "80px 120px 1fr 1fr 1fr 90px 40px", gap: 0, padding: "14px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer", transition: "background 0.15s" }} onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "#fff"}>
            <span style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 600 }}>{m.id}</span>
            <span style={{ fontSize: 13, color: "#6B7280" }}>{m.date}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1A2E" }}>{m.name}</span>
            <span style={{ fontSize: 12.5, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fromAddr}</span>
            <span style={{ fontSize: 12.5, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.toAddr}</span>
            <StatusBadge status={m.status} />
            <span style={{ color: "#9CA3AF", fontSize: 16 }}>›</span>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Inga resultat hittades</div>}
      </div>
    </div>
  );
}

// ─── ADMIN: PARTNERS ──────────────────────────────────────────────────────────
const initialPartners = [
  { id: 1, name: "Bredbandsval.se", category: "Bredband & TV", email: "leads@bredbandsval.se", active: true, leads: 284, lastLead: "2026-03-09", url: "https://www.bredbandsval.se" },
  { id: 2, name: "Vattenfall", category: "El", email: "leads@vattenfall.se", active: false, leads: 312, lastLead: "2026-03-09" },
  { id: 3, name: "Trygg-Hansa", category: "Hemförsäkring", email: "leads@trygg-hansa.se", active: false, leads: 401, lastLead: "2026-03-09" },
  { id: 4, name: "Verisure", category: "Hemlarm", email: "leads@verisure.se", active: false, leads: 198, lastLead: "2026-03-08" },
  { id: 5, name: "Billo", category: "Digital brevlåda", email: "leads@billo.life", active: true, leads: 54, lastLead: "2026-03-09", url: "https://billo.life/" },
  { id: 6, name: "Kivra", category: "Digital brevlåda", email: "leads@kivra.se", active: false, leads: 87, lastLead: "2026-03-05" },
  { id: 7, name: "Fortum", category: "El", email: "leads@fortum.se", active: false, leads: 44, lastLead: "2026-02-28" },
];

const categories = ["Bredband & TV", "El", "Hemförsäkring", "Hemlarm", "Digital brevlåda", "Flyttfirma", "Magasinering", "Annat"];

function AdminPartners() {
  const [partners, setPartners] = useState(initialPartners);
  const [showForm, setShowForm] = useState(false);
  const [newP, setNewP] = useState({ name: "", category: categories[0], email: "" });
  const [errors, setErrors] = useState({});

  function toggleActive(id) {
    setPartners(ps => ps.map(p => p.id === id ? { ...p, active: !p.active } : p));
  }

  function addPartner() {
    const errs = {};
    if (!newP.name.trim()) errs.name = "Namn krävs";
    if (!newP.email.includes("@")) errs.email = "Giltig e-post krävs";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setPartners(ps => [...ps, { id: Date.now(), ...newP, active: true, leads: 0, lastLead: "–" }]);
    setNewP({ name: "", category: categories[0], email: "" });
    setErrors({});
    setShowForm(false);
  }

  const totalLeads = partners.reduce((s, p) => s + p.leads, 0);
  const activeCount = partners.filter(p => p.active).length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 24, color: "#1A1A2E", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Partners</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>{activeCount} aktiva · {totalLeads.toLocaleString()} leads totalt</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{ background: "#1A1A2E", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          + Lägg till partner
        </button>
      </div>

      {/* Stats */}
      <div className="grid-stats4" style={{ marginBottom: 24 }}>
        {[
          { label: "Aktiva partners", value: activeCount },
          { label: "Totala leads", value: totalLeads.toLocaleString() },
          { label: "Leads idag", value: "47" },
          { label: "Konverteringsgrad", value: "34%" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#F8FAFC", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E" }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "22px 22px", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E", margin: "0 0 16px" }}>Ny partner</h3>
          <div className="add-partner-grid">
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Företagsnamn</label>
              <input value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))} placeholder="Telenor AB" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${errors.name ? "#EF4444" : "#D1D5DB"}`, fontSize: 14, boxSizing: "border-box", outline: "none" }} />
              {errors.name && <p style={{ fontSize: 11, color: "#EF4444", margin: "3px 0 0" }}>{errors.name}</p>}
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Bransch / leadtyp</label>
              <select value={newP.category} onChange={e => setNewP(p => ({ ...p, category: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 14, background: "#fff", outline: "none" }}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>E-post för leads</label>
              <input value={newP.email} onChange={e => setNewP(p => ({ ...p, email: e.target.value }))} aria-label="E-postadress för leads" placeholder="leads@företag.se" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${errors.email ? "#EF4444" : "#D1D5DB"}`, fontSize: 14, boxSizing: "border-box", outline: "none" }} />
              {errors.email && <p style={{ fontSize: 11, color: "#EF4444", margin: "3px 0 0" }}>{errors.email}</p>}
            </div>
            <button onClick={addPartner} style={{ background: "#1A1A2E", color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Spara</button>
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "10px 0 0" }}>Leads skickas via e-post med namn, e-post, telefonnummer och ny adress för varje matchande flytt.</p>
        </div>
      )}

      {/* Partner table */}
      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div className="partner-head" style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1.5px solid #E5E7EB" }}>
          {["Partner", "Bransch", "E-post (leads)", "Leads", "Senaste lead", "Status"].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
          ))}
        </div>
        {partners.map((p, i) => (
          <div key={p.id} className="admin-card" style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr 80px 100px 90px", gap: 0, padding: "14px 16px", borderBottom: i < partners.length - 1 ? "1px solid #F3F4F6" : "none", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>
              {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1A1A2E", textDecoration: "none" }}>{p.name} ↗</a> : p.name}
            </span>
            <span style={{ fontSize: 12.5, background: "#EEF2FF", color: "#4338CA", borderRadius: 99, padding: "3px 10px", display: "inline-block", fontWeight: 600 }}>{p.category}</span>
            <span style={{ fontSize: 12.5, color: "#6B7280" }}>{p.email}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{p.leads.toLocaleString()}</span>
            <span style={{ fontSize: 12.5, color: "#6B7280" }}>{p.lastLead}</span>
            <button onClick={() => toggleActive(p.id)} style={{ background: p.active ? "#F0FDF4" : "#F3F4F6", color: p.active ? "#166534" : "#6B7280", border: `1.5px solid ${p.active ? "#BBF7D0" : "#E5E7EB"}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {p.active ? "● Aktiv" : "○ Inaktiv"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN SHELL ──────────────────────────────────────────────────────────────

// ─── GLOSSARY PAGE ────────────────────────────────────────────────────────────
const GLOSSARY_TERMS = [
  { term: "Flyttanmälan", slug: "flyttanmalan", category: "Officiellt", short: "Det officiella beskedet till Skatteverket att du bytt folkbokföringsadress.", body: "En flyttanmälan (officiellt kallad anmälan om ändring av folkbokföringsadress) är det lagstadgade steget du måste ta när du byter bostad. Anmälan görs till Skatteverket och ska lämnas inom en vecka efter att du har bosatt dig på den nya adressen. Det är gratis och kan göras digitalt med BankID. En korrekt folkbokföring påverkar din rätt till kommunala tjänster, vård, skola och rösträtt." },
  { term: "Folkbokföring", slug: "folkbokforing", category: "Officiellt", short: "Statens register över var du är bosatt – grunden för din juridiska identitet i Sverige.", body: "Folkbokföringen administreras av Skatteverket och avgör var du är registrerad som bosatt i Sverige. Din folkbokföringsadress styr bland annat var du betalar kommunalskatt, vilket sjukvårdsområde du tillhör, var dina barn har rätt till skolplats och i vilket valdistrikt du röstar. Det är en lagstadgad skyldighet att hålla folkbokföringen aktuell." },
  { term: "Adressändring", slug: "adressandring", category: "Adress", short: "Att meddela sin nya adress till myndigheter, företag och privatpersoner.", body: "Adressändring är ett bredare begrepp än folkbokföring. Utöver den officiella anmälan till Skatteverket behöver du också meddela din bank, arbetsgivare, försäkringsbolag, tidningsprenumerationer och nätbutiker. Privata aktörer uppdateras inte automatiskt via folkbokföringen – du måste kontakta dem separat. Flytt.io hjälper dig hålla koll på alla adressändringar via den personliga checklistan." },
  { term: "Lägenhetsnummer", slug: "lagenhetsnummer", category: "Adress", short: "En fyrsiffrig kod som identifierar din specifika lägenhet i ett flerbostadshus.", body: "Lägenhetsnumret är ett fyrsiffrigt nummer (t.ex. 1101) som används för att skilja lägenheter åt i samma fastighet. Det används i folkbokföringen och på officiella handlingar. Numret är inte detsamma som ditt trapphus- eller brevlådenummer. Är du osäker på ditt lägenhetsnummer kan du kontakta din hyresvärd, bostadsrättsförening eller kolla i ditt hyreskontrakt." },
  { term: "Fastighetsbeteckning", slug: "fastighetsbeteckning", category: "Fastighet", short: "En unik beteckning för en fastighet i fastighetsregistret, t.ex. 'Björken 3:14'.", body: "Fastighetsbeteckningen är ett unikt ID för en fastighet i Lantmäteriets fastighetsregister. Den består av ett namn och ett nummer, exempelvis 'Björken 3:14'. Beteckningen används vid köp och försäljning av fastigheter, i lagfartsansökan och vid folkbokföring på villa eller radhus. Du hittar fastighetsbeteckningen i ditt köpebrev, pantbrev eller via Lantmäteriets tjänst." },
  { term: "Eftersändning", slug: "eftersandning", category: "Post", short: "En betaltjänst från Postnord som vidarebefordrar din post från gammal till ny adress.", body: "Eftersändning är en tilläggstjänst från Postnord där vanlig brevpost vidarebefordras från din gamla adress till din nya under en begränsad period (1–12 månader). Tjänsten kostar pengar och inkluderar inte paket, reklam eller tidningar. Viktigt att förstå: eftersändning ersätter INTE folkbokföringen. Myndigheter, banker och försäkringsbolag hämtar din adress från Skatteverkets register – inte från Postnords system." },
  { term: "SPAR", slug: "spar", category: "Register", short: "Statens personadressregister – en databas baserad på folkbokföringen som många företag prenumererar på.", body: "SPAR (Statens personadressregister) är ett register som drivs av Skatteverket och innehåller uppgifter om folkbokförda personer i Sverige. Banker, försäkringsbolag och myndigheter prenumererar på SPAR för att automatiskt hålla sina kundregister uppdaterade. Det innebär att en korrekt folkbokföring räcker för att de flesta aktörer ska få din rätta adress – utan att du behöver kontakta dem separat." },
  { term: "BankID", slug: "bankid", category: "Identifiering", short: "Svensk digital legitimation som används för att signera och bekräfta din identitet online.", body: "BankID är Sveriges vanligaste elektroniska identifikation och används av myndigheter, banker och andra aktörer för att verifiera din identitet digitalt. När du gör din flyttanmälan via Skatteverket eller flytt.io används BankID för att säkert signera anmälan. BankID finns som app för mobil och surfplatta, och kräver att du har ett konto hos en deltagande bank." },
  { term: "Kivra", slug: "kivra", category: "Digital post", short: "En digital brevlåda där myndigheter och företag skickar post digitalt istället för på papper.", body: "Kivra är en digital brevlåda som ersätter fysisk post för myndigheter, banker, försäkringsbolag och andra avsändare som är anslutna till tjänsten. Med Kivra slipper du viktig post hamna hos fel person om du glömmer eftersändning. Kivra är gratis att använda och kopplas till ditt personnummer – adresser spelar ingen roll när mottagaren har en digital brevlåda." },
  { term: "Inflyttningsdatum", slug: "inflyttningsdatum", category: "Officiellt", short: "Det datum du officiellt tar din nya bostad i besittning och ska vara folkbokförd.", body: "Inflyttningsdatumet är det datum du börjar bo på din nya adress och ska vara folkbokförd där. Folkbokföringsanmälan ska göras inom en vecka från detta datum. Inflyttningsdatumet påverkar bland annat när din hemförsäkring gäller på den nya adressen, när du börjar betala kommunalskatt till den nya kommunen och när eventuella barnomsorgsköer räknas." },
  { term: "Utflyttningsdatum", slug: "utflyttningsdatum", category: "Officiellt", short: "Det datum du lämnar din gamla bostad och avslutar ditt boende där.", body: "Utflyttningsdatumet är det sista dag du bor på din gamla adress. Kom ihåg att säga upp hemförsäkring, bredband, el och andra abonnemang från detta datum. Om du säljer en bostad är utflyttningsdatumet ofta kopplat till tillträdesdatumet i köpekontraktet." },
  { term: "Folkbokföringsadress", slug: "folkbokforingsadress", category: "Officiellt", short: "Den adress hos Skatteverket där du är officiellt registrerad som bosatt.", body: "Din folkbokföringsadress är den adress som finns registrerad i Skatteverkets folkbokföringsregister. Det är den officiella adressen som används av myndigheter, domstolar, sjukvård och kommunala tjänster. Du kan bara ha en folkbokföringsadress i taget. Folkbokföringsadressen ska vara den adress där du faktiskt bor – det är straffbart att vara folkbokförd på en adress där du inte bor." },
  { term: "Hyreskontrakt", slug: "hyreskontrakt", category: "Kontrakt", short: "Skriftligt avtal mellan hyresgäst och hyresvärd om nyttjanderätt till en bostad.", body: "Ett hyreskontrakt reglerar villkoren för din hyresrätt: hyresbelopp, uppsägningstid, tillträdesdatum och vad som ingår i hyran. Kontraktet bör alltid vara skriftligt. Vid folkbokföring kan Skatteverket ibland begära att du visar upp kontraktet som bevis på var du bor. Obs: ett hyreskontrakt ersätter inte folkbokföringsanmälan – du måste fortfarande anmäla flytten till Skatteverket." },
  { term: "Bostadsrätt", slug: "bostadsratt", category: "Boende", short: "Äganderätt till att nyttja en lägenhet i en bostadsrättsförening.", body: "En bostadsrätt innebär att du äger rätten att bo i en specifik lägenhet som ägs av en bostadsrättsförening. Du betalar en månadsavgift till föreningen för drift och underhåll. Vid köp sker äganderättsövergång via en överlåtelsehandling. Även om du äger bostadsrätten behöver du göra en folkbokföringsanmälan till Skatteverket när du flyttar in." },
  { term: "Äganderätt / Villa", slug: "aganderatt", category: "Boende", short: "Du äger fastigheten direkt, inklusive mark och byggnader.", body: "Med äganderätt äger du fastigheten och marken den står på. Du ansöker om lagfart hos Lantmäteriet för att registrera köpet. Fastighetsbeteckning, pantbrev och köpebrev är viktiga dokument. Precis som för andra boendeformer måste du anmäla folkbokföring på den nya adressen inom en vecka från inflyttning." },
  { term: "Hemförsäkring", slug: "hemforsakring", category: "Försäkring", short: "Försäkring som skyddar ditt hem, dina ägodelar och dig i din privata sfär.", body: "En hemförsäkring skyddar ditt bohag vid inbrott, brand, vattenskada och andra olyckor. Den inkluderar ofta reseskydd och ansvarsskydd. Vid flytt bör du kontakta ditt försäkringsbolag för att uppdatera adressen – eller teckna en ny försäkring. Med flytt.io får du 3 månaders gratis hemförsäkring automatiskt när du genomför din flyttanmälan." },
  { term: "Personnummer", slug: "personnummer", category: "Identifiering", short: "Ett unikt tiosiffrigt identifikationsnummer som varje folkbokförd person i Sverige har.", body: "Personnumret (format: ÅÅMMDD-XXXX) tilldelas av Skatteverket vid folkbokföring och används som unikt ID i myndighetssammanhang, sjukvård, bank och hos arbetsgivare. De första sex siffrorna är födelsedag (år/månad/dag), sedan ett tresiffrigt löpnummer och en kontrollsiffra beräknad med Luhn-algoritmen." },
  { term: "RUT-avdrag", slug: "rut-avdrag", category: "Ekonomi", short: "Skattesubvention för hushållsnära tjänster, inklusive flytt- och städtjänster.", body: "RUT-avdraget (Rengöring, Underhåll och Tvätt) ger dig rätt till skattereduktion för hushållsnära tjänster. Flyttjänster och flyttstädning berättigar till RUT-avdrag. Du drar av 30% av arbetskostnaden (exklusive moms), upp till 75 000 kr per person och år. Anlitar du en flyttfirma kan de ansöka direkt via Skatteverket." },
  { term: "Andrahandsuthyrning", slug: "andrahandsuthyrning", category: "Boende", short: "Att hyra ut din bostad i andra hand till en annan person.", body: "Andrahandsuthyrning innebär att du som hyresgäst eller bostadsrättsinnehavare hyr ut din bostad vidare. För hyresrätt krävs hyresvärdens tillstånd; för bostadsrätt föreningens godkännande. Den som bor i andra hand ska normalt inte folkbokföra sig på adressen utan ägarens medgivande. Uthyrning utan tillstånd kan leda till att kontraktet sägs upp." },
  { term: "Tillträdesdatum", slug: "tilltradesdatum", category: "Kontrakt", short: "Det datum köparen/hyresgästen formellt tar över nyttjanderätten till bostaden.", body: "Tillträdesdatumet är avtalat i köpe- eller hyreskontrakt och är det datum du juridiskt får rätt att flytta in. Nycklar överlämnas på tillträdesdagen. Tillträdesdatum styr ofta inflyttnings- och utflyttningsdatum och är startpunkten för din hemförsäkring på ny adress." },
  { term: "Mäklare", slug: "maklare", category: "Förmedling", short: "En licensierad fastighetsmäklare som förmedlar köp, försäljning och uthyrning av fastigheter.", body: "En fastighetsmäklare är certifierad av Fastighetsmäklarinspektionen (FMI) och förmedlar fastighetsaffärer mellan köpare och säljare. Mäklaren är neutral part och ansvarar för kontraktskrivning, visningar och budgivning. Mäklararvode betalas normalt av säljaren och är avdragsgillt vid reavinstberäkning." },
];

const CAT_COLORS = {
  "Officiellt":   { bg: "#EEF2FF", text: "#4338CA" },
  "Adress":       { bg: "#F0FDF4", text: "#166534" },
  "Post":         { bg: "#FFF7ED", text: "#C2410C" },
  "Register":     { bg: "#F8FAFC", text: "#475569" },
  "Identifiering":{ bg: "#FDF4FF", text: "#7E22CE" },
  "Digital post": { bg: "#ECFDF5", text: "#065F46" },
  "Fastighet":    { bg: "#FEF9C3", text: "#854D0E" },
  "Kontrakt":     { bg: "#FFF1F2", text: "#BE123C" },
  "Boende":       { bg: "#F0F9FF", text: "#0369A1" },
  "Försäkring":   { bg: "#F0FDF4", text: "#166534" },
  "Förmedling":   { bg: "#FDF4FF", text: "#7E22CE" },
  "Ekonomi":      { bg: "#FFFBEB", text: "#92400E" },
};

function GlossaryPage({ onStartFlow, onBack }) {
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState(null);

  const filtered = GLOSSARY_TERMS.filter(t =>
    !query ||
    t.term.toLowerCase().includes(query.toLowerCase()) ||
    t.short.toLowerCase().includes(query.toLowerCase()) ||
    t.body.toLowerCase().includes(query.toLowerCase())
  );

  const categories = [...new Set(GLOSSARY_TERMS.map(t => t.category))];
  const grouped = categories.reduce((acc, cat) => {
    const items = filtered.filter(t => t.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 100px" }}>
      <SEOHead
        title="Ordlista – Flytt, Folkbokföring & Adressändring | Flytt.io"
        description="Förklaringar av begrepp som flyttanmälan, folkbokföring, fastighetsbeteckning, eftersändning, lägenhetsnummer, BankID och mycket mer."
        canonical="https://flytt.io/ordlista"
      />
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Tillbaka</button>

      <span style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 1 }}>Ordlista</span>
      <h1 style={{ fontSize: 34, fontWeight: 800, color: "#1A1A2E", margin: "14px 0 10px", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.15 }}>
        Ordlista – allt du behöver veta om flytt
      </h1>
      <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 28, lineHeight: 1.65 }}>
        Förklaringar av de vanligaste begreppen kring flytt, adressändring, folkbokföring och boende i Sverige.
      </p>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 36 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }} aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder='Sök begrepp, t.ex. "eftersändning" eller "BankID"...'
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveSlug(null); }}
          aria-label="Sök i ordlistan"
          style={{ width: "100%", padding: "13px 40px 13px 42px", borderRadius: 12, border: "1.5px solid #D1D5DB", fontSize: 15, color: "#1A1A2E", background: "#fff", boxSizing: "border-box", outline: "none" }}
          onFocus={e => e.target.style.border = "1.5px solid #1A1A2E"}
          onBlur={e => e.target.style.border = "1.5px solid #D1D5DB"}
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Rensa sökning" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9CA3AF" }}>✕</button>
        )}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 15, textAlign: "center", padding: "40px 0" }}>Inga begrepp matchar "{query}"</p>
      )}

      {Object.entries(grouped).map(([cat, terms]) => {
        const cc = CAT_COLORS[cat] || { bg: "#F8FAFC", text: "#374151" };
        return (
          <div key={cat} style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ background: cc.bg, color: cc.text, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>{cat}</span>
              <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {terms.map(term => {
                const isActive = activeSlug === term.slug;
                return (
                  <div key={term.slug} style={{ borderRadius: 12, border: `1.5px solid ${isActive ? "#1A1A2E" : "#E5E7EB"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
                    <button
                      id={`term-${term.slug}`}
                      onClick={() => setActiveSlug(isActive ? null : term.slug)}
                      aria-expanded={isActive}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: isActive ? "#F8FAFC" : "#fff", border: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1A1A2E", marginBottom: 3 }}>{term.term}</div>
                        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{term.short}</div>
                      </div>
                      <span aria-hidden="true" style={{ color: "#9CA3AF", fontSize: 18, flexShrink: 0, display: "inline-block", transform: isActive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>⌃</span>
                    </button>
                    {isActive && (
                      <div style={{ padding: "0 18px 18px", background: "#F8FAFC", borderTop: "1px solid #F3F4F6" }}>
                        <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.8, margin: "14px 0 0" }}>{term.body}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ background: "#1A1A2E", borderRadius: 16, padding: "28px 24px", marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 6 }}>Dags att göra din flyttanmälan?</div>
          <div style={{ fontSize: 13.5, color: "#9CA3AF" }}>Gratis, officiell och klar på under en minut.</div>
        </div>
        <button onClick={onStartFlow} style={{ background: "#7EE8A2", color: "#1A1A2E", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>Kom igång →</button>
      </div>
    </div>
  );
}


// ─── TRANSLATIONS ──────────────────────────────────────────────────────────────
const T = {
  sv: {
    // Nav
    navHow: "Hur det funkar", navBlog: "Blogg", navAbout: "Om oss", navGlossary: "Ordlista", navCta: "Gör flyttanmälan",
    // Hero
    tickerPrefix: "Just nu: Flytt registrerad från", tickerMid: "till",
    tag1: "✓ Flyttanmälan på SKV", tag2: "✓ Helt gratis", tag3: "✓ Klart på 1 minut",
    h1a: "Flyttanmälan –", h1b: "som det borde funka",
    heroSub: "Gör din officiella flyttanmälan mot Skatteverket och få gratis hemförsäkring i tre månader och en smart checklista anpassad för din flytt.",
    insuranceTitle: "3 månaders gratis hemförsäkring",
    insuranceSub: "Aktiveras direkt på flyttdagen",
    ctaDefault: "Gör flyttanmälan",
    heroNote: "Skickas direkt till Skatteverket · Signeras med mobilt BankID · Aldrig några dolda avgifter",
    // Trust bar
    trust1: "Säker inloggning med BankID", trust2: "GDPR-säkrad", trust3: "4.9 / 5 i betyg",
    // USP cards
    usp1Title: "Klart på 1 minut", usp1Desc: "Fyll i din nya adress, signera med BankID. Inga blanketter, inga utskrifter, ingen väntan.",
    usp2Title: "3 mån gratis hemförsäkring", usp2Desc: "Flytta tryggt. Hemförsäkringen aktiveras på ditt inflyttningsdatum – ingen betalning behövs.",
    usp3Title: "Officiell & laglig anmälan", usp3Desc: "Din anmälan skickas direkt till Skatteverket och uppfyller folkbokföringslagens krav.",
    // How it works
    howLabel: "Hur det funkar", howH2: "Fyra steg – sedan är du klar",
    howSub: "Vi har gjort det så enkelt som möjligt. Ingen inloggning i förväg, ingen krånglig blankett.",
    step1t: "Fyll i din nya adress", step1d: "Ange din nya adress med smart autocomplete, ditt inflyttningsdatum och din e-post. Det tar under 30 sekunder.",
    step2t: "Logga in med mobilt BankID", step2d: "Använd mobilt BankID för att logga in på Skatteverket och hämta dina nuvarande folkbokföringsuppgifter. Signera och skicka tryggt och enkelt på Flytt.io.",
    step3t: "Välj vilka som flyttar", step3d: "Om du har sambo eller barn registrerade på din nuvarande adress, kan du enkelt inkludera dem i samma anmälan.",
    step4t: "Flyttanmälan klar!", step4d: "När du granskat och skrivit under med BankID skickas din flyttanmälan direkt till SKV och du får en smart checklista för resten av flytten.",
    howCta: "Kom igång – det tar 1 minut", howCtaNote: "Helt gratis. Ingen registrering. Inga dolda kostnader.",
    // Testimonials
    testimonialLabel: "Vad användarna säger",
    testimonialH2: "Känns det jobbigt att flytta? Läs vad våra användare säger.",
    t1: "Äntligen en tjänst som faktiskt fungerar. Jag var klar innan mitt morgonkaffe hann kallna. Och hemförsäkringen var en bonus jag inte visste att jag behövde.",
    t2: "Hade skjutit upp det i veckor. Visste inte att det var en lag. Tog mig 55 sekunder med flytt.io. Borde ha gjort det direkt.",
    t3: "Har aldrig förstått varför man ska betala för adressändring. Att flytt.io är gratis OCH ger hemförsäkring känns nästan för bra för att vara sant.",
    t4: "Vi flyttade med två barn. Att kunna inkludera alla i en och samma anmälan, på under en minut, var precis vad vi behövde mitt i allt kaos.",
    // Mid CTA
    midCtaH2: "Redo att flytta? Börja här.",
    midCtaSub: "Flytt.io är gratis, tar under en minut och ger dig 3 månaders hemförsäkring utan att du behöver göra något extra.",
    midCtaBtn: "Gör flyttanmälan nu",
    midCtaNote: "Ingen registrering krävs · Tar under 1 minut · Skickas till Skatteverket",
    // About teaser
    aboutLabel: "Om oss", aboutH2: "Vi tröttnade på att betala för saker som borde vara gratis",
    aboutP1: "Det började med en adressändring och en faktura på 698 kr(!). För pengarna fick man papperspost (och en hel del reklam) eftersänd i ett år – samt den flyttanmälan som är gratis på Skatteverkets hemsida.",
    aboutP2: "Det fick oss att tänka: vem vill ens ha papperspost? År 2026 ska det gå att flytta digitalt – utan att behöva navigera myndighetssidor eller betala för onödiga tjänster. Vi byggde Flytt.io för att göra flytten enklare – och mer förmånlig.",
    aboutReadMore: "Läs mer om oss →",
    stat1: "Användare 2025", stat2: "Genomsnittlig tid", stat3: "Nöjda användare", stat4: "Kostnad",
    // Bottom CTA
    bottomCtaH2: "Kom igång med flytten idag",
    bottomCtaSub: "Gör din flyttanmälan nu. Det tar en minut och kostar ingenting.",
    bottomCtaBtn: "Gör flyttanmälan – gratis",
    check1: "✓ Officiell anmälan till Skatteverket", check2: "✓ Signeras med mobilt BankID", check3: "✓ 3 mån gratis hemförsäkring",
    blogTeaser: "Vill du läsa mer om adressändring och flytt?",
    blogTeaserBtn: "Läs våra guider och tips →",
    // Footer
    footerTagline: "Här börjar flytten – tryggt, enkelt och förmånligt.",
    footerLinks: "Snabblänkar", footerLegal: "Juridiskt",
    footerPol: "Integritetspolicy", footerTos: "Användarvillkor", footerCookies: "Cookies",
    footerCopy: "{tl.footerCopy}",
  },
  en: {
    // Nav
    navHow: "How it works", navBlog: "Blog", navAbout: "About us", navGlossary: "Glossary", navCta: "Register move",
    // Hero
    tickerPrefix: "Just now: Move registered from", tickerMid: "to",
    tag1: "✓ Official filing via SKV", tag2: "✓ Completely free", tag3: "✓ Done in 1 minute",
    h1a: "Change of address –", h1b: "the way it should work",
    heroSub: "File your official change of address with Skatteverket and get free home insurance for three months plus a smart moving checklist tailored to your move.",
    insuranceTitle: "3 months free home insurance",
    insuranceSub: "Activated on your moving day",
    ctaDefault: "Register move",
    heroNote: "Sent directly to Skatteverket · Signed with BankID · Never any hidden fees",
    // Trust bar
    trust1: "Secure login with BankID", trust2: "GDPR-compliant", trust3: "4.9 / 5 rating",
    // USP cards
    usp1Title: "Done in 1 minute", usp1Desc: "Enter your new address, sign with BankID. No forms, no printouts, no waiting.",
    usp2Title: "3 months free home insurance", usp2Desc: "Move with peace of mind. Insurance activates on your move-in date – no payment required.",
    usp3Title: "Official & legal filing", usp3Desc: "Your registration is sent directly to Skatteverket and fulfils the requirements of the Population Registration Act.",
    // How it works
    howLabel: "How it works", howH2: "Four steps – and you're done",
    howSub: "We've made it as simple as possible. No prior login, no complicated forms.",
    step1t: "Enter your new address", step1d: "Enter your new address with smart autocomplete, your move-in date and your email. Takes under 30 seconds.",
    step2t: "Log in with BankID", step2d: "Use BankID to log in to Skatteverket and fetch your current registration details. Sign and submit safely and easily on Flytt.io.",
    step3t: "Choose who is moving", step3d: "If your partner or children are registered at your current address, you can easily include them in the same filing.",
    step4t: "Move registered!", step4d: "Once you've reviewed and signed with BankID, your registration is sent directly to Skatteverket and you receive a smart checklist for the rest of your move.",
    howCta: "Get started – takes 1 minute", howCtaNote: "Completely free. No sign-up. No hidden costs.",
    // Testimonials
    testimonialLabel: "What users say",
    testimonialH2: "Does moving feel stressful? Read what our users say.",
    t1: "Finally a service that actually works. I was done before my morning coffee got cold. And the home insurance was a bonus I didn't know I needed.",
    t2: "Had been putting it off for weeks. Didn't know it was a legal requirement. Took me 55 seconds with flytt.io. Should have done it straight away.",
    t3: "Never understood why you should pay for a change of address. That flytt.io is free AND gives home insurance feels almost too good to be true.",
    t4: "We moved with two kids. Being able to include everyone in one filing, in under a minute, was exactly what we needed in all the chaos.",
    // Mid CTA
    midCtaH2: "Ready to move? Start here.",
    midCtaSub: "Flytt.io is free, takes under a minute and gives you 3 months of home insurance without any extra steps.",
    midCtaBtn: "Register move now",
    midCtaNote: "No sign-up required · Takes under 1 minute · Sent to Skatteverket",
    // About teaser
    aboutLabel: "About us", aboutH2: "We got tired of paying for things that should be free",
    aboutP1: "It started with a change of address and an invoice for 698 kr(!). For that money you got paper mail (and a lot of junk) forwarded for a year – plus the address registration that's already free on Skatteverket's website.",
    aboutP2: "It got us thinking: who even wants paper mail? In 2026 you should be able to move digitally – without navigating government websites or paying for unnecessary services. We built Flytt.io to make moving easier – and more rewarding.",
    aboutReadMore: "Read more about us →",
    stat1: "Users 2025", stat2: "Average time", stat3: "Satisfied users", stat4: "Cost",
    // Bottom CTA
    bottomCtaH2: "Get started with your move today",
    bottomCtaSub: "Register your move now. It takes a minute and costs nothing.",
    bottomCtaBtn: "Register move – free",
    check1: "✓ Official filing with Skatteverket", check2: "✓ Signed with BankID", check3: "✓ 3 months free home insurance",
    blogTeaser: "Want to read more about change of address and moving?",
    blogTeaserBtn: "Read our guides and tips →",
    // Footer
    footerTagline: "This is where your move begins – official, free and done in a minute.",
    footerLinks: "Quick links", footerLegal: "Legal",
    footerPol: "Privacy policy", footerTos: "Terms of service", footerCookies: "Cookies",
    footerCopy: "© 2026 Flytt.io. All rights reserved.",
  },
};

// ─── LANG PICKER ───────────────────────────────────────────────────────────────
function LangPicker({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid #E5E7EB",
          background: "#fff",
          cursor: "pointer",
          fontSize: 20, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.15s",
          padding: 0,
        }}
        onMouseOver={e => e.currentTarget.style.borderColor = "#1A1A2E"}
        onMouseOut={e => e.currentTarget.style.borderColor = "#E5E7EB"}
      >
        {lang === "sv" ? "🇸🇪" : "🇬🇧"}
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: "#fff", border: "1.5px solid #E5E7EB",
            borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 400, overflow: "hidden", minWidth: 148,
          }}
        >
          {[
            { code: "sv", flag: "🇸🇪", label: "Svenska" },
            { code: "en", flag: "🇬🇧", label: "English" },
          ].map(l => (
            <button
              key={l.code}
              role="option"
              aria-selected={lang === l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "11px 16px",
                background: lang === l.code ? "#F0FDF4" : "#fff",
                border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: lang === l.code ? 700 : 400,
                color: "#1A1A2E", textAlign: "left",
              }}
              onMouseOver={e => { if (lang !== l.code) e.currentTarget.style.background = "#F8FAFC"; }}
              onMouseOut={e => { if (lang !== l.code) e.currentTarget.style.background = "#fff"; }}
            >
              <span style={{ fontSize: 20 }}>{l.flag}</span>
              <span>{l.label}</span>
              {lang === l.code && <span style={{ marginLeft: "auto", color: "#16A34A", fontSize: 13 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────────────
function Footer({ onHome, onBlog, onAbout, onGlossary, t }) {
  const tl = t || T.sv;
  return (
    <footer role="contentinfo" style={{ background: "#1A1A2E", color: "#fff", padding: "48px 24px 32px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 40, marginBottom: 40 }}>

          {/* Brand */}
          <div>
            <button onClick={onHome} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 800, fontSize: 22, letterSpacing: -0.5, marginBottom: 14, lineHeight: 1, color: "#fff", display: "block" }}>
              flytt<span style={{ color: "#7EE8A2" }}>.io</span>
            </button>
            <p style={{ fontSize: 13.5, color: "#9CA3AF", lineHeight: 1.7, maxWidth: 260, margin: "0 0 20px" }}>
              {tl.footerTagline}
            </p>
            <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.9 }}>
              <div>Flytt AB · Org.nr 556XXX-XXXX</div>
              <div>Storgatan 1, 111 23 Stockholm</div>
            </div>
          </div>

          {/* Links */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16 }}>{tl.footerLinks}</div>
            {[
              { label: "Hur det funkar", action: onHome },
              { label: "Blogg", action: onBlog },
              { label: "Om oss", action: onAbout },
              { label: "Ordlista", action: onGlossary },
            ].map((link, i) => (
              <button key={i} onClick={link.action} style={{ display: "block", background: "none", border: "none", color: "#9CA3AF", fontSize: 13.5, padding: "5px 0", cursor: "pointer", textAlign: "left" }}
                onMouseOver={e => e.currentTarget.style.color = "#fff"}
                onMouseOut={e => e.currentTarget.style.color = "#9CA3AF"}
              >{link.label}</button>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16 }}>{tl.footerLegal}</div>
            {[tl.footerPol, tl.footerTos, tl.footerCookies].map((item, i) => (
              <button key={i} style={{ display: "block", background: "none", border: "none", color: "#9CA3AF", fontSize: 13.5, padding: "5px 0", cursor: "pointer", textAlign: "left" }}
                onMouseOver={e => e.currentTarget.style.color = "#fff"}
                onMouseOut={e => e.currentTarget.style.color = "#9CA3AF"}
              >{item}</button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #2D2D4E", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>{tl.footerCopy}</span>
          <div style={{ display: "flex", gap: 20 }}>
            {["Twitter/X", "LinkedIn", "Instagram"].map((s, i) => (
              <span key={i} style={{ fontSize: 12, color: "#6B7280", cursor: "pointer" }}
                onMouseOver={e => e.currentTarget.style.color = "#9CA3AF"}
                onMouseOut={e => e.currentTarget.style.color = "#6B7280"}
              >{s}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── CHATBOT ───────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du är en hjälpsam assistent för tjänsten Flytt.io – en gratis digital tjänst som hjälper användare att göra sin officiella folkbokföringsanmälan (flyttanmälan) till Skatteverket. Svara alltid på svenska om inte användaren skriver på engelska, då svarar du på engelska.

Om tjänsten:
- Flytt.io är helt gratis
- Anmälan görs officiellt direkt till Skatteverket via Flytt.io
- Signeras med mobilt BankID
- Klart på under 1 minut
- Användaren fyller i ny adress, inflyttningsdatum och e-post
- Man kan inkludera sambo och barn i samma anmälan
- Man får 3 månaders gratis hemförsäkring som aktiveras på inflyttningsdatum
- Man får en smart personlig checklista för resten av flytten
- Inga dolda avgifter, ingen registrering krävs

Vanliga frågor:
- Vad är en flyttanmälan? Det är en officiell anmälan till Skatteverket om att man byter folkbokföringsadress. Det är ett lagstadgat krav att göra detta inom en vecka från inflyttning.
- Vad kostar det? Ingenting. Flytt.io är helt gratis.
- Varför behöver jag BankID? BankID används för att verifiera din identitet och signera anmälan säkert.
- Kan jag inkludera min familj? Ja, om sambo eller barn är folkbokförda på din nuvarande adress kan du inkludera dem.
- Vad händer efter anmälan? Anmälan skickas direkt till Skatteverket och du får en checklista för resten av flytten.
- Vad är skillnaden mot eftersändning? Eftersändning är en betaltjänst från Postnord – det ersätter INTE folkbokföringen. Flytt.io gör den officiella folkbokföringsanmälan.
- Hur lång tid tar det? Under 1 minut.

Håll svaren korta, vänliga och tydliga. Använd inte markdown-formatering som ** eller #. Om frågan inte rör flytt eller tjänsten, be vänligt att hålla dig till ämnet.`;

function Chatbot({ lang = "sv" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isEn = lang === "en";

  const SUGGESTIONS = isEn ? [
    "What is a change of address registration?",
    "Is Flytt.io really free?",
    "Can I include my partner and children?",
    "What happens after I register?",
  ] : [
    "Vad är en flyttanmälan?",
    "Är Flytt.io verkligen gratis?",
    "Kan jag inkludera min sambo och barn?",
    "Vad händer efter att jag skickat in?",
  ];

  const GREETING = isEn
    ? "Hi! 👋 I'm here to answer your questions about Flytt.io and the change of address process. What can I help you with?"
    : "Hej! 👋 Jag är här för att svara på dina frågor om Flytt.io och hur du gör din flyttanmälan. Vad kan jag hjälpa dig med?";

  useEffect(() => {
    if (open) {
      if (messages.length === 0) {
        setMessages([{ role: "assistant", text: GREETING }]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const history = [...messages, { role: "user", text: userText }]
        .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text || (isEn ? "Something went wrong. Please try again." : "Något gick fel. Försök igen.");
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: isEn ? "Connection error. Please try again." : "Anslutningsfel. Försök igen." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setUnread(false); }}
        aria-label={open ? (isEn ? "Close chat" : "Stäng chatt") : (isEn ? "Open chat" : "Öppna chatt")}
        style={{
          position: "fixed", bottom: 72, right: 20, zIndex: 500,
          width: 52, height: 52, borderRadius: "50%",
          background: "#1A1A2E", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          transition: "transform 0.15s",
        }}
        onMouseOver={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M5 15L15 5" stroke="#7EE8A2" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#7EE8A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {unread && !open && (
          <span style={{ position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: "50%", background: "#EF4444", border: "2px solid #fff" }} />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          role="dialog"
          aria-label={isEn ? "Chat with Flytt.io" : "Chatta med Flytt.io"}
          style={{
            position: "fixed", bottom: 132, right: 20, zIndex: 500,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(520px, calc(100vh - 160px))",
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            border: "1.5px solid #E5E7EB",
          }}
        >
          {/* Header */}
          <div style={{ background: "#1A1A2E", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#7EE8A2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💬</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.2 }}>flytt<span style={{ color: "#7EE8A2" }}>.io</span> {isEn ? "Assistant" : "Assistent"}</div>
              <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{isEn ? "Usually answers in seconds" : "Svarar på sekunder"}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7EE8A2", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{isEn ? "Online" : "Online"}</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? "#1A1A2E" : "#F3F4F6",
                  color: m.role === "user" ? "#fff" : "#1A1A2E",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "#F3F4F6", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#9CA3AF", display: "inline-block", animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick reply suggestions — only show after greeting, before any user message */}
            {messages.length === 1 && messages[0].role === "assistant" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10,
                    padding: "8px 12px", fontSize: 12.5, color: "#374151", cursor: "pointer",
                    textAlign: "left", lineHeight: 1.4,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "#1A1A2E"; e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1.5px solid #F3F4F6", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, background: "#fff" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isEn ? "Ask a question…" : "Skriv din fråga…"}
              rows={1}
              aria-label={isEn ? "Your message" : "Ditt meddelande"}
              style={{
                flex: 1, border: "1.5px solid #E5E7EB", borderRadius: 10,
                padding: "9px 12px", fontSize: 13.5, resize: "none",
                outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                maxHeight: 80, minHeight: 40, overflowY: "auto",
              }}
              onFocus={e => e.target.style.borderColor = "#1A1A2E"}
              onBlur={e => e.target.style.borderColor = "#E5E7EB"}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label={isEn ? "Send" : "Skicka"}
              style={{
                width: 40, height: 40, borderRadius: 10, border: "none",
                background: input.trim() && !loading ? "#1A1A2E" : "#E5E7EB",
                color: input.trim() && !loading ? "#7EE8A2" : "#9CA3AF",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}

export default function App() {
  const [view, setView] = useState("landing");
  const [flowStep, setFlowStep] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lang, setLang] = useState("sv");
  const tl = T[lang];
  const flowPages = [Form, BankID, Review, Confirm];

  const startFlow = () => { setFlowStep(0); setView("flow"); setMobileNavOpen(false); };
  const goHome = () => { setView("landing"); setMobileNavOpen(false); };
  const goBlog = () => { setView("blog"); setMobileNavOpen(false); };
  const goAbout = () => { setView("about"); setMobileNavOpen(false); };
  const goGlossary = () => { setView("glossary"); setMobileNavOpen(false); };
  const goAdmin = () => setView("admin");

  const renderView = () => {
    if (view === "admin") return <AdminShell onExit={goHome} />;
    if (view === "landing") return <Landing onNext={startFlow} onBlog={goBlog} onAbout={goAbout} lang={lang} />;
    if (view === "about") return <AboutPage onStartFlow={startFlow} />;
    if (view === "glossary") return <GlossaryPage onStartFlow={startFlow} onBack={goHome} />;
    if (view === "blog") return <BlogIndex onStartFlow={startFlow} onOpenPost={(slug) => setView(`article:${slug}`)} />;
    if (view.startsWith("article:")) {
      const slug = view.split(":")[1];
      const props = { onStartFlow: startFlow, onBack: goBlog };
      if (slug === "adressandring-gratis") return <ArticleAdressandring {...props} />;
      if (slug === "flyttanmalan-skatteverket") return <ArticleFlyttanmalan {...props} />;
      if (slug === "checklista-forsaljning") return <ArticleChecklista {...props} />;
      if (slug === "adressandra-vid-flytt") return <ArticleAdressandra {...props} />;
      if (slug === "eftersandning-eller-folkbokforing") return <ArticleEftersandning {...props} />;
    }
    if (view === "flow") {
      const Page = flowPages[flowStep];
      return <Page onNext={() => { if (flowStep < flowPages.length - 1) setFlowStep(s => s + 1); }} />;
    }
  };

  if (view === "admin") return (
    <>
      <style>{STYLES}</style>
      {renderView()}
    </>
  );

  const navItems = [
    { label: tl.navAbout, key: "about", action: goAbout },
  ];

  const isActive = (key) => (view === "blog" && key === "blog") || (view === "about" && key === "about") || (view === "glossary" && key === "glossary");

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", background: "#fff" }}>
      <style>{STYLES}</style>
      <a href="#main-content" className="skip-link">Hoppa till innehåll</a>

      <header role="banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 57, borderBottom: "1.5px solid #F3F4F6", background: "#fff", position: "sticky", top: 0, zIndex: 200 }}>
        <button onClick={goHome} aria-label="Flytt.io – gå till startsidan" style={{ fontWeight: 800, fontSize: 20, color: "#1A1A2E", cursor: "pointer", letterSpacing: -0.5, background: "none", border: "none", padding: 0, lineHeight: 1 }}>
          flytt<span style={{ color: "#7EE8A2" }}>.io</span>
        </button>

        {/* Desktop nav */}
        <div className="nav-links">
          {navItems.map((n, i) => (
            <button key={i} onClick={n.action} aria-current={isActive(n.key) ? "page" : undefined} style={{ cursor: "pointer", fontWeight: isActive(n.key) ? 700 : 400, color: isActive(n.key) ? "#1A1A2E" : "#4B5563", fontSize: 13, background: "none", border: "none", padding: "4px 0" }}>{n.label}</button>
          ))}
          <LangPicker lang={lang} setLang={setLang} />
          <button type="button" className="nav-cta-btn" onClick={startFlow} style={{ background: "none", color: "#374151", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "#1A1A2E"; e.currentTarget.style.color = "#1A1A2E"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#374151"; }}
          >
            {tl.navCta}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button type="button" className="nav-mobile-toggle" onClick={() => setMobileNavOpen(o => !o)} aria-label={mobileNavOpen ? "Stäng meny" : "Öppna meny"} aria-expanded={mobileNavOpen} aria-controls="mobile-nav">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {mobileNavOpen
              ? <path d="M6 6l12 12M6 18L18 6" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round"/>
              : <path d="M4 6h16M4 12h16M4 18h16" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round"/>}
          </svg>
        </button>
      </header>

      {/* Mobile nav drawer */}
      <nav id="mobile-nav" className={`mobile-nav-menu ${mobileNavOpen ? "open" : ""}`} aria-label="Mobilmeny" aria-hidden={!mobileNavOpen}>
        {navItems.map((n, i) => (
          <button key={i} className="mobile-nav-item" onClick={n.action} style={{ width: "100%", textAlign: "left", background: "none", border: "none" }}>{n.label}</button>
        ))}
        <button className="mobile-nav-item" style={{ background: "#1A1A2E", color: "#fff", width: "100%", textAlign: "left", border: "none" }} onClick={startFlow}>{tl.navCta} →</button>
      </nav>

      <main id="main-content" onClick={() => mobileNavOpen && setMobileNavOpen(false)}>{renderView()}</main>

      {view !== "flow" && (
        <Footer onHome={goHome} onBlog={goBlog} onAbout={goAbout} onGlossary={goGlossary} t={tl} />
      )}

      <Chatbot lang={lang} />

      {/* Dev nav bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1A1A2E", padding: "8px 12px", display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", zIndex: 150 }}>
        {[
          { label: "1. Start", action: () => setView("landing") },
          { label: "2. Formulär", action: () => { setFlowStep(0); setView("flow"); } },
          { label: "3. BankID", action: () => { setFlowStep(1); setView("flow"); } },
          { label: "4. Granska", action: () => { setFlowStep(2); setView("flow"); } },
          { label: "5. Klart", action: () => { setFlowStep(3); setView("flow"); } },
          { label: "Blogg", action: goBlog },
          { label: "Om oss", action: goAbout },
          { label: "Ordlista", action: goGlossary },
          { label: "Checklista", action: () => setView("article:checklista-forsaljning") },
          { label: "🔐 Admin", action: goAdmin },
        ].map((item, i) => {
          const active = (view === "landing" && item.label === "1. Start") || (view === "blog" && item.label === "Blogg") || (view === "about" && item.label === "Om oss") || (view === "glossary" && item.label === "Ordlista") || (view === `article:checklista-forsaljning` && item.label === "Checklista") || (view === "flow" && item.label === `${flowStep + 2}. ${["Formulär","BankID","Granska","Klart"][flowStep]}`);
          return (
            <button key={i} onClick={item.action} style={{ background: active ? "#7EE8A2" : item.label === "🔐 Admin" ? "#374151" : "transparent", color: active ? "#1A1A2E" : item.label === "🔐 Admin" ? "#7EE8A2" : "#9CA3AF", border: active || item.label === "🔐 Admin" ? "none" : "1px solid #374151", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", minHeight: "unset" }}>
              {item.label}
            </button>
          );
        })}
      </div>
      <div style={{ height: 55 }} />
    </div>
  );
}
