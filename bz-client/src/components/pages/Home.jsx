import { useEffect, useState } from "react";
import {
    FaWandMagicSparkles,
    FaCode,
    FaRocket,
    FaBrain,
    FaChartLine,
    FaMicrophone,
    FaRobot,
    FaCircleCheck,
} from "react-icons/fa6";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";

import Header from "./Header";
import stars from "../../assets/stars.png";
import { useUser } from "../../context/UserContext";
import Footer from "./Footer";

const Home = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData, updateUserData, isLoggedIn } = useUser();
    const [loadingProfile, setLoadingProfile] = useState(false);
    const searchParams = new URLSearchParams(location.search);
    const nextPath = searchParams.get("next");

    useEffect(() => {
        const jwtToken = Cookies.get("neo_code_jwt_token");
        // if (!jwtToken) {
        //   navigate("/login");
        //   return;
        // }

        if (!userData) {
            fetchUserData(jwtToken);
        }
    }, [userData]);

    const fetchUserData = async (jwtToken) => {
        setLoadingProfile(true);
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

        try {
            const response = await axios.get(`${API_BASE_URL}/api/user/profile`, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });
            updateUserData(response.data.user);
        } catch (error) {
            console.error("Error fetching user data:", error);
            if (error.response?.status === 405) {
                Cookies.remove("neo_code_jwt_token");
                navigate("/login");
            }
        } finally {
            setLoadingProfile(false);
        }
    };

    return (
        <div className="bg-black min-h-screen">
            <Header />

            {/* Hero Section */}
            <div
                className="bg-black min-h-screen bg-cover bg-center flex flex-col items-center justify-center relative"
                style={{ backgroundImage: `url(${stars})` }}
            >
                <div className="container mx-auto px-6 relative">
                    <div className="absolute inset-0 flex justify-center items-center">
                        <div
                            className="h-[100%] w-[40%] bg-white/15 
              bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] 
              bg-[size:44px_44px] 
              backdrop-blur-md opacity-50 rounded-xl"
                            style={{
                                maskImage:
                                    "radial-gradient(closest-side, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 90%)",
                                WebkitMaskImage:
                                    "radial-gradient(closest-side, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 90%)",
                            }}
                        />
                    </div>
                    <div className="relative z-10 text-center max-w-4xl mx-auto pt-20">
                        <div className="text-white/70 font-thin tracking-wider mb-4 w-fit mx-auto">
                            <motion.span
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="border border-white/25 px-4 py-2 rounded-md backdrop-blur-md bg-white/10 text-sm flex justify-center items-center gap-2 hover:border-white/40 transition-all duration-300"
                            >
                                <FaWandMagicSparkles className="text-white" />
                                TRANSFORM YOUR CODING EXPERIENCE
                            </motion.span>
                        </div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-7xl font-bold text-white mb-6 mt-10"
                        >
                            NeoCode
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="text-lg text-white/70 mb-8 mt-10 max-w-2xl mx-auto"
                        >
                            AI-powered learning platform with personalized mentorship. Master coding through intelligent
                            skill tracking, career roadmaps, and validated progress across multiple languages.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                            className="flex gap-4 justify-center mt-10 flex-wrap"
                        >
                            {isLoggedIn ? (
                                <>
                                    <button
                                        className="px-8 py-3 bg-white text-black rounded-md font-medium hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-white/20"
                                        onClick={() => navigate(nextPath || "/problemset")}
                                    >
                                        Continue Learning
                                    </button>
                                    <button
                                        className="px-8 py-3 border border-white/25 text-white rounded-md font-medium hover:bg-white/10 hover:border-white/40 transition-all duration-300"
                                        onClick={() => navigate("/compiler")}
                                    >
                                        Try Compiler
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="px-8 py-3 bg-white text-black rounded-md font-medium hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-white/20"
                                        onClick={() => navigate("/login" + (nextPath ? `?next=${nextPath}` : ""))}
                                    >
                                        Start Learning Free
                                    </button>
                                    <button
                                        className="px-8 py-3 border border-white/25 text-white rounded-md font-medium hover:bg-white/10 hover:border-white/40 transition-all duration-300"
                                        onClick={() => navigate("/compiler")}
                                    >
                                        Try Compiler
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-black border-t border-white/10 py-20">
                <div className="container mx-auto px-6 max-w-6xl">
                    <motion.h2
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-4xl font-bold text-white text-center mb-16"
                    >
                        Why Choose NeoCode?
                    </motion.h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaBrain className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">AI Mentor System</h3>
                            <p className="text-white/60 text-sm">
                                Personalized AI mentor that tracks your skills, sets goals, and guides your learning
                                journey with intelligent roadmaps.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaChartLine className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Skill-Based Progress</h3>
                            <p className="text-white/60 text-sm">
                                Track skills across all courses. Your progress aggregates - master Arrays once, apply
                                everywhere.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaCode className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Multi-Language Support</h3>
                            <p className="text-white/60 text-sm">
                                Practice with C++, Python, and Java. Real-time code execution with instant feedback and
                                test case validation.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaRocket className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Career Roadmaps</h3>
                            <p className="text-white/60 text-sm">
                                Set career goals and get AI-generated learning paths. From beginner to VR Engineer, we
                                guide you there.
                            </p>
                        </motion.div>
                    </div>

                    {/* Additional Features Row */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaMicrophone className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Voice Interviews</h3>
                            <p className="text-white/60 text-sm">
                                Practice technical interviews with AI voice interaction. Real-time speech recognition
                                and instant feedback.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.6 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaCircleCheck className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Validated Learning</h3>
                            <p className="text-white/60 text-sm">
                                Multi-modal validation ensures real progress. No fake completion - earn your skills
                                through proven mastery.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.7 }}
                            className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <div className="bg-white/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                                <FaRobot className="text-white text-xl" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-3">Mistake Tracking</h3>
                            <p className="text-white/60 text-sm">
                                AI identifies your coding patterns and common mistakes. Get personalized feedback to
                                improve faster.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="bg-black border-t border-white/10 py-20">
                <div className="container mx-auto px-6 max-w-4xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <div className="text-4xl font-bold text-white mb-2">500+</div>
                            <div className="text-white/60 text-sm">Problems</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-center"
                        >
                            <div className="text-4xl font-bold text-white mb-2">50+</div>
                            <div className="text-white/60 text-sm">Skills Tracked</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-center"
                        >
                            <div className="text-4xl font-bold text-white mb-2">3</div>
                            <div className="text-white/60 text-sm">Languages</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="text-center"
                        >
                            <div className="text-4xl font-bold text-white mb-2">AI</div>
                            <div className="text-white/60 text-sm">Powered</div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Dashboard & Interview Section */}
            <div className="bg-black border-t border-white/10 py-20">
                <div className="container mx-auto px-6 max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-4xl font-bold text-white mb-4">Experience Next-Gen Learning</h2>
                        <p className="text-white/70 text-lg max-w-2xl mx-auto">
                            Your personalized dashboard and AI-powered interview practice await
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Learning Dashboard Card */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 border border-blue-500/30 rounded-xl p-8 hover:border-blue-500/50 transition-all duration-300"
                        >
                            <div className="bg-blue-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                <FaChartLine className="text-blue-400 text-2xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Learning Dashboard</h3>
                            <p className="text-white/70 mb-6 leading-relaxed">
                                Track your progress with real-time analytics, skill validation scores, and personalized
                                learning paths. Monitor mistakes, view completion rates, and get AI recommendations.
                            </p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>Real-time skill progress tracking</span>
                                </li>
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>Personalized problem recommendations</span>
                                </li>
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>Multi-modal validation scores</span>
                                </li>
                            </ul>
                            <button
                                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all duration-300"
                                onClick={() => navigate(isLoggedIn ? nextPath || "/problemset" : "/login")}
                            >
                                {isLoggedIn ? "Open Dashboard" : "Get Started Free"}
                            </button>
                        </motion.div>

                        {/* Voice Interview Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 border border-purple-500/30 rounded-xl p-8 hover:border-purple-500/50 transition-all duration-300"
                        >
                            <div className="bg-purple-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                <FaMicrophone className="text-purple-400 text-2xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Voice Interviews</h3>
                            <p className="text-white/70 mb-6 leading-relaxed">
                                Practice technical interviews with AI-powered voice interaction. Get real-time feedback,
                                transcription, and detailed performance analysis for each session.
                            </p>
                            <ul className="space-y-3 mb-8">
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>AI voice interaction with speech recognition</span>
                                </li>
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>Real-time transcription and analysis</span>
                                </li>
                                <li className="flex items-start gap-3 text-white/80">
                                    <FaCircleCheck className="text-green-400 mt-1 flex-shrink-0" />
                                    <span>Performance metrics and improvement tips</span>
                                </li>
                            </ul>
                            <button
                                className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-all duration-300"
                                onClick={() => navigate(isLoggedIn ? "/interviews" : "/login?next=/interviews")}
                            >
                                {isLoggedIn ? "Start Interview" : "Try Interview"}
                            </button>
                        </motion.div>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default Home;
