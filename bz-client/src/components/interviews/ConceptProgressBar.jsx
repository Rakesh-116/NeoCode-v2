/**
 * ============================================================================
 * Concept Progress Bar
 * ============================================================================
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const gradeConfig = {
    easy: { label: "Easy ↑", className: "bg-green-400/20 text-green-400" },
    good: { label: "Good →", className: "bg-blue-400/20 text-blue-400" },
    hard: { label: "Hard ↓", className: "bg-yellow-400/20 text-yellow-400" },
    failed: { label: "Again ↺", className: "bg-red-400/20 text-red-400" },
};

const easeToPercent = (ease) => {
    const min = 1.3;
    const max = 3.5;
    const value = Math.max(min, Math.min(max, ease));
    return ((value - min) / (max - min)) * 100;
};

const ConceptProgressBar = ({ conceptUpdates = [] }) => {
    if (!conceptUpdates.length) {
        return null;
    }

    return (
        <div className="mt-8">
            {conceptUpdates.map((update, idx) => {
                const grade = gradeConfig[update.grade] || gradeConfig.good;
                const increase = update.newInterval > update.previousInterval;
                const decrease = update.newInterval < update.previousInterval;
                const easePercent = easeToPercent(update.newEase);
                const recovery =
                    update.grade === "easy" && update.previousEase < 1.8 && update.newEase >= 2.0;

                return (
                    <motion.div
                        key={`${update.conceptTag}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-white font-medium text-sm">{update.conceptTag}</div>
                            <div className={`${grade.className} text-xs px-2 py-1 rounded-full`}>{grade.label}</div>
                        </div>

                        <div className="text-white/60 text-xs mb-2">
                            Next review in {update.newInterval} days{" "}
                            {increase && (
                                <span className="text-green-400">↑ from {update.previousInterval}d</span>
                            )}
                            {decrease && (
                                <span className="text-red-400">↓ from {update.previousInterval}d</span>
                            )}
                        </div>

                        <div className="text-white/40 text-xs flex justify-between">
                            <span>Ease factor</span>
                            <span>{update.newEase.toFixed(1)}</span>
                        </div>
                        <div className="bg-white/10 rounded-full h-1.5 mt-1">
                            <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                    update.newEase >= 2.5
                                        ? "bg-green-400"
                                        : update.newEase >= 1.8
                                          ? "bg-yellow-400"
                                          : "bg-red-400"
                                }`}
                                style={{ width: `${easePercent}%` }}
                            />
                        </div>

                        {recovery && (
                            <div className="bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-1.5 mt-2 flex items-center gap-2">
                                <Sparkles className="text-green-400 h-3 w-3" />
                                <span className="text-green-400 text-xs">
                                    Ease recovered! Streak bonus applied.
                                </span>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
};

export default ConceptProgressBar;

