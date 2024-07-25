import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { IsEnum } from 'class-validator';

@Schema({ timestamps: true })
export class Maintenance {
    @Prop({ unique: true })
    maintenanceId: number;

    @Prop()
    title: string;

    @Prop()
    description: string;

    @Prop({ type: Types.ObjectId, ref: 'Room', validate: /^[0-9a-fA-F]{24}$/ })
    roomId: Room;

    @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
    createdBy: User;

    @Prop({ default: 'New', enum: ['New', 'Fixed', 'Rejected'] })
    @IsEnum(['New', 'Fixed', 'Rejected'])
    status: string;

    @Prop()
    file: string;
}

export type MaintenanceDocument = Maintenance & Document;

export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
