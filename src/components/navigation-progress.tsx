"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const clear = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

/** Dispatch this before any programmatic router.push() to trigger the pill */
export const dispatchNavStart = () =>
  window.dispatchEvent(new CustomEvent("nav:start"));

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"hidden" | "enter" | "visible" | "leave">("hidden");
  const prevPathname = useRef(pathname);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Navigation completes → hide pill ── */
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    clear(showTimer);
    clear(safetyTimer);
    setPhase("leave");
    hideTimer.current = setTimeout(() => setPhase("hidden"), 350);
  }, [pathname]);

  /* ── Detect navigation START ── */
  useEffect(() => {
    const show = () => {
      clear(hideTimer);
      clear(safetyTimer);
      setPhase("enter");
      // 80ms delay: fast navigations won't flash the pill
      showTimer.current = setTimeout(() => setPhase("visible"), 80);
      // Safety: auto-hide after 8s if pathname never changes (same-page nav etc.)
      safetyTimer.current = setTimeout(() => {
        setPhase("leave");
        hideTimer.current = setTimeout(() => setPhase("hidden"), 350);
      }, 8000);
    };

    // 1. Anchor clicks (Next.js <Link> renders <a>)
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      const target = href.split("?")[0].split("#")[0];
      if (!target || target === window.location.pathname) return;
      show();
    };

    // 2. Custom event for programmatic router.push()
    const handleNavStart = () => show();

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("nav:start", handleNavStart);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("nav:start", handleNavStart);
      clear(showTimer);
      clear(hideTimer);
      clear(safetyTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99997] flex justify-center pointer-events-none"
      aria-hidden
    >
      <div
        className="mt-3 flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-mono transition-all duration-300"
        style={{
          background: "rgba(15, 15, 22, 0.85)",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(99, 102, 241, 0.15)",
          backdropFilter: "blur(16px)",
          opacity: phase === "leave" ? 0 : 1,
          transform:
            phase === "enter"
              ? "translateY(-10px) scale(0.92)"
              : phase === "leave"
              ? "translateY(-8px) scale(0.94)"
              : "translateY(0) scale(1)",
        }}
      >
        <span
          className="w-3 h-3 rounded-full border-2 shrink-0"
          style={{
            borderColor: "rgba(99, 102, 241, 0.25)",
            borderTopColor: "rgb(129, 140, 248)",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <span className="text-slate-300 tracking-wide">Loading</span>
        <span className="flex items-center gap-0.5 pb-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1 h-1 rounded-full bg-indigo-400"
              style={{ animation: `bounce 0.9s ease-in-out ${delay}ms infinite` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
