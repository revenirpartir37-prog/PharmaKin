'use client'

import { useEffect, useState } from 'react'
import { Check, CloudOff, Download, Loader2, RefreshCw } from 'lucide-react'
import { pendingOfflineWrites, syncOfflineWrites } from '@/lib/offline'
import { toast } from 'sonner'

export function OfflineStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void syncOfflineWrites()
    }
    const updatePending = () => void pendingOfflineWrites().then(setPending).catch(() => undefined)
    const onSync = () => {
      setSyncing(false)
      updatePending()
    }
    const onSyncError = (event: Event) => {
      setSyncing(false)
      const detail = (event as CustomEvent<{ message: string }>).detail
      if (detail?.message) toast.error(detail.message)
    }
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[PWA] Service worker registration failed', error)
      })
      navigator.serviceWorker.addEventListener('message', onSync)
    }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('pharmakin-sync-state', onSync)
    window.addEventListener('pharmakin-sync-error', onSyncError)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    updateOnline()
    updatePending()
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('pharmakin-sync-state', onSync)
      window.removeEventListener('pharmakin-sync-error', onSyncError)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      navigator.serviceWorker?.removeEventListener('message', onSync)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    setInstalling(true)
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } finally {
      setInstalling(false)
    }
  }

  async function syncNow() {
    setSyncing(true)
    await syncOfflineWrites()
    const count = await pendingOfflineWrites().catch(() => pending)
    setPending(count)
    setSyncing(false)
  }

  return (
    <div className="sticky top-0 z-[80] flex justify-center px-2 pt-[max(env(safe-area-inset-top),0.4rem)] pointer-events-none">
      <div className="pointer-events-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-background/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur">
        {!online ? (
          <>
            <CloudOff size={16} className="text-amber-700" />
            <span className="text-amber-900">Hors ligne — vos données enregistrées restent accessibles.</span>
            {pending > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{pending} à synchroniser</span>}
          </>
        ) : pending > 0 ? (
          <>
            {syncing ? <Loader2 size={16} className="animate-spin text-primary" /> : <RefreshCw size={16} className="text-primary" />}
            <span>{pending} opération(s) en attente de synchronisation</span>
            <button type="button" onClick={() => void syncNow()} disabled={syncing} className="rounded-lg bg-primary px-2.5 py-1 text-primary-foreground disabled:opacity-60">
              Synchroniser
            </button>
          </>
        ) : (
          <>
            <Check size={16} className="text-emerald-700" />
            <span>En ligne — synchronisé</span>
          </>
        )}
        {installPrompt && (
          <button type="button" onClick={() => void installApp()} disabled={installing} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-primary-foreground disabled:opacity-60">
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Installer
          </button>
        )}
      </div>
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
