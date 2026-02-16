/**
 * ============================================================================
 * LEARNING CORE MODULE - Main Export
 * ============================================================================
 * Central export point for the Learning OS core system.
 *
 * This module provides:
 * - Plugin system for extensible evaluations
 * - Learning profile management (deterministic memory)
 * - Mistake tracking and pattern detection
 * - Training plan generation (rule-based)
 * - Orchestrated evaluation service
 * ============================================================================
 */

// Core Services
import EvaluationService from "./services/evaluation.service.js";
import LearningProfileService from "./services/learningProfile.service.js";
import MistakeEngineService from "./services/mistakeEngine.service.js";
import TrainingPlannerService from "./services/trainingPlanner.service.js";

// Interfaces & Plugin System
import IEvaluationPlugin, { pluginRegistry } from "./interfaces/IEvaluationPlugin.js";

// Built-in Plugins
import CodeEvaluationPlugin from "./plugins/CodeEvaluationPlugin.js";

/**
 * Initialize the Learning Core system
 * Call this on server startup
 */
async function initializeLearningCore() {
    console.log("🚀 Initializing NeoCode Learning OS...");

    try {
        // Register built-in plugins
        const codePlugin = new CodeEvaluationPlugin();
        pluginRegistry.register(codePlugin);

        // TODO: Register other plugins (quiz, pdf, etc.) as they're built

        console.log("✅ Learning Core initialized successfully");
        console.log(`📦 Registered plugins: ${Array.from(pluginRegistry.getAllPlugins().keys()).join(", ")}`);

        return true;
    } catch (error) {
        console.error("❌ Failed to initialize Learning Core:", error);
        throw error;
    }
}

/**
 * Health check for learning core system
 */
async function healthCheck() {
    const pluginHealthChecks = [];

    for (const [type, plugin] of pluginRegistry.getAllPlugins()) {
        try {
            const isHealthy = await plugin.healthCheck();
            pluginHealthChecks.push({ type, healthy: isHealthy });
        } catch (error) {
            pluginHealthChecks.push({ type, healthy: false, error: error.message });
        }
    }

    return {
        healthy: pluginHealthChecks.every((p) => p.healthy),
        plugins: pluginHealthChecks,
    };
}

// Export services
export {
    // Main orchestrator
    EvaluationService,

    // Core services
    LearningProfileService,
    MistakeEngineService,
    TrainingPlannerService,

    // Plugin system
    IEvaluationPlugin,
    pluginRegistry,

    // Built-in plugins
    CodeEvaluationPlugin,

    // Initialization
    initializeLearningCore,
    healthCheck,
};

// Default export: main orchestrator
export default EvaluationService;
