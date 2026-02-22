import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import Header from "./Header";
import Footer from "./Footer";

const LearningProfile = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchProfile();
        fetchRecommendations();
    }, []);

    const fetchProfile = async () => {
        try {
            const jwtToken = Cookies.get("neo_code_jwt_token");
            if (!jwtToken) {
                navigate("/login");
                return;
            }
            const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
            const response = await axios.get(`${API_BASE_URL}/api/learning/profile`, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });
            setProfile(response.data.profile);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch profile");
            setLoading(false);
        }
    };

    const fetchRecommendations = async () => {
        try {
            const jwtToken = Cookies.get("neo_code_jwt_token");
            if (!jwtToken) return;

            const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
            const response = await axios.get(`${API_BASE_URL}/api/learning/recommendations?count=5`, {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                },
            });
            setRecommendations(response.data.recommendations);
        } catch (err) {
            console.error("Failed to fetch recommendations:", err);
        }
    };

    const generatePlan = async () => {
        try {
            const jwtToken = Cookies.get("neo_code_jwt_token");
            if (!jwtToken) {
                navigate("/login");
                return;
            }

            const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
            await axios.post(
                `${API_BASE_URL}/api/learning/training-plan`,
                {
                    planType: "weak_topic_focus",
                    durationDays: 7,
                    dailyTarget: 3,
                },
                {
                    headers: {
                        Authorization: `Bearer ${jwtToken}`,
                    },
                },
            );
            alert("Training plan generated successfully! Check your active plan.");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to generate training plan");
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="min-h-screen bg-black flex items-center justify-center">
                    <div className="text-xl text-white">Loading your learning profile...</div>
                </div>
                <Footer />
            </>
        );
    }

    if (error) {
        return (
            <>
                <Header />
                <div className="min-h-screen bg-black flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
                        <p className="text-white">{error}</p>
                        <p className="text-sm text-white/70 mt-4">Please make sure you're logged in and try again.</p>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Header />
            <div className="min-h-screen bg-black py-8">
                <div className="container mx-auto px-4 max-w-6xl">
                    <h1 className="text-4xl font-bold mb-8 text-white">Your Learning Profile</h1>

                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-blue-500/30 transition-all">
                            <h3 className="text-white/70 text-sm font-medium mb-2">Current Streak</h3>
                            <p className="text-4xl font-bold text-white">{profile?.profile?.streakDays || 0}</p>
                            <p className="text-sm text-blue-400 mt-1">days</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-green-500/30 transition-all">
                            <h3 className="text-white/70 text-sm font-medium mb-2">Total Sessions</h3>
                            <p className="text-4xl font-bold text-white">{profile?.profile?.totalSessions || 0}</p>
                            <p className="text-sm text-green-400 mt-1">practice sessions</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-purple-500/30 transition-all">
                            <h3 className="text-white/70 text-sm font-medium mb-2">Last Active</h3>
                            <p className="text-xl font-semibold text-white">
                                {profile?.profile?.lastActive
                                    ? new Date(profile.profile.lastActive).toLocaleDateString()
                                    : "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* Weak Topics Section */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-white">🎯 Focus Areas (Weak Topics)</h2>
                        {profile?.weakTopics && profile.weakTopics.length > 0 ? (
                            <div className="space-y-3">
                                {profile.weakTopics.map((topic, index) => (
                                    <div
                                        key={index}
                                        className="bg-black/70 border border-red-500/30 p-4 rounded-lg hover:border-red-500/50 transition-all"
                                    >
                                        <h3 className="font-semibold text-lg text-red-400">{topic.topic}</h3>
                                        <p className="text-sm text-red-300/80 mt-1">
                                            {topic.attempts} attempts • {(topic.failureRate * 100).toFixed(0)}% failure
                                            rate
                                        </p>
                                        {topic.lastFailed && (
                                            <p className="text-xs text-red-300/60 mt-1">
                                                Last failed: {new Date(topic.lastFailed).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-800 border border-white/20 p-6 rounded-lg text-center">
                                <p className="text-white/70">
                                    No weak topics yet! Keep practicing to build your profile.
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Strong Topics Section */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-white">💪 Your Strengths</h2>
                        {profile?.strongTopics && profile.strongTopics.length > 0 ? (
                            <div className="space-y-3">
                                {profile.strongTopics.map((topic, index) => (
                                    <div
                                        key={index}
                                        className="bg-black/70 border border-green-500/30 p-4 rounded-lg hover:border-green-500/50 transition-all"
                                    >
                                        <h3 className="font-semibold text-lg text-green-400">{topic.topic}</h3>
                                        <p className="text-sm text-green-300/80 mt-1">
                                            {topic.attempts} attempts • {(topic.successRate * 100).toFixed(0)}% success
                                            rate
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-800 border border-white/20 p-6 rounded-lg text-center">
                                <p className="text-white/70">Complete more problems to identify your strengths!</p>
                            </div>
                        )}
                    </section>

                    {/* Recommendations Section */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-white">📚 Recommended for You</h2>
                        {recommendations.length > 0 ? (
                            <div className="space-y-3">
                                {recommendations.map((rec) => (
                                    <div
                                        key={rec.id}
                                        className="bg-gray-800 border border-white/20 p-4 rounded-lg flex justify-between items-center hover:border-blue-500/50 transition-all"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg text-white">{rec.title}</h3>
                                            <p className="text-sm text-white/70 mt-1">
                                                <span className="font-medium">{rec.difficulty}</span>
                                                {rec.topics && (
                                                    <>
                                                        {" "}
                                                        •{" "}
                                                        {Array.isArray(rec.topics) ? rec.topics.join(", ") : rec.topics}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => (window.location.href = `/problems/${rec.id}`)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors ml-4"
                                        >
                                            Solve
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-800 border border-white/20 p-6 rounded-lg text-center">
                                <p className="text-white/70">
                                    No recommendations available yet. Start solving problems!
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Generate Training Plan */}
                    <section className="mb-8">
                        <div className="bg-white/5 border border-white/10 p-8 rounded-lg hover:border-white/20 transition-all">
                            <h2 className="text-2xl font-semibold mb-2 text-white">
                                🚀 Ready for Structured Learning?
                            </h2>
                            <p className="text-white/70 mb-4">
                                Generate a personalized 7-day training plan based on your weak topics and learning
                                patterns.
                            </p>
                            <button
                                onClick={generatePlan}
                                className="bg-white text-black hover:bg-white/90 px-8 py-3 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-white/20"
                            >
                                Generate 7-Day Training Plan
                            </button>
                        </div>
                    </section>

                    {/* Learning Insights */}
                    {profile?.profile?.mistakePatterns && Object.keys(profile.profile.mistakePatterns).length > 0 && (
                        <section className="mb-8">
                            <h2 className="text-2xl font-semibold mb-4 text-white">🔍 Common Mistakes</h2>
                            <div className="bg-gray-800 border border-yellow-500/30 p-6 rounded-lg">
                                <ul className="space-y-2">
                                    {Object.entries(profile.profile.mistakePatterns).map(([mistake, count]) => (
                                        <li key={mistake} className="flex justify-between items-center">
                                            <span className="text-white">{mistake}</span>
                                            <span className="bg-yellow-600/30 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-sm font-medium">
                                                {count} times
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>
                    )}

                    {/* Learning Style */}
                    {profile?.profile?.learningStyle && (
                        <section className="mb-8">
                            <h2 className="text-2xl font-semibold mb-4 text-white">🎓 Your Learning Style</h2>
                            <div className="bg-gray-800 border border-purple-500/30 p-6 rounded-lg">
                                <p className="text-white">
                                    <strong>Approach:</strong>{" "}
                                    {profile.profile.learningStyle.approach || "Still learning..."}
                                </p>
                                {profile.profile.learningStyle.hintsPerProblem !== undefined && (
                                    <p className="text-white mt-2">
                                        <strong>Average hints used:</strong>{" "}
                                        {profile.profile.learningStyle.hintsPerProblem.toFixed(1)} per problem
                                    </p>
                                )}
                                {profile.profile.learningStyle.avgTimePerProblem !== undefined && (
                                    <p className="text-white mt-2">
                                        <strong>Average time per problem:</strong>{" "}
                                        {Math.round(profile.profile.learningStyle.avgTimePerProblem / 60)} minutes
                                    </p>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default LearningProfile;
