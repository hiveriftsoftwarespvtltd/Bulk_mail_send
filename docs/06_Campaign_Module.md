# 06. Campaign Module

This document explains the campaign module lifecycle, states, API methods, statistics calculation, and tracking mechanisms.

---

## 1. Campaign Lifecycle & State Transitions

A campaign transitions through the following statuses:

```
          ┌─────────────┐
          │    DRAFT    │  (Draft campaign created with contacts)
          └──────┬──────┘
                 │
                 │ Start Campaign
                 ▼
          ┌─────────────┐
   ┌─────►│   ACTIVE    │  (Enqueued or running immediately)
   │      └──────┬──────┘
   │             │
   │             │ Start with scheduled date in future
   │             ▼
   │      ┌─────────────┐
   │      │  SCHEDULED  │  (Waiting for future scheduled date)
   │      └──────┬──────┘
   │             │
   │             │ Scheduler window matches
   │             ▼
   │      ┌─────────────┐
   │ ┌───►│   SENDING   │  (Looping through contacts)
   │ │    └──────┬──────┘
   │ │           │
   │ │ Pause     │ All contacts processed
   │ │           ▼
   │ │    ┌─────────────┐
   │ └────┤   PAUSED    │
   │      └─────────────┘
   │
   │ Finish
   ▼
┌─────────────┐
│  FINISHED   │  (Campaign completed successfully)
└─────────────┘
```

---

## 2. Main Campaign Endpoints

The module is handled by [CreateCampaignController](file:///d:/mail%20send%20testing/bulk_mail_send/backend/src/create-campaign/create-campaign.controller.ts):

* **`POST /create-campaign/upload`**: Accepts a contact list CSV file, saves it to the `/uploads` directory, parses its headers, and returns them to the frontend.
* **`POST /create-campaign/create`**: Creates the campaign record in MongoDB, maps CSV headers to database fields (Email, Owner, Company), and saves the contact array.
* **`POST /create-campaign/:id/start`**: Calculates the start time, switches status to `ACTIVE` (or `SCHEDULED`), and enqueues the dispatch task into the Bull Queue.
* **`POST /create-campaign/:id/pause`**: Pauses email sending by changing the status in the database to `PAUSED`. The background loop checks this status on each iteration and stops processing if paused.
* **`POST /create-campaign/:id/resume`**: Resets the status to `SENDING` and enqueues the campaign back into the queue from its last recorded `currentIndex`.
* **`POST /create-campaign/:id/restart`**: Resets `currentIndex` to `0`, sets status to `SENDING`, and enqueues the campaign for dispatch.

---

## 3. Real-Time Telemetry & Statistics
When campaigns list or statistics are requested, the service computes metrics by querying the `EmailLog` collection:
* **Sent**: Total logs matching the campaign ID:
  `this.emailLogModel.countDocuments({ companyId, campaignId })`
* **Opened**: Total logs with status `OPENED`, `CLICKED`, or `REPLIED`.
* **Replied**: Total logs with status `REPLIED`.
* **Clicked**: Total logs with status `CLICKED`.
* **Domain Breakdown**: Aggregates metrics grouped by the domain part of the sender's email (e.g. gmail.com, outlook.com) to help monitor deliverability and identify provider-specific blocks.
  ```javascript
  // Group logs by domain part of the email address:
  const domainStats = await this.emailLogModel.aggregate([
    { $match: { campaignId, companyId } },
    { $project: { status: 1, domain: { $arrayElemAt: [{ $split: ["$smtpEmail", "@"] }, 1] } } },
    { $group: { _id: "$domain", totalSent: { $sum: 1 }, ... } }
  ]);
  ```
