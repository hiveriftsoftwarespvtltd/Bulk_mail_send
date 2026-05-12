import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

// Add import for AuditLogService
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {}

  async register(registerDto: any) {
    try {
      const { fullName, email, password, confirmPassword } = registerDto;

      // 1. Validate Password Match
      if (password !== confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      // 2. Check if user already exists
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new BadRequestException('User already exists');
      }

      // 3. Hash Password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Generate Company ID for SaaS isolation
      const companyId = uuidv4();

      // 5. Create and save user
      const newUser = new this.userModel({
        fullName,
        email,
        password: hashedPassword,
        companyId,
      });

      await newUser.save();

      return new CustomResponse(201, 'User registered successfully', {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        companyId: newUser.companyId,
      });
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async login(email: string, pass: string, ip: string = '', device: string = 'Unknown', endpoint: string = '/auth/login') {
    try {
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isMatch = await bcrypt.compare(pass, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        sub: user._id,
        email: user.email,
        companyId: user.companyId,
        fullName: user.fullName,
      };

      const data = {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          companyId: user.companyId,
        },
      };

      // 🔸 Log System Metric in AuditLog
      this.auditLogService.logAction('LOGIN', user.email, user.companyId, ip, device, endpoint);

      return new CustomResponse(200, 'Login successful', data);
    } catch (error) {
      throwException(new CustomError(error.status || 401, error.message));
    }
  }

  async getProfile(userId: string) {
    try {
      const user = await this.userModel.findById(userId).select('-password');
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return new CustomResponse(200, 'Profile fetched successfully', user);
    } catch (error) {
      throwException(new CustomError(error.status || 401, error.message));
    }
  }

  async forgotPassword(email: string, dynamicBackendUrl?: string) {
    try {
      // 1. Find user by email
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new BadRequestException('No account found with this email address');
      }

      // 2. Generate a secure token (alid for 10 minutes)
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // 3. Save token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = tokenExpiry;
      await user.save();

      // 4. Build the reset link → opens backend HTML form page
      // Use dynamic URL from request if available, otherwise fallback to env
      const baseUrl = dynamicBackendUrl || this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000';
      const resetLink = `${baseUrl}/auth/reset-password-page?token=${resetToken}&email=${encodeURIComponent(email)}`;

      // 5. Send email with the Set Password button (same card design)
      const transporter = nodemailer.createTransport({
        host: this.configService.get<string>('MAIL_HOST'),
        port: parseInt(this.configService.get<string>('MAIL_PORT') || '587'),
        secure: parseInt(this.configService.get<string>('MAIL_PORT') || '587') === 465,
        auth: {
          user: this.configService.get<string>('MAIL_USER'),
          pass: this.configService.get<string>('MAIL_PASS'),
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        family: 4,
      } as any);

      await transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to: email,
        subject: '🔐 Reset Your Password - Bulk Mailer',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 36px; border: 1px solid #e0e0e0; border-radius: 12px; background: #fff;">
            <div style="text-align:center; margin-bottom: 24px;">
              <span style="font-size: 40px;">🔐</span>
              <h2 style="color: #4f46e5; margin: 8px 0 0;">Password Reset</h2>
            </div>
            <p style="color: #374151;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="color: #374151;">We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="background: #f0f0ff; border: 2px dashed #4f46e5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">Click below to set your new password</p>
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">
                🔑 Set New Password
              </a>
            </div>
            <p style="color: #dc2626; font-size: 13px; font-weight: 600;">⚠️ This link expires in 10 minutes.</p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
          </div>
        `,
      });

      return new CustomResponse(200, `Password reset link sent to ${email}. Please check your inbox.`);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async resetPassword(token: string, email: string, newPassword: string, confirmPassword: string) {
    try {
      if (newPassword !== confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      const user = await this.userModel.findOne({
        email,
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: new Date() },
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token. Please request a new one.');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();

      return new CustomResponse(200, 'Password reset successfully! You can now login with your new password.');
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }
}
