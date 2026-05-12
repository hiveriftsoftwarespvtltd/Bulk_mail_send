import { Controller, Post, Body, Get, UseGuards, Request, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: any) {
    return this.authService.register(registerDto);
  }

  private getDeviceType(userAgent: string): string {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera M(obi|ini)/.test(userAgent)) {
      return 'Mobile';
    }
    return 'Desktop/Laptop';
  }

  @Post('login')
  async login(@Body() loginDto: any, @Request() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const device = this.getDeviceType(userAgent);
    const endpoint = req.originalUrl || '/auth/login';

    return this.authService.login(loginDto.email, loginDto.password, ip, device, endpoint);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Request() req: any) {
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}`;
    return this.authService.forgotPassword(body.email, fullUrl);
  }

  @Get('reset-password-page')
  async resetPasswordPage(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Set New Password – Bulk Mailer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5ff;
      font-family: Arial, sans-serif;
    }
    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 36px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 4px 24px rgba(79,70,229,0.08);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header span { font-size: 40px; }
    .header h2 { color: #4f46e5; margin: 8px 0 0; font-size: 22px; }
    .header p { color: #6b7280; font-size: 14px; margin-top: 6px; }
    .box {
      background: #f0f0ff;
      border: 2px dashed #4f46e5;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
    }
    .box label {
      display: block;
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .box input {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #c7d2fe;
      border-radius: 8px;
      font-size: 15px;
      color: #1e1b4b;
      background: #fff;
      outline: none;
      margin-bottom: 14px;
      transition: border 0.2s;
    }
    .box input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
    button {
      width: 100%;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 13px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    .msg {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 14px;
      text-align: center;
      display: none;
    }
    .msg.success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .msg.error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .warn {
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }
    .note {
      color: #9ca3af;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span>🔐</span>
      <h2>Password Reset</h2>
      <p>Hello! Set your new password below.</p>
    </div>

    <form id="resetForm">
      <input type="hidden" id="token" value="${token}" />
      <input type="hidden" id="email" value="${email}" />
      <div class="box">
        <label>Enter New Password</label>
        <input type="password" id="newPassword" placeholder="Enter new password" required />
        <label>Confirm New Password</label>
        <input type="password" id="confirmPassword" placeholder="Confirm new password" required />
      </div>
      <button type="submit">🔑 Update Password</button>
    </form>

    <p class="warn">⚠️ This link expires in 10 minutes.</p>
    <p class="note">If you did not request this, please ignore this email.</p>
    <div class="msg" id="msg"></div>
  </div>

  <script>
    document.getElementById('resetForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const token = document.getElementById('token').value;
      const email = document.getElementById('email').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const msgEl = document.getElementById('msg');

      if (newPassword !== confirmPassword) {
        msgEl.className = 'msg error';
        msgEl.style.display = 'block';
        msgEl.textContent = '❌ Passwords do not match!';
        return;
      }
      if (newPassword.length < 6) {
        msgEl.className = 'msg error';
        msgEl.style.display = 'block';
        msgEl.textContent = '❌ Password must be at least 6 characters.';
        return;
      }

      try {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email, newPassword, confirmPassword })
        });
        const data = await res.json();
        msgEl.style.display = 'block';
        if (data.status === 200) {
          msgEl.className = 'msg success';
          msgEl.textContent = '✅ ' + data.message;
          document.getElementById('resetForm').style.display = 'none';
        } else {
          msgEl.className = 'msg error';
          msgEl.textContent = '❌ ' + (data.message || 'Something went wrong. Please try again.');
        }
      } catch (err) {
        msgEl.className = 'msg error';
        msgEl.style.display = 'block';
        msgEl.textContent = '❌ Server error. Please try again.';
      }
    });
  </script>
</body>
</html>`;
    return res.type('html').send(html);
  }

  // ✅ Step 3: Form submission → Update password in DB
  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; email: string; newPassword: string; confirmPassword: string },
  ) {
    return this.authService.resetPassword(
      body.token,
      body.email,
      body.newPassword,
      body.confirmPassword,
    );
  }
}
