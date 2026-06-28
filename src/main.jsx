import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MainPage from "./components/MainPage";
import PortalPage from "./components/PortalPage";
import SwipeScreen from "./components/SwipeScreen";
import HistoryPage from "./components/HistoryPage";

// Temporary fixed user ID for v1 (no auth yet).
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000001";

function App() {
  const [screen, setScreen] = useState("home");
  const [activePortal, setActivePortal] = useState("movie");

  const navigate = (target, params = {}) => {
    if (params.portal) setActivePortal(params.portal);
    setScreen(target); // "home" | "swipe" | "curate" | "shelf"
  };

  if (screen === "home") return <MainPage onNavigate={navigate} />;
  // "curate" reuses PortalPage for now - it already has the recommendations
  // logic; the rename/resize to a small Top-3 view happens in the next pass.
  if (screen === "curate") return <PortalPage portal={activePortal} userId={TEMP_USER_ID} onNavigate={navigate} />;
  if (screen === "swipe") return <SwipeScreen userId={TEMP_USER_ID} portal={activePortal} onNavigate={navigate} />;
  // "shelf" reuses HistoryPage for now - it already reads wl_interactions;
  // adding the To-Watch tab alongside History happens in the next pass.
  if (screen === "shelf") return <HistoryPage userId={TEMP_USER_ID} onNavigate={navigate} />;
  return null;
}

createRoot(document.getElementById("root")).render(<App />);
