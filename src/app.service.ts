import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

@Injectable()
export class AppService {
  getHello(): any {
    return {
      status: 'success',
      message: 'Naija Rent Verify is up and running!',
    };
  }
}
