import * as bcrypt from 'bcryptjs';
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true }) // Enable timestamps
export class User {
  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ unique: true })
  email: string;

  @Prop({ unique: false })
  nin: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  homeAddress: string;

  @Prop()
  password: string;

  @Prop({ default: 'inactive' })
  status: string;

  @Prop()
  confirmationCode: string;

  @Prop()
  accountType: string;

  @Prop({ default: false })
  isOnboarded: boolean;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ type: [Object] })
  tenantVerficationHistory?: object[];

  @Prop()
  employmentStatus?: string;

  @Prop()
  currentEmployer?: string;

  @Prop()
  monthlyIncome?: string;

  @Prop()
  jobTitle?: string;

  @Prop()
  file?: string;

  @Prop()
  gender?: string;

  @Prop()
  dateOfBirth?: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

// Add pre hook to hash the password before saving
UserSchema.pre<UserDocument>('save', async function (next) {
  try {
    if (!this.isModified('password') || !this.password) {
      return next();
    }

    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});
