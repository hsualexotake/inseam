import { 
  Mail, MessageSquare, Phone, Package, Truck, AlertTriangle, 
  CheckCircle, Zap, Bell
} from "lucide-react";

// Constants
export const MAX_TABLE_HEIGHT = 420;
export const UPDATES_FETCH_LIMIT = 20;
export const EMAIL_FETCH_COUNT = 5;

// Source configurations
export const sourceConfig = {
  email: { label: "Email", icon: Mail, color: "bg-blue-100 text-blue-800" },
  wechat: { label: "WeChat", icon: MessageSquare, color: "bg-green-100 text-green-800" },
  whatsapp: { label: "WhatsApp", icon: Phone, color: "bg-emerald-100 text-emerald-800" },
  sms: { label: "SMS", icon: Phone, color: "bg-purple-100 text-purple-800" },
  manual: { label: "Manual", icon: Bell, color: "bg-gray-100 text-gray-800" },
} as const;

// Type configurations
export const typeConfig = {
  shipment: { label: "Shipment Update", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivery: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  delay: { label: "Delayed", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  approval: { label: "Approval", icon: CheckCircle, color: "text-purple-600 bg-purple-50" },
  action: { label: "Action Required", icon: Zap, color: "text-orange-600 bg-orange-50" },
  general: { label: "Update", icon: Bell, color: "text-gray-600 bg-gray-50" },
  in_transit: { label: "In Transit", icon: Truck, color: "text-indigo-600 bg-indigo-50" },
} as const;

// Helper function to handle both 'delay' and 'delayed' types
export const getTypeConfig = (type: string) => {
  if (type === 'delayed') return typeConfig.delay;
  return typeConfig[type as keyof typeof typeConfig] || typeConfig.general;
};

// Badge styles for SKU updates
export const badgeStyles = {
  sku: "bg-indigo-50 text-indigo-700",
  field: "bg-stone-50 text-stone-700",
  value: "bg-yellow-50 text-yellow-700",
} as const;