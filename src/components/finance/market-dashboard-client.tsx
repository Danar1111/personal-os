"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export interface MarketNewsArticle {
  title: string;
  description?: string;
  url: string;
  image?: string;
  source: { name: string };
  publishedAt?: string;
}

export function MarketNewsListClient({ articles }: { articles: MarketNewsArticle[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-all flex flex-col justify-between space-y-3 shadow-lg hover:-translate-y-1"
        >
          {item.image && (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          <div className="space-y-1.5 flex-1">
            <div className="text-xs font-bold font-sans text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
              {item.title}
            </div>
            {item.description && (
              <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-indigo-400 font-semibold truncate max-w-[140px]">{item.source.name}</span>
            <span className="flex items-center gap-1 group-hover:text-white transition-colors">
              Read Article <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
