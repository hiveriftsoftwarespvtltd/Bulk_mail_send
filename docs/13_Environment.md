# 13. Environment Variables

This document lists all environment variables used by the backend application to configure connections, authentication, credentials, and API endpoints.

---

## 1. System Configurations

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `PORT` | Local HTTP binding port | `9000` | Optional (Defaults to 9000) |
| `NODE_ENV` | Environment state indicator | `production` | Optional |
| `BACKEND_URL` | Base API access URL | `https://api.mailpipes.online` | Required (For tracking pixel URLs) |
| `FRONTEND_URL` | Base frontend URL | `https://app.mailpipes.online` | Required (For redirecting auth flows) |

---

## 2. Database & Cache Connections

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/mailpipes` | Yes |
| `REDIS_HOST` | Redis hostname | `127.0.0.1` | Optional (Defaults to localhost) |
| `REDIS_PORT` | Redis port number | `6379` | Optional (Defaults to 6379) |

---

## 3. JWT Authentication

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Secret key used to sign JWT tokens | `super-secret-key` | Yes |

---

## 4. Google OAuth Application Credentials

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | Google Client ID | `123-abc.apps.googleusercontent.com` | Yes (To connect Gmail) |
| `GOOGLE_CLIENT_SECRET`| Google Client Secret | `GOCSPX-secret` | Yes (To connect Gmail) |
| `GOOGLE_REDIRECT_URI` | Google callback URL | `https://api.mailpipes.online/google-mail/callback` | Optional (Falls back to backend URL) |

---

## 5. Outlook Graph Application Credentials

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `OUTLOOK_CLIENT_ID` | Microsoft Azure Application Client ID | `88ef58b6-9fa0-48b4-bf50-3d3f25c754d9` | Yes (To connect Outlook) |
| `OUTLOOK_CLIENT_SECRET`| Microsoft Azure Application Client Secret | `OutlookSecretVal` | Yes (To connect Outlook) |
| `OUTLOOK_REDIRECT_URI` | Outlook callback URL | `https://api.mailpipes.online/outlook-mail/callback` | Optional (Falls back to backend URL) |

---

## 6. System Email & SMTP Fallback Settings
Used to send transactional emails (like password reset links).

| Variable | Description | Example Value | Required? |
| :--- | :--- | :--- | :--- |
| `MAIL_HOST` | System SMTP host name | `smtp.mailtrap.io` | Yes (For password recovery) |
| `MAIL_PORT` | System SMTP port | `587` | Yes (For password recovery) |
| `MAIL_USER` | System SMTP account username | `user-smtp-auth` | Yes (For password recovery) |
| `MAIL_PASS` | System SMTP account password | `password-smtp-auth` | Yes (For password recovery) |
| `MAIL_FROM` | Default sender email address | `noreply@mailpipes.online` | Yes (For password recovery) |
