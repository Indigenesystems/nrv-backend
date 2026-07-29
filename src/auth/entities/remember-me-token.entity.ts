import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RememberMeTokenDocument = RememberMeToken & Document;

@Schema({ timestamps: true, collection: 'remember_me_tokens' })
export class RememberMeToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** SHA-256 hash of the raw token stored in the cookie. Never store the raw token. */
  @Prop({ required: true, unique: true, index: true })
  tokenHash: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: null })
  userAgent?: string;

  @Prop({ default: null })
  lastUsedAt?: Date;

  @Prop({ default: false })
  revoked: boolean;
}

export const RememberMeTokenSchema =
  SchemaFactory.createForClass(RememberMeToken);

RememberMeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
