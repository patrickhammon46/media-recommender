// src/components/SwipeScreen.jsx
//
// Minimalist swipe card - ported from the tested HTML prototype.
// No card box, no divider, one accent color (gold), symmetric feedback
// across all four directions. Real drag + tap, wired to real data.

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  recordInteraction,
  addToSavedList,
  fetchRecommendations,
  getHistory,
  getRecentlyShownTitleNames,
  upsertTitle,
} from "../lib/supabase";

const RATING_OPTIONS = [7, 8, 9, 10];
const TELL_MORE_OPTIONS = ["What stood out?", "Rewatch it?", "Who'd you watch with?"];
const BUFFER_LOW_WATERMARK = 5;
const BUFFER_TARGET_SIZE = 25;

const COLORS = {
  base: "#121116",
  text: "#f4f1eb",
  muted: "#86807a",
  dim: "#5a564f",
  gold: "#cba869",
  goldFaint: "#5a4f38",
  rust: "#8c6a5a",
  greyActive: "#aaa6a0",
  arrowRest: "#3a3833",
};

export default function SwipeScreen({ userId, portal, onNavigate }) {
  const [buffer, setBuffer] = useState([]);
  const [loadingBuffer, setLoadingBuffer] = useState(true);
  const [error, setError] = useState(null);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeDir, setActiveDir] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [tellMoreOpen, setTellMoreOpen] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [pendingTellMore, setPendingTellMore] = useState(null);

  const dragStart = useRef(null);
  const isDragging = useRef(false);
  const resolvedThisGesture = useRef(false);
  const refillInFlight = useRef(false);

  const current = buffer[0];

  const loadInitialBuffer = useCallback(async () => {
    setLoadingBuffer(true);
    setError(null);
    try {
      const history = await getHistory(userId, portal);
      const excludeTitles = await getRecentlyShownTitleNames();
      const ranked = await fetchRecommendations({ history, portal, excludeTitles, count: BUFFER_TARGET_SIZE });
      setBuffer(ranked);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBuffer(false);
    }
  }, [userId, portal]);

  useEffect(() => { loadInitialBuffer(); }, [loadInitialBuffer]);

  const refillIfLow = useCallback(async (remaining) => {
    if (remaining.length > BUFFER_LOW_WATERMARK || refillInFlight.current) return;
    refillInFlight.current = true;
    try {
      const history = await getHistory(userId, portal);
      const excludeTitles = await getRecentlyShownTitleNames();
      const ranked = await fetchRecommendations({ history, portal, excludeTitles, count: BUFFER_TARGET_SIZE });
      setBuffer(prev => [...prev, ...ranked]);
    } catch (err) {
      console.error("Background refill failed:", err.message);
    } finally {
      refillInFlight.current = false;
    }
  }, [userId, portal]);

  const directionFromOffset = (x, y) => {
    const threshold = 45;
    if (Math.abs(x) < threshold && Math.abs(y) < threshold) return null;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
    return y < 0 ? "up" : "down";
  };

  const finishSwipe = useCallback(async (title, direction, rating, tellMoreAnswer) => {
    setReviewedCount(c => c + 1);
    const next = buffer.slice(1);
    setBuffer(next);
    setDragOffset({ x: 0, y: 0 });
    setActiveDir(null);
    setTellMoreOpen(false);
    setPendingTellMore(null);

    try {
      const savedTitle = await upsertTitle({
        source: "claude-generated",
        source_id: `${portal}:${title.title}:${title.year}`,
        media_type: portal,
        title: title.title,
        art_url: null,
        logline: title.logline,
        tags: title.tags,
        year: title.year,
      });

      await recordInteraction({
        userId,
        titleId: savedTitle.id,
        direction,
        rating,
        tellMore: tellMoreAnswer ? { answer: tellMoreAnswer } : null,
        portal,
      });
      if (direction === "right" || direction === "up") {
        await addToSavedList({ userId, titleId: savedTitle.id, addedVia: "swipe" });
      }
    } catch (err) {
      console.error("Failed to record interaction:", err.message);
    }

    refillIfLow(next);
  }, [buffer, userId, portal, refillIfLow]);

  const resolveSwipe = (direction) => {
    if (!current || resolvedThisGesture.current) return;
    resolvedThisGesture.current = true;
    if (direction === "up") {
      setShowRating(true);
      return;
    }
    finishSwipe(current, direction, null, pendingTellMore);
  };

  const handleRatingPick = (rating) => {
    finishSwipe(current, "up", rating, pendingTellMore);
    setShowRating(false);
  };

  const handleTellMorePick = (answer) => {
    setPendingTellMore(answer);
    setTellMoreOpen(false);
  };

  const onPointerDown = (e) => {
    if (!current) return;
    isDragging.current = true;
    resolvedThisGesture.current = false;
    const point = e.touches ? e.touches[0] : e;
    dragStart.current = { x: point.clientX, y: point.clientY };
  };
  const onPointerMove = (e) => {
    if (!isDragging.current || !dragStart.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragStart.current.x;
    const dy = point.clientY - dragStart.current.y;
    setDragOffset({ x: dx, y: dy });
    setActiveDir(directionFromOffset(dx, dy));
  };
  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const dir = directionFromOffset(dragOffset.x, dragOffset.y);
    if (dir) resolveSwipe(dir);
    else { setDragOffset({ x: 0, y: 0 }); setActiveDir(null); }
    dragStart.current = null;
  };

  const handleArrowTap = (dir) => {
    resolvedThisGesture.current = false;
    setActiveDir(dir);
    setTimeout(() => resolveSwipe(dir), 100);
  };

  if (loadingBuffer) return <Centered onNavigate={onNavigate}>Loading recommendations…</Centered>;
  if (error) return <Centered onNavigate={onNavigate}>Couldn't load recommendations: {error}</Centered>;
  if (!current) return <Centered onNavigate={onNavigate}>That's everything for now — check back soon.</Centered>;

  const rotation = dragOffset.x * 0.04;
  const feedbackLabel = { up: "Liked", down: "Not for me", right: "Saved", left: "Skipped" }[activeDir];
  const feedbackColor = { up: COLORS.gold, down: COLORS.rust, right: COLORS.gold, left: COLORS.greyActive }[activeDir];

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <span style={styles.count}>{reviewedCount} reviewed</span>
      </div>

      {!showRating && (
        <div style={styles.cardZone}>
          <Arrow dir="up" active={activeDir === "up"} onClick={() => handleArrowTap("up")} style={styles.arrowUp} />
          <Arrow dir="down" active={activeDir === "down"} onClick={() => handleArrowTap("down")} style={styles.arrowDown} />
          <Arrow dir="left" active={activeDir === "left"} onClick={() => handleArrowTap("left")} style={styles.arrowLeft} />
          <Arrow dir="right" active={activeDir === "right"} onClick={() => handleArrowTap("right")} style={styles.arrowRight} />

          {activeDir && (
            <div style={{ ...styles.feedbackLabel, color: feedbackColor }}>{feedbackLabel}</div>
          )}

          <div
            style={{
              ...styles.card,
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`,
              transition: isDragging.current ? "none" : "transform 0.25s ease",
            }}
            onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          >
            <p style={styles.typeLabel}>{portal.toUpperCase()}</p>
            <h2 style={styles.title}>{current.title}</h2>
            <p style={styles.logline}>{current.logline}</p>
          </div>

          <div style={styles.tellMore} onClick={() => setTellMoreOpen(o => !o)}>
            {pendingTellMore ? `✓ ${pendingTellMore}` : "Tell us more"}
          </div>
          {tellMoreOpen && (
            <div style={styles.tellMorePanel}>
              {TELL_MORE_OPTIONS.map(opt => (
                <button key={opt} style={styles.tellMoreOption} onClick={() => handleTellMorePick(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showRating && (
        <div style={styles.ratingZone}>
          <p style={styles.ratingLabel}>you liked</p>
          <h3 style={styles.ratingTitle}>{current.title}</h3>
          <p style={styles.ratingQuestion}>how much?</p>
          <div style={styles.ratingGrid}>
            {RATING_OPTIONS.map(n => (
              <button key={n} style={styles.ratingButton} onClick={() => handleRatingPick(n)}>{n}</button>
            ))}
          </div>
        </div>
      )}

      <BottomNav active="swipe" onNavigate={onNavigate} />
    </div>
  );
}

function Centered({ children, onNavigate }) {
  return (
    <div style={{ ...styles.screen, justifyContent: "center" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>
        {children}
      </div>
      <BottomNav active="swipe" onNavigate={onNavigate} />
    </div>
  );
}

function Arrow({ dir, active, onClick, style }) {
  const icons = { up: "↑", down: "↓", left: "←", right: "→" };
  const activeColors = { up: COLORS.gold, down: COLORS.rust, left: COLORS.greyActive, right: COLORS.gold };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.arrowBase, ...style,
        color: active ? activeColors[dir] : COLORS.arrowRest,
      }}
    >{icons[dir]}</button>
  );
}

export function BottomNav({ active, onNavigate }) {
  const items = [
    { key: "home", label: "Movies", icon: "▶" },
    { key: "swipe", label: "Swipe", icon: "↔" },
    { key: "saved", label: "Saved", icon: "★" },
  ];
  return (
    <nav style={styles.nav}>
      {items.map(item => (
        <div
          key={item.key}
          style={{ ...styles.navItem, color: active === item.key ? COLORS.gold : "#504c46" }}
          onClick={() => onNavigate(item.key)}
        >
          <span style={styles.navIcon}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </nav>
  );
}

const styles = {
  screen: { fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: COLORS.base, color: COLORS.text, minHeight: "100vh", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative" },
  header: { padding: "20px 20px 0", fontFamily: "ui-monospace, monospace", fontSize: 12, color: COLORS.dim },
  count: {},
  cardZone: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "0 20px" },
  arrowBase: { position: "absolute", background: "none", border: "none", fontSize: 30, fontWeight: 700, cursor: "pointer", padding: 12, lineHeight: 1 },
  arrowUp: { top: "12%", left: "50%", transform: "translateX(-50%)" },
  arrowDown: { bottom: "14%", left: "50%", transform: "translateX(-50%)" },
  arrowLeft: { left: 4, top: "50%", transform: "translateY(-50%)" },
  arrowRight: { right: 4, top: "50%", transform: "translateY(-50%)" },
  feedbackLabel: { position: "absolute", top: "12%", left: "50%", transform: "translate(-50%, -34px)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" },
  card: { textAlign: "center", cursor: "grab", maxWidth: 280 },
  typeLabel: { fontFamily: "ui-monospace, monospace", fontSize: 11, color: COLORS.goldFaint, letterSpacing: "0.04em", marginBottom: 14 },
  title: { fontSize: 30, fontWeight: 700, lineHeight: 1.18, margin: "0 0 16px" },
  logline: { fontSize: 14, color: COLORS.muted, lineHeight: 1.5, margin: "0 auto" },
  tellMore: { textAlign: "center", paddingBottom: 28, fontSize: 13, fontWeight: 700, color: COLORS.gold, cursor: "pointer" },
  tellMorePanel: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingBottom: 20 },
  tellMoreOption: { border: "1px solid #5A7A60", color: "#9CAD92", background: "none", borderRadius: 14, padding: "6px 12px", fontSize: 12, cursor: "pointer" },
  ratingZone: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" },
  ratingLabel: { fontFamily: "ui-monospace, monospace", color: COLORS.dim, margin: 0 },
  ratingTitle: { fontSize: 22, fontWeight: 700, margin: "6px 0 18px" },
  ratingQuestion: { color: COLORS.muted, marginBottom: 16 },
  ratingGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: 180 },
  ratingButton: { width: 64, height: 64, borderRadius: 14, border: `2px solid ${COLORS.gold}`, background: "none", color: COLORS.gold, fontFamily: "ui-monospace, monospace", fontSize: 20, cursor: "pointer" },
  nav: { display: "flex", justifyContent: "center", gap: 90, padding: "14px 0 22px", background: "#0a0a0c" },
  navItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "ui-monospace, monospace", fontSize: 9, cursor: "pointer" },
  navIcon: { fontSize: 16 },
};
