/**
 * ============================================================================
 * Voice Interview System - Main Export
 * ============================================================================
 * Central initialization and export point for the voice interview module
 *
 * This module provides:
 * - Pluggable STT/TTS/LLM providers
 * - Interview orchestration service
 * - Integration with Learning OS evaluation system
 * - RESTful API endpoints
 *
 * Usage:
 * ```
 * import { initializeVoiceInterviewSystem } from './ai/voice-interview/index.js';
 * await initializeVoiceInterviewSystem();
 * ```
 * ============================================================================
 */

// Providers
import voiceProviderRegistry from "./providers/ProviderRegistry.js";
import WhisperSTTProvider from "./providers/WhisperSTTProvider.js";
import PiperTTSProvider from "./providers/PiperTTSProvider.js";
import OllamaInterviewLLM from "./providers/OllamaInterviewLLM.js";
import GroqInterviewLLM from "./providers/GroqInterviewLLM.js";

// Services
import interviewOrchestrator from "./services/InterviewOrchestrator.service.js";

// Plugin
import InterviewEvaluationPlugin from "./plugins/InterviewEvaluationPlugin.js";
import { pluginRegistry } from "../../learning-core/interfaces/IEvaluationPlugin.js";

/**
 * Initialize the voice interview system
 * Should be called during application startup
 *
 * @returns {Promise<void>}
 */
export async function initializeVoiceInterviewSystem() {
    try {
        console.log("🎙️ Initializing Voice Interview System...");

        // Step 1: Initialize provider registry
        await voiceProviderRegistry.initialize();
        console.log("   ✅ Provider registry initialized");

        // Step 2: Register evaluation plugin with Learning OS
        const interviewPlugin = new InterviewEvaluationPlugin();
        pluginRegistry.register(interviewPlugin);
        console.log("   ✅ Interview evaluation plugin registered");

        // Step 3: Health check all providers
        const health = await voiceProviderRegistry.healthCheckAll();
        console.log("   ℹ️ Provider health check:");

        for (const [type, providers] of Object.entries(health)) {
            for (const [name, status] of Object.entries(providers)) {
                const icon = status.healthy ? "✅" : "❌";
                console.log(`      ${icon} ${type}:${name}`);
            }
        }

        console.log("✅ Voice Interview System initialized successfully");

        return {
            initialized: true,
            providers: voiceProviderRegistry.getSummary(),
            health,
        };
    } catch (error) {
        console.error("❌ Failed to initialize Voice Interview System:", error.message);
        throw error;
    }
}

/**
 * Get voice interview system health status
 * @returns {Promise<Object>}
 */
export async function getVoiceInterviewHealth() {
    const health = await voiceProviderRegistry.healthCheckAll();
    const summary = voiceProviderRegistry.getSummary();

    return {
        healthy: Object.values(health)
            .flatMap((providers) => Object.values(providers))
            .every((status) => status.healthy),
        providers: summary,
        details: health,
    };
}

// Export core components
export {
    // Registry
    voiceProviderRegistry,

    // Providers (for custom initialization)
    WhisperSTTProvider,
    PiperTTSProvider,
    OllamaInterviewLLM,
    GroqInterviewLLM,

    // Services
    interviewOrchestrator,

    // Plugin
    InterviewEvaluationPlugin,
};

// Default export: initialization function
export default initializeVoiceInterviewSystem;
