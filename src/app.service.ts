import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): any {
    return {
      "status": "success",
      "message": 'Naija Rent Verify is up and running!'
    };
  }
}
