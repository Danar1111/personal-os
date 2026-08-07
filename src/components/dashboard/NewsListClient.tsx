"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  image?: string;
  source: { name: string };
}

export function NewsListClient({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
      {articles.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-500/40 transition-all flex items-start gap-3.5 shadow-md"
        >
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="w-16 h-16 object-cover rounded-xl shrink-0 border border-white/10 bg-black/40"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          )}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-100 font-sans line-clamp-2 group-hover:text-cyan-300 transition-colors leading-snug">
              {item.title}
            </div>
            {item.description && (
              <p className="text-[11px] text-slate-400 font-sans line-clamp-3 leading-relaxed">
                {item.description}
              </p>
            )}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span className="truncate text-cyan-400 font-semibold">{item.source.name}</span>
              <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                Read Article <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
