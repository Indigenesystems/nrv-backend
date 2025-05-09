import * as bcrypt from 'bcryptjs';
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true }) // Enable timestamps
export class User {
  @Prop()
  @ApiProperty()
  firstName: string;

  @Prop()
  @ApiProperty()
  lastName: string;

  @Prop({ unique: true })
  @ApiProperty()
  email: string;

  @Prop({ unique: false })
  @ApiProperty()
  nin: string;

  @Prop()
  @ApiProperty()
  phoneNumber: string;

  @Prop()
  @ApiProperty()
  homeAddress: string;

  @Prop()
  @ApiProperty()
  password: string;

  @Prop({ default: 'inactive' })
  @ApiProperty()
  status: string;

  @Prop()
  @ApiProperty()
  confirmationCode: string;

  @Prop()
  @ApiProperty()
  accountType: string;

  @Prop({ default: false })
  @ApiProperty()
  isOnboarded: boolean;

  @Prop()
  @ApiProperty()
  passwordResetToken?: string;

  @Prop()
  @ApiProperty()
  passwordResetExpires?: Date;

  @Prop({ type: [Object] })
  @ApiProperty()
  tenantVerficationHistory?: object[];

  @Prop()
  @ApiProperty()
  employmentStatus?: string;

  @Prop()
  @ApiProperty()
  currentEmployer?: string;

  @Prop()
  @ApiProperty()
  monthlyIncome?: string;

  @Prop()
  @ApiProperty()
  jobTitle?: string;

  @Prop()
  @ApiProperty()
  file?: string;

  @Prop()
  @ApiProperty()
  gender?: string;

  @Prop()
  @ApiProperty()
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
