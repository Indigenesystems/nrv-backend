import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class UserVerification {
  @Prop()
  @ApiProperty()
  firstName: string;

  @Prop()
  @ApiProperty()
  middleName: string;

  @Prop()
  @ApiProperty()
  lastName: string;

  @Prop()
  @ApiProperty()
  idNumber: string; // This is the NIN

  @Prop()
  @ApiProperty()
  type: string; // Type of verification (e.g., 'nin')

  @Prop()
  @ApiProperty()
  mobile: string;

  @Prop()
  @ApiProperty()
  email?: string;

  @Prop()
  @ApiProperty()
  gender: string;

  @Prop()
  @ApiProperty()
  dateOfBirth: string;

  @Prop({ type: Object })
  @ApiProperty()
  address: {
    town: string;
    lga: string;
    state: string;
    addressLine: string;
    city: string | null;
  };

  @Prop()
  @ApiProperty()
  image: string; // Base64 string

  @Prop()
  @ApiProperty()
  birthState: string;

  @Prop()
  @ApiProperty()
  birthLGA: string;

  @Prop()
  @ApiProperty()
  birthCountry: string;

  @Prop()
  @ApiProperty()
  nokState: string;

  @Prop()
  @ApiProperty()
  religion: string;

  @Prop()
  @ApiProperty()
  isConsent: boolean;

  @Prop()
  @ApiProperty()
  country: string;

  @Prop()
  @ApiProperty()
  businessId: string;

  @Prop()
  @ApiProperty()
  status: string;

  @Prop()
  @ApiProperty()
  dataValidation: boolean;

  @Prop()
  @ApiProperty()
  selfieValidation: boolean;

  @Prop()
  @ApiProperty()
  allValidationPassed: boolean;

  @Prop()
  @ApiProperty()
  requestedAt: Date;

  @Prop({ type: Object })
  @ApiProperty()
  requestedBy: {
    firstName: string;
    lastName: string;
    middleName?: string;
    id: string;
  };

  @Prop()
  @ApiProperty()
  adverseMediaReport?: string;

  @Prop()
  @ApiProperty()
  amlReport?: string;

  @Prop({ type: Object })
  @ApiProperty()
  metadata?: Record<string, any>;
}

export type UserVerificationDocument = UserVerification & Document;

export const UserVerificationSchema = SchemaFactory.createForClass(UserVerification);
