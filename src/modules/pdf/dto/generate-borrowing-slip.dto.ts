import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';

class BorrowingSlipPartDto {
  @IsString() matUnitId: string;
  @IsString() matName: string;
  @IsNumber() borrowed: number;
  @IsNumber() issued: number;
  @IsOptional() @IsNumber() free?: number | null;
  @IsNumber() sold: number;
  @IsNumber() remaining: number;
  @IsOptional() @IsNumber() returned?: number | null;
  @IsNumber() unitPrice: number;
  @IsNumber() salePrice: number;
}

export class GenerateBorrowingSlipDto {
  @IsString() documentNo: string;
  @IsString() documentType: string;
  @IsString() customerName: string;
  @IsString() productName: string;
  @IsString() productCode: string;
  @IsString() workOrderNo: string;
  @IsString() workOrderType: string;
  @IsString() runDate: string;
  @IsString() technicianName: string;
  @IsString() technicianWarehouse: string;
  @IsString() openDate: string;
  @IsString() serviceCenter: string;
  @IsString() managedBy: string;
  @IsString() senderWarehouse: string;
  @IsString() receiverWarehouse: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BorrowingSlipPartDto)
  parts: BorrowingSlipPartDto[];
}
