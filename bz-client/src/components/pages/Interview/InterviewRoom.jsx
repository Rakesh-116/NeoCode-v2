import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationCircle,
    FaChartLine,
    FaFlag,
    FaChevronLeft,
    FaChevronRight,
} from "react-icons/fa";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import Header from "../Header";
import Footer from "../Footer";
import AudioPlayer from "./AudioPlayer";
import AudioRecorder from "./AudioRecorder";
import InterviewCodingWorkspace from "./InterviewCodingWorkspace";

const InterviewRoom = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();

    const [session, setSession] = useState(null);
    const [allQuestions, setAllQuestions] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [currentTurn, setCurrentTurn] = useState(null);
    const [currentTurnNumber, setCurrentTurnNumber] = useState(1);
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [questionsLoaded, setQuestionsLoaded] = useState(false);
    const [generating, setGenerating] = useState(false); // Prevent multiple simultaneous generations

    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    const jwtToken = Cookies.get("neo_code_jwt_token");

    const looksLikeCodingQuestion = (text) => {
        if (!text) return false;
        const lower = text.toLowerCase();
        const hints = [
            "write",
            "implement",
            "code",
            "algorithm",
            "complexity",
            "o(",
            "array",
            "string",
            "matrix",
            "graph",
            "tree",
            "linked list",
            "stack",
            "queue",
            "hash",
            "dynamic programming",
            "dp",
            "binary search",
            "sort",
            "search",
            "input",
            "output",
            "constraints",
            "subarray",
            "substring",
            "grid",
        ];
        return hints.some((hint) => lower.includes(hint));
    };

    const isCodingQuestion =
        Boolean(currentQuestion?.requiresCodeEditor) ||
        Boolean(currentQuestion?.problemId || currentQuestion?.problem) ||
        (currentQuestion?.questionType || "").toLowerCase() === "coding" ||
        looksLikeCodingQuestion(currentQuestion?.question);

    const getQuestionMeta = () => {
        const meta = currentQuestion?.questionMeta || {};
        const conceptTags =
            currentQuestion?.conceptTags ||
            meta.conceptTags ||
            [];
        const followUps = meta.followUps || [];
        const evaluationCriteria =
            currentQuestion?.validationCriteria?.evaluation_criteria ||
            meta.evaluationCriteria ||
            null;
        const topic = meta.topic || currentQuestion?.topic || null;

        return {
            topic,
            conceptTags,
            followUps,
            evaluationCriteria,
        };
    };

    const getQuestionText = () => {
        const text = currentQuestion?.question;
        if (!text || typeof text !== "string") return "";
        const trimmed = text.trim();
        if (trimmed.startsWith("{") && trimmed.includes('"question"')) {
            try {
                let candidate = trimmed;
                const firstBrace = candidate.indexOf("{");
                const lastBrace = candidate.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    candidate = candidate.slice(firstBrace, lastBrace + 1);
                }
                candidate = candidate.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");

                let out = "";
                let inString = false;
                let escaped = false;
                for (let i = 0; i < candidate.length; i += 1) {
                    const ch = candidate[i];
                    if (escaped) {
                        out += ch;
                        escaped = false;
                        continue;
                    }
                    if (ch === "\\") {
                        out += ch;
                        escaped = true;
                        continue;
                    }
                    if (ch === "\"") {
                        out += ch;
                        inString = !inString;
                        continue;
                    }
                    if (!inString && (ch === "{" || ch === ",")) {
                        out += ch;
                        let j = i + 1;
                        while (j < candidate.length && /\s/.test(candidate[j])) {
                            out += candidate[j];
                            j += 1;
                        }
                        if (candidate[j] === "\"") {
                            i = j - 1;
                            continue;
                        }
                        const keyStart = j;
                        while (j < candidate.length && /[A-Za-z0-9_]/.test(candidate[j])) {
                            j += 1;
                        }
                        const key = candidate.slice(keyStart, j);
                        if (key.length > 0) {
                            let k = j;
                            while (k < candidate.length && /\s/.test(candidate[k])) {
                                k += 1;
                            }
                            if (candidate[k] === ":") {
                                out += `"${key}"`;
                                i = j - 1;
                                continue;
                            }
                        }
                    }
                    out += ch;
                }

                out = out.replace(/,\s*([}\]])/g, "$1").trim();
                const parsed = JSON.parse(out);
                if (parsed?.question) {
                    return parsed.question;
                }
            } catch (error) {
                return text;
            }
        }
        return text;
    };

    useEffect(() => {
        if (!jwtToken) {
            navigate("/login");
            return;
        }
        fetchSession();
        fetchAllQuestions();
    }, []);

    // Only load question after questions list is fetched
    useEffect(() => {
        if (questionsLoaded && currentTurnNumber) {
            loadQuestion(currentTurnNumber);
        }
    }, [currentTurnNumber, questionsLoaded]);

    const fetchSession = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/interview/${sessionId}`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
            setSession(response.data.session);
        } catch (error) {
            console.error("Error fetching session:", error);
            toast.error("Failed to load interview session");
            navigate("/interviews");
        }
    };

    const fetchAllQuestions = async (skipAutoSelect = false) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/interview/${sessionId}/questions`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
            const questions = response.data.questions || [];
            setAllQuestions(questions);

            // If no questions exist, generate the first one
            if (questions.length === 0) {
                setQuestionsLoaded(true); // Mark as loaded before generating
                await fetchNextQuestion();
            } else {
                setQuestionsLoaded(true);
                // Always start from Question 1 on initial page load
                if (!skipAutoSelect) {
                    setCurrentTurnNumber(1);
                }
            }
        } catch (error) {
            console.error("Error fetching questions:", error);
            setQuestionsLoaded(true);
            // If questions don't exist yet, generate first question
            if (error.response?.status === 404 || !error.response) {
                await fetchNextQuestion();
            }
        }
    };

    const loadQuestion = async (turnNumber) => {
        setLoading(true);
        setEvaluation(null);

        try {
            // Check if question exists in allQuestions
            const existingQuestion = allQuestions.find((q) => q.turnNumber === turnNumber);

            if (existingQuestion) {
                const shouldIncludeAudio = true;

                // Load the specific question with audio
                const response = await axios.get(
                    `${API_BASE_URL}/api/interview/${sessionId}/question/${turnNumber}?includeAudio=${shouldIncludeAudio}`,
                    {
                        headers: { Authorization: `Bearer ${jwtToken}` },
                    },
                );

                setCurrentQuestion(response.data.question);
                setCurrentTurn(response.data.question.turnId);

                // If already answered, load evaluation
                if (response.data.question.isAnswered) {
                    setEvaluation({
                        score: response.data.question.score,
                        verdict: response.data.question.verdict,
                        feedback: response.data.question.feedback,
                        transcription: response.data.question.transcription,
                    });
                }
            } else {
                // Question doesn't exist yet - don't auto-generate, let user click "Next Question"
                console.warn(
                    `Question ${turnNumber} not found in session. User needs to generate it by clicking "Next Question".`,
                );

                // Clear current state to show empty question slot
                setCurrentQuestion(null);
                setCurrentTurn(null);
            }
        } catch (error) {
            console.error("Error loading question:", error);
            toast.error(error.response?.data?.message || "Failed to load question");
        } finally {
            setLoading(false);
        }
    };

    const fetchNextQuestion = async () => {
        // Prevent multiple simultaneous question generations
        if (generating) {
            console.log("[InterviewRoom] Question generation already in progress, skipping duplicate call");
            return;
        }

        setLoading(true);
        setGenerating(true);
        setEvaluation(null);

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/interview/${sessionId}/question`,
                {},
                {
                    headers: { Authorization: `Bearer ${jwtToken}` },
                },
            );

            setCurrentQuestion(response.data.question);
            setCurrentTurn(response.data.question.turnId);
            setCurrentTurnNumber(response.data.question.turnNumber);
            setQuestionsLoaded(true);

            // Refresh all questions list (skip auto-select to preserve current turn)
            fetchAllQuestions(true).catch((err) => console.error("Error refreshing questions:", err));
        } catch (error) {
            console.error("Error fetching question:", error);
            toast.error(error.response?.data?.message || "Failed to load question");
        } finally {
            setLoading(false);
            setGenerating(false);
        }
    };

    const handleSubmitAnswer = async (audioBlob) => {
        if (!currentTurn) {
            toast.error("No active question");
            return;
        }

        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append("turnId", currentTurn);
            formData.append("audio", audioBlob, "answer.wav");

            const response = await axios.post(`${API_BASE_URL}/api/interview/${sessionId}/answer`, formData, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            setEvaluation(response.data.evaluation);
            toast.success("Answer submitted successfully!");

            // Refresh questions list to update "answered" status (skip auto-select)
            await fetchAllQuestions(true);
        } catch (error) {
            console.error("Error submitting answer:", error);
            toast.error(error.response?.data?.message || "Failed to submit answer");
        } finally {
            setSubmitting(false);
        }
    };

    const handleNextQuestion = () => {
        fetchNextQuestion();
    };

    const handlePreviousQuestion = () => {
        if (currentTurnNumber > 1) {
            setCurrentTurnNumber(currentTurnNumber - 1);
        }
    };

    const handleNextExistingQuestion = () => {
        if (currentTurnNumber < allQuestions.length) {
            setCurrentTurnNumber(currentTurnNumber + 1);
        }
    };

    const handleGoToQuestion = (turnNumber) => {
        setCurrentTurnNumber(turnNumber);
    };

    const handleEndInterview = async () => {
        if (!confirm("Are you sure you want to end the interview?")) {
            return;
        }

        setEnding(true);

        try {
            await axios.post(
                `${API_BASE_URL}/api/interview/${sessionId}/end`,
                {},
                {
                    headers: { Authorization: `Bearer ${jwtToken}` },
                },
            );

            toast.success("Interview completed!");
            navigate(`/interview/summary/${sessionId}`);
        } catch (error) {
            console.error("Error ending interview:", error);
            toast.error(error.response?.data?.message || "Failed to end interview");
            setEnding(false);
        }
    };

    const getVerdictIcon = (verdict) => {
        switch (verdict) {
            case "excellent":
                return <FaCheckCircle className="text-green-400 text-3xl" />;
            case "good":
                return <FaCheckCircle className="text-blue-400 text-3xl" />;
            case "needs_work":
                return <FaExclamationCircle className="text-yellow-400 text-3xl" />;
            default:
                return <FaTimesCircle className="text-red-400 text-3xl" />;
        }
    };

    const getVerdictColor = (verdict) => {
        switch (verdict) {
            case "excellent":
                return "text-green-400";
            case "good":
                return "text-blue-400";
            case "needs_work":
                return "text-yellow-400";
            default:
                return "text-red-400";
        }
    };

    if (!jwtToken) {
        return null;
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <Header />

            <div className="mx-auto w-full px-6 py-12 pt-28 max-w-[1600px]">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <button
                        onClick={() => navigate("/interviews")}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <FaArrowLeft /> Exit Interview
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-white/60">
                            Question {currentTurnNumber} {allQuestions.length > 0 && `of ${allQuestions.length}`}
                        </div>
                        <button
                            onClick={handleEndInterview}
                            disabled={ending}
                            className="flex items-center gap-2 px-4 py-2 border border-red-400/50 text-red-400 rounded-lg hover:bg-red-400/10 transition-all disabled:opacity-50"
                        >
                            <FaFlag />
                            End Interview
                        </button>
                    </div>
                </div>

                {/* Question Navigator */}
                {allQuestions.length > 0 && (
                    <div className="mb-6 bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-white/60">Questions</div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePreviousQuestion}
                                    disabled={currentTurnNumber === 1}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Previous Question"
                                >
                                    <FaChevronLeft />
                                </button>
                                <button
                                    onClick={handleNextExistingQuestion}
                                    disabled={currentTurnNumber === allQuestions.length}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Next Question"
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allQuestions.map((q) => (
                                <button
                                    key={q.turnId}
                                    onClick={() => handleGoToQuestion(q.turnNumber)}
                                    className={`
                                        w-10 h-10 rounded-lg font-semibold transition-all
                                        ${
                                            currentTurnNumber === q.turnNumber
                                                ? "bg-white text-black"
                                                : q.isAnswered
                                                  ? "bg-green-500/30 border border-green-500/50 text-green-400 hover:bg-green-500/40"
                                                  : "bg-white/10 border border-white/20 text-white/60 hover:bg-white/20"
                                        }
                                    `}
                                    title={
                                        q.isAnswered
                                            ? `Question ${q.turnNumber} (Answered)`
                                            : `Question ${q.turnNumber} (Unanswered)`
                                    }
                                >
                                    {q.turnNumber}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Session Info */}
                {session && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 mb-8"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold capitalize">{session.session_mode} Interview</h2>
                                <p className="text-white/60">
                                    {session.topic || session.target_role || "General Interview"} •{" "}
                                    <span className="capitalize">{session.difficulty}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                                <FaChartLine />
                                <span>Questions Answered: {session.questions_answered || 0}</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                        <p className="text-white/60">Loading next question...</p>
                    </div>
                )}

                {/* Question Display */}
                {!loading && currentQuestion && (
                    <div className="space-y-8">
                        {isCodingQuestion ? (
                            <InterviewCodingWorkspace
                                sessionId={sessionId}
                                turnNumber={currentTurnNumber}
                                question={currentQuestion}
                            />
                        ) : (
                            /* Question Card */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white/5 border border-white/10 rounded-lg p-8"
                            >
                                    <div className="mb-6">
                                        <div className="text-sm text-white/60 mb-2">Question {currentTurnNumber}</div>
                                    <h3 className="text-2xl font-bold mb-4">{getQuestionText()}</h3>
                                    </div>

                                {(() => {
                                    const meta = getQuestionMeta();
                                    const hasMeta =
                                        meta.topic ||
                                        (meta.conceptTags && meta.conceptTags.length > 0) ||
                                        (meta.followUps && meta.followUps.length > 0) ||
                                        meta.evaluationCriteria;
                                    if (!hasMeta) return null;
                                    return (
                                        <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-6">
                                            <div className="text-sm text-white/60 mb-2">Interview Metadata</div>
                                            {meta.topic && (
                                                <div className="text-white/90 mb-2">
                                                    <span className="text-white/60">Topic:</span> {meta.topic}
                                                </div>
                                            )}
                                            {meta.evaluationCriteria && (
                                                <div className="text-white/90 mb-2">
                                                    <span className="text-white/60">Evaluation Criteria:</span>{" "}
                                                    {meta.evaluationCriteria}
                                                </div>
                                            )}
                                            {meta.conceptTags && meta.conceptTags.length > 0 && (
                                                <div className="text-white/90 mb-2">
                                                    <span className="text-white/60">Concept Tags:</span>{" "}
                                                    {meta.conceptTags.join(", ")}
                                                </div>
                                            )}
                                            {meta.followUps && meta.followUps.length > 0 && (
                                                <div className="text-white/90">
                                                    <span className="text-white/60">Suggested Follow-ups:</span>{" "}
                                                    {meta.followUps.join(" • ")}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Audio Player */}
                                {currentQuestion.audio && (
                                    <AudioPlayer audioBase64={currentQuestion.audio} label="Question Audio" />
                                )}
                            </motion.div>
                        )}

                        {/* Answer Section (voice) */}
                        {!evaluation && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h4 className="text-xl font-semibold mb-4">Your Answer</h4>
                                {isCodingQuestion && (
                                    <p className="text-white/60 mb-3">
                                        Submit your code first, then record a short explanation of your approach.
                                    </p>
                                )}
                                <AudioRecorder onSubmit={handleSubmitAnswer} disabled={submitting} />
                                {submitting && (
                                    <div className="text-center mt-4 text-white/60">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                                        <p>Processing your answer...</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Evaluation Display */}
                        <AnimatePresence>
                            {evaluation && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Score Card */}
                                    <div className="bg-white/5 border border-white/10 rounded-lg p-8">
                                        <div className="flex items-center gap-6 mb-6">
                                            {getVerdictIcon(evaluation.verdict)}
                                            <div>
                                                <div className="text-sm text-white/60">Your Score</div>
                                                <div className="text-5xl font-bold">{evaluation.score}</div>
                                                <div
                                                    className={`text-lg font-semibold capitalize ${getVerdictColor(evaluation.verdict)}`}
                                                >
                                                    {evaluation.verdict.replace("_", " ")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Transcription */}
                                        {evaluation.transcription && (
                                            <div className="mb-6">
                                                <div className="text-sm text-white/60 mb-2">Your Answer</div>
                                                <div className="bg-white/10 border border-white/20 rounded-lg p-4 italic">
                                                    "{evaluation.transcription}"
                                                </div>
                                            </div>
                                        )}

                                        {/* Feedback */}
                                        {evaluation.feedback && (
                                            <div className="mb-6">
                                                <div className="text-sm text-white/60 mb-2">AI Feedback</div>
                                                <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                                                    {evaluation.feedback}
                                                </div>
                                            </div>
                                        )}

                                        {/* Code Verdict */}
                                        {evaluation.codeVerdict && (
                                            <div className="mb-6">
                                                <div className="text-sm text-white/60 mb-2">Code Verdict</div>
                                                <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                                                    {evaluation.codeVerdict}
                                                </div>
                                            </div>
                                        )}

                                        {/* Feedback Audio */}
                                        {evaluation.feedbackAudio && (
                                            <AudioPlayer
                                                audioBase64={evaluation.feedbackAudio}
                                                label="Feedback Audio"
                                            />
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-4 justify-center">
                                        <button
                                            onClick={handleNextQuestion}
                                            className="px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all"
                                        >
                                            Next Question
                                        </button>
                                        <button
                                            onClick={handleEndInterview}
                                            disabled={ending}
                                            className="px-8 py-4 border border-white/20 text-white rounded-lg font-semibold hover:bg-white/10 transition-all disabled:opacity-50"
                                        >
                                            End Interview
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
};

export default InterviewRoom;
