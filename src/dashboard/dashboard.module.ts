import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesModule } from '../activities/activities.module';
import { Expense, ExpenseSchema } from '../expenses/entities/expense.entity';
import {
  Application,
  ApplicationSchema,
} from '../properties/entities/application.entity';
import {
  LandlordAssignedTenant,
  LandlordAssignedTenantSchema,
} from '../properties/entities/landlord_assigned_tenant.entity';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import { Room, RoomSchema } from '../rooms/entities/room.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    ActivitiesModule,
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Room.name, schema: RoomSchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
