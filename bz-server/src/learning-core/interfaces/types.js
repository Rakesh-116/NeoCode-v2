/**
 * @fileoverview TypeScript-style JSDoc type definitions for Learning Core
 * @description Core types used across the learning engine
 */

/**
 * @typedef {Object} EvaluationRequest
 * @property {string} userId - User performing the evaluation
 * @property {string} evaluationType - Type of evaluation ('code', 'quiz', 'pdf', etc.)
 * @property {string} questionId - Question/problem being evaluated
 * @property {Object} input - Plugin-specific input (code, answers, etc.)
 * @property {Object} [metadata] - Additional context
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {boolean} success - Whether evaluation succeeded
 * @property {string} verdict - 'ACCEPTED' | 'WRONG_ANSWER' | 'TLE' | 'RTE' | 'PARTIAL' | 'FAIL'
 * @property {number} score - Score achieved (0-100)
 * @property {string} executionTime - Time taken to evaluate
 * @property {Array<TestCaseResult>} [testResults] - Individual test results
 * @property {Array<string>} detectedTopics - Topics extracted from evaluation
 * @property {Array<Mistake>} mistakes - Mistakes identified
 * @property {Object} [pluginMetadata] - Plugin-specific additional data
 * @property {string} [error] - Error message if evaluation failed
 */

/**
 * @typedef {Object} TestCaseResult
 * @property {boolean} passed - Whether test case passed
 * @property {string} [expected] - Expected output
 * @property {string} [actual] - Actual output
 * @property {string} [verdict] - Test-specific verdict
 * @property {string} [executionTime] - Time for this test
 */

/**
 * @typedef {Object} Mistake
 * @property {string} category - 'logic_error' | 'syntax' | 'tle' | 'edge_case' | 'memory' | 'compilation'
 * @property {string} severity - 'low' | 'medium' | 'high' | 'critical'
 * @property {string} topic - Related topic (e.g., 'arrays', 'recursion')
 * @property {string} description - Human-readable description
 * @property {string} [userReason] - User's self-reflection
 * @property {Object} [context] - Additional context for analysis
 */

/**
 * @typedef {Object} LearningProfile
 * @property {string} userId - User ID
 * @property {Object.<string, WeakTopic>} weakTopics - Map of weak topics
 * @property {Object.<string, StrongTopic>} strongTopics - Map of strong topics
 * @property {Object.<string, number>} mistakePatterns - Mistake frequency map
 * @property {string} currentLevel - 'beginner' | 'intermediate' | 'advanced'
 * @property {string} [focusMode] - Current learning focus
 * @property {number} totalEvaluations - Total evaluations attempted
 * @property {number} consecutiveSuccesses - Current success streak
 */

/**
 * @typedef {Object} WeakTopic
 * @property {number} failureCount - Number of failures
 * @property {string} lastAttempt - ISO timestamp of last attempt
 * @property {string} severity - 'low' | 'medium' | 'high'
 * @property {number} successRate - Success rate (0-100)
 */

/**
 * @typedef {Object} StrongTopic
 * @property {number} successCount - Number of successes
 * @property {number} avgScore - Average score (0-100)
 * @property {string} lastSuccess - ISO timestamp of last success
 */

/**
 * @typedef {Object} TrainingTask
 * @property {string} id - Task ID
 * @property {string} taskType - 'solve_problem' | 'review_concept' | 'practice_topic'
 * @property {string} targetTopic - Topic to practice
 * @property {string} targetDifficulty - Recommended difficulty
 * @property {string} reason - Why this was recommended
 * @property {number} priority - Priority score (higher = more urgent)
 * @property {string} [problemId] - Specific problem to solve
 * @property {string} [courseId] - Course to take
 * @property {string} status - 'pending' | 'in_progress' | 'completed' | 'skipped'
 */

/**
 * @typedef {Object} TrainingPlan
 * @property {string} userId - User ID
 * @property {Array<TrainingTask>} tasks - Recommended tasks
 * @property {string} strategy - 'weak_topics_drill' | 'breadth_expansion' | 'competition_prep'
 * @property {string} explanation - Why this plan was chosen
 * @property {number} estimatedDays - Estimated time to complete
 */

// Export for JSDoc usage (types are in comments above)
export default {};
