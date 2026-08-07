export interface Order {
  id: string;
  code: string;
  quoteCode: string;
  product: string;
  importerId: string;
  created: string;
  estimated: string;
  quantity: string;
  unitPrice: string;
  totalValue: string;
  incoterm: string;
  originPort: string;
  destPort: string;
  /** Marca de embarque congelada al crear la orden: lo que va rotulado en las cajas. */
  shippingMark?: string | null;
}

export interface OrderDocument {
  name: string;
  date: string;
  status: "Disponible" | "Pendiente";
}

export interface OrderHistoryEvent {
  label: string;
  date: string;
  icon: React.ReactNode;
}