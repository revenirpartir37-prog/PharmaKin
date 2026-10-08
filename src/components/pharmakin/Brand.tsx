'use client'

import { Pill } from 'lucide-react'

/**
 * Small PharmaKin brand mark (cross + pill) used in headers.
 */
export function PharmaKinLogo({
  size = 32,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Pill size={size * 0.55} strokeWidth={2.4} />
    </div>
  )
}

export function PharmaKinWordmark({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <PharmaKinLogo size={size} />
      <div className="leading-none">
        <div className="text-lg font-extrabold tracking-tight text-foreground">
          PharmaKin
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Gestion pharmacie
        </div>
      </div>
    </div>
  )
}
