import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ApiProperty } from '@nestjs/swagger';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  use(req: Request | any, res: Response, next: NextFunction) {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer token

    if (!token) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your secret
      req.user = decoded; // Attach user info to request
      next();
    } catch (error) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }
}
