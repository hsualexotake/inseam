export interface SKU {
  id: number;
  sku_code: string;
  product_name: string;
  category: string;
  color: string;
  size: string;
  season: string;
}

export interface Shipment {
  id: number;
  sku_id: number;
  tracking_number: string | null;
  supplier: string;
  status: 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'delayed';
  quantity: number;
  shipped_date: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  notes: string | null;
  sku: SKU;
}

export interface OverviewStats {
  totalSKUs: number;
  pendingShipments: number;
  inTransit: number;
  delivered: number;
  delayed: number;
  onTimeDeliveryRate: number;
}

export interface RecentShipment {
  id: string;
  projectId: string;
  skuCode: string;
  productName: string;
  trackingNumber: string;
  status: 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'delayed';
  expectedDelivery: string;
  timestamp: string;
}