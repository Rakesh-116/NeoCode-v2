/**
 * ============================================================================
 * Smart Review Card
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { Brain, Flame } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import Cookies from "js-cookie";

const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const SmartReviewCard = ({ onStartReview = () => {} }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [stats, setStats] = useState({
        totalConcepts: 0,
        dueToday: 0,
        masteredConcepts: 0,
        inEaseHell: 0,
        streakDays: 0,
        nextReviewDate: null,
    });

    useEffect(() => {
        const fetchStats = async () => {
            const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
            const jwtToken = Cookies.get("neo_code_jwt_token");

            if (!jwtToken) {
                setLoading(false);
                setError(true);
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/interview/smart-review/stats`, {
                    headers: { Authorization: `Bearer ${jwtToken}` },
                });
                setStats(response.data.stats || stats);
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 bg-white/10 rounded animate-pulse" />
                        <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-28 bg-white/10 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-64 bg-white/10 rounded mt-4 animate-pulse" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="bg-white/5 rounded-xl p-3">
                            <div className="h-6 w-16 bg-white/10 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-white/10 rounded mt-2 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="h-4 w-40 bg-white/10 rounded mt-4 animate-pulse" />
                <div className="h-11 w-full bg-white/10 rounded-xl mt-5 animate-pulse" />
            </div>
        );
    }

    const nextReviewLabel = formatDate(stats.nextReviewDate);
    const hasDue = stats.dueToday > 0;
    const hasConcepts = stats.totalConcepts > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Brain className="text-white h-5 w-5" />
                    <h3 className="text-white font-semibold text-lg">Smart Review</h3>
                </div>
                {hasDue ? (
                    <div className="flex items-center gap-2 bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 rounded-full px-3 py-1 text-sm">
                        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                        {stats.dueToday} due today
                    </div>
                ) : (
                    <div className="text-green-400 text-sm">Up to date ✓</div>
                )}
            </div>

            <p className="text-white/60 text-sm mt-1">
                Practice concepts you've struggled with, spaced for maximum retention.
            </p>

            {error && (
                <div className="text-white/40 text-sm mt-3">Could not load review data</div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white font-bold text-2xl">{stats.totalConcepts}</div>
                    <div className="text-white/60 text-xs">Concepts Tracked</div>
                </div>
                <div
                    className={`rounded-xl p-3 ${
                        hasDue ? "bg-yellow-400/5 border border-yellow-400/20" : "bg-white/5"
                    }`}
                >
                    <div className="text-yellow-400 font-bold text-2xl">{stats.dueToday}</div>
                    <div className="text-white/60 text-xs">Due Today</div>
                </div>
                <div
                    className={`rounded-xl p-3 ${
                        stats.masteredConcepts > 0 ? "bg-green-400/5 border border-green-400/20" : "bg-white/5"
                    }`}
                >
                    <div className="text-green-400 font-bold text-2xl">{stats.masteredConcepts}</div>
                    <div className="text-white/60 text-xs">Mastered</div>
                </div>
                <div
                    className={`rounded-xl p-3 ${
                        stats.inEaseHell > 0 ? "bg-red-400/5 border border-red-400/20" : "bg-white/5"
                    }`}
                >
                    <div className="text-red-400 font-bold text-2xl">{stats.inEaseHell}</div>
                    <div className="text-white/60 text-xs">Needs Attention</div>
                </div>
            </div>

            <div className="mt-4">
                {stats.streakDays > 0 ? (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Flame className="text-orange-400 h-4 w-4" />
                        {stats.streakDays} day streak — keep it going!
                    </div>
                ) : (
                    <div className="text-white/40 text-sm">Start a session to begin your streak</div>
                )}
            </div>

            <div className="mt-5">
                {hasDue ? (
                    <button
                        onClick={onStartReview}
                        className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition"
                    >
                        Start Review ({stats.dueToday} concepts)
                    </button>
                ) : !hasConcepts ? (
                    <button
                        className="w-full bg-white/10 text-white/60 py-3 rounded-xl cursor-not-allowed"
                        disabled
                    >
                        Complete an interview to unlock
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onStartReview}
                            className="w-full bg-white/10 text-white py-3 rounded-xl hover:bg-white/20 transition"
                        >
                            All caught up — Review anyway
                        </button>
                        {nextReviewLabel && (
                            <div className="text-white/40 text-xs text-center mt-1">
                                Next review: {nextReviewLabel}
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default SmartReviewCard;

