"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Plus,
  Trash2,
  Save,
  Send,
  Sparkles,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Code,
  Tag,
  Eye,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmailTemplate } from "@/db/schema";
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  sendDirectEmailAction,
} from "../actions";
import { cn } from "@/lib/utils";

interface EmailerTemplatesClientProps {
  initialTemplates: EmailTemplate[];
  brevoConfigured: boolean;
}

export function EmailerTemplatesClient({
  initialTemplates,
  brevoConfigured,
}: EmailerTemplatesClientProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(
    initialTemplates.length > 0 ? initialTemplates[0] : null
  );

  // Form Editor State
  const [editorName, setEditorName] = useState(selectedTemplate?.name || "");
  const [editorSubject, setEditorSubject] = useState(selectedTemplate?.subject || "");
  const [editorBodyHtml, setEditorBodyHtml] = useState(selectedTemplate?.bodyHtml || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview / Send Test Email Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testRecipientName, setTestRecipientName] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Helper to extract {{vars}} in real-time
  const extractVars = (str: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const matches = new Set<string>();
    let m;
    while ((m = regex.exec(str)) !== null) {
      if (m[1]) matches.add(m[1].trim());
    }
    return Array.from(matches);
  };

  const currentVariables = extractVars(`${editorSubject} ${editorBodyHtml}`);

  const handleSelectTemplate = (t: EmailTemplate) => {
    setSelectedTemplate(t);
    setEditorName(t.name);
    setEditorSubject(t.subject);
    setEditorBodyHtml(t.bodyHtml);
  };

  const handleNewTemplate = () => {
    const newT: EmailTemplate = {
      id: "",
      name: "New Email Template",
      subject: "Important Notification: {{client_name}}",
      bodyHtml: `<html>\n<body>\n  <h2>Hello {{client_name}}!</h2>\n  <p>Thank you for working with Personal OS.</p>\n  <p>Here is your link: <a href="{{link}}">Click Here</a></p>\n</body>\n</html>`,
      variables: JSON.stringify(["client_name", "link"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedTemplate(null);
    setEditorName(newT.name);
    setEditorSubject(newT.subject);
    setEditorBodyHtml(newT.bodyHtml);
  };

  const handleSaveTemplate = async () => {
    if (!editorName.trim() || !editorSubject.trim() || !editorBodyHtml.trim()) {
      triggerFeedback("Please fill out Name, Subject, and Body HTML.");
      return;
    }

    setIsSaving(true);

    if (selectedTemplate && selectedTemplate.id) {
      const res = await updateEmailTemplate(selectedTemplate.id, {
        name: editorName,
        subject: editorSubject,
        bodyHtml: editorBodyHtml,
      });

      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === selectedTemplate.id
              ? {
                  ...t,
                  name: editorName.trim(),
                  subject: editorSubject.trim(),
                  bodyHtml: editorBodyHtml.trim(),
                  variables: JSON.stringify(currentVariables),
                  updatedAt: new Date(),
                }
              : t
          )
        );
        triggerFeedback(res.message || "Template saved.");
      } else {
        triggerFeedback(res.message || "Failed to save template.");
      }
    } else {
      const res = await createEmailTemplate({
        name: editorName,
        subject: editorSubject,
        bodyHtml: editorBodyHtml,
      });

      if (res.success) {
        const newId = crypto.randomUUID();
        const created: EmailTemplate = {
          id: newId,
          name: editorName.trim(),
          subject: editorSubject.trim(),
          bodyHtml: editorBodyHtml.trim(),
          variables: JSON.stringify(currentVariables),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setTemplates((prev) => [created, ...prev]);
        setSelectedTemplate(created);
        triggerFeedback(res.message || "Template created.");
      } else {
        triggerFeedback(res.message || "Failed to create template.");
      }
    }

    setIsSaving(false);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || !selectedTemplate.id) return;
    setIsDeleting(true);

    const res = await deleteEmailTemplate(selectedTemplate.id);
    if (res.success) {
      const remaining = templates.filter((t) => t.id !== selectedTemplate.id);
      setTemplates(remaining);
      triggerFeedback(res.message || "Template deleted.");
      if (remaining.length > 0) {
        handleSelectTemplate(remaining[0]);
      } else {
        handleNewTemplate();
      }
    } else {
      triggerFeedback(res.message || "Failed to delete template.");
    }
    setIsDeleting(false);
  };

  const openTestModal = () => {
    if (!testRecipient) setTestRecipient("priyambodo02@gmail.com");
    if (!testRecipientName) setTestRecipientName("Danar");

    const smartDefaults: Record<string, string> = {
      alert_level: "HIGH",
      event_name: "System Health Check",
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      server_name: "Personal OS Production",
      log_message: "All systems operational and neural agent active.",
      client_name: "Danar",
      invoice_link: "https://personal-os.local/finance",
      invoice_number: "INV-2026-001",
      user_name: "Danar",
      link: "https://personal-os.local",
    };

    const initialVars: Record<string, string> = {};
    currentVariables.forEach((v) => {
      initialVars[v] = testVariables[v] || smartDefaults[v] || `Sample ${v}`;
    });
    setTestVariables(initialVars);
    setIsTestModalOpen(true);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTo = testRecipient.trim() || "priyambodo02@gmail.com";
    const targetName = testRecipientName.trim() || "Danar";

    // Immediately close modal and trigger sending toast at top center
    setIsTestModalOpen(false);
    triggerFeedback(`📤 Sending email to ${targetTo} via Brevo SMTP...`);

    setIsSendingTest(true);
    const res = await sendDirectEmailAction({
      to: targetTo,
      name: targetName,
      subject: editorSubject,
      bodyHtml: editorBodyHtml,
      variables: testVariables,
    });

    triggerFeedback(res.message);
    setIsSendingTest(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Feedback Toast (Top Center) */}
      {feedback && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#161622]/95 border border-purple-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2.5 font-mono text-xs animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e0e14]/90 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-sans">
              <span>Omni-Emailer Template Studio</span>
              <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px] font-mono">
                {templates.length} Templates
              </Badge>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Brevo SMTP Transactional Templates &amp; Handlebars Dynamic Variables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!brevoConfigured && (
            <Link
              href="/settings"
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 hover:bg-amber-500/20"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Setup Brevo API Key</span>
            </Link>
          )}

          <Button
            onClick={handleNewTemplate}
            className="bg-purple-600 hover:bg-purple-500 text-white rounded-2xl px-4 py-2 text-xs font-mono gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </Button>
        </div>
      </div>

      {/* Main Studio Grid Layout (Left: Templates List, Right: Template Editor) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Template Selector List (Col 4) */}
        <div className="col-span-12 md:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-2 font-mono text-xs text-slate-400">
            <span>SAVED TEMPLATES</span>
            <span>{templates.length} items</span>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto scrollbar-thin pr-1">
            {templates.length === 0 ? (
              <div className="p-8 text-center bg-[#0e0e14]/60 border border-white/10 rounded-3xl text-slate-400 font-mono text-xs">
                No templates saved yet. Click 'New Template' to start.
              </div>
            ) : (
              templates.map((t) => {
                const isSelected = selectedTemplate?.id === t.id;
                const vars: string[] = t.variables ? JSON.parse(t.variables) : [];

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer space-y-2 group",
                      isSelected
                        ? "bg-purple-600/20 border-purple-500/50 text-white shadow-xl shadow-purple-500/5"
                        : "bg-[#0e0e14]/80 border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm font-sans line-clamp-1 group-hover:text-purple-300">
                        {t.name}
                      </h4>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs font-mono text-slate-400 line-clamp-1">
                      Subject: {t.subject}
                    </p>

                    {vars.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {vars.map((v) => (
                          <span
                            key={v}
                            className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Template Editor (Col 8) */}
        <div className="col-span-12 md:col-span-8 bg-[#0e0e14]/90 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <FileCode className="w-5 h-5 text-purple-400" />
              <span>{selectedTemplate?.id ? `Edit: ${selectedTemplate.name}` : "Create Template Studio"}</span>
            </h3>

            <div className="flex items-center gap-2">
              {selectedTemplate?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteTemplate}
                  disabled={isDeleting}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl h-9 px-3 text-xs font-mono gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={openTestModal}
                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 rounded-xl h-9 px-3 text-xs font-mono gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test Dispatch</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl h-9 px-4 text-xs font-mono gap-1.5 shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Template</span>
              </Button>
            </div>
          </div>

          <div className="space-y-4 text-xs font-sans">
            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-mono text-[11px] uppercase font-bold">
                Template Name
              </label>
              <Input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="e.g. Client Invoice Notification, Welcome Onboarding"
                className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono focus-visible:ring-purple-500/40"
              />
            </div>

            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-mono text-[11px] uppercase font-bold flex items-center justify-between">
                <span>Email Subject Line</span>
                <span className="text-slate-500 text-[10px]">Supports {"{{handlebars}}"} variables</span>
              </label>
              <Input
                value={editorSubject}
                onChange={(e) => setEditorSubject(e.target.value)}
                placeholder="e.g. Invoice #{{invoice_number}} for {{client_name}}"
                className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono focus-visible:ring-purple-500/40"
              />
            </div>

            {/* Detected Handlebars Variables */}
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
              <Code className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-mono text-[11px] text-slate-400 shrink-0">
                Detected Variables:
              </span>
              {currentVariables.length === 0 ? (
                <span className="text-slate-600 italic font-mono text-[10px]">
                  None (Type {"{{variable_name}}"} in subject/body)
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentVariables.map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px] font-mono"
                    >
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Body HTML Textarea Editor */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-mono text-[11px] uppercase font-bold flex items-center justify-between">
                <span>Body HTML Content</span>
                <span className="text-slate-500 text-[10px]">HTML &amp; Handlebars formatting supported</span>
              </label>
              <Textarea
                rows={14}
                value={editorBodyHtml}
                onChange={(e) => setEditorBodyHtml(e.target.value)}
                placeholder="<html><body><h2>Hello {{client_name}}!</h2>...</body></html>"
                className="bg-white/[0.04] border-white/15 text-xs text-slate-200 placeholder:text-slate-600 rounded-2xl p-4 font-mono leading-relaxed focus-visible:ring-purple-500/40 resize-y scrollbar-thin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Test Email Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="bg-[#0e0e14] border-white/15 text-slate-100 rounded-3xl p-6 max-w-lg w-[94vw] shadow-2xl backdrop-blur-2xl font-sans">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2 font-mono pb-2 border-b border-white/10">
            <Send className="w-4 h-4 text-purple-400" />
            <span>Test Email Dispatch via Brevo SMTP</span>
          </DialogTitle>

          <form onSubmit={handleSendTestEmail} className="space-y-4 mt-3 font-sans text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-mono text-[11px] uppercase font-bold">
                Recipient Email
              </label>
              <Input
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="e.g. priyambodo02@gmail.com"
                className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-mono text-[11px] uppercase font-bold">
                Recipient Name (Optional)
              </label>
              <Input
                type="text"
                value={testRecipientName}
                onChange={(e) => setTestRecipientName(e.target.value)}
                placeholder="e.g. Danar"
                className="bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-10 font-mono"
              />
            </div>

            {/* Dynamic variable inputs */}
            {currentVariables.length > 0 && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                <label className="text-slate-300 font-mono text-[11px] uppercase font-bold block">
                  Fill Template Variables
                </label>
                <div className="space-y-2">
                  {currentVariables.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-purple-300 w-28 shrink-0 truncate">
                        {`{{${v}}}`}
                      </span>
                      <Input
                        value={testVariables[v] || ""}
                        onChange={(e) =>
                          setTestVariables((prev) => ({
                            ...prev,
                            [v]: e.target.value,
                          }))
                        }
                        placeholder={`Value for ${v}...`}
                        className="bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-8 px-3 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10 font-mono">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTestModalOpen(false)}
                className="rounded-2xl h-10 px-4 text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSendingTest}
                className="bg-purple-600 hover:bg-purple-500 text-white rounded-2xl h-10 px-5 text-xs gap-1.5 shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Email</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
