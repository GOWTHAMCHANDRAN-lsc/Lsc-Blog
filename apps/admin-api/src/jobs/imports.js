const { getImportsQueue } = require('./queues');
const logger = require('../config/logger');

async function enqueueImportJob({
  tenantId,
  jobId,
  type,
  filePath,
  requestedBy,
}) {
  const queue = await getImportsQueue();
  if (!queue) {
    logger.warn('Imports queue unavailable; job will not run automatically');
    return { mode: 'fallback' };
  }

  await queue.add(
    'run-import',
    { tenantId, jobId, type, filePath, requestedBy },
    { jobId: `import-${jobId}`, removeOnComplete: true, removeOnFail: true }
  );

  return { mode: 'bullmq', jobId: `import-${jobId}` };
}

module.exports = { enqueueImportJob };
