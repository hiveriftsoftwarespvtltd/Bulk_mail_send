# 01. Backend Folder Structure

This file explains the purpose and organization of folders within the NestJS backend application.

---

## 1. Backend Codebase Layout

The source code is organized within the `src/` directory:

```
backend/
├── src/
│   ├── app.module.ts              # Root coordinator module
│   ├── main.ts                    # Server bootstrap entry point
│   ├── audit-log/                 # User audit logging modules
│   ├── auth/                      # Authentication (JWT & local setup)
│   ├── campaign/                  # Legacy campaign endpoints
│   ├── campaign-settings/         # Campaign parameters storage module
│   ├── create-campaign/           # Core Campaign Dispatch & CSV mapping module
│   │   ├── dto/                   # Data Transfer Objects
│   │   ├── entities/              # Mongoose schemas/entities
│   │   └── processors/            # Background Bull processors
│   ├── google-mail/               # Google OAuth connection handlers
│   ├── inbox/                     # Unified mail replies syncing controllers
│   ├── logs/                      # Dispatch email telemetry logs schema
│   ├── mail/                      # Mail forwarding and tracking wrapping service
│   ├── outlook-mail/              # Outlook Graph API connection handlers
│   ├── provider/                  # Dynamic response wrapper services
│   ├── schedule-campaign/         # Campaign scheduler details module
│   ├── smtp-sender/               # SMTP server configurations module
│   ├── tracking/                  # Open & Click redirection routing controller
│   ├── tracking-domain/           # User custom tracking domains management
│   └── util/                      # Common utilities
│       └── util/
│           ├── constants.ts       # Shared constants
│           ├── errorhandling.ts   # Exception formatter helpers
│           ├── fileupload.ts      # Multer helper
│           ├── mailerutil.ts      # SMTP check helpers
│           ├── otpStore.ts        # OTP map holder
│           └── serviceutil.ts     # Internal data helpers
├── uploads/                       # Temporary folder for CSV files
└── test/                          # Unit & integration testing files
```

---

## 2. Key Directories & Responsibilities

### `src/`
Contains the core NestJS source code.

* **`app.module.ts`**: Root coordinator module imports all services, queues, environment parameters, and database models.
* **`main.ts`**: Server bootstrap entry point that configures CORS parameters, global validation pipes, and starts the API listening port.

### `src/create-campaign/`
Handles core outreach campaigns processing:
* **`create-campaign.controller.ts`**: Handles CSV uploads, variable mappings, campaign initialization, and controls campaign actions (start, pause, resume, restart).
* **`create-campaign.service.ts`**: Main orchestrator services. Performs CSV data parsing, variables templates personalization, and runs sending loops.
* **`processors/campaign.processor.ts`**: Bull queue background task subscriber.

### `src/mail/`
Exposes the email sending interface:
* **`mail.service.ts`**: Injects tracking pixels, wraps links with tracking parameters, and calls NodeMailer SMTP/Google transports or the Outlook Graph API to send emails.
