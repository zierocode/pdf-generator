export interface BorrowingSlipData {
  documentNo: string;
  documentType: string;
  customerName: string;
  productName: string;
  productCode: string;
  workOrderNo: string;
  workOrderType: string;
  runDate: string; // ISO 8601 — transform layer normalizes from DB
  technicianName: string;
  technicianWarehouse: string;
  openDate: string; // ISO 8601
  serviceCenter: string;
  managedBy: string;
  senderWarehouse: string;
  receiverWarehouse: string;
  parts: BorrowingSlipPart[];
}

export interface BorrowingSlipPart {
  matUnitId: string;
  matName: string;
  borrowed: number;
  issued: number;
  free?: number | null;
  sold: number;
  remaining: number;
  returned?: number | null;
  unitPrice: number;
  salePrice: number;
}
