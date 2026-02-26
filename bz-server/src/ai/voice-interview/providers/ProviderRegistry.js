/**
 * ============================================================================
 * Voice Interview Provider Registry
 * ============================================================================
 * Centralized registry for managing STT, TTS, and Interview LLM providers
 *
 * Responsibilities:
 * - Register/unregister providers
 * - Get active providers by type
 * - Load providers from database configuration
 * - Health check all providers
 * ============================================================================
 */

import { pool } from "../../../database/connect.db.js";

// Import providers
import WhisperSTTProvider from "./WhisperSTTProvider.js";
import PiperTTSProvider from "./PiperTTSProvider.js";
import OllamaInterviewLLM from "./OllamaInterviewLLM.js";

class VoiceProviderRegistry {
    constructor() {
        this.providers = {
            stt: new Map(),
            tts: new Map(),
            llm_interview: new Map(),
        };
        this.initialized = false;
    }

    /**
     * Initialize registry with default providers
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            console.log("[VoiceProviderRegistry] Already initialized");
            return;
        }

        console.log("[VoiceProviderRegistry] Initializing voice providers...");

        try {
            // Register default providers
            await this.registerDefaultProviders();

            // Load additional providers from database
            await this.loadProvidersFromDB();

            this.initialized = true;
            console.log("[VoiceProviderRegistry] ✅ Initialization complete");
            console.log(`   STT Providers: ${this.providers.stt.size}`);
            console.log(`   TTS Providers: ${this.providers.tts.size}`);
            console.log(`   Interview LLM Providers: ${this.providers.llm_interview.size}`);
        } catch (error) {
            console.error("[VoiceProviderRegistry] ❌ Initialization failed:", error.message);
            throw error;
        }
    }

    /**
     * Register default providers
     * @private
     * @returns {Promise<void>}
     */
    async registerDefaultProviders() {
        // STT: Whisper
        const whisperSTT = new WhisperSTTProvider();
        this.register("stt", "whisper", whisperSTT);

        // TTS: Piper
        const piperTTS = new PiperTTSProvider();
        this.register("tts", "piper", piperTTS);

        // Interview LLM: Ollama
        const ollamaLLM = new OllamaInterviewLLM();
        this.register("llm_interview", "ollama", ollamaLLM);

        console.log("[VoiceProviderRegistry] Default providers registered");
    }

    /**
     * Load provider configurations from database
     * @private
     * @returns {Promise<void>}
     */
    async loadProvidersFromDB() {
        try {
            const result = await pool.query(`
                SELECT provider_type, provider_name, config, is_active, is_default
                FROM ai_voice_providers
                WHERE is_active = true
                ORDER BY priority DESC
            `);

            console.log(`[VoiceProviderRegistry] Loaded ${result.rows.length} provider configs from DB`);

            // Update configs for existing providers
            for (const row of result.rows) {
                const provider = this.get(row.provider_type, row.provider_name);
                if (provider) {
                    console.log(`   Config loaded for ${row.provider_type}:${row.provider_name}`);
                }
            }
        } catch (error) {
            console.warn("[VoiceProviderRegistry] Failed to load from DB:", error.message);
            // Non-fatal: we can work with defaults
        }
    }

    /**
     * Register a provider
     * @param {string} type - Provider type ('stt', 'tts', 'llm_interview')
     * @param {string} name - Provider name
     * @param {Object} providerInstance - Provider instance
     */
    register(type, name, providerInstance) {
        if (!this.providers[type]) {
            throw new Error(`Invalid provider type: ${type}`);
        }

        this.providers[type].set(name, providerInstance);
        console.log(`[VoiceProviderRegistry] Registered ${type} provider: ${name}`);
    }

    /**
     * Unregister a provider
     * @param {string} type - Provider type
     * @param {string} name - Provider name
     */
    unregister(type, name) {
        if (!this.providers[type]) {
            throw new Error(`Invalid provider type: ${type}`);
        }

        this.providers[type].delete(name);
        console.log(`[VoiceProviderRegistry] Unregistered ${type} provider: ${name}`);
    }

    /**
     * Get a specific provider
     * @param {string} type - Provider type
     * @param {string} name - Provider name
     * @returns {Object|null} Provider instance
     */
    get(type, name) {
        if (!this.providers[type]) {
            throw new Error(`Invalid provider type: ${type}`);
        }

        return this.providers[type].get(name) || null;
    }

    /**
     * Get default provider for a type
     * @param {string} type - Provider type
     * @returns {Promise<Object|null>} Default provider
     */
    async getDefault(type) {
        try {
            // Check database for default
            const result = await pool.query(
                `
                SELECT provider_name 
                FROM ai_voice_providers 
                WHERE provider_type = $1 AND is_default = true AND is_active = true
                LIMIT 1
            `,
                [type],
            );

            if (result.rows.length > 0) {
                const name = result.rows[0].provider_name;
                return this.get(type, name);
            }

            // Fallback: return first available
            const providers = Array.from(this.providers[type].values());
            return providers.length > 0 ? providers[0] : null;
        } catch (error) {
            console.error(`[VoiceProviderRegistry] Error getting default ${type}:`, error.message);

            // Fallback: return first available
            const providers = Array.from(this.providers[type].values());
            return providers.length > 0 ? providers[0] : null;
        }
    }

    /**
     * Get all providers of a type
     * @param {string} type - Provider type
     * @returns {Map} Map of providers
     */
    getAll(type) {
        if (!this.providers[type]) {
            throw new Error(`Invalid provider type: ${type}`);
        }

        return this.providers[type];
    }

    /**
     * Health check all providers
     * @returns {Promise<Object>} Health status by type and provider
     */
    async healthCheckAll() {
        const results = {
            stt: {},
            tts: {},
            llm_interview: {},
        };

        for (const [type, providerMap] of Object.entries(this.providers)) {
            for (const [name, provider] of providerMap.entries()) {
                try {
                    const isHealthy = await provider.healthCheck();
                    results[type][name] = {
                        healthy: isHealthy,
                        config: provider.getConfig(),
                    };
                } catch (error) {
                    results[type][name] = {
                        healthy: false,
                        error: error.message,
                    };
                }
            }
        }

        return results;
    }

    /**
     * Get registry summary
     * @returns {Object} Summary of registered providers
     */
    getSummary() {
        return {
            initialized: this.initialized,
            providers: {
                stt: Array.from(this.providers.stt.keys()),
                tts: Array.from(this.providers.tts.keys()),
                llm_interview: Array.from(this.providers.llm_interview.keys()),
            },
        };
    }
}

// Export singleton instance
const voiceProviderRegistry = new VoiceProviderRegistry();
export default voiceProviderRegistry;
