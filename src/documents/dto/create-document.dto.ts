import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  file: string;

  @IsArray()
  @IsString({ each: true })
  landlordInsurancePolicy: string[];

  @IsArray()
  @IsString({ each: true })
  utilityAndMaintenance: string[];

  @IsArray()
  @IsString({ each: true })
  otherDocuments: string[];

  @IsString()
  @IsNotEmpty()
  property: string; // or ObjectId if you're referencing a MongoDB ID
}
