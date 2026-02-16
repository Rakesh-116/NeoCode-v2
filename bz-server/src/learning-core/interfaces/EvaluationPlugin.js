/**
 * @fileoverview Abstract interface for evaluation plugins
 * @description All evaluation types (code, quiz, PDF, etc.) must implement this interface
 */

/**
 * @abstract
 * @class EvaluationPlugin
 * @description Base class for all evaluation plugins (code compiler, quiz evaluator, etc.)
 */
class EvaluationPlugin {
    /**
     * @param {string} pluginType - Type identifier ('code', 'quiz', 'pdf', etc.)
     */
    constructor(pluginType) {
        if (this.constructor === EvaluationPlugin) {
            throw new Error("EvaluationPlugin is abstract and cannot be instantiated");
        }
        this.pluginType = pluginType;
    }

    /**
     * @abstract
     * @description Get the plugin type identifier
     * @returns {string} Plugin type
     */
    getType() {
        return this.pluginType;
    }

    /**
     * @abstract
     * @description Evaluate user submission/answer
     * @param {import('./types').EvaluationRequest} request - Evaluation request
     * @returns {Promise<import('./types').EvaluationResult>} Evaluation result
     */
    async evaluate(request) {
        throw new Error("evaluate() must be implemented by subclass");
    }

    /**
     * @abstract
     * @description Extract mistakes from evaluation result
     * @param {import('./types').EvaluationResult} result - Evaluation result
     * @param {Object} context - Additional context (code, problem, etc.)
     * @returns {Promise<Array<import('./types').Mistake>>} Detected mistakes
     */
    async extractMistakes(result, context) {
        throw new Error("extractMistakes() must be implemented by subclass");
    }

    /**
     * @abstract
     * @description Validate if this plugin can handle the given question
     * @param {Object} question - Question data
     * @returns {boolean} True if plugin can handle this question
     */
    canHandle(question) {
        throw new Error("canHandle() must be implemented by subclass");
    }

    /**
     * @description Get plugin metadata and capabilities
     * @returns {Object} Plugin information
     */
    getMetadata() {
        return {
            type: this.pluginType,
            version: "1.0.0",
            capabilities: [],
            supportedLanguages: [],
        };
    }

    /**
     * @description Validate input before evaluation
     * @param {import('./types').EvaluationRequest} request - Evaluation request
     * @returns {Object} Validation result { valid: boolean, errors: string[] }
     */
    validateInput(request) {
        const errors = [];

        if (!request.userId) {
            errors.push("userId is required");
        }
        if (!request.questionId) {
            errors.push("questionId is required");
        }
        if (!request.input) {
            errors.push("input is required");
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * @description Hook called before evaluation
     * @param {import('./types').EvaluationRequest} request - Evaluation request
     * @returns {Promise<void>}
     */
    async beforeEvaluate(request) {
        // Override in subclass if needed
    }

    /**
     * @description Hook called after evaluation
     * @param {import('./types').EvaluationResult} result - Evaluation result
     * @returns {Promise<void>}
     */
    async afterEvaluate(result) {
        // Override in subclass if needed
    }
}

export default EvaluationPlugin;
