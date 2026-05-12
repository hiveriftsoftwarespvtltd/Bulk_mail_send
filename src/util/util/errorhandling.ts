import { HttpException, HttpStatus } from '@nestjs/common';

const throwException = (error: any) => {
  const status = error?.statusCode || HttpStatus.BAD_REQUEST;
  throw new HttpException(
    {
      status: status,
      message: error?.message || 'Server Error',
    },
    status,
    {
      cause: error,
    },
  );
};

export { throwException };
