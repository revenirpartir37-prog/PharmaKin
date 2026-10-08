'use client'

import Image from 'next/image'

export function PharmaKinLogo({
  size = 32,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <Image
      src="/icon-512.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`rounded-xl shadow-sm ${className}`}
    />
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
