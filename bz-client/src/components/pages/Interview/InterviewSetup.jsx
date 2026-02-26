import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaUpload, FaFileAlt, FaRocket, FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import Header from "../Header";
import Footer from "../Footer";

const InterviewSetup = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const interviewType = searchParams.get("type") || "topic";

    const [formData, setFormData] = useState({
        interviewType,
        difficulty: "medium",
        topic: "arrays",
        jobDescription: "",
        resume: "",
        targetQuestions: 5,
    });

    const [jdFile, setJdFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const topics = [
        { value: "arrays", label: "Arrays & Strings" },
        { value: "linked-lists", label: "Linked Lists" },
        { value: "trees", label: "Trees & Graphs" },
        { value: "dynamic-programming", label: "Dynamic Programming" },
        { value: "system-design", label: "System Design" },
        { value: "databases", label: "Database Design" },
        { value: "algorithms", label: "Algorithms" },
        { value: "behavioral", label: "Behavioral Questions" },
    ];

    const difficulties = [
        { value: "easy", label: "Easy", desc: "Good for beginners" },
        { value: "medium", label: "Medium", desc: "Standard interview level" },
        { value: "hard", label: "Hard", desc: "Advanced technical depth" },
    ];

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            if (type === "jd") {
                setFormData({ ...formData, jobDescription: text });
                setJdFile(file);
            } else {
                setFormData({ ...formData, resume: text });
                setResumeFile(file);
            }
        };
        reader.readAsText(file);
    };

    const startInterview = async () => {
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
        const jwtToken = Cookies.get("neo_code_jwt_token");

        if (!jwtToken) {
            navigate("/login");
            return;
        }

        // Validation
        if (interviewType === "topic" && !formData.topic) {
            toast.error("Please select a topic");
            return;
        }

        if (interviewType === "role") {
            if (!formData.jobDescription || !formData.resume) {
                toast.error("Please upload both job description and resume");
                return;
            }
        }

        setLoading(true);

        try {
            const payload = {
                mode: interviewType,
                difficulty: formData.difficulty,
                targetQuestions: formData.targetQuestions, // Send target question count
                ...(interviewType === "topic" && { topic: formData.topic }),
                ...(interviewType === "role" && {
                    targetRole: "Software Engineer", // Default role, could be made configurable
                    jobDescription: formData.jobDescription,
                    resumeText: formData.resume,
                }),
            };

            const response = await axios.post(`${API_BASE_URL}/api/interview/start`, payload, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    "Content-Type": "application/json",
                },
            });

            toast.success("Interview started successfully!");
            navigate(`/interview/room/${response.data.session.sessionId}`);
        } catch (error) {
            console.error("Error starting interview:", error);
            toast.error(error.response?.data?.error || "Failed to start interview");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <Header />

            <div className="container mx-auto px-6 py-12 pt-28 max-w-4xl">
                {/* Back Button */}
                <button
                    onClick={() => navigate("/interviews")}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <FaArrowLeft /> Back to Interviews
                </button>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="text-4xl font-bold mb-2 capitalize">{interviewType}-Based Interview Setup</h1>
                    <p className="text-white/60">
                        {interviewType === "topic"
                            ? "Configure your topic-focused technical interview"
                            : "Upload job description and resume for personalized interview"}
                    </p>
                </motion.div>

                <div className="space-y-6">
                    {/* Difficulty Selection */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <label className="block text-lg font-semibold mb-4">Select Difficulty</label>
                        <div className="grid md:grid-cols-3 gap-4">
                            {difficulties.map((diff) => (
                                <button
                                    key={diff.value}
                                    onClick={() => setFormData({ ...formData, difficulty: diff.value })}
                                    className={`p-4 rounded-lg border-2 text-left transition-all duration-300 ${
                                        formData.difficulty === diff.value
                                            ? "bg-white text-black border-white"
                                            : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                    }`}
                                >
                                    <div className="font-bold mb-1">{diff.label}</div>
                                    <div
                                        className={`text-sm ${
                                            formData.difficulty === diff.value ? "text-black/70" : "text-white/60"
                                        }`}
                                    >
                                        {diff.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Topic Selection (Topic-based only) */}
                    {interviewType === "topic" && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6"
                        >
                            <label className="block text-lg font-semibold mb-4">Choose Topic</label>
                            <div className="grid md:grid-cols-2 gap-3">
                                {topics.map((topic) => (
                                    <button
                                        key={topic.value}
                                        onClick={() => setFormData({ ...formData, topic: topic.value })}
                                        className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                                            formData.topic === topic.value
                                                ? "bg-white text-black border-white"
                                                : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                        }`}
                                    >
                                        {topic.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* File Uploads (Role-based only) */}
                    {interviewType === "role" && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white/5 border border-white/10 rounded-lg p-6"
                            >
                                <label className="block text-lg font-semibold mb-4">Upload Job Description</label>
                                <div className="space-y-3">
                                    <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 hover:border-white/30 transition-all duration-300">
                                        <FaUpload className="text-2xl" />
                                        <span>{jdFile ? jdFile.name : "Click to upload .txt file"}</span>
                                        <input
                                            type="file"
                                            accept=".txt"
                                            onChange={(e) => handleFileUpload(e, "jd")}
                                            className="hidden"
                                        />
                                    </label>
                                    <textarea
                                        placeholder="Or paste job description here..."
                                        value={formData.jobDescription}
                                        onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                                        className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30 resize-none"
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white/5 border border-white/10 rounded-lg p-6"
                            >
                                <label className="block text-lg font-semibold mb-4">Upload Your Resume</label>
                                <div className="space-y-3">
                                    <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 hover:border-white/30 transition-all duration-300">
                                        <FaFileAlt className="text-2xl" />
                                        <span>{resumeFile ? resumeFile.name : "Click to upload .txt file"}</span>
                                        <input
                                            type="file"
                                            accept=".txt"
                                            onChange={(e) => handleFileUpload(e, "resume")}
                                            className="hidden"
                                        />
                                    </label>
                                    <textarea
                                        placeholder="Or paste your resume here..."
                                        value={formData.resume}
                                        onChange={(e) => setFormData({ ...formData, resume: e.target.value })}
                                        className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30 resize-none"
                                    />
                                </div>
                            </motion.div>
                        </>
                    )}

                    {/* Number of Questions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                    >
                        <label className="block text-lg font-semibold mb-4">
                            Number of Questions: {formData.targetQuestions}
                        </label>
                        <input
                            type="range"
                            min="3"
                            max="10"
                            value={formData.targetQuestions}
                            onChange={(e) => setFormData({ ...formData, targetQuestions: parseInt(e.target.value) })}
                            className="w-full accent-white"
                        />
                        <div className="flex justify-between text-sm text-white/60 mt-2">
                            <span>3 questions</span>
                            <span>10 questions</span>
                        </div>
                    </motion.div>

                    {/* Start Button */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        onClick={startInterview}
                        disabled={loading}
                        className="w-full bg-white text-black py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 hover:bg-white/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaRocket />
                        {loading ? "Starting Interview..." : "Start Interview"}
                    </motion.button>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default InterviewSetup;
