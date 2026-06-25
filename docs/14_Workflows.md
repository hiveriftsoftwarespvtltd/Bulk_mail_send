# 14. Core User Workflows

This document outlines the step-by-step workflows for user registration, connecting sending accounts, and launching campaigns.

---

## 1. User Authentication & Session Setup
```
[Visitor] ──► Register Page ──► Submit Details ──► [New User Created] ──► Login ──► Save JWT in Client
```

1. **Registration**:
   * The visitor navigates to `/register` and submits their name, email, and password.
   * The backend generates a unique `companyId` (UUID) to isolate the user's data and hashes the password using bcrypt before saving the user record in MongoDB.
2. **Login**:
   * The user logs in with their credentials at `/login`.
   * The server validates the credentials and returns a JWT access token containing the user's `userId`, `email`, and `companyId`.
   * The frontend stores this token in `localStorage` under `access_token` to authorize subsequent requests.

---

## 2. Connecting a Google Gmail Account
```
[Dashboard] ──► Click "Connect Gmail" ──► Redirect to Google Login ──► Approve Consent ──► Callback Saves Tokens
```

1. The user clicks **Connect Google** in the accounts settings page.
2. The frontend requests the Google OAuth URL from the backend. The backend encodes the user's `companyId` and redirect URL into the OAuth `state` parameter and returns the authorize URL.
3. The frontend redirects the user to the Google Consent Screen.
4. The user signs in and grants the requested email permissions.
5. Google redirects the browser to the backend callback endpoint with an authorization code and the `state` payload.
6. The backend decodes the `state`, retrieves the access and refresh tokens, and saves them in the `GoogleMail` collection.
7. The user is redirected back to the frontend settings page.

---

## 3. Creating & Launching an Outreach Campaign
```
[Campaigns] ──► Create campaign ──► Upload CSV ──► Map Headers ──► Save Template ──► Set Schedule ──► Start Campaign
```

1. **Create Campaign**: The user clicks **Create New** on the campaigns dashboard, opening the Campaign Wizard.
2. **Upload CSV**: The user uploads their contact CSV file. `PapaParse` reads the headers, and the raw file is sent to the backend `/create-campaign/upload` endpoint to save in the `/uploads` directory.
3. **Map Fields**: The user maps the CSV columns to the application fields:
   * **Email**: Maps the target recipient email column.
   * **Owner**: Maps the contact name column.
   * **Company**: Maps the recipient's organization column.
4. **Copywriting Template**: The user edits the HTML email body in CKEditor. Placeholders like `{{companyField}}` are used to inject dynamic contact values.
5. **Set Schedule**: The user configures the sending schedule:
   * Selects sender accounts to rotate.
   * Configures time intervals (minutes, hours, seconds) and timezone.
   * Sets allowed weekdays and daily sending volume caps.
6. **Launch Campaign**: The user clicks **Launch**. The frontend calls `/create-campaign/create` to save the draft, and then `/create-campaign/:id/start` to enqueue the dispatch task.

---

## 4. Telemetry Tracking & Reply Syncer
```
[Recipient Opens Email] ──► Pixel Loads ──► Server logs OPENED ──► Recipient Clicks Link ──► Server logs CLICKED & Redirects
```

1. **Email Tracking**: The background worker personalized the template, inserts the tracking pixel and click tracking links, and dispatches the email.
2. **Open Event**: When the recipient opens the email, their mail client loads the transparent tracking pixel. The server logs an `OPENED` event with the client's IP and device details, and increments the campaign's `opened` counter.
3. **Click Event**: If the recipient clicks a link, the request hits the server click tracking endpoint. The server logs a `CLICKED` event, updates the database, and redirects the recipient to their original destination.
4. **Reply Event**: When the user opens the unified inbox page, the backend connects to the mailboxes via IMAP (for SMTP), Gmail API, or Microsoft Graph API. It scans incoming emails, matches them to sent messages using `In-Reply-To` headers, logs matching replies, and sets their status to `REPLIED`.
