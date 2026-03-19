import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    FaArrowLeft,
    FaTrophy,
    FaClock,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationCircle,
    FaDownload,
    FaRedo,
    FaHome,
} from "react-icons/fa";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import Header from "../Header";
import Footer from "../Footer";
import ConceptProgressBar from "../../interviews/ConceptProgressBar";

const InterviewSummary = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();

    const [session, setSession] = useState(null);
    const [transcript, setTranscript] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retaking, setRetaking] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    const jwtToken = Cookies.get("neo_code_jwt_token");

    useEffect(() => {
        if (!jwtToken) {
            navigate("/login");
            return;
        }
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        setLoading(true);

        try {
            // Fetch session details
            const sessionResponse = await axios.get(`${API_BASE_URL}/api/interview/${sessionId}`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
            setSession(sessionResponse.data.session);

            // Fetch transcript
            const transcriptResponse = await axios.get(`${API_BASE_URL}/api/interview/${sessionId}/transcript`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
            setTranscript(transcriptResponse.data.transcript);

            await axios.get(`${API_BASE_URL}/api/interview/smart-review/stats`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });
        } catch (error) {
            console.error("Error fetching summary:", error);
            toast.error("Failed to load interview summary");
            navigate("/interviews");
        } finally {
            setLoading(false);
        }
    };

    const handleRetake = async () => {
        if (!sessionId) return;

        setRetaking(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/interview/${sessionId}/retake`,
                {},
                { headers: { Authorization: `Bearer ${jwtToken}` } },
            );

            const newSessionId = response.data?.session?.sessionId;
            if (!newSessionId) {
                throw new Error("Retake failed: missing new session id");
            }

            toast.success("Retake started");
            navigate(`/interview/room/${newSessionId}`);
        } catch (error) {
            console.error("Error retaking interview:", error);
            toast.error(error.response?.data?.message || error.message || "Failed to retake interview");
        } finally {
            setRetaking(false);
        }
    };

    const getVerdictIcon = (verdict) => {
        switch (verdict) {
            case "excellent":
                return <FaCheckCircle className="text-green-400" />;
            case "good":
                return <FaCheckCircle className="text-blue-400" />;
            case "needs_work":
                return <FaExclamationCircle className="text-yellow-400" />;
            default:
                return <FaTimesCircle className="text-red-400" />;
        }
    };

    const getVerdictColor = (verdict) => {
        switch (verdict) {
            case "excellent":
                return "bg-green-400/20 text-green-400 border-green-400/30";
            case "good":
                return "bg-blue-400/20 text-blue-400 border-blue-400/30";
            case "needs_work":
                return "bg-yellow-400/20 text-yellow-400 border-yellow-400/30";
            default:
                return "bg-red-400/20 text-red-400 border-red-400/30";
        }
    };

    const downloadTranscript = () => {
        const content = transcript
            .map(
                (turn) =>
                    `Q${turn.turn_number}: ${turn.question_text}\nA: ${turn.user_answer_text}\nScore: ${turn.score}/100\nFeedback: ${turn.feedback}\n\n`,
            )
            .join("");

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `interview-transcript-${sessionId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Transcript downloaded");
    };

    const calculateDuration = () => {
        if (!session || !session.started_at || !session.ended_at) return "N/A";
        const duration = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000);
        return `${duration} min`;
    };

    const conceptUpdates = session?.session_metadata?.conceptUpdates || [];

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                    <p className="text-white/60">Loading summary...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-white/60">Session not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <Header />

            <div className="container mx-auto px-6 py-12 pt-28 max-w-6xl">
                {/* Header */}
                <button
                    onClick={() => navigate("/interviews")}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <FaArrowLeft /> Back to Interviews
                </button>

                {/* Overall Stats */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-5xl font-bold mb-4">Interview Complete!</h1>
                    <p className="text-white/60 text-lg">
                        {session.session_mode === "topic" ? session.topic : session.target_role} •{" "}
                        <span className="capitalize">{session.difficulty}</span>
                    </p>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-8 text-center"
                    >
                        <FaTrophy className="text-yellow-400 text-4xl mx-auto mb-4" />
                        <div className="text-4xl font-bold mb-2">
                            {session.avg_score ? parseFloat(session.avg_score).toFixed(1) : "N/A"}
                        </div>
                        <div className="text-white/60">Average Score</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-8 text-center"
                    >
                        <FaCheckCircle className="text-green-400 text-4xl mx-auto mb-4" />
                        <div className="text-4xl font-bold mb-2">{session.questions_answered || 0}</div>
                        <div className="text-white/60">Questions Answered</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-8 text-center"
                    >
                        <FaClock className="text-blue-400 text-4xl mx-auto mb-4" />
                        <div className="text-4xl font-bold mb-2">{calculateDuration()}</div>
                        <div className="text-white/60">Duration</div>
                    </motion.div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4 justify-center mb-12">
                    <button
                        onClick={downloadTranscript}
                        className="flex items-center gap-2 px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-all"
                    >
                        <FaDownload />
                        Download Transcript
                    </button>
                    <button
                        onClick={handleRetake}
                        disabled={retaking}
                        className="flex items-center gap-2 px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <FaRedo />
                        {retaking ? "Starting Retake..." : "Retake Interview"}
                    </button>
                    <button
                        onClick={() => navigate("/interviews")}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg hover:bg-white/90 transition-all font-semibold"
                    >
                        <FaHome />
                        Back to Interviews
                    </button>
                </div>

                <ConceptProgressBar conceptUpdates={conceptUpdates} />

                {/* Per-Question Breakdown */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <h2 className="text-3xl font-bold mb-6">Question Breakdown</h2>

                    <div className="space-y-6">
                        {transcript.map((turn) => (
                            <div
                                key={turn.turn_number}
                                className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-all"
                            >
                                {/* Question Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="text-sm text-white/60 mb-1">Question {turn.turn_number}</div>
                                        <h3 className="text-xl font-semibold mb-2">{turn.question_text}</h3>
                                    </div>
                                    <div className="text-right ml-4">
                                        <div className="text-3xl font-bold mb-1">{turn.score}</div>
                                        <div
                                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium capitalize ${getVerdictColor(turn.verdict)}`}
                                        >
                                            {getVerdictIcon(turn.verdict)}
                                            {turn.verdict?.replace("_", " ")}
                                        </div>
                                    </div>
                                </div>

                                {/* Your Answer */}
                                {turn.user_answer_text && (
                                    <div className="mb-4">
                                        <div className="text-sm text-white/60 mb-2">Your Answer</div>
                                        <div className="bg-white/10 border border-white/20 rounded-lg p-4 italic">
                                            "{turn.user_answer_text}"
                                        </div>
                                    </div>
                                )}

                                {/* Feedback */}
                                {turn.feedback && (
                                    <div className="mb-4">
                                        <div className="text-sm text-white/60 mb-2">AI Feedback</div>
                                        <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                                            {turn.feedback}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Mistakes */}
                                {turn.detected_mistakes && turn.detected_mistakes.length > 0 && (
                                    <div>
                                        <div className="text-sm text-white/60 mb-2">Detected Issues</div>
                                        <div className="flex flex-wrap gap-2">
                                            {turn.detected_mistakes.map((mistake, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-3 py-1 bg-red-400/20 text-red-400 border border-red-400/30 rounded-full text-sm"
                                                >
                                                    {mistake}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {transcript.length === 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                            <p className="text-white/60">No questions answered yet</p>
                        </div>
                    )}
                </motion.div>

                {/* Performance Insights */}
                {transcript.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-12 bg-white/5 border border-white/10 rounded-lg p-8"
                    >
                        <h3 className="text-2xl font-bold mb-4">Performance Insights</h3>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Score Distribution */}
                            <div>
                                <div className="text-white/60 mb-3">Score Distribution</div>
                                <div className="space-y-2">
                                    {["excellent", "good", "needs_work", "poor"].map((verdict) => {
                                        const count = transcript.filter((t) => t.verdict === verdict).length;
                                        const percentage =
                                            transcript.length > 0 ? ((count / transcript.length) * 100).toFixed(0) : 0;

                                        return (
                                            <div key={verdict}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="capitalize">{verdict.replace("_", " ")}</span>
                                                    <span>
                                                        {count} ({percentage}%)
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${
                                                            verdict === "excellent"
                                                                ? "bg-green-400"
                                                                : verdict === "good"
                                                                  ? "bg-blue-400"
                                                                  : verdict === "needs_work"
                                                                    ? "bg-yellow-400"
                                                                    : "bg-red-400"
                                                        }`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Strengths & Weaknesses */}
                            <div>
                                <div className="text-white/60 mb-3">Key Takeaways</div>
                                <div className="space-y-2">
                                    {session.avg_score >= 80 && (
                                        <div className="flex items-start gap-2 text-green-400">
                                            <FaCheckCircle className="mt-1" />
                                            <span>Strong overall performance</span>
                                        </div>
                                    )}
                                    {session.avg_score >= 60 && session.avg_score < 80 && (
                                        <div className="flex items-start gap-2 text-blue-400">
                                            <FaCheckCircle className="mt-1" />
                                            <span>Good foundation, room for improvement</span>
                                        </div>
                                    )}
                                    {session.avg_score < 60 && (
                                        <div className="flex items-start gap-2 text-yellow-400">
                                            <FaExclamationCircle className="mt-1" />
                                            <span>Practice more to build confidence</span>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-2 text-white/60">
                                        <FaCheckCircle className="mt-1" />
                                        <span>
                                            Completed {session.questions_answered} questions in {calculateDuration()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <Footer />
        </div>
    );
};

export default InterviewSummary;
