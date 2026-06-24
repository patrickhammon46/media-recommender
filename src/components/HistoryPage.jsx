// src/components/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { BottomNav } from "./SwipeScreen";
import { supabase } from "../lib/supabase";

const COLORS = {
  base: "#121116", text: "#f4f1eb", muted: "#86807a", dim: "#5a564f",
  gold: "#cba869", rust: "#8c6a5a", grey: "#aaa6a0", hairline: "#232026",
};

export default function HistoryPage({ userId, onNavigate }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wl_interactions")
      .select("direction, rating, created_at, wl_titles(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setItems(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? items : items.filter(i => i.direction === filter);

  const detail = (item) => {
    if (item.direction === "up") return { text: `${item.rating}/10`, color: COLORS.gold };
    if (item.direction === "down") return { text: "passed", color: COLORS.grey };
    if (item.direction === "right") return { text: "saved", color: COLORS.grey };
    return { text: "skipped", color: COLORS.grey };
  };

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <h1 style={styles.h1}>History</h1>
        <div style={styles.count}>{items.length} reviewed</div>
      </header>

      <div style={styles.filters}>
        {["all", "up", "down", "right"].map(f => (
          <span
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterChip, ...(filter === f ? styles.filterActive : {}) }}
          >
            {{ all: "All", up: "Liked", down: "Disliked", right: "Saved" }[f]}
          </span>
        ))}
      </div>

      <div style={styles.rows}>
        {loading ? <p style={{ color: COLORS.muted }}>Loading…</p> :
         filtered.length === 0 ? <p style={{ color: COLORS.muted }}>Nothing here yet.</p> :
         filtered.map((item, i) => {
           const d = detail(item);
           return (
             <div key={i} style={{ ...styles.row, borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${COLORS.hairline}` }}>
               <span style={styles.rowName}>{item.wl_titles?.title}</span>
               <span style={{ ...styles.rowDetail, color: d.color }}>{d.text}</span>
             </div>
           );
         })}
      </div>

      <BottomNav active="saved" onNavigate={onNavigate} />
    </div>
  );
}

const styles = {
  screen: { fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: COLORS.base, color: COLORS.text, minHeight: "100vh", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column" },
  header: { padding: "36px 24px 0" },
  h1: { fontSize: 21, fontWeight: 700, margin: "0 0 4px" },
  count: { fontFamily: "ui-monospace, monospace", fontSize: 12, color: COLORS.dim },
  filters: { display: "flex", gap: 8, padding: "20px 24px 0", flexWrap: "wrap" },
  filterChip: { fontFamily: "ui-monospace, monospace", fontSize: 11, padding: "6px 12px", borderRadius: 12, border: `1px solid ${COLORS.hairline}`, color: COLORS.dim, cursor: "pointer" },
  filterActive: { borderColor: COLORS.gold, color: COLORS.gold, background: "rgba(203,168,105,0.08)" },
  rows: { flex: 1, padding: "16px 24px", overflowY: "auto" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" },
  rowName: { fontSize: 14, fontWeight: 700 },
  rowDetail: { fontFamily: "ui-monospace, monospace", fontSize: 12 },
};
