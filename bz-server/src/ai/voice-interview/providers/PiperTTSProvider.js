/**
 * ============================================================================
 * Piper TTS Provider Implementation
 * ============================================================================
 * Piper TTS implementation for text-to-speech synthesis
 * Fast, local, open-source TTS
 *
 * Installation: Download piper binary from https://github.com/rhasspy/piper
 * Requires voice models (onnx files)
 * ============================================================================
 */

import ITTSProvider from "../interfaces/ITTSProvider.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export default class PiperTTSProvider extends ITTSProvider {
    name = "piper";
    version = "1.0.0";
    supportedFormats = ["wav", "raw"];
    availableVoices = [
        { id: "en_US-lessac-medium", name: "Lessac (US, Medium)", language: "en-US" },
        { id: "en_US-amy-medium", name: "Amy (US, Medium)", language: "en-US" },
        { id: "en_GB-alan-medium", name: "Alan (UK, Medium)", language: "en-GB" },
    ];

    constructor(config = {}) {
        super();
        this.piperPath = config.piperPath || process.env.PIPER_PATH || "piper";
        this.modelsDir = config.modelsDir || process.env.PIPER_MODELS_DIR || "./piper_models";
        this.defaultVoice = config.voice || "en_US-lessac-medium";
        this.speed = config.speed || 1.0;
    }

    /**
     * Synthesize text to speech
     * @param {string} text - Text to synthesize
     * @param {Object} options - Synthesis options
     * @returns {Promise<Object>} Audio buffer and metadata
     */
    async synthesize(text, options = {}) {
        try {
            console.log(`[PiperTTS] Synthesizing: "${text.substring(0, 50)}..."`);

            const voiceId = options.voice || this.defaultVoice;
            const speed = options.speed || this.speed;
            const format = options.format || "wav";

            // Get voice model path
            const modelPath = this._getModelPath(voiceId);

            // Run Piper to generate audio
            const audioBuffer = await this._runPiper(text, modelPath, speed);

            const duration = this._estimateDuration(text, speed);

            console.log(`[PiperTTS] Synthesis complete (${duration}s audio)`);

            return {
                audio: audioBuffer,
                duration,
                format,
                metadata: {
                    voice: voiceId,
                    speed,
                    provider: "piper",
                    characterCount: text.length,
                },
            };
        } catch (error) {
            console.error("[PiperTTS] Synthesis failed:", error.message);
            throw new Error(`Piper TTS synthesis failed: ${error.message}`);
        }
    }

    /**
     * Run Piper TTS process
     * @private
     * @param {string} text - Text to synthesize
     * @param {string} modelPath - Path to voice model
     * @param {number} speed - Speech speed
     * @returns {Promise<Buffer>} Audio buffer
     */
    async _runPiper(text, modelPath, speed) {
        return new Promise((resolve, reject) => {
            // Use temporary file to avoid stdout/stderr contamination
            const tempDir = "D:\\Neocode-v2-dump";

            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFile = path.join(tempDir, `piper_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);

            const args = [
                "--model",
                modelPath,
                "--output_file",
                tempFile, // Output to temp file instead of stdout
                "--length_scale",
                (1.0 / speed).toFixed(2), // Inverse of speed
            ];

            const piperProcess = spawn(this.piperPath, args);
            let stderr = "";

            // Write text to stdin
            piperProcess.stdin.write(text);
            piperProcess.stdin.end();

            // Capture stderr for debugging (but keep it separate from audio)
            piperProcess.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            piperProcess.on("close", (code) => {
                if (code !== 0) {
                    // Clean up temp file
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                    reject(new Error(`Piper process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Read the generated WAV file
                    const wavAudio = fs.readFileSync(tempFile);

                    // Clean up temp file
                    fs.unlinkSync(tempFile);

                    resolve(wavAudio);
                } catch (error) {
                    // Clean up temp file on error
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                    reject(new Error(`Failed to read audio file: ${error.message}`));
                }
            });

            piperProcess.on("error", (error) => {
                // Clean up temp file on error
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
                reject(new Error(`Piper process error: ${error.message}`));
            });
        });
    }

    /**
     * Get voice model path
     * @private
     * @param {string} voiceId - Voice identifier
     * @returns {string} Path to model file
     */
    _getModelPath(voiceId) {
        const modelFile = `${voiceId}.onnx`;
        const modelPath = path.join(this.modelsDir, modelFile);

        if (!fs.existsSync(modelPath)) {
            throw new Error(
                `Voice model not found: ${modelPath}. Please download from https://github.com/rhasspy/piper/releases`,
            );
        }

        return modelPath;
    }

    /**
     * Estimate audio duration based on text length
     * @private
     * @param {string} text - Text content
     * @param {number} speed - Speech speed
     * @returns {number} Estimated duration in seconds
     */
    _estimateDuration(text, speed) {
        // Average speaking rate: ~150 words per minute
        const wordsPerMinute = 150 * speed;
        const wordCount = text.split(/\s+/).length;
        const durationMinutes = wordCount / wordsPerMinute;
        return Math.ceil(durationMinutes * 60);
    }

    /**
     * Health check - verify Piper is available
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            return new Promise((resolve) => {
                const checkProcess = spawn(this.piperPath, ["--version"]);

                checkProcess.on("close", (code) => {
                    resolve(code === 0);
                });

                checkProcess.on("error", () => {
                    resolve(false);
                });

                setTimeout(() => {
                    checkProcess.kill();
                    resolve(false);
                }, 5000);
            });
        } catch (error) {
            console.error("[PiperTTS] Health check failed:", error.message);
            return false;
        }
    }
}
