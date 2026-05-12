export const COMMON = {
  CREATED_SUCESSFULLY: (entity: string) => `${entity} created successfully`,
  NOT_FOUND: (entity: string) => `${entity} not found`,
  FOUND: (entity: string) => `${entity} found sucessfully`,
  DELETE: (entity: string) => `${entity} deleted successfully`,
  CREATED_SUCESSFULLY_FAIL: (entity: string) => `${entity} creation failed`,
  UPDATE: (entity: string) => `${entity} updated successfully`,
  UPDATE_FAIL: (entity: string) => `${entity} updation failed.`,
  DELETE_FAIL: (entity: string) => `${entity} deletion failed `,
  ID: ':id',
  PID: 'id',
  EMAIL: 'email',
  PHONE: 'phone',
};

export const ENTITY = {
  USER: 'User',
  DISCOUNT:"discount"
};

export const ROUTE = {
  AUTH: 'auth',
  SIGNIN: 'signin',
  SINGUP: 'signup',
  UPLOAD: 'upload',
  USG: 'usg',
  OTP: 'otp',
  SEND: 'send',
  RESEND: 'resend',
  VERIFY: 'verify',
  RESET_PASSWORD:'reset-password',
  CATEGORY:'categories',
  ORDER:'order',
  USER:'user',
  RIDER:'rider',
  BANNER:'banner',
  MENU:'menu',
  
};
export const MESSAGE = {
 
  USER: {
    USER_CREATED_SUCCESSFULLY: 'User created successfully',
    USER_NOT_FOUND: 'User not found',
  },
  UPLOAD: {
    UPLOADED_SUCCESSFULLY: 'File uploaded successfully.',
    FILE_NOT_FOUND: 'File not found',
    FILE_FETCHED: 'Successfully fetch file',
  },
  OTP: {
    SENT: 'Otp sent successfully.',
    RESENT: 'Otp re-send successfully.',
    VERIFY: 'Otp verified successfully.',
  },
  
  PASSWORD:{
    RESET_SUCCESSFULL:"Password has been changed succesfully",
    RESET_FAIL:"Password change has been failed, please try again with new otp"
  }
};

// export const ROUTE = {
//   APPOINTMENT: {
//     BASE: '/api/v1/appointment',
//   },
//   USG: {
//     BASE: '/api/v1/usg',
//   },
//   UPLOAD: {
//     BASE: '/api/v1/upload',
//   },
//   AUTH: {
//     BASE: 'auth',
//     SIGNUP: 'signup',
//     SIGNIN: 'signin',
//   },
//   OTP: {
//     BASE: '/api/v1/otp',
//     SEND: '/send',
//     RESEND: '/resend',
//     VERIFY: '/verify',
//   },
//   STAFF:{
//     BASE:"staff",
//     ID:":id",
//     PID:"id"
//   }
// };

export const VALUES = {
  LOCAL_MONGO_URL: 'mongodb://127.0.0.1:27017/ultrasoundclinicbackend',
  UPLOAD_FILE_LOC: './uploads',
};
