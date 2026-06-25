# 08. Email Sending & Telemetry Tracking

This document explains the CSV parsing, template personalization, outbound email integration, tracking pixel injection, and redirection mechanics.

---

## 1. CSV Processing & Variable Mapping
* **Parsing**: CSV uploads are parsed using the `csv-parser` library. The file stream extracts the headers and reads the rows into memory objects.
* **Variable Mapping**: The application maps the parsed columns to standard database fields (Email, Owner, Company).
* **Personalization**: The `replaceVariables` helper uses regular expressions to dynamically replace placeholders in the subject and HTML body with recipient-specific fields:
  ```typescript
  // Example translation inside replaceVariables:
  // Subject: "Hello {{ownerField}} from {{companyField}}"
  // Result: "Hello Jane Doe from Google Inc."
  ```
  It supports spaced keys, normalized key versions, and default fallback keys (like `{{email}}`, `{{firstName}}`, `{{name}}`).

---

## 2. Outbound Integration Channels

### A. SMTP configurations
Nodemailer creates a standard SMTP transport using host, port, security (SSL/TLS), and credentials:
```typescript
const transporter = nodemailer.createTransport({
  host: smtpConfig.smtpHost,
  port: smtpConfig.smtpPort,
  secure: smtpConfig.smtpPort === 465,
  auth: { user: smtpConfig.userName, pass: smtpConfig.password }
});
```

### B. Google OAuth (Gmail API integration)
Uses OAuth2 authentication with Nodemailer to send emails through the Gmail API. The connection uses the Google Client ID, Client Secret, and User Refresh Token to refresh expired access tokens.

### C. Outlook Microsoft Graph API
Sends emails by calling Microsoft Graph's `/me/sendMail` REST endpoint. The service refreshes the access token using the user's refresh token and sends a POST request with the email details:
```typescript
const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlMessage },
      toRecipients: [{ emailAddress: { address: recipient } }]
    },
    saveToSentItems: 'true'
  })
});
```

---

## 3. Telemetry Tracking Injection

To track user engagement, the service rewrites email templates before sending:

### Open Tracking
Injects a 1x1 transparent tracking pixel image at the top of the HTML body. The image source points to the application's open tracking endpoint, carrying a unique `trackingId`:
`<img src="https://<tracking-domain>/track/open/<trackingId>" width="1" height="1" style="display:none;" />`

### Click Tracking
Uses a regular expression to find all links in the email body and replace their target URLs with the click tracking endpoint, appending the original destination as a redirect parameter:
`href="https://<tracking-domain>/track/click/<trackingId>?url=<escaped-original-url>"`

---

## 4. Telemetry Events Processing

### Open Tracking (`/track/open/:id`)
* When the email client loads the tracking pixel, the server captures the request.
* If the request is from a known crawler or bot, the event is ignored.
* If valid, it sets the status to `OPENED`, records the first open timestamp, and increments the campaign's `opened` counter.
* The server returns a 1x1 transparent PNG image to the email client.

### Click Tracking (`/track/click/:id`)
* When a recipient clicks a tracked link, the server logs the click event.
* Sets the status to `CLICKED` in the database, records the timestamp, and increments the campaign's `clicked` counter.
* The server redirects the user to the original destination URL.
