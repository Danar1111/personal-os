"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { Shield, Eye, EyeOff, Lock, LogIn, KeyRound } from "lucide-react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_KEY = "personal_os_unlocked";

/* ─────────────────────────── Context ─────────────────────────── */
interface LockContextType {
  timeLeft: number;   // seconds
  isLocked: boolean;
}

export const LockContext = createContext<LockContextType>({
  timeLeft: 1800,
  isLocked: false,
});

export function useLockTimer() {
  return useContext(LockContext);
}

/* ─────────────────────── Floating Particle ─────────────────────── */
function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <div
      className="absolute rounded-full opacity-0 pointer-events-none"
      style={{
        left: `${x}%`,
        bottom: "-10px",
        width: `${size}px`,
        height: `${size}px`,
        background: `radial-gradient(circle, rgba(99,102,241,0.6) 0%, rgba(139,92,246,0.3) 60%, transparent 100%)`,
        animation: `floatUp ${6 + delay}s ease-in-out ${delay}s infinite`,
        filter: "blur(1px)",
      }}
    />
  );
}

/* ─────────────────────── Main Provider ─────────────────────── */
export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1800); // seconds (30 minutes)
  const [zenRunning, setZenRunning] = useState(false);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const zenRunningRef = useRef(false);

  /* ── Session & PIN Config check on mount + zen listener ── */
  useEffect(() => {
    let isMounted = true;
    const checkPinConfig = async () => {
      try {
        const res = await fetch("/api/verify-pin");
        const data = await res.json();
        if (!isMounted) return;
        if (!data.configured) {
          // No PIN configured in .env or DB — bypass lock screen
          setIsLocked(false);
          setIsReady(true);
          return;
        }
      } catch (e) {
        console.warn("Failed to check PIN config:", e);
      }

      const unlocked = sessionStorage.getItem(SESSION_KEY);
      if (unlocked === "true") {
        setIsLocked(false);
        setTimeLeft(1800);
      }
      setIsReady(true);
    };

    checkPinConfig();

    // Read initial zen state
    const initialZen = localStorage.getItem("zen_running") === "true";
    setZenRunning(initialZen);
    zenRunningRef.current = initialZen;

    // Listen for zen state changes across same tab (custom event)
    const handleStorage = () => {
      const running = localStorage.getItem("zen_running") === "true";
      setZenRunning(running);
      zenRunningRef.current = running;
    };
    window.addEventListener("zen_state_change", handleStorage);
    window.addEventListener("storage", handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("zen_state_change", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const lastActivityRef = useRef<number>(Date.now());

  /* ── Lock screen ── */
  const lockScreen = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsLocked(true);
    setPassword("");
    setStatus("idle");
    setErrorMsg("");
    setTimeLeft(1800);
  }, []);

  /* ── Reset inactivity & countdown (skips reset when zen running) ── */
  const resetInactivityTimer = useCallback(() => {
    if (zenRunningRef.current) return;
    lastActivityRef.current = Date.now();
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(lockScreen, INACTIVITY_TIMEOUT_MS);
  }, [lockScreen]);

  /* ── Continuous 1-second countdown tick ── */
  useEffect(() => {
    if (isLocked) return;

    lastActivityRef.current = Date.now();
    setTimeLeft(1800);

    const interval = setInterval(() => {
      if (zenRunningRef.current) return;
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, 1800 - elapsedSeconds);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        lockScreen();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockScreen]);

  /* ── Inactivity listeners when unlocked ── */
  useEffect(() => {
    if (!isLocked) {
      const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
      events.forEach((ev) => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
      resetInactivityTimer();

      return () => {
        events.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    }
  }, [isLocked, resetInactivityTimer]);

  /* ── Pause/resume inactivity timeout when zen starts/stops ── */
  useEffect(() => {
    if (!isLocked) {
      if (zenRunning) {
        // Zen started — freeze the inactivity timeout
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      } else {
        // Zen stopped — restart timeout from remaining timeLeft
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(lockScreen, timeLeft * 1000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zenRunning, isLocked]);

  /* ── Auto-focus input when locked ── */
  useEffect(() => {

    if (isLocked && isReady) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLocked, isReady]);

  /* ── Submit password ── */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim() || status === "verifying" || status === "success") return;

    setStatus("verifying");
    setErrorMsg("");

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: password }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY, "true");
          setIsLocked(false);
          setPassword("");
          setStatus("idle");
        }, 800);
      } else {
        setStatus("error");
        setErrorMsg("Incorrect password. Please try again.");
        setShakeKey((k) => k + 1);
        setTimeout(() => {
          setPassword("");
          setStatus("idle");
          inputRef.current?.focus();
        }, 700);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Connection error. Please try again.");
      setShakeKey((k) => k + 1);
      setTimeout(() => {
        setPassword("");
        setStatus("idle");
      }, 700);
    }
  }, [password, status]);

  if (!isReady) return null;

  return (
    <LockContext.Provider value={{ timeLeft, isLocked }}>
      {isLocked && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden">
          {/* ── Blurred app background (reduced blur) ── */}
          <div className="absolute inset-0 backdrop-blur-sm bg-[#0a0a0b]/50" />

          {/* ── Dark vignette overlay ── */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#07070a]/40 to-[#07070a]/80 pointer-events-none" />

          {/* ── Grid overlay ── */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* ── Animated ambient glows ── */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
                animation: "breathe 4s ease-in-out infinite",
              }}
            />
            <div
              className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
                animation: "breathe 5s ease-in-out 1.5s infinite",
              }}
            />
          </div>

          {/* ── Floating particles ── */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[
              { x: 10, delay: 0, size: 4 }, { x: 25, delay: 1.5, size: 6 },
              { x: 40, delay: 0.8, size: 3 }, { x: 55, delay: 2.2, size: 5 },
              { x: 68, delay: 0.4, size: 4 }, { x: 80, delay: 1.8, size: 7 },
              { x: 92, delay: 1.1, size: 3 }, { x: 15, delay: 3.0, size: 5 },
              { x: 35, delay: 2.5, size: 4 }, { x: 73, delay: 3.5, size: 6 },
              { x: 50, delay: 4.0, size: 3 }, { x: 85, delay: 2.8, size: 5 },
            ].map((p, i) => (
              <Particle key={i} x={p.x} delay={p.delay} size={p.size} />
            ))}
          </div>

          {/* ── Scanline sweep ── */}
          <div
            className="absolute left-0 right-0 h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)",
              animation: "scanline 8s linear infinite",
            }}
          />

          {/* ── Lock Card ── */}
          <div
            key={shakeKey}
            className="relative z-10 w-full max-w-md mx-4"
            style={status === "error" ? { animation: "shake 0.5s ease-in-out" } : undefined}
          >
            <div className="bg-white/[0.04] border border-white/15 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-7">

              {/* ── Icon & Title ── */}
              <div className="text-center space-y-4">
                {/* Pulsing rings + icon */}
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  {/* Outer pulse ring */}
                  <div
                    className="absolute inset-0 rounded-full border border-indigo-500/30"
                    style={{ animation: "pingRing 2.5s ease-out infinite" }}
                  />
                  <div
                    className="absolute inset-0 rounded-full border border-indigo-500/20"
                    style={{ animation: "pingRing 2.5s ease-out 0.8s infinite" }}
                  />
                  {/* Icon background */}
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600/25 to-purple-600/15 border border-indigo-500/40 flex items-center justify-center shadow-2xl shadow-indigo-600/20">
                    {status === "success" ? (
                      <div className="text-emerald-400" style={{ animation: "popIn 0.3s ease-out" }}>
                        <LogIn className="w-9 h-9" />
                      </div>
                    ) : (
                      <KeyRound
                        className="w-9 h-9 text-indigo-400"
                        style={{ animation: "floatIcon 3s ease-in-out infinite" }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-bold font-mono text-white tracking-widest uppercase">
                    PERSONAL OS
                  </h1>
                  <p className="text-xs font-mono text-slate-500 mt-1.5 tracking-wider">
                    {status === "success"
                      ? "✓ Access granted. Unlocking workspace..."
                      : "Enter your password to access the system"}
                  </p>
                </div>
              </div>

              {/* ── Password Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-400 tracking-widest uppercase">
                    Access Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      ref={inputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (status === "error") { setStatus("idle"); setErrorMsg(""); }
                      }}
                      placeholder="••••••••"
                      disabled={status === "verifying" || status === "success"}
                      className={`
                        w-full h-12 pl-11 pr-11 bg-white/[0.05] border rounded-2xl text-sm font-mono text-white placeholder:text-slate-600
                        focus:outline-none transition-all duration-200
                        ${status === "error"
                          ? "border-rose-500/60 focus:border-rose-500 shadow-[0_0_16px_rgba(239,68,68,0.15)]"
                          : status === "success"
                          ? "border-emerald-500/60 shadow-[0_0_16px_rgba(52,211,153,0.15)]"
                          : "border-white/15 focus:border-indigo-500/70 focus:shadow-[0_0_16px_rgba(99,102,241,0.2)]"
                        }
                        disabled:opacity-50
                      `}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer rounded-lg"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Error message */}
                  {errorMsg && (
                    <p className="text-xs font-mono text-rose-400 flex items-center gap-1.5 pl-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block shrink-0" />
                      {errorMsg}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!password.trim() || status === "verifying" || status === "success"}
                  className={`
                    w-full h-12 rounded-2xl font-mono text-sm font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer
                    ${status === "success"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    }
                  `}
                >
                  {status === "verifying" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : status === "success" ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      Unlocking Workspace
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Unlock System
                    </>
                  )}
                </button>
              </form>

              {/* ── Footer ── */}
              <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-slate-600 pt-1">
                <Shield className="w-3 h-3" />
                <span>Secured · Personal OS v1.0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-10px); }
          30%       { transform: translateX(10px); }
          45%       { transform: translateX(-7px); }
          60%       { transform: translateX(7px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.2; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%       { transform: scale(1.15); opacity: 1;   }
        }
        @keyframes pingRing {
          0%   { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0;   }
        }
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes scanline {
          0%   { top: -2px;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 0.3; }
          100% { top: 100vh; opacity: 0; }
        }
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-stops));
        }
      `}</style>

      {children}
    </LockContext.Provider>
  );
}
