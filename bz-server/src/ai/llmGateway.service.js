/**
 * ============================================================================
 * LLM Gateway Service - Central AI Router
 * ============================================================================
 * Single entry point for all LLM interactions in NeoCode.
 *
 * Features:
 * - Multi-provider support (swap providers easily)
 * - Purpose-specific prompt routing
 * - Automatic retries with fallback
 * - Response caching
 * - Feature flag enforcement
 * - Error handling & timeouts
 *
 * Usage:
 * ```
 * const response = await llmGateway.generate({
 *   purpose: "coach",
 *   context: { weakTopics, mistakes },
 *   provider: "local" // optional
 * });
 * ```
 * ============================================================================
 */

import config from "../config/index.js";
import { pool } from "../database/connect.db.js";

// Import prompts
import { coachPrompt } from "./prompts/coach.prompt.js";
import { interviewPrompt } from "./prompts/interview.prompt.js";
import { codeReviewPrompt } from "./prompts/codeReview.prompt.js";
import { supportPrompt } from "./prompts/support.prompt.js";

class LLMGateway {
    /**
     * Initialize gateway with registered providers
     * @param {Object} providers - Map of provider name to provider instance
     */
    constructor(providers = {}) {
        this.providers = providers;
        this.defaultProvider = config.AI.DEFAULT_PROVIDER;
        this.cache = new Map(); // In-memory cache (TODO: Redis for production)
    }

    /**
     * Main generate method - routes to appropriate provider and prompt
     * @param {Object} params
     * @param {string} params.purpose - Purpose: "coach", "interview", "codeReview", "support"
     * @param {Object} params.context - Context data for prompt generation
     * @param {string} params.provider - Provider to use (default: config default)
     * @param {boolean} params.skipCache - Skip cache lookup
     * @returns {Promise<string>} Generated response
     */
    async generate({ purpose, context, provider = this.defaultProvider, skipCache = false }) {
        // Check if feature is enabled
        if (!this.isFeatureEnabled(purpose)) {
            throw new Error(`AI feature '${purpose}' is disabled. Enable it in config.`);
        }

        // Validate purpose
        if (!this.isValidPurpose(purpose)) {
            throw new Error(`Invalid AI purpose: ${purpose}. Valid: coach, interview, codeReview, support`);
        }

        // Check cache if enabled
        if (config.AI.CACHE_ENABLED && !skipCache) {
            const cached = this.getCached(purpose, context);
            if (cached) {
                console.log(`✅ LLMGateway: Cache hit for ${purpose}`);
                return cached;
            }
        }

        // Get provider instance
        const providerInstance = this.providers[provider];
        if (!providerInstance) {
            throw new Error(`Provider '${provider}' not found. Available: ${Object.keys(this.providers).join(", ")}`);
        }

        // Build prompt for the purpose
        const prompt = this.buildPrompt(purpose, context);

        // Generate with retries and fallback
        try {
            const response = await this.generateWithRetry(providerInstance, prompt, provider);

            // Cache response if enabled
            if (config.AI.CACHE_ENABLED) {
                this.setCached(purpose, context, response);
            }

            return response;
        } catch (error) {
            console.error(`❌ LLMGateway generation failed for ${purpose}:`, error.message);

            // Try fallback provider if configured
            if (provider !== this.defaultProvider) {
                console.log(`🔄 Trying fallback provider: ${this.defaultProvider}`);
                return this.generate({ purpose, context, provider: this.defaultProvider, skipCache });
            }

            // If all fails, return graceful fallback
            return this.getGracefulFallback(purpose);
        }
    }

    /**
     * Build prompt based on purpose
     */
    buildPrompt(purpose, context) {
        switch (purpose) {
            case "coach":
                return coachPrompt(context);
            case "interview":
                return interviewPrompt(context);
            case "codeReview":
                return codeReviewPrompt(context);
            case "support":
                return supportPrompt(context);
            default:
                throw new Error(`Unknown AI purpose: ${purpose}`);
        }
    }

    /**
     * Generate with automatic retry logic
     */
    async generateWithRetry(provider, prompt, providerName, retries = config.AI.MAX_RETRIES) {
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                console.log(`🤖 LLMGateway: Calling ${providerName} (attempt ${attempt + 1}/${retries + 1})`);

                const response = await provider.generate({ prompt });

                console.log(`✅ LLMGateway: Success with ${providerName}`);
                return response;
            } catch (error) {
                lastError = error;
                console.error(`⚠️ LLMGateway: Attempt ${attempt + 1} failed:`, error.message);

                // Don't retry on authentication/config errors
                if (error.message.includes("API key") || error.message.includes("not configured")) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(purpose) {
        const featureMap = {
            coach: config.AI.ENABLE_AI_COACH,
            interview: config.AI.ENABLE_AI_INTERVIEW,
            codeReview: config.AI.ENABLE_AI_CODE_REVIEW,
            support: config.AI.ENABLE_AI_SUPPORT,
        };

        return featureMap[purpose] ?? false;
    }

    /**
     * Validate purpose
     */
    isValidPurpose(purpose) {
        return ["coach", "interview", "codeReview", "support"].includes(purpose);
    }

    /**
     * Get cached response
     */
    getCached(purpose, context) {
        const cacheKey = this.getCacheKey(purpose, context);
        const cached = this.cache.get(cacheKey);

        if (!cached) return null;

        // Check if expired
        const now = Date.now();
        if (now - cached.timestamp > config.AI.CACHE_EXPIRY * 1000) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.response;
    }

    /**
     * Set cached response
     */
    setCached(purpose, context, response) {
        const cacheKey = this.getCacheKey(purpose, context);
        this.cache.set(cacheKey, {
            response,
            timestamp: Date.now(),
        });

        // Cleanup old cache entries periodically
        if (this.cache.size > 1000) {
            const entries = Array.from(this.cache.entries());
            const now = Date.now();
            entries.forEach(([key, value]) => {
                if (now - value.timestamp > config.AI.CACHE_EXPIRY * 1000) {
                    this.cache.delete(key);
                }
            });
        }
    }

    /**
     * Generate cache key from purpose and context
     */
    getCacheKey(purpose, context) {
        // Create stable key from context
        const contextString = JSON.stringify(context, Object.keys(context).sort());
        return `${purpose}:${this.simpleHash(contextString)}`;
    }

    /**
     * Simple hash function for cache keys
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Graceful fallback when all providers fail
     */
    getGracefulFallback(purpose) {
        const fallbacks = {
            coach: "I'm having trouble connecting to the AI coach right now. Please check your Learning Profile for detailed analytics, or try again in a moment.",
            interview:
                "The AI interviewer is temporarily unavailable. Please try the practice problems section instead.",
            codeReview:
                "AI code review is currently unavailable. Your code is correct! Consider reviewing best practices documentation.",
            support:
                "I'm experiencing connectivity issues. Please check our documentation or contact support for assistance.",
        };

        return fallbacks[purpose] || "AI service is temporarily unavailable. Please try again later.";
    }

    /**
     * Get gateway status (providers availability)
     */
    async getStatus() {
        const status = {
            providers: {},
            config: {
                defaultProvider: this.defaultProvider,
                cacheEnabled: config.AI.CACHE_ENABLED,
                cacheSize: this.cache.size,
            },
            features: {
                coach: config.AI.ENABLE_AI_COACH,
                interview: config.AI.ENABLE_AI_INTERVIEW,
                codeReview: config.AI.ENABLE_AI_CODE_REVIEW,
                support: config.AI.ENABLE_AI_SUPPORT,
            },
        };

        // Check each provider availability
        for (const [name, provider] of Object.entries(this.providers)) {
            try {
                const available = await provider.isAvailable();
                status.providers[name] = {
                    available,
                    config: provider.getConfig(),
                };
            } catch (error) {
                status.providers[name] = {
                    available: false,
                    error: error.message,
                };
            }
        }

        return status;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log("🗑️ LLMGateway: Cache cleared");
    }
}

export default LLMGateway;
