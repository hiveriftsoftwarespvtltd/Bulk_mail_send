# 04. Database Architecture

This document describes the MongoDB collections, Mongoose schemas, indexes, relationships, and data growth implications of the Mailpipes application.

---

## 1. Mongoose Collections & Schema Fields

### A. Users (`users` Collection)
Stores administrative user accounts.

| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key |
| `fullName` | String | User's display name |
| `email` | String (Unique) | Login identity |
| `password` | String | Bcrypt hashed password |
| `companyId` | String | Multi-tenant company identifier |
| `role` | String (Default: 'admin') | Access control role |
| `signature` | String | Email footer signature |
| `resetPasswordToken` | String | Password recovery token |
| `resetPasswordExpiry`| Date | Expiry time of recovery token |

* **Indexes**: `{ email: 1 }` (Unique).

---

### B. CreateCampaign (`createcampaigns` Collection)
Stores campaign settings, drafts, schedules, and embedded lead contacts.

| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key |
| `userId` | String | Owner identifier |
| `workspaceId` | String | Tenant ID |
| `subject` | String | Template subject line |
| `body` | String | HTML email template |
| `name` | String | Campaign display name |
| `status` | String | Enum: `DRAFT`, `ACTIVE`, `SCHEDULED`, `SENDING`, `PAUSED`, `FINISHED` |
| `currentIndex` | Number | Current send offset |
| `contacts` | Array | Inline list of leads objects |
| `companyField` | String | Mapping key for Company |
| `ownerField` | String | Mapping key for Owner |
| `emailField` | String | Mapping key for Email |
| `delayMinutes` | Number | Delay between dispatches |
| `scheduledAt` | Date | Projected launch timestamp |
| `startedAt` | Date | Dispatch start timestamp |
| `finishedAt` | Date | Completion timestamp |
| `timezone` | String | Target timezone |
| `sendDays` | [String] | Allowed sending weekdays |
| `from` | String | Window start (HH:MM) |
| `to` | String | Window end (HH:MM) |
| `intervalMinutes` | Number | Time spacing calculated |
| `maxLeadsPerDay` | Number | Daily cap |
| `trackingDomainId`| String | Associated tracking domain |
| `selectedAccountIds`| [String] | Sender accounts rotated |

* **Indexes**: None explicitly defined beyond default `_id`.

---

### C. EmailLog (`emaillogs` Collection)
Tracks delivery logs, status updates, open/click telemetry, and recipient device details.

| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key |
| `smtpEmail` | String | Sender address |
| `companyId` | String | Tenant ID (Indexed) |
| `recipient` | String | Target recipient email |
| `subject` | String | Delivered subject |
| `message` | String | Fully generated custom HTML body |
| `status` | String | Enum: `SENT`, `OPENED`, `CLICKED`, `REPLIED`, `BOUNCED` |
| `trackingId` | String (Unique)| Telemetry tracking correlation key |
| `messageId` | String | Outbound email header Message-ID |
| `provider` | String | Enum: `SMTP`, `GOOGLE`, `OUTLOOK` |
| `openedAt` | Date | Timestamp of first open |
| `clickedAt` | Date | Timestamp of first link click |
| `ipAddress` | String | Target client device IP address |
| `device` | String | Derived device (Mobile/Tablet/Desktop) |
| `campaignId` | String | Associated campaign (Indexed) |

* **Indexes**:
  * `{ companyId: 1 }`
  * `{ campaignId: 1 }`
  * `{ trackingId: 1 }` (Unique)

---

### D. SmtpSender (`smtpsenders` Collection)
Stores outbound SMTP configurations.

| Field | Type | Description |
| :--- | :--- | :--- |
| `tenantId` | String | Multi-tenant ID (Indexed) |
| `fromName` | String | Sender display name |
| `fromEmail` | String | Sender email address |
| `userName` | String | SMTP auth username |
| `password` | String | Plaintext SMTP password |
| `smtpHost` | String | Outbound host address |
| `smtpPort` | Number | Port number |
| `smtpSecurity` | String | Enum: `SSL`, `TLS`, `NONE` |
| `messagePerDay`| Number | Outbox cap |
| `minTimeGap` | Number | Forced delay minutes |
| `replyTo` | String | Custom reply-to address |

---

### E. GoogleMail (`googlemails` Collection) & OutlookMail (`outlookmails` Collection)
Stores OAuth account connections.

| Field | Type | Description |
| :--- | :--- | :--- |
| `tenantId` | String | Multi-tenant ID (Indexed) |
| `email` | String | Connected email address |
| `name` | String | Connected user name |
| `accessToken` | String | API access token |
| `refreshToken`| String | API refresh token |

---

## 2. Collection Relationships (ERD)

```
   ┌──────────────┐             ┌─────────────────────┐
   │    Users     │             │    TrackingDomain   │
   └──────┬───────┘             └──────────┬──────────┘
          │ 1                              │ 1
          │                                │
          │ 1:N                            │ 1:N
   ┌──────▼───────┐ 1:N             ┌──────▼──────────┐
   │ SmtpSenders  ├────────┐        │ CreateCampaigns │
   │ GoogleMails  │        │        └──────┬──────────┘
   │ OutlookMails │        │               │ 1
   └──────────────┘        │               │
                           │ 1:N           │ 1:N
                           │        ┌──────▼──────────┐
                           └───────►│    EmailLogs    │
                                    └─────────────────┘
```

---

## 3. Database Bottlenecks & Optimization Plan
* **Missing Compound Indexes**: Endpoints querying stats by campaign require a compound index: `{ companyId: 1, campaignId: 1, status: 1 }` to bypass full collection scans.
* **Document Size Overflow**: Storing `contacts: any[]` inside the campaign collection will fail when BSON document sizes exceed MongoDB's 16MB limit. Contacts must be moved to a separate collection.
* **Email Message Bloat**: Logging the complete customized email HTML in `message` under `EmailLog` results in rapid disk space consumption.
