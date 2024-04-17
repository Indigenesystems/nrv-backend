import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'NaijaRentVerify backend is healthy';
  }
}
