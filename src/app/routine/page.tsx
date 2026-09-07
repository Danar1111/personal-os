import React from "react";
import { Metadata } from "next";
import { DailyRoutineTracker } from "@/components/daily-routine-tracker";

export const metadata: Metadata = {
  title: "Daily Routine & Day Tracker | Personal OS",
  description: "24-Hour Day Schedule Matrix, Dynamic Day Protocols & Minimal Habit Tracking",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function RoutinePage() {
  return (
    <div className="-m-6 md:-m-8 h-[calc(100vh-4rem)] p-3 md:p-4 overflow-hidden flex flex-col justify-between">
      <DailyRoutineTracker />
    </div>
  );
}
