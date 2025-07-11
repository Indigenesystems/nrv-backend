import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//import { Document } from 'mongoose';


@Schema({ timestamps: true })
export class VerificationResponse {
  @Prop()
  verificationId: string;

  @Prop()
  fullName: string;

  @Prop({unique: false})
  email: string;

  @Prop()
  phone: string;

  @Prop()
  dateOfBirth: Date;

  @Prop({ default: null })
  address?: string;

  @Prop({ default: null })
  employmentStatus?: string;

  @Prop({ default: null })
  roleInCompany?: string;

  @Prop({ default: null })
  companyName?: string;

  @Prop({ default: null })
  companyAddress?: string;

  @Prop({ default: null })
  monthlyIncome?: number;

  @Prop({ default: null })
  dateJoined?: string;

  @Prop({ default: null })
  guarantorFirstName?: string;

  @Prop({ default: null })
  guarantorLastName?: string;

  @Prop({ default: null })
  guarantorPhone?: string;

  @Prop({ default: null })
  guarantorEmail?: string;

  @Prop({ default: null })
  guarantorAddress?: string;

  @Prop({ default: null })
  guarantorEmploymentStatus?: string;

  @Prop({ default: null })
  guarantorCompany?: string;

  @Prop({ default: null })
  guarantorRelationship?: string;

  @Prop({ default: null })
  bankStatementUrl?: string;

  @Prop({ default: null })
  utilityBillUrl?: string;

  @Prop({ default: null })
  identificationDocumentUrl?: string;

  @Prop({ default: null })
  identificationDocumentType?: string;

  @Prop({ default: null })
  gender?: string;

  @Prop()
  createdBy: string;
}

export const VerificationResponseSchema = SchemaFactory.createForClass(VerificationResponse);
