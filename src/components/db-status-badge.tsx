"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Activity, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DbStatusBadge() {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/health/db", {
        cache: "no-store",
      });
      const data = await res.json();

      if (res.ok && data.connected) {
        setStatus("connected");
        setLatency(data.latencyMs ?? 0);
        setErrorMessage(null);
      } else {
        setStatus("disconnected");
        setLatency(null);
        setErrorMessage(data.error || "Database Offline");
      }
    } catch (err: any) {
      setStatus("disconnected");
      setLatency(null);
      setErrorMessage(err?.message || "Failed to reach database server");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 20000); // Poll every 20s
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div
      onClick={checkHealth}
      title={
        status === "disconnected"
          ? `Error: ${errorMessage}. Click to re-check connection.`
          : status === "connected"
          ? `Latency: ${latency}ms. Click to re-check connection.`
          : "Checking database health..."
      }
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300 cursor-pointer hover:bg-white/[0.06] transition-all select-none group"
    >
      {status === "checking" && (
        <>
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          <span>MySQL Database:</span>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px] font-mono px-1.5 py-0"
          >
            CHECKING...
          </Badge>
        </>
      )}

      {status === "connected" && (
        <>
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>MySQL Database:</span>
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px] font-mono px-1.5 py-0 flex items-center gap-1"
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>CONNECTED</span>
            {latency !== null && (
              <span className="text-[9px] text-emerald-500/80 font-normal">({latency}ms)</span>
            )}
          </Badge>
        </>
      )}

      {status === "disconnected" && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
          <span>MySQL Database:</span>
          <Badge
            variant="outline"
            className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[10px] font-mono px-1.5 py-0 flex items-center gap-1"
          >
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
            <span>DISCONNECTED</span>
          </Badge>
        </>
      )}
    </div>
  );
}
