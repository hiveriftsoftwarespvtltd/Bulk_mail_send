import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Get('privacy-policy')
  @Header('Content-Type', 'text/html')
  getPrivacyPolicy() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - MailPipes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --primary-light: #e0e7ff;
            --text-dark: #0f172a;
            --text-medium: #334155;
            --text-light: #64748b;
            --bg-page: #f8fafc;
            --bg-card: #ffffff;
            --border-color: #e2e8f0;
            --transition-speed: 0.3s;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.04), transparent 45%), 
                        radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.04), transparent 45%), 
                        var(--bg-page);
            color: var(--text-medium);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .container {
            max-width: 840px;
            margin: 0 auto;
            padding: 40px 20px;
            width: 100%;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 40px;
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: var(--text-dark);
        }

        .logo-icon {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, var(--primary), #3b82f6);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 1.2rem;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .logo-text {
            font-size: 1.4rem;
            font-weight: 700;
            background: linear-gradient(to right, var(--text-dark), #1e293b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .btn-home {
            padding: 8px 16px;
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--primary);
            background-color: var(--primary-light);
            border-radius: 6px;
            text-decoration: none;
            transition: all var(--transition-speed) ease;
        }

        .btn-home:hover {
            background-color: var(--primary);
            color: white;
        }

        main {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        h1 {
            color: var(--text-dark);
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }

        .last-updated {
            font-size: 0.9rem;
            color: var(--text-light);
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .last-updated::before {
            content: "";
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: #10b981;
            border-radius: 50%;
        }

        h2 {
            color: var(--text-dark);
            font-size: 1.4rem;
            font-weight: 600;
            margin-top: 35px;
            margin-bottom: 15px;
            border-left: 4px solid var(--primary);
            padding-left: 12px;
            letter-spacing: -0.015em;
        }

        p {
            margin-bottom: 16px;
            color: var(--text-medium);
        }

        ul {
            margin-bottom: 20px;
            padding-left: 20px;
        }

        li {
            margin-bottom: 8px;
        }

        .highlight-box {
            background-color: #f8fafc;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }

        .highlight-box p:last-child {
            margin-bottom: 0;
        }

        .info-card {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }

        .info-card-item {
            background: #f8fafc;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
        }

        .info-card-item h3 {
            font-size: 1.1rem;
            color: var(--text-dark);
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .contact-section {
            background: linear-gradient(135deg, #f5f3ff, #ede9fe);
            border: 1px solid #ddd6fe;
            border-radius: 12px;
            padding: 30px;
            margin-top: 40px;
            text-align: center;
        }

        .contact-section h3 {
            color: var(--text-dark);
            margin-bottom: 10px;
            font-size: 1.2rem;
        }

        .email-link {
            display: inline-block;
            margin-top: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--primary);
            text-decoration: none;
            transition: color 0.2s;
        }

        .email-link:hover {
            color: var(--primary-hover);
            text-decoration: underline;
        }

        footer {
            margin-top: auto;
            text-align: center;
            padding: 30px 20px;
            font-size: 0.85rem;
            color: var(--text-light);
            border-top: 1px solid var(--border-color);
        }

        @media (max-width: 640px) {
            .container {
                padding: 20px 10px;
            }
            main {
                padding: 24px;
            }
            h1 {
                font-size: 1.8rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <a href="https://mailpipes.online" class="logo-container">
                <div class="logo-icon">M</div>
                <span class="logo-text">MailPipes</span>
            </a>
            <a href="https://mailpipes.online" class="btn-home">Back to Home</a>
        </header>

        <main>
            <h1>Privacy Policy</h1>
            <div class="last-updated">Last Updated: June 1, 2026</div>

            <p>At <strong>MailPipes</strong> (accessible from <a href="https://mailpipes.online" style="color: var(--primary); text-decoration: none; font-weight: 500;">https://mailpipes.online</a>), one of our main priorities is the privacy of our visitors and users. This Privacy Policy document outlines the types of information collected and recorded by MailPipes and how we use it, particularly concerning our Google Login integration and bulk mailing services.</p>

            <p>If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at <a href="mailto:support@mailpipes.online" style="color: var(--primary); text-decoration: none; font-weight: 500;">support@mailpipes.online</a>.</p>

            <h2>1. Information We Collect</h2>
            <p>MailPipes collects specific data to provide a seamless and secure bulk email sending and campaign management experience. The types of data we collect include:</p>
            
            <div class="info-card">
                <div class="info-card-item">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Personal Profile
                    </h3>
                    <p style="font-size: 0.9rem; margin-bottom: 0;">We collect your name and email address when you sign up or authenticate with your account.</p>
                </div>
                <div class="info-card-item">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        OAuth Credentials
                    </h3>
                    <p style="font-size: 0.9rem; margin-bottom: 0;">When you connect your Gmail or Google Workspace account, we securely store your Google OAuth access and refresh tokens.</p>
                </div>
            </div>

            <h2>2. Google Login and OAuth Integration</h2>
            <p>To provide advanced email dispatch functionalities, MailPipes allows you to connect your Google account securely using Google Sign-In and Google OAuth. This enables MailPipes to act as an authorized client on your behalf.</p>
            
            <div class="highlight-box">
                <p><strong>How we use Google API Services:</strong></p>
                <ul>
                    <li><strong>Google Login Integration:</strong> We use Google Login to securely authenticate users. We only retrieve your email address and basic profile information (such as your name) to set up and manage your MailPipes account.</li>
                    <li><strong>Email Integration:</strong> In order to allow you to compose, schedule, and send bulk emails or track your campaigns directly through your own Google Workspace/Gmail accounts, we request authorization via official Google OAuth API scopes.</li>
                    <li><strong>Credential Security:</strong> The access and refresh tokens provided by Google are encrypted and stored in our database. We do not have access to your Google account password.</li>
                </ul>
            </div>

            <h2>3. How We Use Your Data</h2>
            <p>We use the collected data for various purposes, including:</p>
            <ul>
                <li>To authenticate your identity and secure your MailPipes account.</li>
                <li>To send scheduled bulk emails on your behalf from your connected email addresses.</li>
                <li>To monitor and track email campaign delivery status, opens, and link clicks to provide you with insightful analytics.</li>
                <li>To maintain, optimize, and personalize your experience within the MailPipes platform.</li>
                <li>To communicate with you, including sending technical updates, security alerts, and support responses.</li>
            </ul>

            <h2>4. Data Sharing and Privacy</h2>
            <p><strong>MailPipes does not sell, rent, trade, or share your personal data with any third-party companies.</strong></p>
            <p>Your Google API data is strictly used to facilitate the features of MailPipes (such as sending emails and retrieving campaign reports). We comply fully with the Google API Services User Data Policy, including the Limited Use requirements. Your data will never be used for advertisement serving or transferred to third-party databases for reasons unrelated to executing the features you authorize.</p>

            <h2>5. Data Security & Retention</h2>
            <p>We implement a variety of security measures to maintain the safety of your personal information. Your tokens are encrypted at rest, and all communication between your browser and our backend servers is encrypted using standard Secure Socket Layer (SSL/TLS) technology.</p>
            <p>We retain your information for as long as your MailPipes account is active. If you choose to disconnect a Google account or delete your MailPipes account, all associated credentials, profile records, and Google OAuth tokens are immediately and permanently deleted from our databases.</p>

            <h2>6. Revoking Consent</h2>
            <p>You can revoke MailPipes' access to your Google account at any time either directly within the MailPipes dashboard settings (by deleting the connected account) or via your Google Account's Security Settings page (under "Third-party apps with account access"). Once revoked, MailPipes will no longer be able to access your email address or send emails on your behalf.</p>

            <div class="contact-section">
                <h3>Have questions or need to request data deletion?</h3>
                <p>Feel free to reach out to our support team. We are committed to responding to all data protection inquiries promptly.</p>
                <a href="mailto:support@mailpipes.online" class="email-link">support@mailpipes.online</a>
            </div>
        </main>

        <footer>
            <p>&copy; 2026 MailPipes. All rights reserved. | <a href="https://mailpipes.online" style="color: var(--text-light); text-decoration: underline;">Home</a></p>
        </footer>
    </div>
</body>
</html>`;
  }
}
