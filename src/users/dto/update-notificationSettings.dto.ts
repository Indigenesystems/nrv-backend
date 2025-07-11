import { IsBoolean, IsOptional, IsString } from 'class-validator';


export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  
  platformUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  
  weeklyOpportunities?: boolean;

  @IsOptional()
  @IsBoolean()
  
  feedbackOpportunities?: boolean;

  @IsOptional()
  @IsBoolean()
  
  maintenanceUpdates?: boolean;

  @IsOptional()
  @IsString()
  
  messagePreference?: string;
}
