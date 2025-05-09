import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  platformUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  weeklyOpportunities?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  feedbackOpportunities?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  maintenanceUpdates?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty()
  messagePreference?: string;
}
