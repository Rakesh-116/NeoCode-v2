/**
 * Voice Assistant - Siri-Style Interface
 * 
 * Voice-only AI assistant activated by "Hey Karen"
 * Bottom-left Siri-inspired design with wave animations
 * 
 * Features:
 * - Wake word detection ("Hey Karen")
 * - Voice-only interaction (no text input)
 * - Minimal Siri-style UI
 * - Context-aware responses
 * - Navigation handling
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { 
    Mic, 
    Volume2, 
    Sparkles,
    LoaderCircle
} from "lucide-react";

const VoiceAssistant = () => {
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [response, setResponse] = useState("");
    const [error, setError] = useState(null);
    const [showButton, setShowButton] = useState(true); // Show floating button for manual activation

    const navigate = useNavigate();
    const location = useLocation();
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const wakeWordRecognitionRef = useRef(null);

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    
    // Debug logging
    useEffect(() => {
        console.log("[Karen] 🎤 Voice Assistant Initialized");
        console.log("[Karen] 📡 Backend URL:", API_BASE);
        console.log("[Karen] 🔑 JWT Token:", Cookies.get("neo_code_jwt_token") ? "Present ✅" : "Missing ❌");
    }, []);

    // Initialize wake word detection
    useEffect(() => {
        if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            wakeWordRecognitionRef.current = new SpeechRecognition();
            wakeWordRecognitionRef.current.continuous = true;
            wakeWordRecognitionRef.current.interimResults = false;
            wakeWordRecognitionRef.current.lang = "en-US";

            wakeWordRecognitionRef.current.onresult = (event) => {
                const lastResult = event.results[event.results.length - 1];
                const text = lastResult[0].transcript.toLowerCase().trim();

                console.log("[Karen] 🎤 Wake word detection:", text);

                // Check for wake word
                if (text.includes("hey karen") || text.includes("hi karen") || text.includes("hello karen")) {
                    console.log("[Karen] ✅ Wake word detected! Activating...");
                    activateAssistant();
                }
            };

            wakeWordRecognitionRef.current.onerror = (event) => {
                if (event.error !== "no-speech") {
                    console.error("[Karen] ❌ Wake word error:", event.error);
                }
            };

            wakeWordRecognitionRef.current.onend = () => {
                // Auto-restart if not active
                if (!isActive) {
                    try {
                        wakeWordRecognitionRef.current.start();
                    } catch (e) {
                        // Already started
                    }
                }
            };

            // Start listening for wake word
            try {
                wakeWordRecognitionRef.current.start();
                console.log("[Karen] 🎧 Wake word detection started (red dot will appear)");
            } catch (error) {
                console.error("[Karen] Failed to start wake word detection:", error);
            }
        } else {
            console.warn("[Karen] Speech recognition not supported in this browser");
        }

        return () => {
            if (wakeWordRecognitionRef.current) {
                wakeWordRecognitionRef.current.stop();
            }
        };
    }, []);

    // Activate assistant and start listening
    const activateAssistant = () => {
        setIsActive(true);
        setError(null);
        setTranscript("");
        setResponse("");
        
        // Stop wake word detection while assistant is active
        if (wakeWordRecognitionRef.current) {
            wakeWordRecognitionRef.current.stop();
        }

        // Start recording immediately
        setTimeout(() => {
            startRecording();
        }, 500);
    };

    // Deactivate assistant
    const deactivateAssistant = () => {
        setIsActive(false);
        setIsListening(false);
        setIsProcessing(false);
        setIsSpeaking(false);
        
        // Restart wake word detection
        if (wakeWordRecognitionRef.current) {
            try {
                wakeWordRecognitionRef.current.start();
            } catch (e) {
                // Already started
            }
        }
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioChunksRef.current = [];
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await processVoiceCommand(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
            setError(null);

            // Auto-stop after 10 seconds
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    stopRecording();
                }
            }, 10000);

        } catch (error) {
            console.error("[Karen] Recording error:", error);
            setError("Microphone access denied");
            setTimeout(deactivateAssistant, 2000);
        }
    };

    // Stop recording audio
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
    };

    // Process voice command
    const processVoiceCommand = async (audioBlob) => {
        setIsProcessing(true);
        setError(null);

        try {
            const token = Cookies.get("neo_code_jwt_token");
            
            if (!token) {
                console.error("[Karen] ❌ No JWT token found");
                setError("Please login first");
                setTimeout(deactivateAssistant, 2000);
                return;
            }

            const context = getCurrentContext();
            const formData = new FormData();
            formData.append("audio", audioBlob, "voice.webm");
            formData.append("context", JSON.stringify(context));

            console.log("[Karen] 📤 Sending voice command to:", `${API_BASE}/api/assistant/voice`);
            console.log("[Karen] 📦 Context:", context);

            const response = await axios.post(
                `${API_BASE}/api/assistant/voice`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                    responseType: "arraybuffer",
                    timeout: 90000, // 90 second timeout (Whisper on CPU is slow)
                }
            );

            // Extract metadata from headers
            const transcription = decodeURIComponent(response.headers["x-transcription"] || "");
            const responseText = decodeURIComponent(response.headers["x-response-text"] || "");
            const navigateTo = response.headers["x-navigate"];

            console.log("[Karen] ✅ Transcription:", transcription);
            console.log("[Karen] 💬 Response:", responseText);

            setTranscript(transcription);
            setResponse(responseText);

            // Play response audio
            const audioResponseBlob = new Blob([response.data], { type: "audio/wav" });
            await playAudio(audioResponseBlob);

            // Handle navigation
            if (navigateTo) {
                console.log("[Karen] 🧭 Navigating to:", navigateTo);
                setTimeout(() => {
                    navigate(navigateTo);
                    deactivateAssistant();
                }, 1000);
            } else {
                // Auto-close after response
                setTimeout(deactivateAssistant, 2000);
            }
        } catch (error) {
            console.error("[Karen] ❌ Voice processing error:", error);
            console.error("[Karen] 📋 Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            
            setError(error.response?.data?.message || error.message || "Failed to process command");
            setTimeout(deactivateAssistant, 3000);
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
                reject(new Error("Audio playback failed"));
            };

            audio.play().catch(reject);
        });
    };

    return (
        <>
            {/* Floating Button - Bottom Left */}
            {!isActive && (
                <button
                    onClick={activateAssistant}
                    className="fixed bottom-8 left-8 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 text-white shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-300 z-[9998] flex items-center justify-center group"
                    title="Click or say 'Hey Karen'"
                >
                    <div className="relative">
                        <Sparkles size={28} className="drop-shadow-lg" />
                        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-3 left-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl">
                        💬 Click or say "Hey Karen"
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
                                            height: isListening || isSpeaking
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
                            {(transcript || response || error) && (
                                <div className="space-y-3 max-h-40 overflow-y-auto">
                                    {transcript && (
                                        <div className="text-center">
                                            <p className="text-base text-white/90 font-medium">
                                                "{transcript}"
                                            </p>
                                        </div>
                                    )}
                                    {response && (
                                        <div className="text-center">
                                            <p className="text-sm text-white/70">
                                                {response}
                                            </p>
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
                                        Say "Hey Karen" to activate • Speak your command now
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
