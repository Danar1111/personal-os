"use client";

import React, { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";

interface SparklineProps {
  data: { close: number }[];
  isPositive: boolean;
  height?: number;
}

export function Sparkline({ data, isPositive, height = 45 }: SparklineProps) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return null;
  }

  const strokeColor = isPositive ? "#10b981" : "#ef4444";
  const fillColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <div className="w-full overflow-hidden pointer-events-none select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
