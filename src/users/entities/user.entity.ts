import * as bcrypt from 'bcryptjs';
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User {
  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  email: string;

  @Prop()
  nin: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  homeAddress: string;

  @Prop()
  password: string;

  @Prop({ default: 'inactive' }) // Add status field with default value
  status: string;

  @Prop()
  confirmationCode: string;

  @Prop()
  accountType: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

// Add pre hook to hash the password before saving
UserSchema.pre<UserDocument>('save', async function(next) {
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
