/**
 * ============================================================================
 * ILLMProvider - LLM Provider Interface
 * ============================================================================
 * Base interface that all LLM providers must implement.
 *
 * This ensures consistent behavior across different LLM providers:
 * - Local models (Ollama/Orca Mini)
 * - Cloud providers (OpenAI, Gemini, etc.)
 *
 * Design principle: Swap providers with minimal code changes
 * ============================================================================
 */

class ILLMProvider {
    /**
     * Provider name (e.g., "ollama", "openai", "gemini")
     * @returns {string}
     */
    getName() {
        throw new Error("ILLMProvider.getName() must be implemented");
    }

    /**
     * Generate text completion from prompt
     * @param {Object} params - Generation parameters
     * @param {string} params.prompt - The input prompt
     * @param {number} params.temperature - Temperature for randomness (0-1)
     * @param {number} params.maxTokens - Maximum tokens to generate
     * @returns {Promise<string>} Generated text
     */
    async generate({ prompt, temperature = 0.2, maxTokens = 1000 }) {
        throw new Error("ILLMProvider.generate() must be implemented");
    }

    /**
     * Check if provider is available/healthy
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        throw new Error("ILLMProvider.isAvailable() must be implemented");
    }

    /**
     * Get provider-specific configuration
     * @returns {Object}
     */
    getConfig() {
        throw new Error("ILLMProvider.getConfig() must be implemented");
    }
}

export default ILLMProvider;
