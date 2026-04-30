import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class UserVerification {
  @Prop()
  
  firstName: string;

  @Prop()
  
  middleName: string;

  @Prop()
  
  lastName: string;

  @Prop()
  
  idNumber: string; // This is the NIN

  @Prop()
  
  type: string; // Type of verification (e.g., 'nin')

  @Prop()
  
  mobile: string;

  @Prop()
  
  email?: string;

  @Prop()
  
  gender: string;

  @Prop()
  
  dateOfBirth: string;

  @Prop({ type: Object })
  
  address: {
    town: string;
    lga: string;
    state: string;
    addressLine: string;
    city: string | null;
  };

  @Prop()
  
  image: string; // Base64 string

  @Prop()
  
  birthState: string;

  @Prop()
  
  birthLGA: string;

  @Prop()
  
  birthCountry: string;

  @Prop()
  
  nokState: string;

  @Prop()
  
  religion: string;

  @Prop()
  
  isConsent: boolean;

  @Prop()
  
  country: string;

  @Prop()
  
  businessId: string;

  @Prop()
  
  status: string;

  @Prop()
  
  dataValidation: boolean;

  @Prop()
  
  selfieValidation: boolean;

  @Prop()
  
  allValidationPassed: boolean;

  @Prop()
  
  requestedAt: Date;

  @Prop({ type: Object })
  
  requestedBy: {
    firstName: string;
    lastName: string;
    middleName?: string;
    id: string;
  };

  @Prop()
  
  adverseMediaReport?: string;

  @Prop()
  
  amlReport?: string;

  @Prop({ type: Object })
  
  metadata?: Record<string, any>;
}

export type UserVerificationDocument = UserVerification & Document;

export const UserVerificationSchema = SchemaFactory.createForClass(UserVerification);
