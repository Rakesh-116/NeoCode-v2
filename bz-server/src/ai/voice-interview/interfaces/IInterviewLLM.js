/**
 * ============================================================================
 * Interview LLM Provider Interface
 * ============================================================================
 * Abstract interface for interview-specific LLM providers
 *
 * Responsibilities:
 * - Generate context-aware interview questions
 * - Evaluate user answers
 * - Provide detailed feedback
 * - Adapt difficulty based on performance
 * ============================================================================
 */

/**
 * @typedef {Object} QuestionContext
 * @property {string} [topic] - Technical topic (e.g., 'Arrays', 'Dynamic Programming')
 * @property {string} [role] - Target role (e.g., 'Backend Engineer')
 * @property {string} [jd] - Job description
 * @property {string} [resume] - User's resume text
 * @property {string} difficulty - 'easy', 'medium', 'hard'
 * @property {Array<string>} previousQuestions - Questions already asked
 * @property {Array<Object>} previousAnswers - Previous Q&A with scores
 */

/**
 * @typedef {Object} GeneratedQuestion
 * @property {string} question - Question text
 * @property {string} type - 'technical' | 'behavioral' | 'system_design' | 'coding'
 * @property {string} difficulty - 'easy', 'medium', 'hard'
 * @property {string} [topic] - Specific topic label (e.g., 'React internals')
 * @property {Array<string>} [followUps] - Suggested follow-up questions
 * @property {string} [evaluationCriteria] - Criteria used to evaluate the answer
 * @property {Array<string>} [conceptTags] - Concept tags for learning review
 * @property {Array<string>} expectedKeywords - Keywords expected in answer
 * @property {Object} [metadata] - Additional question metadata
 */

/**
 * @typedef {Object} AnswerEvaluationContext
 * @property {string} question - The question asked
 * @property {string} answer - User's answer
 * @property {string} topic - Topic/skill area
 * @property {string} difficulty - Question difficulty
 * @property {number} [timeToAnswer] - Time taken in seconds
 * @property {string} [evaluationCriteria] - Specific evaluation criteria
 */

/**
 * @typedef {Object} AnswerEvaluation
 * @property {number} score - Score 0-100
 * @property {string} verdict - 'excellent' | 'good' | 'average' | 'poor' | 'failed'
 * @property {string} feedback - Detailed feedback
 * @property {Array<string>} detectedMistakes - Identified mistakes
 * @property {Array<string>} strengths - Strengths in the answer
 * @property {Array<string>} improvements - Suggested improvements
 * @property {boolean} followUpSuggested - Whether follow-up question recommended
 * @property {Object} [metadata] - Provider-specific metadata
 */

export default class IInterviewLLM {
    /**
     * Provider name (e.g., 'ollama', 'openai', 'gemini')
     * @type {string}
     */
    name = "base_interview_llm";

    /**
     * Provider version
     * @type {string}
     */
    version = "1.0.0";

    /**
     * Model name/identifier
     * @type {string}
     */
    modelName = "";

    /**
     * Generate interview question based on context
     * @param {QuestionContext} context - Question generation context
     * @returns {Promise<GeneratedQuestion>}
     * @throws {Error} If generation fails
     */
    async generateQuestion(context) {
        throw new Error("generateQuestion() must be implemented by subclass");
    }

    /**
     * Evaluate user's answer
     * @param {AnswerEvaluationContext} context - Evaluation context
     * @returns {Promise<AnswerEvaluation>}
     * @throws {Error} If evaluation fails
     */
    async evaluateAnswer(context) {
        throw new Error("evaluateAnswer() must be implemented by subclass");
    }

    /**
     * Generate follow-up question based on previous answer
     * @param {Object} previousQA - Previous question and answer
     * @returns {Promise<GeneratedQuestion>}
     */
    async generateFollowUp(previousQA) {
        throw new Error("generateFollowUp() must be implemented by subclass");
    }

    /**
     * Health check for provider
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        throw new Error("healthCheck() must be implemented by subclass");
    }

    /**
     * Get provider configuration
     * @returns {Object}
     */
    getConfig() {
        return {
            name: this.name,
            version: this.version,
            modelName: this.modelName,
        };
    }
}
