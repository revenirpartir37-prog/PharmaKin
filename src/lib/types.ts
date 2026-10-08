// Shared TypeScript types for PharmaKin frontend.

export interface PharmacyDTO {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  currency: string
  invoiceSeq?: number
  createdAt?: string
  updatedAt?: string
}

export interface SellerDTO {
  id: string
  pharmacyId: string
  name: string
  isPrimary: boolean
}

export interface ProductDTO {
  id: string
  pharmacyId: string
  name: string
  category: string | null
  price: number
  quantity: number
  minThreshold: number | null
  expiryDate: string | null
  barcode: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SaleItemDTO {
  id: string
  saleId: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SaleDTO {
  id: string
  pharmacyId: string
  sellerId: string
  invoiceNumber: string
  clientName: string | null
  total: number
  itemCount: number
  dateStr: string
  timeStr: string
  createdAt: string
  items?: SaleItemDTO[]
  seller?: SellerDTO | null
  pharmacy?: PharmacyDTO | null
}

export interface StockMovementDTO {
  id: string
  pharmacyId: string
  productId: string
  sellerId: string | null
  type: 'ENTRY' | 'EXIT' | 'SALE' | 'ADJUST'
  quantity: number
  reason: string | null
  oldQuantity: number
  newQuantity: number
  dateStr: string
  timeStr: string
  createdAt: string
  product?: ProductDTO
}

export interface ActivityDTO {
  id: string
  pharmacyId: string
  sellerId: string
  type: string
  description: string
  refId: string | null
  dateStr: string
  timeStr: string
  createdAt: string
  seller?: SellerDTO | null
}

export interface ServiceSessionDTO {
  id: string
  pharmacyId: string
  sellerId: string
  startTime: string
  endTime: string | null
  startStr: string
  endStr: string | null
  open: boolean
}

export interface PublicPharmacyDTO {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number
  longitude: number
}
