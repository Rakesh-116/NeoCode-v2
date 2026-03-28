/**
 * Voice Assistant - Siri-Style Interface
 *
 * Voice-only AI assistant activated by click
 * Bottom-left Siri-inspired design with wave animations
 *
 * Features:
 * - Click to activate
 * - Voice-only interaction (no text input)
 * - Minimal Siri-style UI
 * - Context-aware responses
 * - Navigation handling
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { Mic, Volume2, Sparkles, LoaderCircle } from "lucide-react";

const VoiceAssistant = () => {
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [liveTranscript, setLiveTranscript] = useState("");
    const [response, setResponse] = useState("");
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const autoStopTimeoutRef = useRef(null);
    const recognitionRef = useRef(null);
    const lastFinalTranscriptRef = useRef("");

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    const RECORDING_LIMIT_MS = 10000;
    const AUTO_CLOSE_MS = 2000;
    const ERROR_CLOSE_MS = 3000;
    const REQUEST_TIMEOUT_MS = 90000;

    // Debug logging
    useEffect(() => {
        console.log("[Karen] 🎤 Voice Assistant Initialized");
        console.log("[Karen] 📡 Backend URL:", API_BASE);
        console.log("[Karen] 🔑 JWT Token:", Cookies.get("neo_code_jwt_token") ? "Present ✅" : "Missing ❌");
    }, []);

    useEffect(() => {
        return () => {
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
                autoStopTimeoutRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // No-op
                }
            }
        };
    }, []);

    // Activate assistant and start listening
    const activateAssistant = () => {
        setIsActive(true);
        setError(null);
        setTranscript("");
        setLiveTranscript("");
        setResponse("");
        lastFinalTranscriptRef.current = "";
        startRecording();
    };

    // Deactivate assistant
    const deactivateAssistant = () => {
        setIsActive(false);
        setIsListening(false);
        setIsProcessing(false);
        setIsSpeaking(false);
        setLiveTranscript("");
        stopRecording();
    };

    // Get current page context
    const getCurrentContext = () => {
        const path = location.pathname;
        const context = {
            currentPage: path,
        };

        const problemMatch = path.match(/\/problems\/([a-f0-9-]+)/);
        if (problemMatch) {
            context.currentProblem = problemMatch[1];
        }

        const courseMatch = path.match(/\/courses\/([a-f0-9-]+)/);
        if (courseMatch) {
            context.currentCourse = courseMatch[1];
        }

        return context;
    };

    // Start recording audio
    const startRecording = async () => {
        try {
            if (isListening || isProcessing) return;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            audioChunksRef.current = [];
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                }
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await processVoiceCommand(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
            setError(null);
            startLiveTranscription();

            // Auto-stop after a fixed window
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
            }
            autoStopTimeoutRef.current = setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    stopRecording();
                }
            }, RECORDING_LIMIT_MS);
        } catch (error) {
            console.error("[Karen] Recording error:", error);
            setError("Microphone access denied");
            setTimeout(deactivateAssistant, AUTO_CLOSE_MS);
        }
    };

    // Stop recording audio
    const stopRecording = () => {
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
        stopLiveTranscription();
    };

    // Live speech-to-text (browser)
    const startLiveTranscription = () => {
        if (recognitionRef.current) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            let interim = "";
            let finalText = "";
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }
            if (finalText) {
                const trimmedFinal = finalText.trim();
                lastFinalTranscriptRef.current = trimmedFinal;
                setTranscript(trimmedFinal);
            }
            if (interim) {
                setLiveTranscript(interim.trim());
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== "no-speech") {
                console.error("[Karen] Live transcription error:", event.error);
            }
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            setLiveTranscript("");
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopLiveTranscription = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // No-op
            }
            recognitionRef.current = null;
        }
        setLiveTranscript("");
    };

    // Process voice command
    const processVoiceCommand = async (audioBlob) => {
        setIsProcessing(true);
        setError(null);

        try {
            if (!audioBlob || audioBlob.size === 0) {
                setError("No audio captured. Please try again.");
                setTimeout(deactivateAssistant, AUTO_CLOSE_MS);
                return;
            }
            const token = Cookies.get("neo_code_jwt_token");

            if (!token) {
                console.error("[Karen] ❌ No JWT token found");
                setError("Please login first");
                setTimeout(deactivateAssistant, AUTO_CLOSE_MS);
                return;
            }

            const context = getCurrentContext();
            const formData = new FormData();
            formData.append("audio", audioBlob, "voice.webm");
            formData.append("context", JSON.stringify(context));
            const clientTranscript =
                lastFinalTranscriptRef.current ||
                transcript ||
                liveTranscript;
            if (clientTranscript) {
                formData.append("clientTranscript", clientTranscript);
                console.log("[Karen] 📝 Client transcript:", clientTranscript);
            }

            console.log("[Karen] 📤 Sending voice command to:", `${API_BASE}/api/assistant/voice`);
            console.log("[Karen] 📦 Context:", context);

            const response = await axios.post(`${API_BASE}/api/assistant/voice`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
                responseType: "arraybuffer",
                timeout: REQUEST_TIMEOUT_MS, // Whisper on CPU can be slow
            });

            // Extract metadata from headers
            const transcription = decodeURIComponent(response.headers["x-transcription"] || "");
            const responseText = decodeURIComponent(response.headers["x-response-text"] || "");
            const navigateTo = response.headers["x-navigate"];
            const openUrl = decodeURIComponent(response.headers["x-open-url"] || "");

            console.log("[Karen] ✅ Transcription:", transcription);
            console.log("[Karen] 💬 Response:", responseText);

            setTranscript(transcription);
            setResponse(responseText);

            // Play response audio
            const audioResponseBlob = new Blob([response.data], { type: "audio/wav" });
            if (audioResponseBlob.size > 0) {
                await playAudio(audioResponseBlob);
            } else {
                console.warn("[Karen] Empty audio response, skipping playback");
            }

            // Handle external open (new tab) or navigation
            if (openUrl) {
                const opened = window.open(openUrl, "_blank", "noopener,noreferrer");
                if (!opened) {
                    setError("Popup blocked. Please allow popups to open links in a new tab.");
                }
                setTimeout(deactivateAssistant, AUTO_CLOSE_MS);
            } else if (navigateTo) {
                console.log("[Karen] Navigating to:", navigateTo);
                setTimeout(() => {
                    navigate(navigateTo);
                    deactivateAssistant();
                }, 1000);
            } else {
                // Auto-close after response
                setTimeout(deactivateAssistant, AUTO_CLOSE_MS);
            }
        } catch (error) {
            console.error("[Karen] ❌ Voice processing error:", error);
            console.error("[Karen] 📋 Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });

            setError(error.response?.data?.message || error.message || "Failed to process command");
            setTimeout(deactivateAssistant, ERROR_CLOSE_MS);
        } finally {
            setIsProcessing(false);
        }
    };

    // Play audio response
    const playAudio = (audioBlob) => {
        return new Promise((resolve, reject) => {
            setIsSpeaking(true);
            const audio = new Audio(URL.createObjectURL(audioBlob));

            audio.onended = () => {
                setIsSpeaking(false);
                resolve();
            };

            audio.onerror = () => {
                setIsSpeaking(false);
                console.warn("[Karen] Audio playback failed, skipping voice output");
                resolve();
            };

            audio.play().catch(() => {
                setIsSpeaking(false);
                console.warn("[Karen] Audio playback blocked by browser");
                resolve();
            });
        });
    };

    const displayTranscript = isListening && liveTranscript ? liveTranscript : transcript;

    return (
        <>
            {/* Floating Button - Bottom Left */}
            {!isActive && (
                <button
                    onClick={activateAssistant}
                    className="fixed bottom-8 left-8 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 text-white shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-300 z-[9998] flex items-center justify-center group"
                    title="Click to talk"
                >
                    <div className="relative">
                        <Sparkles size={28} className="drop-shadow-lg" />
                        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-3 left-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl">
                        💬 Click to talk
                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                    </div>
                </button>
            )}

            {/* Siri-Style Voice Interface - Only when active */}
            {isActive && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent backdrop-blur-sm z-[9998] animate-in fade-in duration-300"
                        onClick={deactivateAssistant}
                    />

                    {/* Siri-Style Voice Interface - Bottom Left */}
                    <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-in slide-in-from-bottom-5 duration-500">
                        <div className="max-w-2xl mx-auto px-8 pb-8">
                            <div className="bg-white/10 dark:bg-gray-900/40 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-gray-700/30 shadow-2xl overflow-hidden">
                                {/* Wave Animation Container */}
                                <div className="relative h-32 flex items-center justify-center overflow-hidden">
                                    {/* Animated Wave Bars - Siri Style */}
                                    <div className="flex items-center justify-center gap-1.5">
                                        {[...Array(12)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-1 rounded-full transition-all duration-300 ${
                                                    isListening
                                                        ? "bg-gradient-to-t from-red-500 via-pink-500 to-purple-500 animate-pulse"
                                                        : isProcessing
                                                          ? "bg-gradient-to-t from-blue-500 via-cyan-500 to-teal-500"
                                                          : isSpeaking
                                                            ? "bg-gradient-to-t from-green-500 via-emerald-500 to-teal-500 animate-pulse"
                                                            : "bg-gradient-to-t from-purple-500 via-indigo-500 to-blue-500"
                                                }`}
                                                style={{
                                                    height:
                                                        isListening || isSpeaking
                                                            ? `${20 + Math.random() * 60}%`
                                                            : isProcessing
                                                              ? "50%"
                                                              : "30%",
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: "0.8s",
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="px-6 pb-6 space-y-4">
                                    {/* Status */}
                                    <div className="text-center">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 dark:bg-gray-800/40 border border-white/20 dark:border-gray-700/30 backdrop-blur-sm">
                                            {isListening && (
                                                <>
                                                    <Mic className="text-red-400 animate-pulse" size={16} />
                                                    <span className="text-sm font-medium text-white">Listening...</span>
                                                </>
                                            )}
                                            {isProcessing && (
                                                <>
                                                    <LoaderCircle className="text-blue-400 animate-spin" size={16} />
                                                    <span className="text-sm font-medium text-white">Thinking...</span>
                                                </>
                                            )}
                                            {isSpeaking && (
                                                <>
                                                    <Volume2 className="text-green-400 animate-pulse" size={16} />
                                                    <span className="text-sm font-medium text-white">Speaking...</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transcript & Response */}
                                    {(displayTranscript || response || error) && (
                                        <div className="space-y-3 max-h-40 overflow-y-auto">
                                            {displayTranscript && (
                                                <div className="text-center">
                                                    <p className="text-base text-white/90 font-medium">
                                                        "{displayTranscript}"
                                                    </p>
                                                </div>
                                            )}
                                            {response && (
                                                <div className="text-center">
                                                    <p className="text-sm text-white/70">{response}</p>
                                                </div>
                                            )}
                                            {error && (
                                                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
                                                    <span className="text-red-200 text-sm">{error}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Hint Text */}
                                    {!transcript && !error && (
                                        <div className="text-center">
                                            <p className="text-xs text-white/50">
                                                Tap to talk - Speak your command now
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Manual Close (tap outside or wait for auto-close) */}
                            <div className="text-center mt-4">
                                <button
                                    onClick={deactivateAssistant}
                                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                                >
                                    Tap to close
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default VoiceAssistant;

