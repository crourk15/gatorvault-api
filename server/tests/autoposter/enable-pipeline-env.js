/** Enable pipeline kill switches for autoposter integration tests. */
const PIPELINE_ENV_KEYS = [
  'X_PIPELINES_ENABLED',
  'X_GM2_REWRITE_ENABLED',
  'X_INTEL_REWRITE_ENABLED',
  'X_AUTOPROMPT_ENABLED'
];

function enablePipelineEnvForTests() {
  const saved = {};
  for (const key of PIPELINE_ENV_KEYS) {
    saved[key] = process.env[key];
    process.env[key] = 'true';
  }
  return saved;
}

function restorePipelineEnv(saved) {
  for (const key of PIPELINE_ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

module.exports = { enablePipelineEnvForTests, restorePipelineEnv, PIPELINE_ENV_KEYS };
