// src/components/PortalPage.jsx
//
// The recommendations + to-watch tabbed view for one portal (movie/tv).
// Tapping a recommendation row re-opens the swipe card popup for that
// single title (the "pull up an individual title" mechanic from the spec).

import React, { useState, useEffect, useCallback } from "react";
import { BottomNav } from "./SwipeScreen";
import {
  getHistory,
  getRecentlyShownTitleNames,
  fetchRecommendations,
  getSavedList,
  recordInteraction,
  addToSavedList,
  upsertTitle,
  supabase,
} from "../lib/supabase";

const COLORS = {
  base: "#121116", text: "#f4f1eb", muted: "#86807a", dim: "#5a564f",
  gold: "#cba869", goldFaint: "#5a4f38", rust: "#8c6a5a", hairline: "#232026",
};

const RAIL_SIZE = 10;
const BUFFER_TARGET = 15; // 10 visible + 5 reserve - sized to finish within Netlify's 10s function timeout

export default function PortalPage({ portal, userId, onNavigate }) {
  const [tab, setTab] = useState("recommendations");
  const [rail, setRail] = useState([]);
  const [buffer, setBuffer] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [watchedList, setWatchedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popupTitle, setPopupTitle] = useState(null);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await getHistory(userId, portal);
      const excludeTitles = await getRecentlyShownTitleNames();
      const ranked = await fetchRecommendations({ history, portal, excludeTitles, count: BUFFER_TARGET });
      setRail(ranked.slice(0, RAIL_SIZE));
      setBuffer(ranked.slice(RAIL_SIZE));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, portal]);

  const loadSaved = useCallback(async () => {
    try {
      const list = await getSavedList(userId);
      setSavedList(list.filter(item => item.wl_titles?.media_type === portal));
    } catch (err) {
      console.error("Failed to load saved list:", err.message);
    }
  }, [userId, portal]);

  // Watched: everything you've actually rated (liked or disliked) - separate
  // from the watch-LATER list above. This is your history of opinions, not
  // your queue of things to get to.
  const loadWatched = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("wl_interactions")
        .select("direction, rating, created_at, wl_titles(title)")
        .eq("user_id", userId)
        .eq("portal", portal)
        .in("direction", ["up", "down"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setWatchedList(data);
    } catch (err) {
      console.error("Failed to load watched list:", err.message);
    }
  }, [userId, portal]);

  useEffect(() => {
    loadRecommendations();
    loadSaved();
    loadWatched();
  }, [loadRecommendations, loadSaved, loadWatched]);

  const replaceRailItem = (index) => {
    setRail(prev => {
      const next = [...prev];
      if (buffer.length > 0) {
        next[index] = buffer[0];
        setBuffer(b => b.slice(1));
      } else {
        next.splice(index, 1);
      }
      return next;
    });
  };

  const handlePopupResolve = async (title, index, direction, rating) => {
    setPopupTitle(null);
    try {
      const savedTitle = await upsertTitle({
        source: "claude-generated",
        source_id: `${portal}:${title.title}:${title.year}`,
        media_type: portal,
        title: title.title, art_url: null, logline: title.logline, tags: title.tags, year: title.year,
      });
      await recordInteraction({ userId, titleId: savedTitle.id, direction, rating, tellMore: null, portal });
      if (direction === "right") {
        await addToSavedList({ userId, titleId: savedTitle.id, addedVia: "swipe" });
        loadSaved();
      }
      if (direction === "up" || direction === "down") {
        loadWatched();
      }
    } catch (err) {
      console.error("Failed to resolve popup swipe:", err.message);
    }
    replaceRailItem(index);
  };

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <h1 style={styles.h1}>{portal === "tv" ? "TV" : "Movies"}</h1>
      </header>

      <div style={styles.tabRow}>
        <Tab label="Recommendations" active={tab === "recommendations"} onClick={() => setTab("recommendations")} />
        <Tab label="To watch" active={tab === "towatch"} onClick={() => setTab("towatch")} />
        <Tab label="Watched" active={tab === "watched"} onClick={() => setTab("watched")} />
        {tab === "recommendations" && (
          <span style={styles.regenerate} onClick={loadRecommendations}>Regenerate</span>
        )}
      </div>

      <div style={styles.rows}>
        {tab === "recommendations" && (
          loading ? <p style={{ color: COLORS.muted }}>Loading…</p> :
          error ? <p style={{ color: COLORS.muted }}>{error}</p> :
          rail.length === 0 ? <p style={{ color: COLORS.muted }}>Nothing here yet.</p> :
          rail.map((item, i) => (
            <div key={`${item.title}-${i}`} style={{ ...styles.row, borderBottom: i === rail.length - 1 ? "none" : `1px solid ${COLORS.hairline}` }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setPopupTitle({ item, index: i })}>
                <div style={styles.rowName}>{item.title}</div>
                <div style={styles.rowWhy}>{item.why_type}</div>
              </div>
              <span style={styles.infoIcon} onClick={() => setPopupTitle({ item, index: i, showWhy: true })}>i</span>
            </div>
          ))
        )}
        {tab === "towatch" && (
          savedList.length === 0 ? <p style={{ color: COLORS.muted }}>Nothing saved yet.</p> :
          savedList.map((entry, i) => (
            <div key={entry.id} style={{ ...styles.row, borderBottom: i === savedList.length - 1 ? "none" : `1px solid ${COLORS.hairline}` }}>
              <div style={styles.rowName}>{entry.wl_titles.title}</div>
              <div style={styles.rowWhy}>{entry.added_via === "swipe" ? "saved via swipe" : "added manually"}</div>
            </div>
          ))
        )}
        {tab === "watched" && (
          watchedList.length === 0 ? <p style={{ color: COLORS.muted }}>Nothing watched yet.</p> :
          watchedList.map((entry, i) => (
            <div key={i} style={{ ...styles.row, borderBottom: i === watchedList.length - 1 ? "none" : `1px solid ${COLORS.hairline}` }}>
              <div style={styles.rowName}>{entry.wl_titles?.title}</div>
              {entry.direction === "up" ? (
                <span style={styles.ratingBadge}>{entry.rating}/10</span>
              ) : (
                <span style={styles.dislikeArrow}>↓</span>
              )}
            </div>
          ))
        )}
      </div>

      {popupTitle && (
        <TitlePopup
          data={popupTitle}
          onClose={() => setPopupTitle(null)}
          onResolve={(direction, rating) => handlePopupResolve(popupTitle.item, popupTitle.index, direction, rating)}
        />
      )}

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <span onClick={onClick} style={{ ...styles.tab, color: active ? COLORS.text : COLORS.dim, borderBottom: active ? `2px solid ${COLORS.gold}` : "2px solid transparent" }}>
      {label}
    </span>
  );
}

function TitlePopup({ data, onClose, onResolve }) {
  const [showRating, setShowRating] = useState(false);
  const { item, showWhy } = data;

  const handleDirection = (dir) => {
    if (dir === "up") { setShowRating(true); return; }
    onResolve(dir, null);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={e => e.stopPropagation()}>
        {!showRating ? (
          <>
            <p style={styles.typeLabel}>{item.tags?.[0] || ""}</p>
            <h2 style={styles.popupTitle}>{item.title}</h2>
            <p style={styles.popupLogline}>{item.logline}</p>
            {showWhy && <p style={styles.popupWhy}>{item.why}</p>}
            <div style={styles.popupArrows}>
              <button style={styles.popupArrowBtn} onClick={() => handleDirection("left")}>← Skip</button>
              <button style={styles.popupArrowBtn} onClick={() => handleDirection("down")}>↓ Not for me</button>
              <button style={styles.popupArrowBtn} onClick={() => handleDirection("up")}>↑ Liked</button>
              <button style={styles.popupArrowBtn} onClick={() => handleDirection("right")}>→ Add to list</button>
            </div>
          </>
        ) : (
          <>
            <p style={styles.typeLabel}>you liked</p>
            <h3 style={styles.popupTitle}>{item.title}</h3>
            <p style={{ color: COLORS.muted }}>how much?</p>
            <div style={styles.ratingGrid}>
              {[7, 8, 9, 10].map(n => (
                <button key={n} style={styles.ratingButton} onClick={() => onResolve("up", n)}>{n}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  screen: { fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: COLORS.base, color: COLORS.text, minHeight: "100vh", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column" },
  header: { padding: "36px 24px 0" },
  h1: { fontSize: 21, fontWeight: 700, margin: 0 },
  tabRow: { display: "flex", alignItems: "center", padding: "20px 24px 0", gap: 22 },
  tab: { fontSize: 13, fontWeight: 700, cursor: "pointer", paddingBottom: 6 },
  regenerate: { marginLeft: "auto", fontSize: 13, fontWeight: 700, color: COLORS.gold, cursor: "pointer" },
  rows: { flex: 1, padding: "16px 24px", overflowY: "auto" },
  row: { display: "flex", alignItems: "center", padding: "14px 0" },
  rowName: { fontSize: 14, fontWeight: 700 },
  rowWhy: { fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLORS.goldFaint, marginTop: 3 },
  ratingBadge: { fontFamily: "ui-monospace, monospace", fontSize: 13, color: COLORS.gold, fontWeight: 700 },
  dislikeArrow: { fontSize: 16, color: COLORS.rust, fontWeight: 700 },
  infoIcon: { fontSize: 13, color: "#6e6a62", cursor: "pointer", padding: 8 },
  overlay: { position: "fixed", inset: 0, background: "rgba(5,5,7,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  popup: { background: COLORS.base, padding: "32px 28px", borderRadius: 16, maxWidth: 320, textAlign: "center" },
  typeLabel: { fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLORS.goldFaint, margin: "0 0 8px" },
  popupTitle: { fontSize: 22, fontWeight: 700, margin: "0 0 12px" },
  popupLogline: { fontSize: 13, color: COLORS.muted, marginBottom: 16 },
  popupWhy: { fontSize: 12, color: "#9CAD92", marginBottom: 16 },
  popupArrows: { display: "flex", flexDirection: "column", gap: 8 },
  popupArrowBtn: { background: "none", border: `1px solid ${COLORS.hairline}`, color: COLORS.text, borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer" },
  ratingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 },
  ratingButton: { width: 60, height: 60, borderRadius: 12, border: `2px solid ${COLORS.gold}`, background: "none", color: COLORS.gold, fontFamily: "ui-monospace, monospace", fontSize: 18, cursor: "pointer" },
};
