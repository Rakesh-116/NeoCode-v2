import { useState, useRef, useEffect } from "react";
import { FaMicrophone, FaStop, FaPaperPlane, FaCircle } from "react-icons/fa";
import { toast } from "react-toastify";

const AudioRecorder = ({ onSubmit, disabled = false }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [waveformData, setWaveformData] = useState([]);
    const [showSilencePrompt, setShowSilencePrompt] = useState(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const animationRef = useRef(null);
    const analyserRef = useRef(null);
    const audioContextRef = useRef(null);
    const lastNonSilentAtRef = useRef(0);
    const silencePromptedRef = useRef(false);
    const silenceThreshold = 0.03; // normalized 0-1

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Setup audio context for visualization
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                setAudioBlob(blob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            setShowSilencePrompt(false);
            silencePromptedRef.current = false;
            lastNonSilentAtRef.current = performance.now();

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

            // Start waveform animation
            animateWaveform();

            toast.success("Recording started");
        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setShowSilencePrompt(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }

            toast.success("Recording stopped");
        }
    };

    const animateWaveform = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            // Sample 20 frequency bands for visualization
            const samples = 20;
            const step = Math.floor(bufferLength / samples);
            const bars = [];

            for (let i = 0; i < samples; i++) {
                const value = dataArray[i * step];
                bars.push(value / 255); // Normalize to 0-1
            }

            const avgLevel = bars.reduce((sum, value) => sum + value, 0) / bars.length;
            const now = performance.now();
            if (avgLevel >= silenceThreshold) {
                lastNonSilentAtRef.current = now;
                if (showSilencePrompt) {
                    setShowSilencePrompt(false);
                }
                silencePromptedRef.current = false;
            } else if (!silencePromptedRef.current && now - lastNonSilentAtRef.current >= 5000) {
                setShowSilencePrompt(true);
                silencePromptedRef.current = true;
            }

            setWaveformData(bars);
            animationRef.current = requestAnimationFrame(draw);
        };

        draw();
    };

    const handleSubmit = () => {
        if (audioBlob) {
            onSubmit(audioBlob);
            // Reset after submission
            setAudioBlob(null);
            setRecordingTime(0);
            setWaveformData([]);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            {/* Recording Status */}
            <div className="text-center mb-6">
                {isRecording && (
                    <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
                        <FaCircle className="animate-pulse" />
                        <span className="font-semibold">Recording...</span>
                    </div>
                )}
                <div className="text-3xl font-mono font-bold">{formatTime(recordingTime)}</div>
            </div>

            {/* Waveform Visualization */}
            {isRecording && waveformData.length > 0 && (
                <div className="flex items-center justify-center gap-1 h-20 mb-6">
                    {waveformData.map((value, index) => (
                        <div
                            key={index}
                            className="bg-white/60 rounded-full transition-all duration-100"
                            style={{
                                width: "4px",
                                height: `${Math.max(4, value * 60)}px`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Silence Prompt */}
            {isRecording && showSilencePrompt && (
                <div className="mb-6 text-center text-sm text-white/70 bg-white/10 border border-white/20 rounded-lg px-4 py-2">
                    Take your time — whenever you're ready, keep going.
                </div>
            )}

            {/* Audio Preview (if recorded) */}
            {audioBlob && !isRecording && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FaMicrophone className="text-xl text-green-400" />
                            <div>
                                <div className="font-semibold">Audio Recorded</div>
                                <div className="text-sm text-white/60">
                                    Duration: {formatTime(recordingTime)} • Size: {(audioBlob.size / 1024).toFixed(1)}{" "}
                                    KB
                                </div>
                            </div>
                        </div>
                        <audio src={URL.createObjectURL(audioBlob)} controls className="h-8" />
                    </div>
                </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4 justify-center">
                {!isRecording && !audioBlob && (
                    <button
                        onClick={startRecording}
                        disabled={disabled}
                        className="flex items-center gap-3 px-8 py-4 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaMicrophone className="text-xl" />
                        Start Recording
                    </button>
                )}

                {isRecording && (
                    <button
                        onClick={stopRecording}
                        className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all"
                    >
                        <FaStop className="text-xl" />
                        Stop Recording
                    </button>
                )}

                {audioBlob && !isRecording && (
                    <>
                        <button
                            onClick={() => {
                                setAudioBlob(null);
                                setRecordingTime(0);
                            }}
                            className="px-6 py-4 border border-white/20 text-white rounded-lg font-semibold hover:bg-white/10 transition-all"
                        >
                            Re-record
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={disabled}
                            className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaPaperPlane />
                            Submit Answer
                        </button>
                    </>
                )}
            </div>

            {/* Instructions */}
            {!isRecording && !audioBlob && (
                <p className="text-center text-white/60 text-sm mt-4">
                    Click the button to start recording your answer. Speak clearly into your microphone.
                </p>
            )}
        </div>
    );
};

export default AudioRecorder;
