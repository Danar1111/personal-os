"use client";

import React, { useState, useTransition } from "react";
import {
  Settings2,
  Plus,
  Trash2,
  Activity,
  Loader2,
  X,
  GripVertical,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PinnedTicker } from "@/db/schema";
import {
  addTickerAction,
  removeTickerAction,
  updateTickerOrderAction,
} from "@/lib/actions/tickerActions";

// @dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ManageTickersModalProps {
  initialTickers: PinnedTicker[];
}

function SortableTickerRow({
  ticker,
  onRemove,
}: {
  ticker: PinnedTicker;
  onRemove: (id: number, symbol: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ticker.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between font-mono text-sm shadow-lg transition-all ${
        isDragging ? "ring-2 ring-indigo-500/60 bg-indigo-500/15 z-50 scale-[1.02]" : "hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3 font-bold text-white">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none transition-colors"
          title="Drag handle to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 glow-emerald" />
        <span className="tracking-wide text-sm">{ticker.symbol}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(ticker.id, ticker.symbol)}
        className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer transition-colors"
        title={`Unpin ${ticker.symbol}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function ManageTickersModal({ initialTickers }: ManageTickersModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tickers, setTickers] = useState<PinnedTicker[]>(initialTickers);
  const [newSymbol, setNewSymbol] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || isAdding) return;

    setErrorMsg(null);
    setIsAdding(true);

    const clean = newSymbol.trim().toUpperCase();
    const res = await addTickerAction(clean);

    if (res.success) {
      setNewSymbol("");
      setTickers((prev) => [
        ...prev,
        { id: Date.now(), symbol: clean, sortOrder: prev.length, createdAt: new Date() },
      ]);
    } else {
      setErrorMsg(res.message);
    }

    setIsAdding(false);
  };

  const handleRemove = (id: number, symbol: string) => {
    setTickers((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const res = await removeTickerAction(id);
      if (!res.success) {
        alert(res.message);
        setTickers(initialTickers);
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTickers((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);

      startTransition(async () => {
        await updateTickerOrderAction(newItems.map((t) => t.id));
      });

      return newItems;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-500/30 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 font-mono text-xs cursor-pointer shadow-md transition-all hover:scale-105">
        <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
        <span>Manage Tickers ({tickers.length})</span>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl md:max-w-2xl w-[94vw] bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-7 shadow-2xl backdrop-blur-2xl space-y-6"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-mono text-white tracking-wide uppercase flex items-center gap-2">
                MANAGE PINNED TICKERS
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono">
                  DRAG &amp; DROP
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time Yahoo Validation • Drag ☰ to Reorder Equities / Crypto / IDX (.JK)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* Add Ticker Input Form */}
        <form onSubmit={handleAdd} className="space-y-2.5">
          <div className="flex gap-3">
            <Input
              value={newSymbol}
              onChange={(e) => {
                setNewSymbol(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Enter symbol e.g. AAPL, NVDA, BMRI.JK, BBCA.JK, BTC-USD..."
              className="bg-white/[0.04] border-white/10 text-sm text-white uppercase placeholder:text-slate-500 rounded-2xl h-12 focus:border-indigo-500/50 font-mono flex-1 px-4"
            />
            <Button
              type="submit"
              disabled={isAdding || !newSymbol.trim()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs font-bold rounded-2xl h-12 px-6 gap-2 shrink-0 shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Symbol</span>
                </>
              )}
            </Button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Drag and Drop Pinned List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider">
            <span>Pinned Symbols ({tickers.length})</span>
            <span className="text-[11px] text-slate-400 font-normal flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" /> Hold ☰ to Drag &amp; Reorder
            </span>
          </div>

          {tickers.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5">
              No tickers pinned. Add a symbol above!
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tickers.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {tickers.map((t) => (
                    <SortableTickerRow key={t.id} ticker={t} onRemove={handleRemove} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
