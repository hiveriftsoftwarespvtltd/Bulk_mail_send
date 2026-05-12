import { Injectable } from '@nestjs/common';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class AppService {
  getHello() {
    return new CustomResponse(200, 'Health check successful', 'Hello World!');
  }
}
