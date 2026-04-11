# Redis & BullMQ (optional, low / no cost)

The backend currently runs **without** Redis. When you add **caching**, **BullMQ** (certificates, emails, bulk jobs), you need a Redis-compatible URL.

## Recommended: Upstash (free tier)

- **Upstash** offers a **generous free tier** for serverless Redis (suitable for hobby / early production).
- Create a database at [upstash.com](https://upstash.com), copy the **Redis URL** (often `rediss://...`).
- Set in Railway (backend service):

  `REDIS_URL=rediss://default:...@...upstash.io:6379`

- Use **`ioredis`** with that URL from Node; **BullMQ** uses the same connection.

**Pros:** No card required for the free tier in many regions, works from Railway/Vercel serverless or long-running Node.

## Alternatives

- **Redis Cloud**: free small instance (limits apply); fine for dev.
- **Railway Redis plugin**: convenient if you already use Railway; check current **pricing** (may not stay $0).
- **Local Redis** (`docker run redis`) for development only — do not rely on it in production.

## When you are not ready for Redis

- Skip BullMQ initially; run **light** work synchronously or use **setImmediate** for non-critical tasks.
- For **certificates**, keep generating in a **background** path once Redis is available.

## Environment variables (future)

```bash
# Optional until Redis is provisioned
REDIS_URL=
# BullMQ prefix (optional)
BULLMQ_PREFIX=funt
```

No secrets in the repo — only set these in Railway / local `.env`.
