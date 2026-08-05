import React from "react";
import { color, font, Pill, Button } from "../theme.jsx";
import { STORES } from "../data/stores.js";
import burgerIcon from "../assets/icons/burger.png";
import croissantIcon from "../assets/icons/croissant.png";
import juicePromoBig from "../assets/icons/juice_promo_big.png";
import grillPromoSmall from "../assets/icons/grill_promo_small.png";

/* "Offers & Promos" — the page flagged "ADD THIS IMPORTANT" in the sketch:
   a dark brand/shop directory on the left, a promo showcase on the right
   with the big centered hero image + a smaller side image, per
   "big_in_the_middle_like_ishowed_you" / "on_the_side_smaller". */
export default function OffersPromo({ onSelectStore }) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 60px" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "0 0 4px" }}>
          Offers &amp; Promos
        </h2>
        <p style={{ fontFamily: font.body, fontSize: 13, color: color.muted, margin: 0 }}>
          Every brand on Wasel, and what's discounted right now.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 320px) 1fr",
          gap: 0,
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${color.line}`,
          boxShadow: "0 16px 40px rgba(20,23,31,0.08)",
        }}
      >
        {/* Left — brand / shop directory */}
        <div style={{ background: color.ink, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <span style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9098A8" }}>
              Our branches
            </span>
            <h3 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: "#fff", margin: "4px 0 0" }}>
              List of brands
              <br />
              &amp; shops
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STORES.map((s) => (
              <button
                key={s.store_id}
                onClick={() => onSelectStore?.(s.store_id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: s.tint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {s.image ? <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 12.5, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </div>
                  <div style={{ fontFamily: font.mono, fontSize: 10.5, color: "#9098A8" }}>{s.cuisine}</div>
                </div>
              </button>
            ))}
          </div>

          <span style={{ fontFamily: font.mono, fontSize: 10, color: "#6B7280", marginTop: "auto", lineHeight: 1.5 }}>
            Design it like it's real, ok! — every brand here maps 1:1 to a
            store_id the planning engine already tracks.
          </span>
        </div>

        {/* Right — promo showcase */}
        <div style={{ background: color.paper, padding: "28px 30px", position: "relative" }}>
          <span style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: color.coral, fontWeight: 700 }}>
            Offers and Promos!!
          </span>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr auto",
              gap: 18,
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <img
              src={burgerIcon}
              alt="Burger promo"
              style={{ width: "100%", maxHeight: 150, objectFit: "contain" }}
            />
            {/* Big, centered — per "big_in_the_middle_like_ishowed_you" */}
            <img
              src={juicePromoBig}
              alt="Juice promo"
              style={{ width: "100%", maxHeight: 210, objectFit: "contain" }}
            />
            {/* Small, on the side — per "on_the_side_smaller" */}
            <img
              src={grillPromoSmall}
              alt="Grill promo"
              style={{ width: 110, maxHeight: 130, objectFit: "contain", justifySelf: "end" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
            <img src={croissantIcon} alt="Bakery promo" style={{ width: 64, height: 64, objectFit: "contain" }} />
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: 30,
                color: color.coralDeep,
              }}
            >
              up to 50%
            </div>
            <Pill tone="coral">This week only</Pill>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
            {STORES.map((s) => (
              <Pill key={s.store_id} tone="mint">
                {s.name.split(" ")[0]} · up to 50% off
              </Pill>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <Button variant="dark" onClick={() => onSelectStore?.(STORES[0].store_id)}>
              Browse all offers →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
