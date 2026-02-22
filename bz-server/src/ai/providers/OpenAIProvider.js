/**
 * ============================================================================
 * OpenAIProvider - OpenAI GPT Provider
 * ============================================================================
 * Optional cloud provider for OpenAI models (GPT-3.5/GPT-4).
 *
 * Configuration:
 * Set OPENAI_API_KEY in .env file
 *
 * Use when:
 * - Local LLM insufficient
 * - Need higher quality responses
 * - Production deployment with budget
 * ============================================================================
 */

import ILLMProvider from "./ILLMProvider.js";
import config from "../../config/index.js";

class OpenAIProvider extends ILLMProvider {
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey || config.AI.OPENAI.API_KEY;
        this.model = options.model || config.AI.OPENAI.MODEL;
        this.defaultTemperature = options.temperature || config.AI.OPENAI.TEMPERATURE;
        this.baseUrl = "https://api.openai.com/v1";
    }

    getName() {
        return "openai";
    }

    /**
     * Generate text using OpenAI Chat Completions API
     */
    async generate({ prompt, temperature = this.defaultTemperature, maxTokens = 1000 }) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), config.AI.REQUEST_TIMEOUT);

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature,
                    max_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (!data.choices || data.choices.length === 0) {
                throw new Error("OpenAI returned no completions");
            }

            return data.choices[0].message.content.trim();
        } catch (error) {
            if (error.name === "AbortError") {
                console.error("OpenAIProvider: Request timeout after", config.AI.REQUEST_TIMEOUT, "ms");
                throw new Error("OpenAI request timed out. Please try again.");
            }

            console.error("OpenAIProvider generate error:", error.message);
            throw error;
        }
    }

    /**
     * Check if OpenAI API key is valid
     */
    async isAvailable() {
        if (!this.apiKey) {
            return false;
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                signal: controller.signal,
            });

            clearTimeout(timeout);
            return response.ok;
        } catch (error) {
            console.error("OpenAIProvider availability check failed:", error.message);
            return false;
        }
    }

    getConfig() {
        return {
            provider: "openai",
            model: this.model,
            temperature: this.defaultTemperature,
            hasApiKey: !!this.apiKey,
        };
    }
}

export default OpenAIProvider;
