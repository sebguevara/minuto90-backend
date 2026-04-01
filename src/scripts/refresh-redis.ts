export {};

const rawScope = (process.argv[2] || 'full').trim().toLowerCase();
const scope = rawScope === 'football' ? 'scheduled' : rawScope;

if (!['full', 'scheduled'].includes(scope)) {
  console.error(`Invalid scope "${rawScope}". Use "full" or "football".`);
  process.exit(1);
}

process.env.PREWARM_RUN_ON_STARTUP = 'true';
process.env.PREWARM_EXIT_AFTER_RUN = 'true';
process.env.PREWARM_MODE = scope;

await import('../workers/daily-prewarm.worker');
