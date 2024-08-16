import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongodbModule } from './db/db.module';
import { UserSchema } from './users/entities/user.entity';
import { UserController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { UserService } from './users/users.service';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtModule } from '@nestjs/jwt'; // Import JwtModule only
import { EmailService } from './email-sender/email.service';
import { EmailServiceModule } from './email-sender/email-sender.module';
import { PropertiesModule } from './properties/properties.module';
import { CloudinaryService } from './upload/cloudinary.service';
import { MyMulterModule } from './upload/multer.module';
import { PropertiesController } from './properties/properties.controller';
import { PropertiesService } from './properties/properties.service';
import { PropertySchema } from './properties/entities/property.entity';
import { RoomsModule } from './rooms/rooms.module';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';
import { RoomSchema } from './rooms/entities/room.entity';
import { ApplicationSchema } from './properties/entities/application.entity';
import { MaintenanceSchema } from './maintenance/entities/maintenance.entity';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MaintenanceService } from './maintenance/maintenance.service';
import { MaintenanceController } from './maintenance/maintenance.controller';
import { LandlordAssignedTenantSchema } from './properties/entities/landlord_assigned_tenant.entity';

@Module({
  imports: [
    MongodbModule,
    UsersModule,
    EmailServiceModule,
    MyMulterModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Property', schema: PropertySchema }, { name: 'Room', schema: RoomSchema },  { name: 'Application', schema:  ApplicationSchema }, { name: 'Maintenance', schema:  MaintenanceSchema }, { name: 'LandlordAssignedTenant', schema:  LandlordAssignedTenantSchema }]),
    JwtModule.register({
      secret: 'your-secret-key-here',
      signOptions: { expiresIn: '1d' }, 
    }),
    AuthModule,
    PropertiesModule,
    RoomsModule,
    MaintenanceModule,
  ],
  controllers: [AppController, UserController, AuthController, PropertiesController, RoomsController, UserController, MaintenanceController],
  providers: [AppService, UserService, AuthService, EmailService, CloudinaryService, PropertiesService, RoomsService, MaintenanceService], 
})
export class AppModule {}
