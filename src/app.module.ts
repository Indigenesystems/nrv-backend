import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongodbModule } from './db/db.module';


@Module({
  imports: [
    MongodbModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
