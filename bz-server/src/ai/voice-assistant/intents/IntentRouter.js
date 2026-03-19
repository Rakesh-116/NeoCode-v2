/**
 * ============================================================================
 * Intent Router - Voice Assistant Command Parser
 * ============================================================================
 * Analyzes user speech and routes to appropriate system services
 * 
 * Supports intents:
 * - start_interview: Start technical interview practice
 * - explain_concept: Get explanation of a topic
 * - show_dashboard: Navigate to dashboard
 * - open_course: Open specific course
 * - review_flashcards: Start flashcard review
 * - check_progress: Show user progress
 * - solve_problem: Open problem solver
 * - get_hints: Get hints for current problem
 * ============================================================================
 */

import { pool } from "../../../database/connect.db.js";

class IntentRouter {
    constructor() {
        // Intent patterns with regex and keywords
        this.intentPatterns = {
            start_interview: {
                keywords: ["start", "begin", "interview", "practice", "mock interview"],
                patterns: [
                    /start\s+(an?\s+)?interview/i,
                    /begin\s+interview/i,
                    /practice\s+interview/i,
                    /mock\s+interview/i,
                ],
                priority: 9,
            },
            explain_concept: {
                keywords: ["explain", "what is", "tell me about", "how does", "define"],
                patterns: [
                    /explain\s+(.+)/i,
                    /what\s+is\s+(.+)/i,
                    /tell\s+me\s+about\s+(.+)/i,
                    /how\s+does\s+(.+)\s+work/i,
                    /define\s+(.+)/i,
                ],
                priority: 8,
            },
            show_dashboard: {
                keywords: ["dashboard", "home", "overview", "main page"],
                patterns: [
                    /show\s+dashboard/i,
                    /go\s+to\s+dashboard/i,
                    /take\s+me\s+home/i,
                    /show\s+overview/i,
                ],
                priority: 7,
            },
            open_course: {
                keywords: ["open", "course", "show course", "view course"],
                patterns: [
                    /open\s+(.+)\s+course/i,
                    /show\s+(.+)\s+course/i,
                    /take\s+me\s+to\s+(.+)\s+course/i,
                ],
                priority: 8,
            },
            review_flashcards: {
                keywords: ["flashcards", "review", "cards", "spaced repetition"],
                patterns: [
                    /review\s+flashcards/i,
                    /start\s+flashcards/i,
                    /show\s+cards/i,
                    /spaced\s+repetition/i,
                ],
                priority: 8,
            },
            check_progress: {
                keywords: ["progress", "stats", "statistics", "performance", "how am i doing"],
                patterns: [
                    /show\s+progress/i,
                    /my\s+stats/i,
                    /how\s+am\s+i\s+doing/i,
                    /check\s+performance/i,
                ],
                priority: 7,
            },
            solve_problem: {
                keywords: ["solve", "problem", "coding", "challenge"],
                patterns: [
                    /solve\s+(a\s+)?problem/i,
                    /coding\s+challenge/i,
                    /practice\s+coding/i,
                    /start\s+problem/i,
                ],
                priority: 8,
            },
            get_hints: {
                keywords: ["hint", "help", "stuck", "clue"],
                patterns: [
                    /give\s+me\s+a\s+hint/i,
                    /i'm\s+stuck/i,
                    /need\s+help/i,
                    /show\s+hint/i,
                ],
                priority: 9,
            },
            greeting: {
                keywords: ["hi", "hello", "hey", "good morning", "good evening"],
                patterns: [
                    /^(hi|hello|hey)\b/i,
                    /good\s+(morning|afternoon|evening)/i,
                ],
                priority: 5,
            },
        };
    }

    /**
     * Parse user speech and determine intent
     * @param {string} userSpeech - Transcribed user speech
     * @param {Object} context - Current context (page, user data, etc.)
     * @returns {Promise<Object>} Intent object with action and parameters
     */
    async parseIntent(userSpeech, context = {}) {
        const text = userSpeech.toLowerCase().trim();

        console.log(`[IntentRouter] Parsing: "${text}"`);

        // Check all patterns
        let bestMatch = null;
        let highestScore = 0;

        for (const [intentName, intentConfig] of Object.entries(this.intentPatterns)) {
            const score = this._calculateMatchScore(text, intentConfig);

            if (score > highestScore) {
                highestScore = score;
                bestMatch = { intent: intentName, score, config: intentConfig };
            }
        }

        // If no pattern matches strongly, classify as unknown
        if (highestScore < 3) {
            return {
                intent: "unknown",
                confidence: 0,
                text: userSpeech,
                response: "I'm not sure what you want me to do. Try commands like 'start interview' or 'explain binary search'.",
            };
        }

        // Extract entities from text based on intent
        const entities = await this._extractEntities(text, bestMatch.intent, context);

        console.log(`[IntentRouter] Matched intent: ${bestMatch.intent} (score: ${highestScore})`);

        return {
            intent: bestMatch.intent,
            confidence: Math.min(highestScore / 10, 1.0),
            text: userSpeech,
            entities,
            context,
        };
    }

    /**
     * Calculate match score for intent
     * @private
     */
    _calculateMatchScore(text, intentConfig) {
        let score = 0;

        // Check regex patterns
        for (const pattern of intentConfig.patterns) {
            if (pattern.test(text)) {
                score += intentConfig.priority;
                break;
            }
        }

        // Check keywords
        for (const keyword of intentConfig.keywords) {
            if (text.includes(keyword.toLowerCase())) {
                score += 1;
            }
        }

        return score;
    }

    /**
     * Extract entities from user speech based on intent
     * @private
     */
    async _extractEntities(text, intent, context) {
        const entities = {};

        switch (intent) {
            case "start_interview":
                // Extract topic if mentioned
                entities.topic = this._extractTopic(text);
                entities.difficulty = this._extractDifficulty(text);
                break;

            case "explain_concept":
                // Extract concept name
                const conceptMatch = text.match(/explain\s+(.+)/) || text.match(/what\s+is\s+(.+)/) || text.match(/tell\s+me\s+about\s+(.+)/);
                if (conceptMatch) {
                    entities.concept = conceptMatch[1].trim();
                }
                break;

            case "open_course":
                // Extract course name
                const courseMatch = text.match(/open\s+(.+?)\s+course/i) || text.match(/show\s+(.+?)\s+course/i);
                if (courseMatch) {
                    entities.courseName = courseMatch[1].trim();
                }
                break;

            case "solve_problem":
                // Extract difficulty or topic
                entities.difficulty = this._extractDifficulty(text);
                entities.topic = this._extractTopic(text);
                break;

            default:
                break;
        }

        // Add context information
        if (context.currentPage) {
            entities.currentPage = context.currentPage;
        }
        if (context.currentProblem) {
            entities.currentProblem = context.currentProblem;
        }
        if (context.currentCourse) {
            entities.currentCourse = context.currentCourse;
        }

        return entities;
    }

    /**
     * Extract topic from text
     * @private
     */
    _extractTopic(text) {
        const topics = [
            "arrays",
            "strings",
            "linked lists",
            "trees",
            "graphs",
            "dynamic programming",
            "dp",
            "recursion",
            "sorting",
            "searching",
            "greedy",
            "backtracking",
            "system design",
            "operating systems",
            "os",
            "databases",
            "networks",
        ];

        for (const topic of topics) {
            if (text.includes(topic)) {
                return topic;
            }
        }

        return null;
    }

    /**
     * Extract difficulty from text
     * @private
     */
    _extractDifficulty(text) {
        if (text.includes("easy")) return "easy";
        if (text.includes("medium")) return "medium";
        if (text.includes("hard")) return "hard";
        return "medium"; // Default
    }

    /**
     * Get personalized greeting based on time and user data
     * @param {Object} context - User context
     * @returns {Promise<string>}
     */
    async getGreeting(context) {
        const hour = new Date().getHours();
        let timeGreeting = "Good evening";

        if (hour < 12) timeGreeting = "Good morning";
        else if (hour < 18) timeGreeting = "Good afternoon";

        const userName = context.userName || "there";

        // Get pending tasks count
        let tasksMessage = "";
        if (context.userId) {
            try {
                const result = await pool.query(
                    `SELECT COUNT(*) as pending_count FROM flashcards 
                     WHERE user_id = $1 AND next_review_date <= NOW()`,
                    [context.userId]
                );

                const pendingCount = parseInt(result.rows[0]?.pending_count || 0);

                if (pendingCount > 0) {
                    tasksMessage = ` You have ${pendingCount} flashcard${pendingCount > 1 ? "s" : ""} due for review.`;
                }
            } catch (error) {
                console.error("[IntentRouter] Error fetching tasks:", error);
            }
        }

        return `${timeGreeting} ${userName}.${tasksMessage} How can I help you?`;
    }
}

// Singleton export
const intentRouter = new IntentRouter();
export default intentRouter;
