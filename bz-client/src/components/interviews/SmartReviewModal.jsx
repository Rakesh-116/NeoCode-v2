/**
 * ============================================================================
 * Smart Review Modal
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, X, Info, CheckCircle } from "lucide-react";
import axios from "axios";
import Cookies from "js-cookie";

const mapConcept = (item) => ({
    conceptTag: item.conceptTag || item.concept_tag,
    lastScore: item.lastScore ?? item.last_score ?? null,
    intervalDays: item.intervalDays ?? item.interval_days ?? 0,
    dueDate: item.dueDate || item.next_review_date || null,
    consecutiveEasyCount: item.consecutiveEasyCount ?? item.consecutive_easy_count ?? 0,
});

const getPill = (score) => {
    if (score === null || score === undefined) {
        return { className: "bg-white/10 text-white/60", label: "New" };
    }
    if (score <= 59) return { className: "bg-red-400/20 text-red-400", label: "Struggling" };
    if (score <= 74) return { className: "bg-yellow-400/20 text-yellow-400", label: "Hard" };
    if (score <= 89) return { className: "bg-blue-400/20 text-blue-400", label: "Good" };
    return { className: "bg-green-400/20 text-green-400", label: "Easy" };
};

const SmartReviewModal = ({ isOpen = false, onClose = () => {}, onConfirmStart = () => {} }) => {
    const [loading, setLoading] = useState(false);
    const [concepts, setConcepts] = useState([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchDue = async () => {
            const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
            const jwtToken = Cookies.get("neo_code_jwt_token");
            if (!jwtToken) {
                setError(true);
                return;
            }

            setLoading(true);
            setError(false);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/interview/smart-review/due`, {
                    headers: { Authorization: `Bearer ${jwtToken}` },
                });
                const mapped = (response.data.due || []).map(mapConcept);
                setConcepts(mapped);
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchDue();
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-black border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Brain className="text-white h-5 w-5" />
                                <h3 className="text-white font-semibold text-lg">Smart Review Session</h3>
                            </div>
                            <button onClick={onClose} className="text-white/40 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[0, 1, 2].map((row) => (
                                    <div key={row} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="text-white/40 text-sm">Could not load review data</div>
                        ) : concepts.length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="text-green-400 mx-auto h-12 w-12" />
                                <div className="text-white font-semibold mt-3">All caught up!</div>
                                <div className="text-white/60 text-sm mt-1">
                                    No concepts are due for review today.
                                </div>
                                <button
                                    onClick={onClose}
                                    className="mt-6 bg-white/10 text-white py-2.5 px-6 rounded-xl hover:bg-white/20 transition"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-white/60 text-sm mb-4">
                                    {concepts.length} concepts due for review today
                                </div>

                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{
                                        hidden: {},
                                        visible: {
                                            transition: {
                                                staggerChildren: 0.05,
                                            },
                                        },
                                    }}
                                >
                                    {concepts.map((concept) => {
                                        const pill = getPill(concept.lastScore);
                                        return (
                                            <motion.div
                                                key={concept.conceptTag}
                                                variants={{
                                                    hidden: { opacity: 0, y: 10 },
                                                    visible: { opacity: 1, y: 0 },
                                                }}
                                                className="bg-white/5 rounded-xl p-3 flex items-center justify-between mb-2"
                                            >
                                                <div>
                                                    <div className="text-white font-medium text-sm">
                                                        {concept.conceptTag}
                                                    </div>
                                                    <div className="text-white/40 text-xs">
                                                        Last score: {concept.lastScore ?? "N/A"}% ·{" "}
                                                        {concept.intervalDays}d interval
                                                    </div>
                                                </div>
                                                <div
                                                    className={`${pill.className} text-xs px-2 py-1 rounded-full`}
                                                >
                                                    {pill.label}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>

                                <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-3 mt-3 flex items-start gap-2">
                                    <Info className="text-blue-400 h-4 w-4 mt-0.5" />
                                    <p className="text-white/60 text-xs">
                                        Questions are tailored to your weak points in each concept.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-3 mt-5">
                                    <button
                                        onClick={onClose}
                                        className="bg-white/10 text-white/60 px-4 py-2.5 rounded-xl hover:bg-white/20 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            onConfirmStart(concepts);
                                            onClose();
                                        }}
                                        className="bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 text-sm"
                                    >
                                        Begin ({concepts.length} questions)
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SmartReviewModal;

