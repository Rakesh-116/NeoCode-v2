/**
 * ============================================================================
 * TTS (Text-to-Speech) Provider Interface
 * ============================================================================
 * Abstract interface for pluggable TTS providers (Piper, Coqui, ElevenLabs, etc.)
 *
 * Implementation Pattern:
 * - Accepts text, returns audio buffer
 * - Consistent voice configuration
 * - Support for different output formats
 * ============================================================================
 */

/**
 * @typedef {Object} TTSOptions
 * @property {string} [voice] - Voice ID or name
 * @property {number} [speed=1.0] - Speech speed (0.5 - 2.0)
 * @property {number} [pitch=1.0] - Voice pitch
 * @property {string} [format='wav'] - Output audio format
 * @property {number} [sampleRate=22050] - Audio sample rate
 */

/**
 * @typedef {Object} TTSSynthesisResult
 * @property {Buffer} audio - Audio buffer
 * @property {number} duration - Audio duration in seconds
 * @property {string} format - Audio format
 * @property {Object} [metadata] - Provider-specific metadata
 */

export default class ITTSProvider {
    /**
     * Provider name (e.g., 'piper', 'coqui', 'elevenlabs')
     * @type {string}
     */
    name = "base_tts_provider";

    /**
     * Provider version
     * @type {string}
     */
    version = "1.0.0";

    /**
     * Available voices
     * @type {Array<Object>}
     */
    availableVoices = [];

    /**
     * Supported output formats
     * @type {Array<string>}
     */
    supportedFormats = ["wav", "mp3"];

    /**
     * Synthesize text to speech
     * @param {string} text - Text to synthesize
     * @param {TTSOptions} options - Synthesis options
     * @returns {Promise<TTSSynthesisResult>}
     * @throws {Error} If synthesis fails
     */
    async synthesize(text, options = {}) {
        throw new Error("synthesize() must be implemented by subclass");
    }

    /**
     * Get available voices
     * @returns {Promise<Array<Object>>}
     */
    async getVoices() {
        return this.availableVoices;
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
            supportedFormats: this.supportedFormats,
            voiceCount: this.availableVoices.length,
        };
    }

    /**
     * Validate output format
     * @param {string} format - Audio format
     * @returns {boolean}
     */
    isFormatSupported(format) {
        return this.supportedFormats.includes(format.toLowerCase());
    }
}
