'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MapPin,
  Navigation,
  Phone,
  Star,
  Loader2,
  ArrowLeft,
  Building2,
  LocateFixed,
  X,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistance, haversineMeters } from '@/lib/format'
import type { PublicPharmacyDTO } from '@/lib/types'

type L = typeof import('leaflet')

interface ClientViewProps {
  onBack: () => void
}

interface PharmacyWithDist extends PublicPharmacyDTO {
  distance: number
}

export function ClientView({ onBack }: ClientViewProps) {
  const [clientPos, setClientPos] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(true)
  const [pharmacies, setPharmacies] = useState<PharmacyWithDist[]>([])
  const [loadingPharmacies, setLoadingPharmacies] = useState(true)
  const [selected, setSelected] = useState<PharmacyWithDist | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<ReturnType<L['map']> | null>(null)
  const leafletLib = useRef<L | null>(null)
  const markersLayer = useRef<ReturnType<L['layerGroup']> | null>(null)
  const clientMarkerRef = useRef<ReturnType<L['marker']> | null>(null)

  // Load Leaflet library (client-only)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const mod = await import('leaflet')
      // CSS import via side-effect
      await import('leaflet/dist/leaflet.css')
      if (!mounted) return
      leafletLib.current = mod as unknown as L
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Try to get geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('La géolocalisation nest pas disponible sur cet appareil')
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('Autorisation de localisation refusée. Activez-la pour trouver les pharmacies.')
        } else {
          setError('Impossible dobtenir votre position. Réessayez.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }, [])

  // Load pharmacies
  useEffect(() => {
    ;(async () => {
      setLoadingPharmacies(true)
      try {
        const res = await fetch('/api/public/pharmacies')
        const json = await res.json()
        const list = (json.pharmacies as PublicPharmacyDTO[]).map((p) => ({
          ...p,
          distance: clientPos
            ? haversineMeters(clientPos.lat, clientPos.lng, p.latitude, p.longitude)
            : 0,
        }))
        list.sort((a, b) => a.distance - b.distance)
        setPharmacies(list)
      } catch {
        toast.error('Erreur au chargement des pharmacies')
      } finally {
        setLoadingPharmacies(false)
      }
    })()
     
  }, [clientPos?.lat, clientPos?.lng])

  // Recompute distances when clientPos changes
  useEffect(() => {
    if (!clientPos) return
    setPharmacies((prev) =>
      [...prev]
        .map((p) => ({
          ...p,
          distance: haversineMeters(clientPos.lat, clientPos.lng, p.latitude, p.longitude),
        }))
        .sort((a, b) => a.distance - b.distance),
    )
  }, [clientPos?.lat, clientPos?.lng])

  // Init / update map
  useEffect(() => {
    if (!leafletLib.current || !mapRef.current) return
    const L = leafletLib.current
    if (!leafletMap.current) {
      // Default center: Kinshasa if no client pos yet
      const center = clientPos ?? { lat: -4.325, lng: 15.3222 }
      leafletMap.current = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(leafletMap.current)
      markersLayer.current = L.layerGroup().addTo(leafletMap.current)
    }

    // Update center if clientPos changes
    if (clientPos && leafletMap.current) {
      leafletMap.current.setView([clientPos.lat, clientPos.lng], 15)
      // Client marker
      if (clientMarkerRef.current) {
        clientMarkerRef.current.setLatLng([clientPos.lat, clientPos.lng])
      } else {
        const icon = L.divIcon({
          className: 'pharma-marker',
          html: '<div class="client-marker-pin">📍</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
        clientMarkerRef.current = L.marker([clientPos.lat, clientPos.lng], { icon })
          .addTo(leafletMap.current!)
          .bindPopup('<strong>Vous êtes ici</strong>')
      }
    }
  }, [clientPos?.lat, clientPos?.lng, leafletLib.current])

  // Update pharmacy markers
  useEffect(() => {
    if (!leafletLib.current || !leafletMap.current || !markersLayer.current) return
    const L = leafletLib.current
    markersLayer.current.clearLayers()

    pharmacies.forEach((p, i) => {
      const isNearest = i === 0 && clientPos != null
      const icon = L.divIcon({
        className: 'pharma-marker',
        html: `<div class="pharma-marker-pin" style="${isNearest ? 'background:oklch(0.5 0.15 145);width:42px;height:42px' : ''}"></div>`,
        iconSize: isNearest ? [42, 42] : [36, 36],
        iconAnchor: isNearest ? [21, 42] : [18, 36],
        popupAnchor: [0, -36],
      })
      const marker = L.marker([p.latitude, p.longitude], { icon })
        .bindPopup(
          `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(p.name)}</div>` +
          `<div style="font-size:11px;color:#666">${formatDistance(p.distance)}</div>` +
          (isNearest ? '<div style="font-size:11px;color:#2c8869;font-weight:600">⭐ La plus proche</div>' : ''),
        )
      marker.on('click', () => setSelected(p))
      marker.addTo(markersLayer.current!)
    })
  }, [pharmacies, leafletLib.current])

  // Ensure map invalidates size when selected changes (covers drawer open/close)
  useEffect(() => {
    if (leafletMap.current) {
      setTimeout(() => leafletMap.current?.invalidateSize(), 200)
    }
  }, [selected])

  function handleLocateMe() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        toast.success('Position mise à jour')
      },
      () => {
        setLocating(false)
        toast.error('Impossible dobtenir votre position')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function openRoute(p: PharmacyWithDist) {
    if (!clientPos) {
      toast.error('Position actuelle indisponible')
      return
    }
    const url = `https://www.openstreetmap.org/directions?engine=graphhopper_foot&route=${clientPos.lat}%2C${clientPos.lng}%3B${p.latitude}%2C${p.longitude}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Accueil
          </button>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-primary" />
            <span className="text-sm font-bold">Pharmacies à proximité</span>
          </div>
          <button
            onClick={handleLocateMe}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <LocateFixed size={14} /> Moi
          </button>
        </div>
      </header>

      {/* Map */}
      <div className="relative h-[45vh] min-h-[280px] w-full">
        <div ref={mapRef} className="absolute inset-0" />
        {(locating || !leafletLib.current) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {locating ? 'Localisation en cours…' : 'Chargement de la carte…'}
            </p>
          </div>
        )}
        {error && !locating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 p-6 text-center">
            <MapPin size={32} className="mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={handleLocateMe}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {pharmacies.length} pharmacie(s)
          </h2>
          {clientPos && (
            <span className="text-xs text-muted-foreground">
              Triées par distance
            </span>
          )}
        </div>

        {loadingPharmacies && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        )}

        {!loadingPharmacies && pharmacies.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <Building2 size={28} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold">Aucune pharmacie à proximité</p>
            <p className="text-xs text-muted-foreground">
              Les pharmacies enregistrées avec une position apparaîtront ici.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {pharmacies.map((p, i) => {
            const nearest = i === 0 && clientPos != null
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                  nearest
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${nearest ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                  <span className="text-lg">🏥</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {nearest && <Star size={14} className="fill-primary text-primary" />}
                    <div className="truncate text-sm font-bold">{p.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {clientPos ? formatDistance(p.distance) : 'Position non disponible'}
                    {p.address ? ` · ${p.address}` : ''}
                  </div>
                  {nearest && (
                    <div className="text-[11px] font-bold text-primary">Pharmacie la plus proche</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                    Voir
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Pharmacy sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Pharmacie
                </div>
                <h3 className="text-xl font-extrabold tracking-tight">{selected.name}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={16} className="text-primary" />
              {clientPos ? formatDistance(selected.distance) : 'Distance inconnue'}
              {selected.address ? ` · ${selected.address}` : ''}
            </div>

            {/* Action buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => openRoute(selected)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm"
              >
                <Navigation size={18} /> Itinéraire
              </button>
              <button
                onClick={() => {
                  if (leafletMap.current && leafletLib.current) {
                    leafletMap.current.setView([selected.latitude, selected.longitude], 17)
                    setSelected(null)
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground"
              >
                <MapPin size={18} /> Sur la carte
              </button>
            </div>

            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary"
              >
                <Phone size={18} /> Appeler · {selected.phone}
              </a>
            )}

            <a
              href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=17/${selected.latitude}/${selected.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink size={12} /> Voir sur OpenStreetMap
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
