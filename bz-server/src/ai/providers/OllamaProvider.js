/**
 * ============================================================================
 * OllamaProvider - Local LLM Provider (Orca Mini)
 * ============================================================================
 * Connects to locally running Ollama instance.
 *
 * Prerequisites:
 * 1. Install Ollama: https://ollama.ai/
 * 2. Pull model: ollama pull orca-mini
 * 3. Start Ollama service (runs on localhost:11434 by default)
 *
 * Benefits:
 * - Fully local (no API costs)
 * - Privacy (data never leaves your server)
 * - Open-source friendly
 * ============================================================================
 */

import ILLMProvider from "./ILLMProvider.js";
import config from "../../config/index.js";

class OllamaProvider extends ILLMProvider {
    /**
     * Initialize Ollama provider
     * @param {Object} options - Override default config
     */
    constructor(options = {}) {
        super();
        this.baseUrl = options.baseUrl || config.AI.OLLAMA.BASE_URL;
        this.model = options.model || config.AI.OLLAMA.MODEL;
        this.defaultTemperature = options.temperature || config.AI.OLLAMA.TEMPERATURE;
    }

    getName() {
        return "ollama";
    }

    /**
     * Generate text using Ollama API
     * Handles connection failures and timeouts
     */
    async generate({ prompt, temperature = this.defaultTemperature, maxTokens = 1000 }) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), config.AI.REQUEST_TIMEOUT);

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.model,
                    prompt,
                    stream: false,
                    options: {
                        temperature,
                        num_predict: maxTokens,
                    },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.response) {
                throw new Error("Ollama returned empty response");
            }

            return data.response.trim();
        } catch (error) {
            // Handle specific error types
            if (error.name === "AbortError") {
                console.error("OllamaProvider: Request timeout after", config.AI.REQUEST_TIMEOUT, "ms");
                throw new Error("LLM request timed out. Please try again.");
            }

            if (error.code === "ECONNREFUSED") {
                console.error("OllamaProvider: Cannot connect to Ollama at", this.baseUrl);
                throw new Error("Ollama service is not running. Start it with: ollama serve");
            }

            console.error("OllamaProvider generate error:", error.message);
            throw error;
        }
    }

    /**
     * Check if Ollama is running and model is available
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000); // Quick health check

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            const models = data.models || [];

            // Check if our model is pulled
            const hasModel = models.some((m) => m.name.includes(this.model));

            if (!hasModel) {
                console.warn(`OllamaProvider: Model ${this.model} not found. Run: ollama pull ${this.model}`);
            }

            return hasModel;
        } catch (error) {
            console.error("OllamaProvider availability check failed:", error.message);
            return false;
        }
    }

    getConfig() {
        return {
            provider: "ollama",
            baseUrl: this.baseUrl,
            model: this.model,
            temperature: this.defaultTemperature,
        };
    }
}

export default OllamaProvider;
