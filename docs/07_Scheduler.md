# 07. Scheduler Module

This document explains the timezone offset logic, allowed sending windows, daily volume limits, and the scheduling mechanism of the outreach campaign system.

---

## 1. Timezone offset Calculations
The scheduler handles local timezone conversions using native JavaScript APIs.

```
[Date Input + Time String] ──► Date.UTC(Base Time) ──► Calculate Offset via Intl ──► Output UTC Date
```

* **Calculation Method**: `getScheduledDateInTimezone` creates a base date in UTC using the target year, month, day, hour, and minute. It then uses `Intl.DateTimeFormat` with the user's timezone to extract the offset (e.g. `GMT+05:30`), calculates the offset in milliseconds, and subtracts it from the base date to get the correct UTC execution time.

---

## 2. Dispatch Guardrails (`checkScheduleGuardrails`)
Before sending each email in the queue, the worker runs validation checks to ensure compliance with the campaign settings:

### A. Allowed Sending Days (`sendDays`)
* Checks if today's weekday (in the target timezone) is included in the campaign's `sendDays` array (e.g., `['Monday', 'Tuesday']`).
* If today is not an allowed day, it calculates the number of days until the next allowed day and schedules the campaign to resume at the start of the allowed sending window.

### B. Sending Time Window (`from` to `to`)
* Compares the current local time with the allowed daily sending window (defined by `from` and `to` times, e.g., `09:00` and `18:00`).
* If the current time is before the window starts, it delays the campaign until the start time.
* If the current time is after the window ends, it delays the campaign until the window opens the following day.

### C. Daily Volume Limits (`maxLeadsPerDay`)
* Counts the number of emails sent for the campaign since the start of the day in the target timezone.
* If the count is equal to or greater than the limit, it pauses the campaign and schedules it to resume the next day.

---

## 3. Worker Re-enqueueing Logic
If a campaign is delayed by the scheduler checks, the worker pauses the sending loop and updates the campaign status:
1. Sets campaign status to `SCHEDULED`.
2. Computes the delay (`delayMs`) until the campaign should resume.
3. Updates `scheduledAt` to the calculated resume time.
4. Enqueues a new `process-campaign` job in the Bull queue with the calculated delay.
5. If Redis is down, it schedules the resume task using a fallback `setTimeout` timer.

```typescript
// Scheduler execution flow:
const guard = await this.checkScheduleGuardrails(freshCampaign, workspaceId);
if (guard.shouldDelay) {
    await this.campaignModel.findByIdAndUpdate(campaign._id, {
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + guard.delayMs),
        currentIndex: i // Tracks the current progress for when the campaign resumes
    });

    await this.campaignQueue.add('process-campaign', jobData, { delay: guard.delayMs });
    return; // Exit loop
}
```
