import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty()
  file: string;

  @ApiProperty({ type: [String] })
  landlordInsurancePolicy: string[];

  @ApiProperty({ type: [String] })
  utilityAndMaintenance: string[];

  @ApiProperty({ type: [String] })
  otherDocuments: string[];

  @ApiProperty()
  property: string; // or ObjectId if you're referencing a MongoDB ID
}
