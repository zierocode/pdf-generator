export interface ServiceOrderData {
  workOrderNo: string;
  previousWorkOrderNo?: string;
  openDate: string; // ISO 8601
  createdBy: string;
  customerName: string;
  customerCode: string;
  contactName: string;
  contactPhone: string;
  workOrderType: string;
  productName: string;
  productCode: string;
  serialNo: string;
  serviceCenter: string;
  serviceDate: string; // ISO 8601
  serviceTime: string; // "HH:mm"
  purchaseDate?: string;
  purchaseLocation?: string;
  installDate?: string;
  productAddress: string;
  receiveAddress: string;
  taxInvoiceAddress?: string;
  initialSymptom?: string;
  actionPerformed: string;
  customerAdvice: string;
  preInstallData: InstallationData;
  postInstallData: InstallationData;
  technicianName: string;
  technicianWarehouse: string;
  borrowSlipNos?: string;
  quotationNo?: string;
  evaluationResult?: string;
  evaluator?: string;
  travelStartTime?: string; // ISO 8601
  workStartTime?: string; // ISO 8601
  workEndTime?: string; // ISO 8601
  costs: ServiceOrderCosts;
  checklist: ChecklistItem[];
  customerSignatureUrl?: string;
  qrCodeContent?: string;
  phone?: string;
  taxId?: string;
  paymentChannel?: string;
}

export interface InstallationData {
  waterPressure: string;
  chlorine: string;
  tds: string;
  hardness: string;
  airPressure: string;
  waterTemp: string;
  ph: string;
}

export interface ServiceOrderCosts {
  productCost: number;
  serviceFee: number;
  installationFee: number;
  travelCost: number;
  otherCost: number;
  totalCost: number; // from DB — may include discount/tax logic
}

export interface ChecklistItem {
  no: number;
  description: string;
  checked: boolean;
}
