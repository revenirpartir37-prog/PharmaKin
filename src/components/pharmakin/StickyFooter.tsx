'use client'

import { Building2 } from 'lucide-react'

/**
 * Sticky footer with HenoBuild branding.
 * White-on-teal, always visible at the bottom of the viewport.
 */
export function StickyFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="opacity-80" />
          <span className="text-xs font-medium opacity-90">
            Créé par <strong className="font-bold">HenoBuild Entreprise</strong>
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest opacity-70">
          PharmaKin · RDC
        </span>
      </div>
    </footer>
  )
}
