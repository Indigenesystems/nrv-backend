import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { User, UserSchema } from './entities/user.entity'; // Import User and UserSchema
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import { LandlordAssignedTenant, LandlordAssignedTenantSchema } from 'src/properties/entities/landlord_assigned_tenant.entity';
import { Property, PropertySchema } from 'src/properties/entities/property.entity';
import { Application, ApplicationSchema } from '../properties/entities/application.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import { RoomsService } from '../rooms/rooms.service';
import { Room, RoomSchema } from '../rooms/entities/room.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: LandlordAssignedTenant.name, schema: LandlordAssignedTenantSchema }, { name: Property.name, schema: PropertySchema }, { name: Application.name, schema: ApplicationSchema }, { name: Room.name, schema: RoomSchema },]),  // Register UserSchema
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, JwtService, EmailService, PropertiesService, CloudinaryService, RoomsService],
})
export class UsersModule {}