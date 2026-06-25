# 09. Queue Architecture & Workers

This document details the background task execution architecture, Redis connection settings, and worker failure recovery patterns.

---

## 1. Bull Queue Configuration
Mailpipes uses **Bull** and **Redis** to handle campaign dispatch tasks asynchronously in the background.

* **Module Registration**: Configured in [app.module.ts](file:///d:/mail%20send%20testing/bulk_mail_send/backend/src/app.module.ts). The Bull module connects asynchronously to Redis using parameters defined in the environment variables:
  ```typescript
  BullModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => ({
      redis: {
        host: configService.get<string>('REDIS_HOST') || 'localhost',
        port: configService.get<number>('REDIS_PORT') || 6379,
      },
    }),
    inject: [ConfigService],
  })
  ```
* **Queue Definition**: Registers a single queue named `campaign` to manage all outreach dispatch tasks.

---

## 2. Background Worker Processor
* **Worker File**: [campaign.processor.ts](file:///d:/mail%20send%20testing/bulk_mail_send/backend/src/create-campaign/processors/campaign.processor.ts)
* **Decorator**: `@Processor('campaign')`
* **Concurrency**: Set to 50 concurrent jobs (`@Process({ name: 'process-campaign', concurrency: 50 })`). This allows the worker to run multiple campaigns in parallel.
* **Process Entry**: Consumes jobs, extracts the campaign data, and invokes the `runCampaignJob` service method.
  ```typescript
  @Process({ name: 'process-campaign', concurrency: 50 })
  async handleProcessCampaign(job: Job) {
    console.log(`🎯 Processing background job for campaign: ${job.data.campaignId}`);
    await this.campaignService.runCampaignJob(job.data);
  }
  ```

---

## 3. Worker Execution Flow

```
[Bull Queue Job]
       │
       ▼
[runCampaignJob] ──► Refresh Google/Outlook Tokens ──► Initialize Transporters
                                                            │
                                                            ▼
                                                 [processCampaignSending]
                                                            │
                                                            ▼
                                                    Sequential Loop
                                                (Checks PAUSE status)
                                                            │
                                                            ▼
                                                Wait for delayMinutes
                                                            │
                                                            ▼
                                                  Mark as FINISHED
```

---

## 4. Redis Offline Fallback Mechanics
If Redis is down or unreachable when a campaign starts, the application handles the failure with an in-memory fallback mechanism:
1. It logs a warning about the Redis status:
   `⚠️ Redis is NOT ready. Falling back to Sync Mode.`
2. Instead of enqueuing a Bull job, it schedules the dispatch task using a standard JavaScript timer:
   ```typescript
   setTimeout(() => {
     this.runCampaignJob(jobData).catch(err => console.error(err));
   }, delayMs);
   ```
3. This allows the application to keep sending emails even if Redis is down, but it runs tasks in the main HTTP request thread, which lacks retry options and will crash if the server restarts.
