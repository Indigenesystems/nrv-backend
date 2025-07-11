import { IsString, IsNotEmpty } from 'class-validator';


export class CreateMaintenanceDTO {
  @IsString()
  @IsNotEmpty()
  
  title: string;

  @IsString()
  @IsNotEmpty()
  
  description: string;

  @IsString()
  @IsNotEmpty()
  
  roomId: string;

  @IsString()
  @IsNotEmpty()
  
  createdBy: string;
}
