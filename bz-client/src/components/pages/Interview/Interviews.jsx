import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaMicrophone, FaHistory, FaTrophy, FaClock, FaChartLine, FaTrash } from "react-icons/fa";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import Header from "../Header";
import Footer from "../Footer";
import SmartReviewCard from "../../interviews/SmartReviewCard";
import SmartReviewModal from "../../interviews/SmartReviewModal";

const Interviews = () => {
    const navigate = useNavigate();
    const [interviewHistory, setInterviewHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInterviews: 0,
        avgScore: 0,
        totalMinutes: 0,
        bestScore: 0,
    });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [showSmartReviewModal, setShowSmartReviewModal] = useState(false);

    useEffect(() => {
        fetchInterviewHistory();
    }, []);

    const fetchInterviewHistory = async () => {
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
        const jwtToken = Cookies.get("neo_code_jwt_token");

        if (!jwtToken) {
            navigate("/login");
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/api/interview/history`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });

            setInterviewHistory(response.data.interviews || []);
            calculateStats(response.data.interviews || []);
        } catch (error) {
            console.error("Error fetching interview history:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (interviews) => {
        if (interviews.length === 0) {
            return;
        }

        const total = interviews.length;
        const avgScore = interviews.reduce((sum, i) => sum + (i.overall_score || 0), 0) / total;
        const totalMinutes = interviews.reduce((sum, i) => sum + Math.round((i.duration_seconds || 0) / 60), 0);
        const bestScore = Math.max(...interviews.map((i) => i.overall_score || 0));

        setStats({ totalInterviews: total, avgScore, totalMinutes, bestScore });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "completed":
                return "text-green-400";
            case "active":
                return "text-blue-400";
            case "cancelled":
                return "text-red-400";
            default:
                return "text-white/60";
        }
    };

    const handleDelete = async (sessionId) => {
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
        const jwtToken = Cookies.get("neo_code_jwt_token");

        if (!jwtToken) {
            navigate("/login");
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/interview/${sessionId}`, {
                headers: { Authorization: `Bearer ${jwtToken}` },
            });

            toast.success("Interview deleted successfully");
            setDeleteConfirm(null);
            fetchInterviewHistory(); // Refresh list
        } catch (error) {
            console.error("Error deleting interview:", error);
            toast.error(error.response?.data?.message || "Failed to delete interview");
        }
    };

    const startSmartReviewSession = async () => {
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
        const jwtToken = Cookies.get("neo_code_jwt_token");

        if (!jwtToken) {
            navigate("/login");
            return;
        }

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/interview/smart-review/start`,
                {},
                { headers: { Authorization: `Bearer ${jwtToken}` } },
            );
            const sessionId = response.data?.session?.sessionId;
            if (!sessionId) {
                toast.info("No concepts due right now");
                return;
            }
            navigate(`/interview/room/${sessionId}`);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to start Smart Review");
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <Header />

            <div className="container mx-auto px-6 py-12 pt-28 max-w-7xl">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-5xl font-bold mb-4">AI Voice Interviews</h1>
                    <p className="text-white/70 text-lg max-w-2xl mx-auto">
                        Practice coding interviews with AI-powered voice feedback. Choose topic-based or role-based
                        interviews.
                    </p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <FaTrophy className="text-yellow-400 text-2xl mb-2" />
                        <div className="text-3xl font-bold">{stats.totalInterviews}</div>
                        <div className="text-white/60 text-sm">Total Interviews</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <FaChartLine className="text-green-400 text-2xl mb-2" />
                        <div className="text-3xl font-bold">{stats.avgScore.toFixed(1)}%</div>
                        <div className="text-white/60 text-sm">Average Score</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <FaClock className="text-blue-400 text-2xl mb-2" />
                        <div className="text-3xl font-bold">{stats.totalMinutes}</div>
                        <div className="text-white/60 text-sm">Minutes Practiced</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <FaTrophy className="text-purple-400 text-2xl mb-2" />
                        <div className="text-3xl font-bold">{stats.bestScore.toFixed(1)}%</div>
                        <div className="text-white/60 text-sm">Best Score</div>
                    </motion.div>
                </div>

                {/* Start New Interview Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/5 border border-white/10 rounded-lg p-8 mb-12"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <FaMicrophone className="text-2xl" />
                        <h2 className="text-2xl font-bold">Start New Interview</h2>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <button
                            onClick={() => navigate("/interview/setup?type=topic")}
                            className="bg-white/10 border border-white/20 rounded-lg p-6 text-left hover:bg-white/15 hover:border-white/30 transition-all duration-300 group"
                        >
                            <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">
                                Topic-Based Interview
                            </h3>
                            <p className="text-white/60 mb-4">
                                Focus on specific topics like Arrays, Dynamic Programming, System Design, etc.
                            </p>
                            <span className="text-blue-400">Choose Topics →</span>
                        </button>

                        <button
                            onClick={() => navigate("/interview/setup?type=role")}
                            className="bg-white/10 border border-white/20 rounded-lg p-6 text-left hover:bg-white/15 hover:border-white/30 transition-all duration-300 group"
                        >
                            <h3 className="text-xl font-bold mb-2 group-hover:text-green-400 transition-colors">
                                Role-Based Interview
                            </h3>
                            <p className="text-white/60 mb-4">
                                Simulate real interviews by uploading a job description and your resume.
                            </p>
                            <span className="text-green-400">Upload JD & Resume →</span>
                        </button>
                        <div className="md:col-span-2 xl:col-span-1">
                            <SmartReviewCard onStartReview={() => setShowSmartReviewModal(true)} />
                        </div>
                    </div>
                </motion.div>

                {/* Interview History */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                    <div className="flex items-center gap-3 mb-6">
                        <FaHistory className="text-xl" />
                        <h2 className="text-2xl font-bold">Recent Interviews</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-white/60">Loading...</div>
                    ) : interviewHistory.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                            <FaMicrophone className="text-5xl text-white/20 mx-auto mb-4" />
                            <p className="text-white/60">No interviews yet. Start your first interview above!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {interviewHistory.map((interview) => (
                                <div
                                    key={interview.id}
                                    className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300 relative"
                                >
                                    <div
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/interview/summary/${interview.id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-xl font-bold capitalize">
                                                    {interview.session_mode} Interview
                                                </h3>
                                                <p className="text-white/60 text-sm">
                                                    {interview.topic || interview.target_role || "General Interview"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className={`text-sm font-medium mb-1 ${getStatusColor(interview.status)}`}
                                                >
                                                    {interview.status}
                                                </div>
                                                {interview.overall_score !== null && (
                                                    <div className="text-2xl font-bold">
                                                        {parseFloat(interview.overall_score).toFixed(1)}%
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-6 text-sm text-white/60 mb-4">
                                            <span>Mode: {interview.session_mode}</span>
                                            <span>Questions: {interview.total_questions}</span>
                                            <span>
                                                Duration: {Math.round((interview.duration_seconds || 0) / 60)} min
                                            </span>
                                            <span>{new Date(interview.started_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Delete Button - Bottom Right */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirm(interview.id);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 transition-all duration-200 text-sm font-medium"
                                            title="Delete interview"
                                        >
                                            <FaTrash className="text-xs" />
                                            Delete Interview
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/10 border border-white/20 rounded-lg p-8 max-w-md mx-4 backdrop-blur-sm"
                    >
                        <h3 className="text-2xl font-bold mb-4">Delete Interview?</h3>
                        <p className="text-white/70 mb-6">
                            Are you sure you want to delete this interview? This action cannot be undone and will remove
                            all questions, answers, and scores.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            <SmartReviewModal
                isOpen={showSmartReviewModal}
                onClose={() => setShowSmartReviewModal(false)}
                onConfirmStart={() => startSmartReviewSession()}
            />

            <Footer />
        </div>
    );
};

export default Interviews;
