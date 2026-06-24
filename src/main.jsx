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
    if (target === "portal") {
      setActivePortal(params.portal);
      setScreen("portal");
    } else {
      setScreen(target); // "home" | "swipe" | "saved"
    }
  };

  if (screen === "home") return <MainPage onNavigate={navigate} />;
  if (screen === "portal") return <PortalPage portal={activePortal} userId={TEMP_USER_ID} onNavigate={navigate} />;
  if (screen === "swipe") return <SwipeScreen userId={TEMP_USER_ID} portal={activePortal} onNavigate={navigate} />;
  if (screen === "saved") return <HistoryPage userId={TEMP_USER_ID} onNavigate={navigate} />;
  return null;
}

createRoot(document.getElementById("root")).render(<App />);
