import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { CartDrawer } from "./CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
export function SiteShell({ children }: { children: ReactNode }) {
  return (<div className="min-h-[100dvh] flex flex-col bg-background"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /><CartDrawer /><Toaster position="bottom-right" theme="dark" />
  <a href={businessWaLink(`Hello ${BUSINESS.name}, I need help with roofing / building materials.`)} target="_blank" rel="noreferrer" className="no-print fixed bottom-5 right-5 z-50 bg-[#25D366] text-black font-display font-semibold uppercase tracking-wider px-4 py-3 shadow-lg hover:scale-[1.03] transition-transform" aria-label="Chat on WhatsApp">WhatsApp Us</a>
  </div>);
}
