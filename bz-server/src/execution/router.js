import { execute as executeDocker } from "./providers/docker.provider.js";
import { execute as executeJudge0 } from "./providers/judge0.provider.js";

const PROVIDERS = {
  docker: executeDocker,
  judge0: executeJudge0,
};

export async function execute(code, language, stdin, testId) {
  const providerName = (process.env.CODE_EXECUTION_PROVIDER || "docker").toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Unknown execution provider: ${providerName}`);
  }

  console.log(`[Execution] Provider: ${providerName}`);

  // Phase 2: replace env read with: await settingsService.get('execution_provider')

  return provider(code, language, stdin, testId);
}
