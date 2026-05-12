const otps = new Map();

export const setOTP = (email, otp,type="login") => {
  const expiresAt = Date.now() + 3600000; // 1 hour in milliseconds
  otps.set(email, { otp, expiresAt,type });
};

export const getOTP = (email) => otps.get(email);

export const deleteOTP = (email) => otps.delete(email);
