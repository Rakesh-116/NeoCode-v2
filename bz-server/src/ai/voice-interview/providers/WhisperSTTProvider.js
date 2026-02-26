/**
 * ============================================================================
 * Whisper STT Provider Implementation
 * ============================================================================
 * OpenAI Whisper implementation for speech-to-text
 * Uses faster-whisper or whisper.cpp for local inference
 *
 * Dependencies: npm install @xenova/transformers
 * Alternative: Use whisper.cpp via child_process or Python whisper
 * ============================================================================
 */

import ISTTProvider from "../interfaces/ISTTProvider.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export default class WhisperSTTProvider extends ISTTProvider {
    name = "whisper";
    version = "1.0.0";
    supportsStreaming = false;
    supportedFormats = ["wav", "mp3", "ogg", "flac", "m4a"];

    constructor(config = {}) {
        super();
        this.modelSize = config.model || process.env.WHISPER_MODEL || "base";
        this.language = config.language || "en";
        this.temperature = config.temperature || 0.0;
        this.whisperPath = config.whisperPath || "whisper"; // Assumes whisper is in PATH
    }

    /**
     * Transcribe audio using Whisper
     * @param {Buffer} audioBuffer - Audio data
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Transcription result
     */
    async transcribe(audioBuffer, options = {}) {
        let tempFilePath = null;
        let outputJsonPath = null;

        try {
            console.log(`[WhisperSTT] Starting transcription with model: ${this.modelSize}`);

            // Save audio buffer to temp file
            tempFilePath = await this._saveToTempFile(audioBuffer);

            // Whisper creates output file with same name but .json extension
            const tempDir = path.dirname(tempFilePath);
            const tempBaseName = path.basename(tempFilePath, path.extname(tempFilePath));
            outputJsonPath = path.join(tempDir, `${tempBaseName}.json`);

            // Run Whisper transcription
            const result = await this._runWhisper(tempFilePath, options);

            console.log(`[WhisperSTT] Transcription complete: ${result.text.substring(0, 50)}...`);

            return {
                text: result.text.trim(),
                confidence: result.confidence || 95, // Whisper doesn't provide confidence by default
                language: result.language || this.language,
                segments: result.segments || [],
                metadata: {
                    model: this.modelSize,
                    provider: "whisper",
                    duration: result.duration,
                },
            };
        } catch (error) {
            console.error("[WhisperSTT] Transcription failed:", error.message);
            throw new Error(`Whisper transcription failed: ${error.message}`);
        } finally {
            // Cleanup temp files in finally block to ensure they're always deleted
            try {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                if (outputJsonPath && fs.existsSync(outputJsonPath)) {
                    fs.unlinkSync(outputJsonPath);
                }
            } catch (cleanupError) {
                console.warn("[WhisperSTT] Failed to cleanup temp files:", cleanupError.message);
            }
        }
    }

    /**
     * Save audio buffer to temporary file
     * @private
     * @param {Buffer} audioBuffer - Audio data
     * @returns {Promise<string>} Temp file path
     */
    async _saveToTempFile(audioBuffer) {
        const tempDir = "D:\\Neocode-v2-dump";

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `whisper_${Date.now()}.wav`);

        // Use synchronous write to ensure file is fully written before returning
        // This prevents race condition where Whisper tries to read file before it's ready
        try {
            console.log(`[WhisperSTT] Writing audio buffer (${audioBuffer.length} bytes) to ${tempFilePath}`);
            fs.writeFileSync(tempFilePath, audioBuffer);

            // Verify file was created successfully
            if (!fs.existsSync(tempFilePath)) {
                throw new Error(`Failed to create temp file: ${tempFilePath}`);
            }

            const stats = fs.statSync(tempFilePath);
            console.log(`[WhisperSTT] ✅ Temp file created successfully: ${tempFilePath} (${stats.size} bytes)`);

            // Convert Windows path to forward slashes for better CLI compatibility
            const normalizedPath = tempFilePath.replace(/\\/g, "/");
            console.log(`[WhisperSTT] Normalized path for Whisper: ${normalizedPath}`);

            return normalizedPath;
        } catch (error) {
            console.error(`[WhisperSTT] ❌ Error saving temp file:`, error);
            throw new Error(`Failed to save audio to temp file: ${error.message}`);
        }
    }

    /**
     * Run Whisper CLI or Python script
     * @private
     * @param {string} audioPath - Path to audio file
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Whisper result
     */
    async _runWhisper(audioPath, options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`[WhisperSTT] Running Whisper CLI with path: ${audioPath}`);
            console.log(`[WhisperSTT] Whisper executable: ${this.whisperPath}`);
            console.log(`[WhisperSTT] File exists check: ${fs.existsSync(audioPath)}`);

            const args = [
                audioPath,
                "--model",
                options.model || this.modelSize,
                "--language",
                options.language || this.language,
                "--output_format",
                "json",
                "--temperature",
                (options.temperature || this.temperature).toString(),
                "--output_dir",
                path.dirname(audioPath), // Output JSON to same directory as input
            ];

            if (options.word_timestamps) {
                args.push("--word_timestamps", "True");
            }

            console.log(`[WhisperSTT] Whisper command: ${this.whisperPath} ${args.join(" ")}`);

            // Ensure ffmpeg is in PATH for Whisper subprocess
            const ffmpegBin =
                "C:\\Users\\rakes\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin";
            const env = {
                ...process.env,
                PATH: `${process.env.PATH};${ffmpegBin}`,
                PYTHONIOENCODING: "utf-8", // Fix Windows Unicode encoding issues
            };

            const whisperProcess = spawn(this.whisperPath, args, { env });

            let stdout = "";
            let stderr = "";

            whisperProcess.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            whisperProcess.stderr.on("data", (data) => {
                const stderrText = data.toString();
                stderr += stderrText;
                console.log(`[WhisperSTT] stderr: ${stderrText}`);
            });

            whisperProcess.on("close", (code) => {
                console.log(`[WhisperSTT] Whisper process exited with code: ${code}`);
                console.log(`[WhisperSTT] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);

                if (code !== 0) {
                    reject(new Error(`Whisper process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Whisper writes JSON to a file with same basename
                    const baseName = path.basename(audioPath, path.extname(audioPath));
                    const jsonPath = path.join(path.dirname(audioPath), `${baseName}.json`);

                    console.log(`[WhisperSTT] Looking for JSON output at: ${jsonPath}`);

                    // Check if JSON file exists (Whisper writes output to file, not stdout)
                    if (fs.existsSync(jsonPath)) {
                        console.log(`[WhisperSTT] ✅ JSON file found, reading...`);
                        const jsonContent = fs.readFileSync(jsonPath, "utf-8");
                        const result = JSON.parse(jsonContent);
                        console.log(
                            `[WhisperSTT] ✅ Parsed JSON successfully, text length: ${result.text?.length || 0}`,
                        );
                        resolve(result);
                    } else {
                        console.log(`[WhisperSTT] ⚠️ JSON file not found, checking stdout...`);
                        // Fallback: try parsing stdout for JSON
                        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            console.log(`[WhisperSTT] Found JSON in stdout`);
                            const result = JSON.parse(jsonMatch[0]);
                            resolve(result);
                        } else {
                            console.log(`[WhisperSTT] ⚠️ No JSON found, using stdout as text`);
                            console.log(`[WhisperSTT] stdout content: ${stdout}`);
                            console.log(`[WhisperSTT] stderr content: ${stderr}`);

                            // Check if this looks like an error message
                            if (
                                stdout.includes("FileNotFoundError") ||
                                stdout.includes("Skipping") ||
                                stderr.includes("Error")
                            ) {
                                reject(new Error(`Whisper failed: ${stdout} ${stderr}`));
                            } else {
                                // Last fallback: treat stdout as plain text
                                resolve({
                                    text: stdout.trim(),
                                    language: this.language,
                                    segments: [],
                                });
                            }
                        }
                    }
                } catch (parseError) {
                    console.error(`[WhisperSTT] ❌ Parse error: ${parseError.message}`);
                    reject(new Error(`Failed to parse Whisper output: ${parseError.message}`));
                }
            });

            whisperProcess.on("error", (error) => {
                console.error(`[WhisperSTT] ❌ Process error: ${error.message}`);
                reject(new Error(`Whisper process error: ${error.message}`));
            });
        });
    }

    /**
     * Health check - verify Whisper is available
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            return new Promise((resolve) => {
                const checkProcess = spawn(this.whisperPath, ["--help"]);

                checkProcess.on("close", (code) => {
                    resolve(code === 0);
                });

                checkProcess.on("error", () => {
                    resolve(false);
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    checkProcess.kill();
                    resolve(false);
                }, 5000);
            });
        } catch (error) {
            console.error("[WhisperSTT] Health check failed:", error.message);
            return false;
        }
    }
}
