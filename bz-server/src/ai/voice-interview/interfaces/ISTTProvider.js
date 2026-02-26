/**
 * ============================================================================
 * STT (Speech-to-Text) Provider Interface
 * ============================================================================
 * Abstract interface for pluggable STT providers (Whisper, Deepgram, Google, etc.)
 *
 * Implementation Pattern:
 * - Each provider must implement all methods
 * - Return consistent response format
 * - Handle errors gracefully
 * - Log provider-specific metadata
 * ============================================================================
 */

/**
 * @typedef {Object} STTTranscriptionResult
 * @property {string} text - Transcribed text
 * @property {number} [confidence] - Confidence score 0-100
 * @property {string} [language] - Detected language
 * @property {Array<STTSegment>} [segments] - Word-level timestamps (if supported)
 * @property {Object} [metadata] - Provider-specific metadata
 */

/**
 * @typedef {Object} STTSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Segment text
 * @property {number} [confidence] - Segment confidence
 */

/**
 * @typedef {Object} STTOptions
 * @property {string} [language='en'] - Target language code
 * @property {number} [temperature=0.0] - Model temperature (for Whisper)
 * @property {boolean} [word_timestamps=false] - Return word-level timestamps
 * @property {string} [model] - Model variant (e.g., 'base', 'small', 'medium')
 */

export default class ISTTProvider {
    /**
     * Provider name (e.g., 'whisper', 'deepgram', 'google')
     * @type {string}
     */
    name = "base_stt_provider";

    /**
     * Provider version
     * @type {string}
     */
    version = "1.0.0";

    /**
     * Whether provider supports streaming transcription
     * @type {boolean}
     */
    supportsStreaming = false;

    /**
     * Supported audio formats (e.g., ['wav', 'mp3', 'ogg'])
     * @type {Array<string>}
     */
    supportedFormats = ["wav", "mp3"];

    /**
     * Transcribe audio buffer to text
     * @param {Buffer} audioBuffer - Audio data
     * @param {STTOptions} options - Transcription options
     * @returns {Promise<STTTranscriptionResult>}
     * @throws {Error} If transcription fails
     */
    async transcribe(audioBuffer, options = {}) {
        throw new Error("transcribe() must be implemented by subclass");
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
            supportsStreaming: this.supportsStreaming,
            supportedFormats: this.supportedFormats,
        };
    }

    /**
     * Validate audio format
     * @param {string} format - Audio format (e.g., 'wav', 'mp3')
     * @returns {boolean}
     */
    isFormatSupported(format) {
        return this.supportedFormats.includes(format.toLowerCase());
    }
}
