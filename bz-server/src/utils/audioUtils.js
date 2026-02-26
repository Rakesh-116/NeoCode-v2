/**
 * ============================================================================
 * Audio Utility Functions
 * ============================================================================
 * Helper functions for audio processing
 * ============================================================================
 */

/**
 * Add WAV header to raw PCM audio data
 * @param {Buffer} pcmBuffer - Raw PCM audio data
 * @param {number} sampleRate - Sample rate (default: 22050 for Piper)
 * @param {number} channels - Number of channels (1 = mono, 2 = stereo)
 * @param {number} bitsPerSample - Bits per sample (16 or 24)
 * @returns {Buffer} WAV file with header
 */
export function addWavHeader(pcmBuffer, sampleRate = 22050, channels = 1, bitsPerSample = 16) {
    const blockAlign = (channels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize - 8;

    const header = Buffer.alloc(headerSize);

    // RIFF chunk descriptor
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);

    // fmt sub-chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(channels, 22); // NumChannels
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(byteRate, 28); // ByteRate
    header.writeUInt16LE(blockAlign, 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

    // data sub-chunk
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

/**
 * Check if buffer already has WAV header
 * @param {Buffer} buffer - Audio buffer
 * @returns {boolean} True if buffer has WAV header
 */
export function hasWavHeader(buffer) {
    if (buffer.length < 12) return false;
    return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
}

/**
 * Ensure audio buffer has WAV header
 * @param {Buffer} buffer - Audio buffer (may or may not have header)
 * @param {Object} options - Audio options
 * @returns {Buffer} WAV file with header
 */
export function ensureWavFormat(buffer, options = {}) {
    if (hasWavHeader(buffer)) {
        return buffer;
    }

    // Assume raw PCM, add header
    const { sampleRate = 22050, channels = 1, bitsPerSample = 16 } = options;
    return addWavHeader(buffer, sampleRate, channels, bitsPerSample);
}
