/**
 * ============================================================================
 * Action Executor - Execute Intents
 * ============================================================================
 * Takes parsed intents and executes appropriate actions
 * Routes to existing NeoCode services (interview, courses, problems, etc.)
 * ============================================================================
 */

import { pool } from "../../../database/connect.db.js";
import interviewOrchestrator from "../../voice-interview/services/InterviewOrchestrator.service.js";
import intentRouter from "../intents/IntentRouter.js";

class ActionExecutor {
    /**
     * Execute an intent and return response
     * @param {Object} intent - Parsed intent from IntentRouter
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Action result with response text and data
     */
    async execute(intent, userId) {
        console.log(`[ActionExecutor] Executing intent: ${intent.intent}`);

        try {
            switch (intent.intent) {
                case "greeting":
                    return await this._handleGreeting(intent, userId);

                case "start_interview":
                    return await this._handleStartInterview(intent, userId);

                case "explain_concept":
                    return await this._handleExplainConcept(intent, userId);

                case "show_dashboard":
                    return await this._handleShowDashboard(intent, userId);

                case "open_course":
                    return await this._handleOpenCourse(intent, userId);

                case "review_flashcards":
                    return await this._handleReviewFlashcards(intent, userId);

                case "check_progress":
                    return await this._handleCheckProgress(intent, userId);

                case "solve_problem":
                    return await this._handleSolveProblem(intent, userId);

                case "get_hints":
                    return await this._handleGetHints(intent, userId);

                case "unknown":
                    return {
                        success: false,
                        response: intent.response || "I didn't understand that. Can you rephrase?",
                    };

                default:
                    return {
                        success: false,
                        response: "I'm not sure how to handle that request yet.",
                    };
            }
        } catch (error) {
            console.error("[ActionExecutor] Execution error:", error);
            return {
                success: false,
                response: "Sorry, I encountered an error processing your request.",
                error: error.message,
            };
        }
    }

    /**
     * Handle greeting intent
     * @private
     */
    async _handleGreeting(intent, userId) {
        const context = { userId, ...intent.context };
        
        // Get user name
        try {
            const userResult = await pool.query(
                `SELECT name FROM users WHERE id = $1`,
                [userId]
            );
            if (userResult.rows[0]) {
                context.userName = userResult.rows[0].name;
            }
        } catch (error) {
            console.error("[ActionExecutor] Error fetching user:", error);
        }

        const greeting = await intentRouter.getGreeting(context);

        return {
            success: true,
            response: greeting,
            action: "greeting",
        };
    }

    /**
     * Handle start interview intent
     * @private
     */
    async _handleStartInterview(intent, userId) {
        const { topic, difficulty } = intent.entities;

        // If no topic specified, ask user
        if (!topic) {
            return {
                success: true,
                response: "What topic would you like to practice? For example, arrays, dynamic programming, or system design.",
                action: "request_interview_topic",
                awaitingInput: true,
            };
        }

        // Start interview session
        try {
            const session = await interviewOrchestrator.startSession({
                userId,
                mode: "topic",
                topic,
                difficulty: difficulty || "medium",
                targetQuestions: 5,
            });

            return {
                success: true,
                response: `Starting ${difficulty || "medium"} difficulty interview on ${topic}. Let me ask you the first question.`,
                action: "start_interview",
                data: {
                    sessionId: session.id,
                    topic,
                    difficulty,
                },
                navigate: `/interview/${session.id}`,
            };
        } catch (error) {
            console.error("[ActionExecutor] Interview start error:", error);
            return {
                success: false,
                response: "I couldn't start the interview. Please try again.",
                error: error.message,
            };
        }
    }

    /**
     * Handle explain concept intent
     * @private
     */
    async _handleExplainConcept(intent, userId) {
        const { concept } = intent.entities;

        if (!concept) {
            return {
                success: false,
                response: "What would you like me to explain?",
            };
        }

        // TODO: Integrate with LLM to generate explanation
        // For now, return a placeholder that triggers LLM call
        return {
            success: true,
            response: `Let me explain ${concept}.`,
            action: "explain_concept",
            data: {
                concept,
                needsLLMGeneration: true,
            },
        };
    }

    /**
     * Handle show dashboard intent
     * @private
     */
    async _handleShowDashboard(intent, userId) {
        return {
            success: true,
            response: "Taking you to the dashboard.",
            action: "navigate",
            navigate: "/dashboard",
        };
    }

    /**
     * Handle open course intent
     * @private
     */
    async _handleOpenCourse(intent, userId) {
        const { courseName } = intent.entities;

        if (!courseName) {
            return {
                success: true,
                response: "Which course would you like to open?",
                action: "list_courses",
                navigate: "/courses",
            };
        }

        // Search for course by name
        try {
            const result = await pool.query(
                `SELECT id, title FROM courses 
                 WHERE LOWER(title) LIKE $1 
                 ORDER BY SIMILARITY(title, $2) DESC
                 LIMIT 1`,
                [`%${courseName.toLowerCase()}%`, courseName]
            );

            if (result.rows.length === 0) {
                return {
                    success: false,
                    response: `I couldn't find a course matching "${courseName}". Would you like to see all courses?`,
                    navigate: "/courses",
                };
            }

            const course = result.rows[0];
            return {
                success: true,
                response: `Opening ${course.title} course.`,
                action: "open_course",
                data: { courseId: course.id, title: course.title },
                navigate: `/courses/${course.id}`,
            };
        } catch (error) {
            console.error("[ActionExecutor] Course search error:", error);
            return {
                success: false,
                response: "I had trouble finding that course. Try browsing the course list.",
                navigate: "/courses",
            };
        }
    }

    /**
     * Handle review flashcards intent
     * @private
     */
    async _handleReviewFlashcards(intent, userId) {
        // Check if user has flashcards due
        try {
            const result = await pool.query(
                `SELECT COUNT(*) as due_count FROM flashcards 
                 WHERE user_id = $1 AND next_review_date <= NOW()`,
                [userId]
            );

            const dueCount = parseInt(result.rows[0]?.due_count || 0);

            if (dueCount === 0) {
                return {
                    success: true,
                    response: "You don't have any flashcards due right now. Great job staying on top of your reviews!",
                    action: "no_flashcards_due",
                };
            }

            return {
                success: true,
                response: `You have ${dueCount} flashcard${dueCount > 1 ? "s" : ""} due. Let's review them now.`,
                action: "review_flashcards",
                navigate: "/flashcards/review",
            };
        } catch (error) {
            console.error("[ActionExecutor] Flashcard check error:", error);
            return {
                success: false,
                response: "I couldn't check your flashcards. Please try again.",
            };
        }
    }

    /**
     * Handle check progress intent
     * @private
     */
    async _handleCheckProgress(intent, userId) {
        try {
            // Get user statistics
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM user_submissions WHERE user_id = $1 AND status = 'accepted') as problems_solved,
                    (SELECT COUNT(DISTINCT skill_id) FROM user_skills WHERE user_id = $1) as skills_learned,
                    (SELECT AVG(score) FROM interview_sessions WHERE user_id = $1 AND status = 'completed') as avg_interview_score
            `;

            const result = await pool.query(statsQuery, [userId]);
            const stats = result.rows[0];

            const response = `Here's your progress: You've solved ${stats.problems_solved || 0} problems, learned ${stats.skills_learned || 0} skills, and your average interview score is ${Math.round(stats.avg_interview_score || 0)}%.`;

            return {
                success: true,
                response,
                action: "show_progress",
                data: stats,
                navigate: "/profile",
            };
        } catch (error) {
            console.error("[ActionExecutor] Progress check error:", error);
            return {
                success: false,
                response: "I couldn't fetch your progress right now.",
            };
        }
    }

    /**
     * Handle solve problem intent
     * @private
     */
    async _handleSolveProblem(intent, userId) {
        const { difficulty, topic } = intent.entities;

        // Find a problem matching criteria
        try {
            let query = `SELECT id, title, difficulty FROM problems WHERE 1=1`;
            const params = [];
            let paramIndex = 1;

            if (difficulty) {
                query += ` AND difficulty = $${paramIndex}`;
                params.push(difficulty);
                paramIndex++;
            }

            if (topic) {
                query += ` AND EXISTS (
                    SELECT 1 FROM problem_topics pt
                    JOIN topics t ON pt.topic_id = t.id
                    WHERE pt.problem_id = problems.id
                    AND LOWER(t.name) LIKE $${paramIndex}
                )`;
                params.push(`%${topic.toLowerCase()}%`);
                paramIndex++;
            }

            query += ` ORDER BY RANDOM() LIMIT 1`;

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    response: "I couldn't find a problem matching your criteria. Try browsing the problem list.",
                    navigate: "/problems",
                };
            }

            const problem = result.rows[0];
            return {
                success: true,
                response: `Here's a ${problem.difficulty} problem: ${problem.title}. Good luck!`,
                action: "solve_problem",
                data: { problemId: problem.id, title: problem.title },
                navigate: `/problems/${problem.id}`,
            };
        } catch (error) {
            console.error("[ActionExecutor] Problem search error:", error);
            return {
                success: false,
                response: "I had trouble finding a problem. Let me show you the problem list.",
                navigate: "/problems",
            };
        }
    }

    /**
     * Handle get hints intent
     * @private
     */
    async _handleGetHints(intent, userId) {
        const { currentProblem } = intent.entities;

        if (!currentProblem) {
            return {
                success: false,
                response: "I can only give hints when you're working on a problem. Navigate to a problem first.",
            };
        }

        // TODO: Integrate with LLM to generate contextual hint
        return {
            success: true,
            response: "Let me give you a hint for this problem.",
            action: "generate_hint",
            data: {
                problemId: currentProblem,
                needsLLMGeneration: true,
            },
        };
    }
}

// Singleton export
const actionExecutor = new ActionExecutor();
export default actionExecutor;
