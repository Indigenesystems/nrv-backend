import { IsString, IsNotEmpty } from 'class-validator';


export class CreateRoomDTO {
  @IsString()
  @IsNotEmpty()
  
  description: string;

  @IsString()
  @IsNotEmpty()
  
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  
  propertyType: string;

  @IsString()
  @IsNotEmpty()
  
  rentAmountMetrics: string;

  @IsString()
  @IsNotEmpty()
  
  rentAmount: string;

  // @IsString()
  // @IsNotEmpty()
  // targetRent: string;

  // @IsString()
  // @IsNotEmpty()
  // targetDeposit: string;

  @IsString()
  @IsNotEmpty()
  
  noOfBaths: string;

  @IsString()
  
  noOfPools: string;

  @IsString()
  @IsNotEmpty()
  
  noOfRooms: string;

  @IsString()
  
  otherAmentities: string[];
}
