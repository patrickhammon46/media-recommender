// src/components/MainPage.jsx
import React from "react";
import { BottomNav } from "./SwipeScreen";

const COLORS = {
  base: "#121116", text: "#f4f1eb", muted: "#86807a", dim: "#5a564f",
  gold: "#cba869", hairline: "#232026",
};

export default function MainPage({ onNavigate, savedCounts = {} }) {
  const portals = [
    { key: "movie", name: "Movies", sub: `${savedCounts.movie ?? 0} saved · fresh picks ready`, disabled: false },
    { key: "tv", name: "TV", sub: `${savedCounts.tv ?? 0} in your list`, disabled: false },
    { key: "podcast", name: "Podcasts", sub: "coming soon", disabled: true },
  ];

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <p style={styles.greeting}>Good evening</p>
        <h1 style={styles.h1}>What sounds good?</h1>
      </header>

      <div style={styles.list}>
        {portals.map((p, i) => (
          <div
            key={p.key}
            style={{ ...styles.portal, borderBottom: i === portals.length - 1 ? "none" : `1px solid ${COLORS.hairline}`, opacity: p.disabled ? 0.45 : 1, cursor: p.disabled ? "default" : "pointer" }}
            onClick={() => !p.disabled && onNavigate("portal", { portal: p.key })}
          >
            <div style={styles.portalName}>{p.name}</div>
            <div style={styles.portalSub}>{p.sub}</div>
          </div>
        ))}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
}

const styles = {
  screen: { fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: COLORS.base, color: COLORS.text, minHeight: "100vh", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column" },
  header: { padding: "36px 24px 0" },
  greeting: { fontSize: 13, color: COLORS.muted, margin: "0 0 4px" },
  h1: { fontSize: 23, fontWeight: 700, margin: 0 },
  list: { flex: 1, padding: "28px 24px" },
  portal: { padding: "22px 0" },
  portalName: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  portalSub: { fontFamily: "ui-monospace, monospace", fontSize: 12, color: COLORS.dim },
};
