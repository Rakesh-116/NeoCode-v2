/**
 * @fileoverview Code Evaluation Plugin
 * @description Wraps existing Docker-based code execution into plugin interface
 */

import IEvaluationPlugin from "../interfaces/IEvaluationPlugin.js";
import executeJavaCode from "../../controllers/compilers/executeJavaCode.controller.js";
import executePythonCode from "../../controllers/compilers/executePythonCode.controller.js";
import executeCppCode from "../../controllers/compilers/executeCppCode.controller.js";
import { pool } from "../../database/connect.db.js";

/**
 * @class CodeEvaluationPlugin
 * @extends IEvaluationPlugin
 * @description Handles code problem evaluation using Docker containers
 */
class CodeEvaluationPlugin extends IEvaluationPlugin {
    constructor() {
        super();
        this.pluginType = "code";
        this.supportedLanguages = ["java", "python", "cpp"];
    }

    /**
     * @override
     */
    getType() {
        return this.pluginType;
    }

    /**
     * @override
     */
    getSupportedQuestionTypes() {
        return ["code", "coding_problem", "algorithm"];
    }

    /**
     * @override
     */
    canHandle(question) {
        return question.question_type === "code" || question.type === "code";
    }

    /**
     * @override
     */
    getMetadata() {
        return {
            type: this.pluginType,
            version: "1.0.0",
            capabilities: ["code_execution", "test_case_validation", "performance_metrics"],
            supportedLanguages: this.supportedLanguages,
        };
    }

    /**
     * @override
     * Main evaluation method matching IEvaluationPlugin interface
     * @param {Object} input - {userId, questionId, answer: {sourceCode, language}, context}
     * @returns {Promise<Object>} EvaluationResult
     */
    async evaluate(input) {
        try {
            const { userId, questionId, answer, context = {} } = input;
            const { code: sourceCode, language } = answer;

            // Validate input
            if (!sourceCode || !language) {
                return {
                    success: false,
                    verdict: "INVALID_INPUT",
                    score: 0,
                    executionTime: "0ms",
                    error: "sourceCode and language are required",
                    mistakes: [],
                    detectedTopics: [],
                    details: {},
                };
            }

            // Validate language support
            if (!this.supportedLanguages.includes(language.toLowerCase())) {
                return {
                    success: false,
                    verdict: "UNSUPPORTED_LANGUAGE",
                    score: 0,
                    executionTime: "0ms",
                    error: `Language ${language} not supported`,
                    mistakes: [],
                    detectedTopics: [],
                };
            }

            // Get problem data and test cases
            const problemQuery = "SELECT * FROM problem WHERE id = $1";
            const problemResult = await pool.query(problemQuery, [questionId]);

            if (problemResult.rowCount === 0) {
                return {
                    success: false,
                    verdict: "PROBLEM_NOT_FOUND",
                    score: 0,
                    executionTime: "0ms",
                    error: "Problem not found",
                    mistakes: [],
                    detectedTopics: [],
                };
            }

            const problem = problemResult.rows[0];
            const detectedTopics = problem.category || [];

            // Get test cases
            const testCasesQuery = "SELECT * FROM testcases WHERE problem_id = $1";
            const testCasesResult = await pool.query(testCasesQuery, [questionId]);

            if (testCasesResult.rowCount === 0) {
                return {
                    success: false,
                    verdict: "NO_TESTCASES",
                    score: 0,
                    executionTime: "0ms",
                    error: "No test cases found",
                    mistakes: [],
                    detectedTopics,
                };
            }

            // Select appropriate executor
            const executor = this.getExecutor(language.toLowerCase());

            // Execute code against all test cases
            const testResults = [];
            let passedTests = 0;
            let totalExecutionTime = 0;

            for (const test of testCasesResult.rows) {
                const result = await executor(sourceCode, test.testcase.input, test.id);

                const verdict = this.determineVerdict(result, test.testcase.output);
                const passed = verdict === "ACCEPTED";

                if (passed) passedTests++;

                testResults.push({
                    passed,
                    expected: test.testcase.output,
                    actual: result.output,
                    verdict,
                    executionTime: result.executionTime,
                    error: result.error,
                });

                // Parse execution time
                const timeMs = parseFloat(result.executionTime);
                if (!isNaN(timeMs)) {
                    totalExecutionTime += timeMs;
                }
            }

            // Calculate score
            const score = Math.round((passedTests / testCasesResult.rowCount) * 100);
            const overallVerdict = passedTests === testCasesResult.rowCount ? "ACCEPTED" : "WRONG_ANSWER";

            return {
                success: true,
                verdict: overallVerdict,
                score,
                executionTime: `${totalExecutionTime.toFixed(2)}ms`,
                testResults,
                detectedTopics,
                mistakes: [], // Will be populated by extractMistakes()
                details: {
                    totalTests: testCasesResult.rowCount,
                    passedTests,
                },
                pluginMetadata: {
                    sourceCode,
                    language,
                    problemId: questionId,
                    totalTests: testCasesResult.rowCount,
                    passedTests,
                    difficulty: problem.difficulty,
                },
            };
        } catch (error) {
            console.error("CodeEvaluationPlugin error:", error);
            return {
                success: false,
                verdict: "SYSTEM_ERROR",
                score: 0,
                executionTime: "0ms",
                error: error.message,
                mistakes: [],
                detectedTopics: [],
                details: {},
            };
        }
    }

    /**
     * @override
     * Extract mistakes from evaluation result
     * @param {Object} result - Evaluation result
     * @param {Object} question - Question data
     * @returns {Promise<Array>} Detected mistakes
     */
    async extractMistakes(result, question) {
        const mistakes = [];

        if (!result.testResults || result.testResults.length === 0) {
            return mistakes;
        }

        // Get source code and language from result metadata
        const context = {
            sourceCode: result.pluginMetadata?.sourceCode || "",
            language: result.pluginMetadata?.language || "",
            problem: question,
        };

        // Analyze failed test cases
        for (const testResult of result.testResults) {
            if (!testResult.passed) {
                const mistake = this.categorizeMistake(testResult, result, context);
                if (mistake) {
                    mistakes.push(mistake);
                }
            }
        }

        // Detect patterns across mistakes
        this.detectMistakePatterns(mistakes, result);

        return mistakes;
    }

    /**
     * @private
     * @description Categorize individual test failure
     */
    categorizeMistake(testResult, result, context) {
        const { verdict, error } = testResult;

        // TLE (Time Limit Exceeded)
        if (verdict === "TLE" || (error && error.includes("time limit"))) {
            return {
                type: "TLE",
                category: "performance",
                severity: 5,
                topic: result.detectedTopics[0] || "unknown",
                description: "Time Limit Exceeded - Algorithm too slow",
                context: {
                    executionTime: testResult.executionTime,
                    suggestion: "Consider optimizing your algorithm complexity",
                },
            };
        }

        // RTE (Runtime Error)
        if (verdict === "RTE" || error) {
            return {
                type: "RUNTIME_ERROR",
                category: "runtime",
                severity: 4,
                topic: result.detectedTopics[0] || "unknown",
                description: `Runtime Error: ${error}`,
                context: {
                    error: error,
                    suggestion: "Check for null pointers, array bounds, or divide by zero",
                },
            };
        }

        // Wrong Answer - Need deeper analysis
        if (verdict === "WRONG_ANSWER") {
            const mistakeType = this.analyzeWrongAnswer(testResult.expected, testResult.actual);
            return {
                type: mistakeType.type || "WRONG_ANSWER",
                category: mistakeType.category,
                severity: 3,
                topic: result.detectedTopics[0] || "unknown",
                description: mistakeType.description,
                context: {
                    expected: testResult.expected,
                    actual: testResult.actual,
                    ...mistakeType.context,
                },
            };
        }

        return null;
    }

    /**
     * @private
     * @description Analyze wrong answer to categorize mistake type
     */
    analyzeWrongAnswer(expected, actual) {
        if (!expected || !actual) {
            return {
                type: "LOGIC_ERROR",
                category: "logic",
                description: "Missing or empty output",
                context: {},
            };
        }

        const expectedTrim = expected.trim();
        const actualTrim = actual.trim();

        // Off-by-one error detection
        if (this.isOffByOne(expectedTrim, actualTrim)) {
            return {
                type: "OFF_BY_ONE",
                category: "logic",
                description: "Off-by-one error detected",
                context: { suggestion: "Check loop boundaries and array indices" },
            };
        }

        // Edge case miss (empty input/output)
        if (expectedTrim === "" || actualTrim === "") {
            return {
                type: "EDGE_CASE",
                category: "logic",
                description: "Edge case not handled (empty input/output)",
                context: { suggestion: "Consider edge cases like empty arrays or zero values" },
            };
        }

        // Format/output error
        if (this.isSimilarButWrongFormat(expectedTrim, actualTrim)) {
            return {
                type: "FORMAT_ERROR",
                category: "output",
                description: "Correct logic but wrong output format",
                context: { suggestion: "Check output format requirements" },
            };
        }

        // Generic logic error
        return {
            type: "LOGIC_ERROR",
            category: "logic",
            description: "Incorrect algorithm or logic",
            context: {},
        };
    }

    /**
     * @private
     */
    isOffByOne(expected, actual) {
        // Check if numbers differ by 1
        const expectedNum = parseInt(expected);
        const actualNum = parseInt(actual);
        if (!isNaN(expectedNum) && !isNaN(actualNum)) {
            return Math.abs(expectedNum - actualNum) === 1;
        }
        return false;
    }

    /**
     * @private
     */
    isSimilarButWrongFormat(expected, actual) {
        // Remove whitespace and compare
        const exp = expected.replace(/\s+/g, "");
        const act = actual.replace(/\s+/g, "");
        return exp === act && expected !== actual;
    }

    /**
     * @private
     * @description Detect patterns across multiple mistakes
     */
    detectMistakePatterns(mistakes, result) {
        // Detect if all failures are TLE -> complexity issue
        const tleCount = mistakes.filter((m) => m.category === "tle").length;
        if (tleCount === mistakes.length && tleCount > 0) {
            mistakes.forEach((m) => {
                m.pattern = "consistent_tle";
                m.context.suggestion = "All test cases timing out - fundamental complexity issue";
            });
        }

        // Detect if failures only on later test cases -> edge case issues
        if (result.testResults) {
            const passedFirst = result.testResults.slice(0, 2).every((t) => t.passed);
            const failedLater = result.testResults.slice(2).some((t) => !t.passed);
            if (passedFirst && failedLater) {
                mistakes.forEach((m) => {
                    m.pattern = "edge_case_failure";
                    m.context.suggestion = "Passing simple cases but failing complex ones - check edge cases";
                });
            }
        }
    }

    /**
     * @private
     */
    getExecutor(language) {
        switch (language.toLowerCase()) {
            case "java":
                return executeJavaCode;
            case "python":
                return executePythonCode;
            case "cpp":
            case "c++":
                return executeCppCode;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * @private
     */
    determineVerdict(result, expectedOutput) {
        if (result.error) {
            if (result.error.toLowerCase().includes("time limit")) {
                return "TLE";
            }
            return "RTE";
        }

        if (!result.output) {
            return "RTE";
        }

        return result.output.trimEnd() === expectedOutput.trimEnd() ? "ACCEPTED" : "WRONG_ANSWER";
    }
}

export default CodeEvaluationPlugin;
