/**
 * ============================================================================
 * GeminiProvider - Google Gemini Provider
 * ============================================================================
 * Optional cloud provider for Google Gemini models.
 *
 * Configuration:
 * Set GEMINI_API_KEY in .env file
 *
 * Use when:
 * - Already using Gemini for complexity analysis
 * - Need fast, cost-effective cloud LLM
 * - Want Google's latest models
 * ============================================================================
 */

import ILLMProvider from "./ILLMProvider.js";
import config from "../../config/index.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

class GeminiProvider extends ILLMProvider {
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey || config.AI.GEMINI.API_KEY;
        this.modelName = options.model || config.AI.GEMINI.MODEL;
        this.defaultTemperature = options.temperature || config.AI.GEMINI.TEMPERATURE;

        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        }
    }

    getName() {
        return "gemini";
    }

    /**
     * Generate text using Google Gemini API
     */
    async generate({ prompt, temperature = this.defaultTemperature, maxTokens = 1000 }) {
        if (!this.apiKey) {
            throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in .env");
        }

        if (!this.model) {
            throw new Error("Gemini model not initialized");
        }

        try {
            const generationConfig = {
                temperature,
                maxOutputTokens: maxTokens,
            };

            // Create a promise that will timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), config.AI.REQUEST_TIMEOUT);
            });

            // Race between generation and timeout
            const result = await Promise.race([
                this.model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig,
                }),
                timeoutPromise,
            ]);

            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error("Gemini returned empty response");
            }

            return text.trim();
        } catch (error) {
            if (error.message === "Request timeout") {
                console.error("GeminiProvider: Request timeout after", config.AI.REQUEST_TIMEOUT, "ms");
                throw new Error("Gemini request timed out. Please try again.");
            }

            console.error("GeminiProvider generate error:", error.message);
            throw error;
        }
    }

    /**
     * Check if Gemini API is available
     */
    async isAvailable() {
        if (!this.apiKey || !this.model) {
            return false;
        }

        try {
            // Simple test prompt
            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: "Hello" }] }],
            });

            return !!(await result.response.text());
        } catch (error) {
            console.error("GeminiProvider availability check failed:", error.message);
            return false;
        }
    }

    getConfig() {
        return {
            provider: "gemini",
            model: this.modelName,
            temperature: this.defaultTemperature,
            hasApiKey: !!this.apiKey,
        };
    }
}

export default GeminiProvider;
