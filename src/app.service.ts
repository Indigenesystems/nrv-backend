import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Returns health check message
   * @returns Status and message
   */
  getHello(): { status: string; message: string } {
    return {
      status: 'success',
      message: 'Naija Rent Verify is up and running!',
    };
  }
}
