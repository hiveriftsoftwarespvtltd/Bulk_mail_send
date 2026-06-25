# 15. Deployment & Production Operations

This document covers deployment configurations, reverse proxy settings, PM2 process management, and backup strategies.

---

## 1. PM2 Process Configuration
For bare-metal or VM deployments, use PM2 to manage processes, handle auto-restarts on crashes, and scale instances.

* **File Location**: `/ecosystem.config.js`
* **Configuration**:
  ```javascript
  module.exports = {
    apps: [
      {
        name: 'mailpipes-backend',
        script: 'dist/main.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
          PORT: 9000
        }
      }
    ]
  };
  ```

---

## 2. Nginx Reverse Proxy & SSL Configuration
Nginx handles SSL termination, redirects HTTP traffic to HTTPS, and proxies requests to the backend PM2 cluster.

### Nginx Configuration Example
```nginx
server {
    listen 80;
    server_name api.mailpipes.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mailpipes.online;

    ssl_certificate /etc/letsencrypt/live/api.mailpipes.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mailpipes.online/privkey.pem;

    client_max_body_size 15M; # Support large CSV uploads

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        
        # Headers required for trust proxy IP mapping:
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Database Persistence & Backup

### A. Redis Persistence Settings
Configure Redis to write keys to disk regularly, preventing campaign state loss on Redis crashes.
* Edit `/etc/redis/redis.conf`:
  ```ini
  appendonly yes
  appendfsync everysec
  ```

### B. MongoDB Backup Script
Set up a daily cron job to back up the MongoDB database using `mongodump` and upload the archive to secure remote storage:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
MONGODB_URI="mongodb://localhost:27017/mailpipes"

mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGODB_URI" --archive="$BACKUP_DIR/mailpipes_$DATE.gz" --gzip

# Keep backups for 7 days
find "$BACKUP_DIR" -type f -mtime +7 -name "*.gz" -delete
```

---

## 4. Docker Deployment Setup

### Backend Dockerfile (`Dockerfile`)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 9000
CMD ["node", "dist/main.js"]
```
