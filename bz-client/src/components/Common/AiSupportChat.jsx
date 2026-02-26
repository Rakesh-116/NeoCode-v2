/**
 * AiSupportChat.jsx
 * Floating AI support chat widget (bottom-right).
 * Sends user messages to POST /api/ai/support and displays replies.
 * Checks /api/ai/status on mount to disable UI if AI is unavailable.
 */

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useLocation } from "react-router-dom";
import { useUser } from "../../context/UserContext";

// ── constants ──────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_BACKEND_URL;
const STATUS_ENDPOINT = `${API_BASE}/api/ai/status`;
const SUPPORT_ENDPOINT = `${API_BASE}/api/ai/support`;
const MAX_HISTORY = 20; // keep last N messages in context payload
const REQUEST_TIMEOUT = 30000; // 30 s — matches backend config

// ── small pure helpers ─────────────────────────────────────────────────────

/** Format a Date to hh:mm am/pm */
function formatTime(date) {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}:${m} ${ampm}`;
}

/** Derive a display label from the provider name returned by the API */
function providerLabel(name) {
    if (!name) return null;
    if (name === "local") return "Local";
    if (name === "openai") return "OpenAI";
    if (name === "gemini") return "Gemini";
    return name;
}

// ── component ──────────────────────────────────────────────────────────────
export default function AiSupportChat() {
    const location = useLocation();
    const { isLoggedIn, userData } = useUser();

    // widget state (must be called before any conditional returns)
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState("");
    const [messages, setMessages] = useState([]); // { role, content, ts, provider? }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [aiAvailable, setAiAvailable] = useState(null); // null=checking, true, false
    const [activeProvider, setActiveProvider] = useState(null);

    // refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // ── Helper functions (defined before hooks that use them) ───────────

    async function checkAiStatus() {
        try {
            const res = await axios.get(STATUS_ENDPOINT, { timeout: 5000 });
            const providers = res.data?.status?.providers || {};
            let available = false;

            // find at least one available provider
            for (const key in providers) {
                if (providers[key]?.available) {
                    available = true;
                    setActiveProvider(key);
                    break;
                }
            }

            setAiAvailable(available);
        } catch (err) {
            // network error / server down — mark unavailable so badge shows correctly
            if (err.response) {
                // server responded with an error but is reachable; allow degraded use
                setAiAvailable(true);
            } else {
                setAiAvailable(false);
            }
        }
    }

    // ── build conversation history payload (last MAX_HISTORY messages) ──
    function buildHistory() {
        const start = Math.max(0, messages.length - MAX_HISTORY);
        const result = [];
        for (let i = start; i < messages.length; i++) {
            const msg = messages[i];
            result.push({ role: msg.role, content: msg.content });
        }
        return result;
    }

    // ── build context object ─────────────────────────────────────────────
    function buildContext() {
        // derive page name from pathname
        const path = location.pathname;
        const lastSegment = path === "/" ? "Home" : path.replace(/\//g, " ").trim();

        const ctx = {
            currentPage: lastSegment,
            authStatus: isLoggedIn ? "authenticated" : "guest",
        };

        if (isLoggedIn && userData) {
            const role = userData.role;
            ctx.userType = role === "admin" ? "Admin" : "Student";
        }

        return ctx;
    }

    // ── send message ─────────────────────────────────────────────────────
    async function sendMessage() {
        const text = inputText.trim();
        if (!text || isLoading) return;

        setError(null);

        // optimistic: append user message
        const userMsg = { role: "user", content: text, ts: new Date() };
        setMessages((prev) => [...prev, userMsg]);
        setInputText("");
        setIsLoading(true);

        // build payload
        const payload = {
            message: text,
            context: buildContext(),
            conversationHistory: buildHistory(),
        };

        // attach JWT if available (support chat is public but context is richer when authed)
        const token = Cookies.get("neo_code_jwt_token");
        const headers = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        try {
            const res = await axios.post(SUPPORT_ENDPOINT, payload, {
                headers,
                withCredentials: true,
                timeout: REQUEST_TIMEOUT,
            });

            const data = res.data;
            const assistantMsg = {
                role: "assistant",
                content: data.reply || "Sorry, I didn't understand that. Could you rephrase?",
                ts: new Date(),
                provider: data.provider || null,
            };

            setMessages((prev) => [...prev, assistantMsg]);
            setActiveProvider(assistantMsg.provider);
        } catch (err) {
            // surface a readable error in the chat
            let errText = "AI support is temporarily unavailable. Please try again.";

            if (err.response) {
                // server-side HTTP error
                const status = err.response.status;
                if (status === 403) errText = "AI Support feature is currently disabled.";
                else if (status === 400) errText = "Invalid request. Please try again.";
                else if (status === 500) errText = "Server error. Please try again later.";
            } else if (err.code === "ECONNABORTED" || err.code === "ERR_CANCELED") {
                errText = "Request timed out. The AI is taking too long — please try again.";
            } else if (!err.response) {
                // network-level failure (ERR_CONNECTION_REFUSED, offline, etc.)
                errText = "Cannot reach the server. Make sure the backend is running on port 3000.";
                // also flip status indicator so the badge shows correctly
                setAiAvailable(false);
            }

            setError(errText);
        } finally {
            setIsLoading(false);
        }
    }

    // ── keyboard handler ─────────────────────────────────────────────────
    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // ── toggle widget ────────────────────────────────────────────────────
    function toggleOpen() {
        setIsOpen((prev) => !prev);
        setError(null);
    }

    // ── Effects (after all functions are defined) ───────────────────────

    // ── check AI availability on mount ──────────────────────────────────
    useEffect(() => {
        if (isLoggedIn) {
            checkAiStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    // ── re-check status every time the panel opens ───────────────────────
    useEffect(() => {
        if (isLoggedIn && isOpen) {
            checkAiStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isLoggedIn]);

    // ── auto-scroll to latest message ───────────────────────────────────
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // ── focus input when chat is opened ─────────────────────────────────
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Only render chat support for logged-in users (after all hooks are called)
    if (!isLoggedIn) {
        return null;
    }

    // ── render ───────────────────────────────────────────────────────────
    const isDisabled = aiAvailable === false;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* ── chat panel ──────────────────────────────────────────── */}
            {isOpen && (
                <div
                    className="w-80 sm:w-96 flex flex-col rounded-xl shadow-2xl border border-gray-700 bg-gray-900 overflow-hidden"
                    style={{ height: "480px" }}
                >
                    {/* header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🤖</span>
                            <div>
                                <p className="text-white text-sm font-semibold leading-none">NeoCode AI</p>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    {aiAvailable === null ? "Checking…" : isDisabled ? "Unavailable" : "Online"}
                                </p>
                            </div>
                        </div>

                        {/* provider badge */}
                        {activeProvider && !isDisabled && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 border border-blue-700 font-mono">
                                {providerLabel(activeProvider)}
                            </span>
                        )}
                    </div>

                    {/* unavailable overlay */}
                    {isDisabled ? (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
                            <span className="text-4xl">⚠️</span>
                            <p className="text-gray-300 text-sm font-medium">AI Support Unavailable</p>
                            <p className="text-gray-500 text-xs">
                                No AI providers are currently online. Please check your Ollama setup or try again later.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* messages area */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
                                {/* welcome message */}
                                {messages.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-2xl mb-2">👋</p>
                                        <p className="text-gray-300 text-sm font-medium">
                                            Hi! I&apos;m the NeoCode assistant.
                                        </p>
                                        <p className="text-gray-500 text-xs mt-1">
                                            Ask me anything about the platform.
                                        </p>
                                    </div>
                                )}

                                {/* render messages — imperative loop */}
                                {(() => {
                                    const items = [];
                                    for (let i = 0; i < messages.length; i++) {
                                        const msg = messages[i];
                                        const isUser = msg.role === "user";
                                        const timeStr = formatTime(msg.ts);
                                        const provider = msg.provider;

                                        items.push(
                                            <div
                                                key={i}
                                                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm
                                                    ${
                                                        isUser
                                                            ? "bg-blue-600 text-white rounded-br-sm"
                                                            : "bg-gray-700 text-gray-100 rounded-bl-sm"
                                                    }`}
                                                >
                                                    {/* whitespace preserved for bullet-point replies */}
                                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-gray-600 text-xs">{timeStr}</span>
                                                    {provider && (
                                                        <span className="text-gray-700 text-xs">
                                                            · {providerLabel(provider)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>,
                                        );
                                    }
                                    return items;
                                })()}

                                {/* loading indicator */}
                                {isLoading && (
                                    <div className="flex items-start">
                                        <div className="bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                                            <div className="flex gap-1 items-center">
                                                <span
                                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                                                    style={{ animationDelay: "0ms" }}
                                                />
                                                <span
                                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                                                    style={{ animationDelay: "150ms" }}
                                                />
                                                <span
                                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                                                    style={{ animationDelay: "300ms" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* error state */}
                                {error && (
                                    <div className="flex items-start">
                                        <div className="max-w-[85%] bg-red-900/40 border border-red-700/50 rounded-2xl rounded-bl-sm px-3 py-2">
                                            <p className="text-red-300 text-xs">{error}</p>
                                        </div>
                                    </div>
                                )}

                                {/* scroll anchor */}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* input area */}
                            <div className="px-3 py-3 bg-gray-800 border-t border-gray-700">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        ref={inputRef}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isLoading}
                                        rows={1}
                                        placeholder={isLoggedIn ? "Ask anything…" : "Ask anything (not logged in)…"}
                                        className="flex-1 resize-none bg-gray-700 text-white text-sm rounded-lg px-3 py-2
                                            border border-gray-600 focus:border-blue-500 focus:outline-none
                                            placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed
                                            max-h-24 scrollbar-thin scrollbar-thumb-gray-600 leading-relaxed"
                                        style={{ minHeight: "38px" }}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={isLoading || !inputText.trim()}
                                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center
                                            bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed
                                            rounded-lg transition-colors duration-200"
                                        aria-label="Send message"
                                    >
                                        {isLoading ? (
                                            <svg
                                                className="w-4 h-4 animate-spin text-gray-400"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v8H4z"
                                                />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="text-gray-600 text-xs mt-1.5 pl-0.5">
                                    Enter to send · Shift+Enter for new line
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── toggle button ────────────────────────────────────────── */}
            <button
                onClick={toggleOpen}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg
                    transition-all duration-200 border
                    ${
                        isOpen
                            ? "bg-gray-700 border-gray-600 hover:bg-gray-600"
                            : isDisabled
                              ? "bg-gray-800 border-gray-700 cursor-not-allowed opacity-60"
                              : "bg-blue-600 border-blue-500 hover:bg-blue-500"
                    }`}
                title={isDisabled ? "AI Support unavailable" : isOpen ? "Close chat" : "AI Support"}
                disabled={isDisabled && !isOpen}
                aria-label="Toggle AI Support Chat"
            >
                {isOpen ? (
                    /* X icon */
                    <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    /* chat bubble icon */
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
