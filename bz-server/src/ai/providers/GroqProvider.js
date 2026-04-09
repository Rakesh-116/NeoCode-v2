/**
 * ============================================================================
 * GroqProvider - Groq Chat Completions Provider
 * ============================================================================
 * Optional cloud provider for Groq-hosted open models.
 *
 * Configuration:
 * Set GROQ_API_KEY in .env file
 *
 * Use when:
 * - You want a fast cloud fallback
 * - You prefer Groq-hosted open-weight models
 * - Local Ollama is unavailable
 * ============================================================================
 */

import ILLMProvider from "./ILLMProvider.js";
import config from "../../config/index.js";

class GroqProvider extends ILLMProvider {
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey || config.AI.GROQ.API_KEY;
        this.model = options.model || config.AI.GROQ.MODEL;
        this.defaultTemperature = options.temperature || config.AI.GROQ.TEMPERATURE;
        this.baseUrl = options.baseUrl || config.AI.GROQ.BASE_URL;
    }

    getName() {
        return "groq";
    }

    async generate({ prompt, temperature = this.defaultTemperature, maxTokens = 1000 }) {
        if (!this.apiKey) {
            throw new Error("Groq API key not configured. Set GROQ_API_KEY in .env");
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
                let errorMessage = response.statusText;
                try {
                    const error = await response.json();
                    errorMessage = error.error?.message || errorMessage;
                } catch {
                    // Keep status text fallback.
                }
                throw new Error(`Groq API error: ${errorMessage}`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;

            if (!text) {
                throw new Error("Groq returned empty response");
            }

            return text.trim();
        } catch (error) {
            if (error.name === "AbortError") {
                console.error("GroqProvider: Request timeout after", config.AI.REQUEST_TIMEOUT, "ms");
                throw new Error("Groq request timed out. Please try again.");
            }

            console.error("GroqProvider generate error:", error.message);
            throw error;
        }
    }

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
            console.error("GroqProvider availability check failed:", error.message);
            return false;
        }
    }

    getConfig() {
        return {
            provider: "groq",
            model: this.model,
            temperature: this.defaultTemperature,
            baseUrl: this.baseUrl,
            hasApiKey: !!this.apiKey,
        };
    }
}

export default GroqProvider;
