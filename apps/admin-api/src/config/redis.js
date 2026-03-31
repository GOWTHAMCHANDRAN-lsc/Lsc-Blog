const Redis = require('ioredis');
const logger = require('./logger');

const memoryStore = new Map();
let redisAvailable = false;
let fallbackLogged = false;

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableReadyCheck: false,
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: null,
});

function logFallback(err) {
  if (fallbackLogged) {
    return;
  }
  fallbackLogged = true;
  const message = err?.message || 'connection unavailable';
  logger.warn(`Redis unavailable, using in-memory fallback: ${message}`);
}

function markRedisAvailable() {
  redisAvailable = true;
  fallbackLogged = false;
}

redis.on('connect', () => {
  markRedisAvailable();
  logger.info('Redis connected');
});

redis.on('ready', () => {
  markRedisAvailable();
});

redis.on('error', err => {
  redisAvailable = false;
  logFallback(err);
});

redis.on('end', () => {
  redisAvailable = false;
  logFallback(new Error('connection ended'));
});

redis.connect().catch(err => {
  redisAvailable = false;
  logFallback(err);
});

function getMemoryRecord(key) {
  const record = memoryStore.get(key);
  if (!record) {
    return null;
  }
  if (record.expiresAt && record.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return record;
}

function setMemoryRecord(key, value, ttlSeconds = null) {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

function deleteMemoryKey(key) {
  return memoryStore.delete(key) ? 1 : 0;
}

async function runWithFallback(redisOperation, fallbackOperation) {
  if (redisAvailable) {
    try {
      return await redisOperation();
    } catch (err) {
      redisAvailable = false;
      logFallback(err);
    }
  }

  return fallbackOperation();
}

async function get(key) {
  const value = await runWithFallback(
    () => redis.get(key),
    () => {
      const record = getMemoryRecord(key);
      return record ? record.value : null;
    }
  );

  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function set(key, value, ttlSeconds = null) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return runWithFallback(
    () =>
      ttlSeconds
        ? redis.setex(key, ttlSeconds, serialized)
        : redis.set(key, serialized),
    () => {
      setMemoryRecord(key, serialized, ttlSeconds);
      return 'OK';
    }
  );
}

async function setex(key, ttlSeconds, value) {
  return set(key, value, ttlSeconds);
}

async function del(key) {
  return runWithFallback(
    () => redis.del(key),
    () => deleteMemoryKey(key)
  );
}

async function invalidatePattern(pattern) {
  return runWithFallback(
    async () => {
      const keys = await redis.keys(pattern);
      if (keys.length) {
        await redis.del(...keys);
      }
      return keys.length;
    },
    () => {
      const regex = new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
      );
      let deleted = 0;
      for (const key of memoryStore.keys()) {
        if (regex.test(key)) {
          memoryStore.delete(key);
          deleted += 1;
        }
      }
      return deleted;
    }
  );
}

async function incr(key) {
  return runWithFallback(
    () => redis.incr(key),
    () => {
      const current = parseInt(getMemoryRecord(key)?.value || '0', 10) || 0;
      const nextValue = current + 1;
      const existing = getMemoryRecord(key);
      memoryStore.set(key, {
        value: String(nextValue),
        expiresAt: existing?.expiresAt ?? null,
      });
      return nextValue;
    }
  );
}

async function expire(key, seconds) {
  return runWithFallback(
    () => redis.expire(key, seconds),
    () => {
      const record = getMemoryRecord(key);
      if (!record) {
        return 0;
      }
      record.expiresAt = Date.now() + seconds * 1000;
      memoryStore.set(key, record);
      return 1;
    }
  );
}

async function ttl(key) {
  return runWithFallback(
    () => redis.ttl(key),
    () => {
      const record = getMemoryRecord(key);
      if (!record) {
        return -2;
      }
      if (!record.expiresAt) {
        return -1;
      }
      return Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000));
    }
  );
}

function isAvailable() {
  return redisAvailable;
}

module.exports = {
  redis,
  get,
  set,
  setex,
  del,
  invalidatePattern,
  incr,
  expire,
  ttl,
  isAvailable,
};
