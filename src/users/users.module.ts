import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { User, UserSchema } from './entities/user.entity'; // Import User and UserSchema

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // Register UserSchema
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UsersModule {}