import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { PinLockProvider } from "@/components/pin-lock-provider";
import { HeaderCountdown } from "@/components/header-countdown";
import { Omnibar } from "@/components/omnibar";
import { OmniAIChat } from "@/components/omni-ai-chat";
import { SearchTrigger } from "@/components/search-trigger";
import { OmniAiTrigger } from "@/components/omni-ai-trigger";
import { DbStatusBadge } from "@/components/db-status-badge";
import { NavigationProgress } from "@/components/navigation-progress";
import { NotificationBell } from "@/components/layout/NotificationBell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Personal OS | Control Center",
  description: "Next-gen Personal OS Hub & Bento Dashboard",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  try {
                    var observer = new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                          m.target.removeAttribute('bis_skin_checked');
                        }
                      }
                    });
                    observer.observe(document.documentElement, {
                      attributes: true,
                      subtree: true,
                      attributeFilter: ['bis_skin_checked']
                    });
                  } catch (e) {}

                  const _err = console.error;
                  console.error = function(...args) {
                    const str = args.map(a => (typeof a === 'object' ? String(a?.message || a?.stack || '') : String(a))).join(' ');
                    if (str.includes('bis_skin_checked')) return;
                    _err.apply(console, args);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans bg-[#0a0a0b] text-[#e5e2e3] antialiased min-h-screen flex overflow-hidden" suppressHydrationWarning>
        <PinLockProvider>
        {/* Page navigation loading pill */}
        <NavigationProgress />

        {/* Collapsible Sidebar */}
        <Sidebar />

        {/* Global Universal Search (Ctrl+K) */}
        <Omnibar />

        {/* Global Omni AI Assistant (Ctrl+J) */}
        <OmniAIChat />

        {/* Main Content Hub */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden" suppressHydrationWarning>
          {/* Top Bar Header */}
          <header className="h-16 border-b border-white/10 glass-panel px-6 flex items-center justify-between shrink-0 z-20">
            {/* Command Search */}
            <SearchTrigger />

            {/* System Status Indicators */}
            <div className="flex items-center gap-4">
              <OmniAiTrigger />

              <DbStatusBadge />

              <NotificationBell />

              <HeaderCountdown />
            </div>
          </header>

          {/* Scrollable Viewport */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-[#0a0a0b] via-[#101014] to-[#0a0a0b]">
            {children}
          </main>
        </div>
        </PinLockProvider>
      </body>
    </html>
  );
}
