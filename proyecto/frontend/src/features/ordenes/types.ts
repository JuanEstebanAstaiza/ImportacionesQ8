export interface OrderHistoryItem {estado:string;fecha:string;nota:string|null;}
export interface OrderDocumentItem {name:string;date:string;status:string;url:string;type:string;}
export interface LifecycleDocItem {label:string;name:string;status:string;url:string|null;source:string;}
export interface Order {
  id:string; code:string; quoteCode:string; product:string; importerId:string; advisorName?:string; created:string; estimated:string; quantity:string; unitPrice:string; totalValue:string; incoterm:string; originPort:string; destPort:string; shippingMark?:string|null; status:string; history:OrderHistoryItem[]; documents:OrderDocumentItem[]; conversationId?:string;
}
