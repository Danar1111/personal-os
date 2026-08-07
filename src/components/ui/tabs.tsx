"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (val: string) => void;
}>({
  activeTab: "",
  setActiveTab: () => {},
});

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("space-y-6", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-inner",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={cn(
        "px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 cursor-pointer select-none",
        isActive
          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25 border border-white/20"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext);
  if (activeTab !== value) return null;

  return <div className={cn("animate-in fade-in-50 duration-200", className)}>{children}</div>;
}
