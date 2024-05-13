import { IsString, IsNotEmpty } from 'class-validator';


export class CreateRoomDTO {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    targetRent: string;

    @IsString()
    @IsNotEmpty()
    targetDeposit: string;

    @IsString()
    @IsNotEmpty()
    propertyId: string;
}



