// src/components/MainPage.jsx
//
// Home screen: a media-type toggle (filter, not navigation) up top, then
// three real destinations - Discover (swipe), Curate (small bespoke picks),
// Shelf (to-watch + history). Warm paper palette, real type scale.

import React, { useState } from "react";

const COLORS = {
  bg: "#ece9dc", screenBg: "#f2f0e4", card: "#fcfaf0", cardBorder: "#dad6c6",
  ink: "#262420", muted: "#6e6a60", accentSage: "#647c64", accentRust: "#aa5a5a",
  accentBlue: "#5a6c96",
};

const MEDIA_TYPES = [
  { key: "movie", label: "Movies" },
  { key: "tv", label: "TV" },
  { key: "podcast", label: "Podcasts" },
];

export default function MainPage({ onNavigate }) {
  const [mediaType, setMediaType] = useState("movie");

  return (
    <div style={styles.screen}>
      <p style={styles.greeting}>Good evening</p>

      <div style={styles.toggle}>
        {MEDIA_TYPES.map(m => {
          const active = mediaType === m.key;
          const disabled = m.key === "podcast";
          return (
            <div
              key={m.key}
              style={{
                ...styles.toggleItem,
                ...(active ? styles.toggleItemActive : {}),
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "default" : "pointer",
              }}
              onClick={() => !disabled && setMediaType(m.key)}
            >
              {m.label}
            </div>
          );
        })}
      </div>

      <div
        style={styles.discoverCard}
        onClick={() => onNavigate("swipe", { portal: mediaType })}
      >
        <p style={styles.discoverLabel}>START HERE</p>
        <h1 style={styles.discoverTitle}>Discover</h1>
        <p style={styles.discoverSub}>Swipe through new titles</p>
        <span style={styles.discoverArrow}>→</span>
      </div>

      <div style={styles.secondaryRow}>
        <div
          style={styles.secondaryCard}
          onClick={() => onNavigate("curate", { portal: mediaType })}
        >
          <h2 style={styles.secondaryTitle}>Curate</h2>
          <p style={styles.secondarySub}>Your top picks</p>
        </div>
        <div
          style={styles.secondaryCard}
          onClick={() => onNavigate("shelf", { portal: mediaType })}
        >
          <h2 style={styles.secondaryTitle}>Shelf</h2>
          <p style={styles.secondarySub}>To watch + history</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    background: COLORS.bg, color: COLORS.ink, minHeight: "100vh",
    maxWidth: 420, margin: "0 auto", padding: "32px 24px 40px",
    boxSizing: "border-box",
  },
  greeting: { fontSize: 14, color: COLORS.muted, margin: "0 0 16px" },
  toggle: {
    display: "flex", background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 22, padding: 4, marginBottom: 28,
  },
  toggleItem: {
    flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 18,
    fontSize: 13, fontWeight: 700, color: COLORS.muted,
  },
  toggleItemActive: { background: COLORS.ink, color: "#faf8f0" },
  discoverCard: {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 24, padding: "26px 28px", marginBottom: 24,
    boxShadow: "0 7px 0 #d2cebb", cursor: "pointer", position: "relative",
  },
  discoverLabel: {
    fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700,
    color: COLORS.accentRust, margin: "0 0 10px", letterSpacing: "0.04em",
  },
  discoverTitle: { fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 700, margin: "0 0 14px" },
  discoverSub: { fontSize: 15, color: COLORS.muted, margin: 0 },
  discoverArrow: {
    position: "absolute", right: 28, bottom: 24, fontSize: 26,
    color: COLORS.accentSage, fontWeight: 700,
  },
  secondaryRow: { display: "flex", gap: 16 },
  secondaryCard: {
    flex: 1, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 18, padding: "20px 18px", cursor: "pointer",
  },
  secondaryTitle: { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, margin: "0 0 8px" },
  secondarySub: { fontSize: 12, color: COLORS.muted, margin: 0 },
};
