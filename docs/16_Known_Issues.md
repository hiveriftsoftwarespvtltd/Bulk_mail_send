# 16. Known Issues & Architectural Vulnerabilities

This document catalogs security vulnerabilities, scalability limits, performance bottlenecks, and code implementation bugs identified in the Mailpipes codebase.

---

## 1. Security Vulnerabilities

### A. Plaintext Credentials Storage
* **Location**: `SmtpSender`, `GoogleMail`, and `OutlookMail` Mongoose entities.
* **Vulnerability**: SMTP credentials, Gmail OAuth access/refresh tokens, and Outlook access/refresh tokens are stored in the database in plaintext.
* **Impact**: If database backups, logs, or read-access keys are compromised, the attacker gains full control of all client email accounts.
* **Fix**: Encrypt credentials at-rest using AES-256-GCM before writing to MongoDB.

### B. Stored XSS in Analytics & Inbox Pages
* **Location**:
  - `d:\mailpipe frontend\src\pages\CampaignStats.jsx` (Line 370)
  - `d:\mailpipe frontend\src\pages\CampaignInbox.jsx` (Line 309, 330)
* **Vulnerability**: Campaign templates and incoming recipient emails are rendered using React's `dangerouslySetInnerHTML` without HTML sanitization.
* **Impact**: Attackers can send emails containing malicious scripts. When an administrator views the statistics or inbox page, the script executes, enabling token theft, session hijacking, or account takeover.
* **Fix**: Sanitize HTML strings using `dompurify` before injection.

### C. Open Redirect in Click Tracking
* **Location**: `src/tracking/tracking.controller.ts` (Lines 148-150)
* **Vulnerability**: The click tracking route redirects users to the `url` query parameter value without validating the domain.
* **Impact**: Attackers can use the application's domain for phishing campaigns (e.g. `https://track.mailpipes.online/track/click/id?url=https://phishing-site.com`). This triggers security blacklists on the custom domain.
* **Fix**: Validate that the redirect destination URL is registered within the campaign.

### D. Unrestricted File Uploads
* **Location**: `src/create-campaign/create-campaign.controller.ts`
* **Vulnerability**: CSV uploads are saved directly to `./uploads` without size limits or file extension checks.
* **Impact**: Authenticated users can upload massive payloads (DoS) or executable binaries (RCE).
* **Fix**: Add size restrictions and file filters to the Multer middleware.

### E. Open SMTP Relay in `send-direct`
* **Location**: `src/smtp-sender/smtp-sender.controller.ts` (Line 56)
* **Vulnerability**: Exposes an endpoint that sends emails using SMTP configurations passed directly in the request body, bypassing tenancy validations.
* **Impact**: Users can use the API as an open SMTP relay, sending spam or phishing campaigns that blacklist the hosting IP.
* **Fix**: Restrict direct sending to verified accounts bound to the caller's tenant context.

---

## 2. Scalability & Performance Bottlenecks

### A. MongoDB 16MB Document Limit Exhaustion
* **Location**: `contacts` array in `CreateCampaign` document schema.
* **Vulnerability**: Storing the campaign contact list inline inside the campaign document.
* **Impact**: Campaigns with 15,000+ contacts with dynamic variables will exceed MongoDB's 16MB document limit, causing database updates to fail.
* **Fix**: Move contacts to a separate `CampaignContact` collection.

### B. Worker Thread Lockup in Bull Processor
* **Location**: `CreateCampaignService.processCampaignSending` sending loop.
* **Vulnerability**: Running the entire campaign outreach loop sequentially inside a single Bull job execution thread using `setTimeout` promises.
* **Impact**: Campaigns with large contact lists lock the background worker thread for days. This occupies all queue slots, blocking other scheduled campaigns and test emails.
* **Fix**: Enqueue each contact send task as an individual delayed Bull job.

### C. N+1 Database Query Flood
* **Location**: Campaign sending loop in `create-campaign.service.ts`.
* **Vulnerability**: Queries the DB on every single email iteration to fetch the campaign state (`campaignModel.findById`) and check daily limits.
* **Impact**: A campaign with 10,000 contacts generates 20,000+ database reads in a short period, causing high CPU load on MongoDB and slowing down other services.
* **Fix**: Cache the campaign state or track limits in Redis.

### D. Full Email Body Logging
* **Location**: `message` field in `EmailLogSchema`.
* **Vulnerability**: Storing the complete custom HTML body of every single sent email in the database.
* **Impact**: Outreach campaigns generate massive duplicate HTML data, inflating database size and costs.
* **Fix**: Store only the template variables and dynamically reconstruct the HTML body when needed for previews.

### E. In-Memory OTP Store
* **Location**: `src/util/util/otpStore.ts`
* **Vulnerability**: OTP codes are stored in a local JavaScript `Map` without TTL cleanup.
* **Impact**: Memory leaks from unverified OTPs. Horizontal scaling behind a load balancer will also fail because login requests will be routed to instances that do not hold the OTP in memory.
* **Fix**: Migrate OTP storage to Redis with an explicit TTL expiration.

---

## 3. Inefficient Email Operations

### A. Inefficient Full Email Source Syncing via IMAP
* **Location**: `InboxService.getSmtpReplies` (Lines 278-280)
* **Vulnerability**: Fetches the entire raw email source (`source: true`) for 100 emails and parses it in memory on every inbox request.
* **Impact**: Extreme CPU load, high bandwidth usage, and request timeouts.
* **Fix**: Fetch only email headers (`envelope: true` and select headers) to find campaign reply matches.

### B. Lack of Automated Bounce and Suppression Handling
* **Location**: Bounces count is hardcoded to `0` in `create-campaign.service.ts` (Line 277).
* **Vulnerability**: No webhook or IMAP logic to capture email bounces or spam complaints.
* **Impact**: The system continues sending emails to invalid addresses, damaging the sender domain reputation.
* **Fix**: Implement bounce processing and exclude matching emails.
