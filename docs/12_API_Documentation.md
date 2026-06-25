# 12. API Reference

This document maps all REST API endpoints, DTO schema structures, validations, and auth headers.

---

## 1. Global Request Headers
Endpoints protected by `JwtAuthGuard` require the following header:
```
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## 2. Authentication Module (`/auth`)

### A. POST `/auth/register`
Creates a new user account.
* **Payload**:
  * `fullName` (String, Required)
  * `email` (String, Required)
  * `password` (String, Required)
  * `confirmPassword` (String, Required)
* **Response (201 Created)**:
  ```json
  {
    "statusCode": 201,
    "message": "User registered successfully",
    "data": { "id": "...", "fullName": "...", "email": "...", "companyId": "..." }
  }
  ```

### B. POST `/auth/login`
Authenticates a user and returns a access token.
* **Payload**:
  * `email` (String, Required)
  * `password` (String, Required)
* **Response (200 OK)**:
  ```json
  {
    "statusCode": 200,
    "message": "Login successful",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": { "id": "...", "fullName": "...", "email": "...", "companyId": "..." }
    }
  }
  ```

### C. POST `/auth/forgot-password`
Generates a reset link and sends it to the user.
* **Payload**: `{ "email": "..." }`

---

## 3. Campaign Module (`/create-campaign`)

### A. POST `/create-campaign/upload`
Uploads a leads CSV file.
* **Payload (Multipart Form-Data)**: `file` (CSV File)
* **Response (200 OK)**:
  ```json
  {
    "statusCode": 200,
    "message": "CSV uploaded and parsed successfully",
    "filePath": "uploads/169000000-contacts.csv",
    "fileName": "169000000-contacts.csv",
    "columns": ["Email", "First Name", "Company"]
  }
  ```

### B. POST `/create-campaign/create`
Saves campaign details and contacts in the database.
* **Payload (CreateCreateCampaignDto)**:
  * `name` (String, Optional)
  * `subject` (String, Required)
  * `body` (String, Required)
  * `filePath` (String, Required)
  * `emailField` (String, Required)
  * `companyField` (String, Optional)
  * `ownerField` (String, Optional)
* **Response (201 Created)**:
  ```json
  {
    "statusCode": 201,
    "message": "Campaign created successfully",
    "data": { "totalContacts": 50, "campaign": { ... } }
  }
  ```

### C. POST `/create-campaign/:id/start`
Enqueues the campaign for immediate or scheduled dispatch.
* **Payload**:
  * `selectedAccountIds` (Array of Strings, Optional)
  * `delayMinutes` (Number, Optional)
  * `scheduledAt` (ISO Date String, Optional)

---

## 4. SMTP Sender Module (`/smtp-sender`)

### A. POST `/smtp-sender`
Adds a new SMTP account.
* **Payload**:
  * `fromName`, `fromEmail`, `userName`, `password`, `smtpHost`, `smtpPort`
  * `smtpSecurity` (Enum: `SSL`, `TLS`, `NONE`)

### B. POST `/smtp-sender/send-direct`
Sends an email using SMTP credentials passed directly in the request body.
* **Payload**:
  * `smtpConfig`: Outbound connection details.
  * `payload`: `{ "to": "...", "subject": "...", "html": "..." }`

---

## 5. Inbox Module (`/inbox`)

### A. GET `/inbox/accounts`
Lists all connected email configurations (SMTP, Google, Outlook) for the tenant.

### B. GET `/inbox/:accountId/sent`
Fetches sent logs for an account with pagination support.
* **Query Parameters**: `page` (Default: 1), `limit` (Default: 10)

### C. GET `/inbox/:accountId/replies`
Fetches replies to a specific campaign email from the inbox.
* **Query Parameters**: `messageId` (Required)

---

## 6. Telemetry & Tracking

### A. GET `/track/open/:id`
Logs an email open event when the tracking pixel loads.
* **Response**: Returns a 1x1 transparent PNG image.

### B. GET `/track/click/:id`
Logs a link click event and redirects the user to the target URL.
* **Query Parameters**: `url` (Required redirect destination)
* **Response**: HTTP 302 redirect.
