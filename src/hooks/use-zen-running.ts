"use client";

import { useState, useEffect } from "react";

export function useZenRunning(): boolean {
  const [zenRunning, setZenRunning] = useState(false);

  useEffect(() => {
    const sync = () => {
      setZenRunning(localStorage.getItem("zen_running") === "true");
    };
    sync();
    window.addEventListener("zen_state_change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("zen_state_change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return zenRunning;
}
