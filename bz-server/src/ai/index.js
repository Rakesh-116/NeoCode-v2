/**
 * ============================================================================
 * AI MODULE - Main Export & Initialization
 * ============================================================================
 * Central export point for NeoCode AI infrastructure.
 *
 * This module provides:
 * - LLM provider registry (Ollama, OpenAI, Gemini)
 * - LLM Gateway service (multi-purpose AI router)
 * - Easy provider swapping with minimal config changes
 *
 * Architecture:
 * - Providers: Pluggable LLM backends (local or cloud)
 * - Gateway: Routes requests to appropriate provider
 * - Prompts: Purpose-specific prompt engineering
 *
 * Usage across NeoCode:
 * ```
 * import llmGateway from './ai/index.js';
 *
 * const response = await llmGateway.generate({
 *   purpose: "coach",
 *   context: { weakTopics, mistakes }
 * });
 * ```
 * ============================================================================
 */

import config from "../config/index.js";

// Import providers
import OllamaProvider from "./providers/OllamaProvider.js";
import OpenAIProvider from "./providers/OpenAIProvider.js";
import GeminiProvider from "./providers/GeminiProvider.js";

// Import gateway
import LLMGateway from "./llmGateway.service.js";

/**
 * Provider Registry
 * Add/remove providers here to change available LLM backends
 */
const providers = {
    local: new OllamaProvider(),
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider(),
};

/**
 * Initialize LLM Gateway with providers
 */
const llmGateway = new LLMGateway(providers);

/**
 * Initialize AI module
 * Call this on server startup
 */
export async function initializeAI() {
    console.log("🤖 Initializing NeoCode AI Module...");

    try {
        // Check provider availability
        const status = await llmGateway.getStatus();

        console.log("📦 Registered Providers:");
        Object.entries(status.providers).forEach(([name, info]) => {
            const icon = info.available ? "✅" : "❌";
            console.log(`   ${icon} ${name}: ${info.available ? "Available" : "Unavailable"}`);
        });

        console.log("\n⚙️ AI Features:");
        Object.entries(status.features).forEach(([feature, enabled]) => {
            const icon = enabled ? "✅" : "⚪";
            console.log(`   ${icon} ${feature}: ${enabled ? "Enabled" : "Disabled"}`);
        });

        console.log(`\n🎯 Default Provider: ${status.config.defaultProvider}`);
        console.log(`💾 Cache: ${status.config.cacheEnabled ? "Enabled" : "Disabled"}`);

        // Warn if default provider is unavailable
        const defaultAvailable = status.providers[status.config.defaultProvider]?.available;
        if (!defaultAvailable) {
            console.warn(`\n⚠️ WARNING: Default provider '${status.config.defaultProvider}' is not available!`);

            // Find first available provider
            const availableProvider = Object.entries(status.providers).find(([_, info]) => info.available);
            if (availableProvider) {
                console.log(`💡 Suggestion: Set AI_DEFAULT_PROVIDER=${availableProvider[0]} in .env`);
            } else {
                console.log(`💡 No providers available. AI features will use fallback responses.`);
            }
        }

        console.log("\n✅ AI Module initialized successfully\n");
        return true;
    } catch (error) {
        console.error("❌ Failed to initialize AI Module:", error);
        console.log("⚠️ AI features will be degraded (fallback mode)\n");
        return false;
    }
}

/**
 * Export gateway as default
 * This is what other modules import
 */
export default llmGateway;

/**
 * Named exports for advanced usage
 */
export { llmGateway, providers, OllamaProvider, OpenAIProvider, GeminiProvider };
