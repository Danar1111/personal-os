"use client";

import React, { useState, useTransition } from "react";
import { Transaction } from "@/db/schema";
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
} from "@/app/finance/actions";
import {
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Tag,
  Edit3,
  AlertTriangle,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FinanceManagerProps {
  initialTransactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  initialAssets?: any[];
  initialNotes?: any[];
}

export function FinanceManager({
  initialTransactions,
  totalIncome,
  totalExpense,
  netBalance,
}: FinanceManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [txVisibleLimit, setTxVisibleLimit] = useState<number>(6);

  // Create Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Detail View Modal State
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  // Edit Modal State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Custom Glassmorphic Delete Confirmation Modal State
  const [deletingTransactionConfirm, setDeletingTransactionConfirm] = useState<Transaction | null>(null);

  // Filtered Transactions
  const filteredTransactions = initialTransactions.filter((tx) => {
    const matchesSearch =
      tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const spendPercentage =
    totalIncome > 0 ? Math.min(Math.round((totalExpense / totalIncome) * 100), 100) : 0;

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    startTransition(async () => {
      await createTransactionAction({
        type: newType,
        amount: parsedAmount,
        category: newCategory || "General",
        description: newDescription,
      });
      setNewAmount("");
      setNewCategory("");
      setNewDescription("");
      setIsDialogOpen(false);
    });
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setViewingTransaction(null);
    setEditingTransaction(tx);
    setEditType(tx.type as "income" | "expense");
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category);
    setEditDescription(tx.description || "");
  };

  const handleSaveEditTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    startTransition(async () => {
      await updateTransactionAction(editingTransaction.id, {
        type: editType,
        amount: parsedAmount,
        category: editCategory || "General",
        description: editDescription,
      });
      setEditingTransaction(null);
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* 4 Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Net Balance */}
        <div className="glass-panel glass-panel-hover p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">NET BALANCE</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div
              className={cn(
                "text-2xl font-bold font-mono tracking-tight",
                netBalance >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {formatCurrency(netBalance)}
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-1 block">
              {netBalance >= 0 ? "+ Positive Liquidity" : "- Deficit Warning"}
            </span>
          </div>
        </div>

        {/* Card 2: Total Income */}
        <div className="glass-panel glass-panel-hover p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">TOTAL INCOME</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400 flex items-center gap-1">
              {formatCurrency(totalIncome)} <ArrowUpRight className="w-4 h-4 inline" />
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-1 block">Current Month</span>
          </div>
        </div>

        {/* Card 3: Total Expense */}
        <div className="glass-panel glass-panel-hover p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">TOTAL EXPENSES</span>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-rose-400 flex items-center gap-1">
              {formatCurrency(totalExpense)} <ArrowDownRight className="w-4 h-4 inline" />
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-1 block">Current Month</span>
          </div>
        </div>

        {/* Card 4: Expense / Income Ratio */}
        <div className="glass-panel glass-panel-hover p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border border-white/10 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">SPEND RATE</span>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono text-[10px]">
              {spendPercentage}% USED
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span>Budget Usage</span>
              <span className="text-indigo-300 font-semibold">{spendPercentage}%</span>
            </div>
            <Progress value={spendPercentage} className="h-1.5 bg-white/10" />
            <span className="text-[10px] font-mono text-slate-500 block">Based on monthly income</span>
          </div>
        </div>

      </div>

      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 focus:border-indigo-500 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val || "all")}>
            <SelectTrigger className="w-48 bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <SelectValue placeholder="All Types" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#14141e] border-white/15 text-slate-100 rounded-2xl p-1.5 shadow-2xl z-[100] min-w-[200px]">
              <SelectItem value="all" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">All Types</SelectItem>
              <SelectItem value="income" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">Income Only (+)</SelectItem>
              <SelectItem value="expense" className="px-3.5 py-2.5 text-xs font-mono rounded-xl cursor-pointer">Expenses Only (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create Transaction Modal */}
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Transaction
        </Button>
      </div>

      {/* New Transaction Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
            <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-400" /> ADD NEW TRANSACTION
            </DialogTitle>
            <button
              onClick={() => setIsDialogOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <form onSubmit={handleCreateTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Type *</label>
                <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                  <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                    <SelectItem value="expense" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Expense (-)</SelectItem>
                    <SelectItem value="income" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Income (+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Amount ($) *</label>
                <Input
                  autoFocus
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Category *</label>
              <Input
                required
                placeholder="e.g. Cloud Infrastructure, Salary, AI Credits"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Description</label>
              <Textarea
                placeholder="Additional context or notes..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[90px] p-3.5 font-sans"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 w-full shadow-lg shadow-indigo-600/30">
                {isPending ? "Recording..." : "Save Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction History Data Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-lg">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" /> TRANSACTION HISTORY
          </h3>
          <Badge variant="outline" className="border-white/10 text-slate-300 font-mono text-[11px]">
            {filteredTransactions.length} RECORDS
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/[0.02] border-b border-white/10 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                    No transactions match criteria
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, txVisibleLimit).map((tx) => {
                  const isIncome = tx.type === "income";
                  const numericVal = parseFloat(tx.amount.toString()) || 0;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setViewingTransaction(tx)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono uppercase px-2 py-0.5",
                            isIncome
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                          )}
                        >
                          {isIncome ? "Income (+)" : "Expense (-)"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <span className="flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
                          <Tag className="w-3 h-3 text-slate-500 inline" />
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                        {tx.description || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {tx.date ? new Date(tx.date).toLocaleDateString("en-US") : "-"}
                      </td>
                      <td
                        className={cn(
                          "py-3 px-4 text-right font-bold font-mono text-sm",
                          isIncome ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {isIncome ? "+" : "-"}{formatCurrency(numericVal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(tx);
                            }}
                            className="w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                            title="Edit Transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingTransactionConfirm(tx);
                            }}
                            className="w-7 h-7 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Show More / Show Less Expander Button */}
        {filteredTransactions.length > 6 && (
          <div className="flex justify-center pt-4 pb-1">
            {txVisibleLimit < filteredTransactions.length ? (
              <Button
                onClick={() => setTxVisibleLimit(filteredTransactions.length)}
                className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
              >
                Show More (+{filteredTransactions.length - txVisibleLimit} more transactions)
              </Button>
            ) : (
              <Button
                onClick={() => setTxVisibleLimit(6)}
                variant="outline"
                className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
              >
                Show Less
              </Button>
            )}
          </div>
        )}
      </div>

      {/* TRANSACTION DETAIL VIEW MODAL */}
      {viewingTransaction && (
        <Dialog open={!!viewingTransaction} onOpenChange={() => setViewingTransaction(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-lg p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Eye className="w-4 h-4" />
                </div>
                <DialogTitle className="text-sm font-bold font-mono text-white tracking-wide uppercase">
                  TRANSACTION DETAILS
                </DialogTitle>
              </div>

              <button
                onClick={() => setViewingTransaction(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div>
                  <h4 className="text-xs text-slate-400">Category</h4>
                  <p className="text-sm font-bold text-white mt-0.5">{viewingTransaction.category}</p>
                </div>
                <div className="text-right">
                  <h4 className="text-xs text-slate-400">Amount</h4>
                  <p className={cn(
                    "text-base font-bold font-mono mt-0.5",
                    viewingTransaction.type === "income" ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {viewingTransaction.type === "income" ? "+" : "-"}{formatCurrency(parseFloat(viewingTransaction.amount.toString()))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Type: <strong className="text-white uppercase">{viewingTransaction.type}</strong></span>
                <span>•</span>
                <span>Date: <strong className="text-white">{viewingTransaction.date ? new Date(viewingTransaction.date).toLocaleDateString("en-US") : "-"}</strong></span>
              </div>

              {viewingTransaction.description ? (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {viewingTransaction.description}
                </div>
              ) : (
                <p className="text-xs italic text-slate-500 font-mono">No description provided for this transaction.</p>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeletingTransactionConfirm(viewingTransaction)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
              <Button
                onClick={() => handleOpenEditModal(viewingTransaction)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-5 shadow-lg shadow-indigo-600/30"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* EDIT TRANSACTION MODAL DIALOG */}
      {editingTransaction && (
        <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
          <DialogContent showCloseButton={false} className="bg-[#14141e] border-white/15 text-slate-100 rounded-3xl max-w-xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 font-mono">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" /> EDIT TRANSACTION
              </DialogTitle>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>

            <form onSubmit={handleSaveEditTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300">Type *</label>
                  <Select value={editType} onValueChange={(val: any) => setEditType(val)}>
                    <SelectTrigger className="w-full bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14141e] border-white/15 text-slate-200 rounded-2xl p-1.5">
                      <SelectItem value="expense" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Expense (-)</SelectItem>
                      <SelectItem value="income" className="px-3.5 py-2 text-xs font-mono rounded-xl cursor-pointer">Income (+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300">Amount ($) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Category *</label>
                <Input
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-11 px-4 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl min-h-[90px] p-3.5 font-sans"
                />
              </div>

              <DialogFooter className="pt-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeletingTransactionConfirm(editingTransaction)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-mono text-xs rounded-2xl h-11 px-4"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Record
                </Button>
                <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs rounded-2xl h-11 px-6 shadow-lg shadow-indigo-600/30">
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC TRANSACTION DELETE CONFIRMATION DIALOG */}
      {deletingTransactionConfirm && (
        <Dialog open={!!deletingTransactionConfirm} onOpenChange={() => setDeletingTransactionConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">DELETE TRANSACTION RECORD</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to delete transaction <span className="text-rose-300 font-bold">&quot;{deletingTransactionConfirm.category}&quot;</span> ({formatCurrency(parseFloat(deletingTransactionConfirm.amount.toString()))})?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingTransactionConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  const id = deletingTransactionConfirm.id;
                  startTransition(async () => {
                    await deleteTransactionAction(id);
                    setDeletingTransactionConfirm(null);
                    if (viewingTransaction?.id === id) setViewingTransaction(null);
                    if (editingTransaction?.id === id) setEditingTransaction(null);
                  });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40"
              >
                {isPending ? "Deleting..." : "Delete Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
