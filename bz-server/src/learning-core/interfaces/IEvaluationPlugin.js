/**
 * ============================================================================
 * EVALUATION PLUGIN INTERFACE
 * ============================================================================
 * Core abstraction that makes the learning system pluggable.
 *
 * ANY evaluation system (code, quiz, PDF, interview, essay) must implement this.
 * The learning engine only knows about this interface - NOT about specifics.
 *
 * This is THE most important design pattern in the entire refactor.
 * ============================================================================
 */

/**
 * @typedef {Object} EvaluationInput
 * @property {string} userId - User attempting the question
 * @property {string} questionId - Question being evaluated
 * @property {Object} answer - User's answer (flexible format)
 * @property {Object} [context] - Optional context (hints used, time spent, etc.)
 */

/**
 * @typedef {Object} Mistake
 * @property {string} type - Mistake type from mistake_catalog (e.g., 'array_bounds', 'tle_nested_loops')
 * @property {string} category - 'logic' | 'syntax' | 'performance' | 'edge_case'
 * @property {number} severity - 1-5, where 5 is most severe
 * @property {string} description - Human-readable description
 * @property {Object} [context] - Mistake-specific context (testcase #, line #, etc.)
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {boolean} success - Whether evaluation completed successfully
 * @property {string} verdict - 'ACCEPTED' | 'WRONG_ANSWER' | 'TLE' | 'RTE' | 'INCOMPLETE' | 'PARTIAL'
 * @property {number} score - Percentage or points (0-100)
 * @property {Mistake[]} mistakes - Detected mistakes (empty array if none)
 * @property {Object} details - Plugin-specific details
 * @property {number} [timeSpent] - Time spent in seconds
 * @property {string} [feedback] - Optional feedback message
 * @property {Object} [metadata] - Any additional metadata for learning engine
 */

/**
 * Base Interface for All Evaluation Plugins
 *
 * @interface IEvaluationPlugin
 */
class IEvaluationPlugin {
    /**
     * Gets the type of evaluation this plugin handles
     * @returns {string} - 'code' | 'quiz' | 'pdf-exam' | 'interview' | 'essay'
     */
    getType() {
        throw new Error("getType() must be implemented");
    }

    /**
     * Gets the version of this plugin
     * @returns {string} - Semantic version (e.g., '1.0.0')
     */
    getVersion() {
        return "1.0.0";
    }

    /**
     * Gets supported question types for this plugin
     * @returns {string[]} - Array of question types
     */
    getSupportedQuestionTypes() {
        throw new Error("getSupportedQuestionTypes() must be implemented");
    }

    /**
     * Validates that the plugin can handle a given question
     * @param {Object} question - Question data from normalized_questions
     * @returns {boolean} - True if plugin can handle this question
     */
    canHandle(question) {
        throw new Error("canHandle() must be implemented");
    }

    /**
     * Main evaluation method - judges the user's answer
     *
     * @param {EvaluationInput} input - User's answer and context
     * @returns {Promise<EvaluationResult>} - Evaluation result
     */
    async evaluate(input) {
        throw new Error("evaluate() must be implemented");
    }

    /**
     * Extracts mistakes from the evaluation result
     * This is CRITICAL for learning - the learning engine uses this to update weak topics
     *
     * @param {EvaluationResult} result - Raw evaluation result
     * @param {Object} question - Question data
     * @returns {Promise<Mistake[]>} - Detected mistakes
     */
    async extractMistakes(result, question) {
        throw new Error("extractMistakes() must be implemented");
    }

    /**
     * Gets recommended next questions based on performance
     * (Optional - plugins can provide their own logic)
     *
     * @param {EvaluationResult} result - Evaluation result
     * @param {Object} userProfile - User's learning profile
     * @returns {Promise<string[]>} - Array of recommended question IDs
     */
    async getRecommendations(result, userProfile) {
        return []; // Default: no plugin-specific recommendations
    }

    /**
     * Health check for the plugin
     * @returns {Promise<boolean>} - True if plugin is operational
     */
    async healthCheck() {
        return true;
    }

    /**
     * Gets plugin configuration
     * @returns {Object} - Plugin configuration
     */
    getConfig() {
        return {};
    }
}

/**
 * Plugin Registry - Manages all registered plugins
 */
class PluginRegistry {
    constructor() {
        this.plugins = new Map();
    }

    /**
     * Register a new plugin
     * @param {IEvaluationPlugin} plugin
     */
    register(plugin) {
        if (!(plugin instanceof IEvaluationPlugin)) {
            throw new Error("Plugin must implement IEvaluationPlugin interface");
        }

        const type = plugin.getType();
        if (this.plugins.has(type)) {
            console.warn(`Plugin type '${type}' is being overwritten`);
        }

        this.plugins.set(type, plugin);
        console.log(`✅ Registered plugin: ${type} v${plugin.getVersion()}`);
    }

    /**
     * Get plugin by type
     * @param {string} type
     * @returns {IEvaluationPlugin}
     */
    getPlugin(type) {
        const plugin = this.plugins.get(type);
        if (!plugin) {
            throw new Error(`No plugin registered for type: ${type}`);
        }
        return plugin;
    }

    /**
     * Get all registered plugins
     * @returns {Map<string, IEvaluationPlugin>}
     */
    getAllPlugins() {
        return this.plugins;
    }

    /**
     * Check if plugin exists for type
     * @param {string} type
     * @returns {boolean}
     */
    hasPlugin(type) {
        return this.plugins.has(type);
    }
}

// Singleton instance
const pluginRegistry = new PluginRegistry();

export { IEvaluationPlugin, PluginRegistry, pluginRegistry };
export default IEvaluationPlugin;
