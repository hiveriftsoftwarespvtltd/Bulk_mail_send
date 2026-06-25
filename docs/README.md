# Mailpipes: Backend Codebase Documentation Index

Welcome to the Mailpipes NestJS API technical documentation. This directory contains detailed architectural, module, API, and database specifications for the Bulk Email SaaS backend application.

---

## Documentation Manifest

| Document | Purpose | Core Content |
| :--- | :--- | :--- |
| **[00. Backend Project Overview](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/00_Project_Overview.md)** | Scope & Tech Stack | Technical stack summary, core features, request lifecycles. |
| **[01. Backend Folder Structure](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/01_Folder_Structure.md)** | Codebase Organization | File trees mapping, responsibilities of directories. |
| **[02. Backend Architecture](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/02_Backend_Architecture.md)** | NestJS Components | Pipeline structures (validation, guard, exception filters), and diagrams. |
| **[04. Database Architecture](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/04_Database.md)** | MongoDB Schemas | Database collections, schema types, indexes, and relationships. |
| **[05. Authentication & Authorization](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/05_Authentication.md)** | Session Management | JWT validation strategy, password recovery, and multi-tenant isolation. |
| **[06. Campaign Module](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/06_Campaign_Module.md)** | Campaigns Lifecycle | Campaign statuses, control endpoints, and analytics aggregations. |
| **[07. Scheduler Module](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/07_Scheduler.md)** | Scheduling Constraints | Timezone conversions, daily sending windows, and daily limits. |
| **[08. Email Sending & Tracking](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/08_Email_Sending.md)** | Delivery Channels | SMTP, Gmail, Outlook Graph API, tracking pixels, and link wrapping. |
| **[09. Queue Architecture & Workers](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/09_Bull_Queue.md)** | Async Workflows | Bull queue settings, worker concurrency, and Redis fallback. |
| **[10. Google OAuth Integration](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/10_OAuth_Google.md)** | Gmail Connectivity | Consent settings, state mappings, and token refresh logic. |
| **[11. Outlook & Graph Integration](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/11_OAuth_Outlook.md)** | Microsoft Connectivity | Azure App permissions, access scopes, and REST API connections. |
| **[12. API Reference](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/12_API_Documentation.md)** | API Endpoint Catalog | Complete routes catalog with request payloads and responses. |
| **[13. Environment Variables](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/13_Environment.md)** | Server Configurations | Key lists of required/optional variables. |
| **[14. Core User Workflows](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/14_Workflows.md)** | Sequential User Flows | Registration, mailbox connection, campaign execution, and tracking. |
| **[15. Deployment & Operations](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/15_Deployment.md)** | Production Deployment | PM2 config, Nginx SSL proxy, Docker, and persistence configurations. |
| **[16. Known Issues](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/16_Known_Issues.md)** | Bugs & Vulnerabilities | Plaintext credentials, document size crash risks, XSS, and thread locks. |

---

## Quick Start for New Developers
1. Read **[00. Backend Project Overview](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/00_Project_Overview.md)** to understand the system architecture.
2. Review **[13. Environment Variables](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/13_Environment.md)** to set up your local `.env` configuration.
3. Understand database fields and constraints in **[04. Database Architecture](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/04_Database.md)**.
4. Review **[16. Known Issues](file:///d:/mail%20send%20testing/bulk_mail_send/backend/docs/16_Known_Issues.md)** before writing code to avoid introducing security issues or performance bottlenecks.
