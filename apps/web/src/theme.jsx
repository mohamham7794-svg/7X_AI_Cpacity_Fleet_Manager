import { useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Wasel design tokens                                                */
/*  Deliberately light/warm — the counterpart to the dark "ops console" */
/*  in apps/web. Same product family (mint/amber echo the console's    */
/*  teal/amber), different room: this one is built to be tapped by a   */
/*  customer, not stared at by an operator.                            */
/* ------------------------------------------------------------------ */
export const color = {
  ink: "#14171F",
  inkSoft: "#4A4F5C",
  muted: "#8A8F9B",
  paper: "#FFFDF8",
  surface: "#FFFFFF",
  line: "#ECE7DD",
  coral: "#FF5A36",
  coralDeep: "#E14A2A",
  coralTint: "#FFF1EC",
  mint: "#12B886",
  mintTint: "#E9FBF4",
  amber: "#FFB648",
  amberTint: "#FFF6E5",
};

export const font = {
  display: "'Unbounded', sans-serif",
  body: "'Plus Jakarta Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export function useWaselFonts() {
  useEffect(() => {
    const id = "wasel-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);

    const styleId = "wasel-keyframes";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes wasel-travel { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }
      @keyframes wasel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      @keyframes wasel-slide-in { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes wasel-fade-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

/* Small reusable atoms, kept here so every screen renders pills/badges
   identically without re-deriving the same styles per component. */
export function Pill({ children, tone = "neutral", style }) {
  const tones = {
    neutral: { bg: color.line, fg: color.inkSoft },
    coral: { bg: color.coralTint, fg: color.coralDeep },
    mint: { bg: color.mintTint, fg: "#0B8F68" },
    amber: { bg: color.amberTint, fg: "#8A6100" },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: tones.bg,
        color: tones.fg,
        fontFamily: font.body,
        fontSize: 12,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Button({ children, onClick, variant = "primary", full, disabled, style, type = "button" }) {
  const variants = {
    primary: { bg: disabled ? "#F2C4B6" : color.coral, fg: "#fff", border: "none" },
    dark: { bg: color.ink, fg: "#fff", border: "none" },
    ghost: { bg: "transparent", fg: color.ink, border: `1.5px solid ${color.line}` },
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: font.body,
        fontWeight: 700,
        fontSize: 14.5,
        padding: "13px 22px",
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        width: full ? "100%" : "auto",
        background: variants.bg,
        color: variants.fg,
        border: variants.border,
        transition: "transform 0.12s ease, opacity 0.12s ease",
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}
