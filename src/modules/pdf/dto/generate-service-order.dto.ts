import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';

class InstallationDataDto {
  @IsString() waterPressure: string;
  @IsString() chlorine: string;
  @IsString() tds: string;
  @IsString() hardness: string;
  @IsString() airPressure: string;
  @IsString() waterTemp: string;
  @IsString() ph: string;
}

class ServiceOrderCostsDto {
  @IsNumber() productCost: number;
  @IsNumber() serviceFee: number;
  @IsNumber() installationFee: number;
  @IsNumber() travelCost: number;
  @IsNumber() otherCost: number;
  @IsNumber() totalCost: number;
}

class ChecklistItemDto {
  @IsNumber() no: number;
  @IsString() description: string;
  @IsBoolean() checked: boolean;
}

export class GenerateServiceOrderDto {
  @IsString() workOrderNo: string;
  @IsOptional() @IsString() previousWorkOrderNo?: string;
  @IsString() openDate: string;
  @IsString() createdBy: string;
  @IsString() customerName: string;
  @IsString() customerCode: string;
  @IsString() contactName: string;
  @IsString() contactPhone: string;
  @IsString() workOrderType: string;
  @IsString() productName: string;
  @IsString() productCode: string;
  @IsString() serialNo: string;
  @IsString() serviceCenter: string;
  @IsString() serviceDate: string;
  @IsString() serviceTime: string;
  @IsOptional() @IsString() purchaseDate?: string;
  @IsOptional() @IsString() purchaseLocation?: string;
  @IsOptional() @IsString() installDate?: string;
  @IsString() productAddress: string;
  @IsString() receiveAddress: string;
  @IsOptional() @IsString() taxInvoiceAddress?: string;
  @IsOptional() @IsString() initialSymptom?: string;
  @IsString() actionPerformed: string;
  @IsString() customerAdvice: string;

  @ValidateNested()
  @Type(() => InstallationDataDto)
  preInstallData: InstallationDataDto;

  @ValidateNested()
  @Type(() => InstallationDataDto)
  postInstallData: InstallationDataDto;

  @IsString() technicianName: string;
  @IsString() technicianWarehouse: string;
  @IsOptional() @IsString() borrowSlipNos?: string;
  @IsOptional() @IsString() quotationNo?: string;
  @IsOptional() @IsString() evaluationResult?: string;
  @IsOptional() @IsString() evaluator?: string;
  @IsOptional() @IsString() travelStartTime?: string;
  @IsOptional() @IsString() workStartTime?: string;
  @IsOptional() @IsString() workEndTime?: string;

  @ValidateNested()
  @Type(() => ServiceOrderCostsDto)
  costs: ServiceOrderCostsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist: ChecklistItemDto[];

  @IsOptional() @IsString() customerSignatureUrl?: string;
  @IsOptional() @IsString() qrCodeContent?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() taxId?: string;
  @IsOptional() @IsString() paymentChannel?: string;
}
