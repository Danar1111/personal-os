"use client";

import { useState, useEffect } from "react";

export function useSpotifyDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleToggleRight = (e: any) => {
      if (typeof e.detail?.isOpen === "boolean") {
        setIsOpen(e.detail.isOpen);
      } else {
        setIsOpen((prev) => !prev);
      }
    };

    const handleDismissMini = (e: any) => {
      if (typeof e.detail?.isDismissed === "boolean") {
        setIsDismissed(e.detail.isDismissed);
      } else {
        setIsDismissed((prev) => !prev);
      }
    };

    window.addEventListener("toggle-spotify-right-sidebar", handleToggleRight);
    window.addEventListener("toggle-spotify-mini-player", handleDismissMini);

    return () => {
      window.removeEventListener("toggle-spotify-right-sidebar", handleToggleRight);
      window.removeEventListener("toggle-spotify-mini-player", handleDismissMini);
    };
  }, []);

  const toggleRight = (openState?: boolean) => {
    window.dispatchEvent(
      new CustomEvent("toggle-spotify-right-sidebar", {
        detail: { isOpen: openState },
      })
    );
  };

  const setMiniDismissed = (dismissedState: boolean) => {
    window.dispatchEvent(
      new CustomEvent("toggle-spotify-mini-player", {
        detail: { isDismissed: dismissedState },
      })
    );
  };

  const showSpotify = () => {
    setMiniDismissed(false);
    toggleRight(false);
  };


  return { isOpen, isDismissed, toggleRight, setMiniDismissed, showSpotify };
}
