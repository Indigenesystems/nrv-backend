import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  description: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  propertyType: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  rentAmountMetrics: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  rentAmount: string;

  // @IsString()
  // @IsNotEmpty()
  // targetRent: string;

  // @IsString()
  // @IsNotEmpty()
  // targetDeposit: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  noOfBaths: string;

  @IsString()
  @ApiProperty()
  noOfPools: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  noOfRooms: string;

  @IsString()
  @ApiProperty()
  otherAmentities: string[];
}
