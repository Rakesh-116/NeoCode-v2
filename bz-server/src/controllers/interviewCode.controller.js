import { pool } from "../database/connect.db.js";
import executeJavaCode from "./compilers/executeJavaCode.controller.js";
import executePythonCode from "./compilers/executePythonCode.controller.js";
import executeCppCode from "./compilers/executeCppCode.controller.js";

const MAX_SOURCE_CODE_CHARS = 200_000;
const MAX_STDIN_CHARS = 50_000;

const isUuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const verifySessionOwnership = async (sessionId, userId) => {
    if (!isUuid(sessionId)) {
        const error = new Error("Invalid sessionId");
        error.statusCode = 400;
        throw error;
    }

    const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

    if (sessionCheck.rows.length === 0) {
        const error = new Error("Session not found");
        error.statusCode = 404;
        throw error;
    }

    if (sessionCheck.rows[0].user_id !== userId) {
        const error = new Error("Unauthorized access to session");
        error.statusCode = 403;
        throw error;
    }
};

const verifyTurnInSession = async (turnId, sessionId) => {
    if (!isUuid(turnId)) {
        const error = new Error("Invalid turnId");
        error.statusCode = 400;
        throw error;
    }

    const turnCheck = await pool.query(
        "SELECT id, requires_code_editor, question_type, problem_id FROM interview_turns WHERE id = $1 AND session_id = $2",
        [
            turnId,
            sessionId,
        ],
    );

    if (turnCheck.rows.length === 0) {
        const error = new Error("Turn not found for session");
        error.statusCode = 404;
        throw error;
    }

    return turnCheck.rows[0];
};

const getExecutor = (languageRaw) => {
    const language = (languageRaw || "").toLowerCase();
    if (language === "java") return executeJavaCode;
    if (language === "python") return executePythonCode;
    if (language === "cpp") return executeCppCode;
    return null;
};

/**
 * Execute code for an interview coding turn (no normal submission record)
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/:sessionId/turn/:turnId/code/execute
 *
 * Body: { sourceCode, language, input? }
 */
export const executeInterviewCode = async (req, res) => {
    try {
        const { sessionId, turnId } = req.params;
        const userId = req.userId;

        const { sourceCode, language, input } = req.body || {};

        if (!sourceCode || typeof sourceCode !== "string") {
            return res.status(400).json({ success: false, message: "sourceCode is required" });
        }
        if (sourceCode.length > MAX_SOURCE_CODE_CHARS) {
            return res
                .status(413)
                .json({ success: false, message: `sourceCode too large (max ${MAX_SOURCE_CODE_CHARS} chars)` });
        }
        if (!language || typeof language !== "string") {
            return res.status(400).json({ success: false, message: "language is required" });
        }
        if (input && typeof input !== "string") {
            return res.status(400).json({ success: false, message: "input must be a string" });
        }
        if (input && input.length > MAX_STDIN_CHARS) {
            return res.status(413).json({ success: false, message: `input too large (max ${MAX_STDIN_CHARS} chars)` });
        }

        await verifySessionOwnership(sessionId, userId);
        const turnRow = await verifyTurnInSession(turnId, sessionId);

        if (!turnRow.requires_code_editor) {
            return res.status(400).json({
                success: false,
                message: "This interview turn is not marked as a coding/editor turn",
            });
        }

        const executeCode = getExecutor(language);
        if (!executeCode) {
            return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
        }

        const sandboxKey = `interview_${sessionId}_${turnId}_${userId}`;
        const result = await executeCode(sourceCode, input || "", sandboxKey);

        return res.status(200).json({ success: true, output: result.output });
    } catch (error) {
        console.error("[InterviewCodeController] Error executing interview code:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to execute interview code",
            error: error.message,
        });
    }
};

/**
 * Submit code for an interview coding turn
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/:sessionId/turn/:turnId/code/submit
 *
 * Body: { sourceCode, language, stdin? } (stdin alias: input)
 */
export const submitInterviewCode = async (req, res) => {
    try {
        const { sessionId, turnId } = req.params;
        const userId = req.userId;

        const { sourceCode, language, stdin, input } = req.body || {};
        const resolvedStdin = stdin ?? input;

        if (!sourceCode || typeof sourceCode !== "string") {
            return res.status(400).json({ success: false, message: "sourceCode is required" });
        }
        if (sourceCode.length > MAX_SOURCE_CODE_CHARS) {
            return res
                .status(413)
                .json({ success: false, message: `sourceCode too large (max ${MAX_SOURCE_CODE_CHARS} chars)` });
        }
        if (!language || typeof language !== "string") {
            return res.status(400).json({ success: false, message: "language is required" });
        }
        if (resolvedStdin && typeof resolvedStdin !== "string") {
            return res.status(400).json({ success: false, message: "stdin must be a string" });
        }
        if (resolvedStdin && resolvedStdin.length > MAX_STDIN_CHARS) {
            return res
                .status(413)
                .json({ success: false, message: `stdin too large (max ${MAX_STDIN_CHARS} chars)` });
        }

        await verifySessionOwnership(sessionId, userId);
        const turnRow = await verifyTurnInSession(turnId, sessionId);

        if (!turnRow.requires_code_editor) {
            return res.status(400).json({
                success: false,
                message: "This interview turn is not marked as a coding/editor turn",
            });
        }

        let verdict = null;
        let testResults = null;
        let totalExecutionTime = null;

        if (turnRow.problem_id) {
            const executeCode = getExecutor(language);
            if (!executeCode) {
                return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });
            }

            const tcResult = await pool.query("SELECT id, testcase FROM testcases WHERE problem_id = $1", [
                turnRow.problem_id,
            ]);

            testResults = [];
            totalExecutionTime = 0;
            verdict = "ACCEPTED";

            for (const test of tcResult.rows) {
                const result = await executeCode(sourceCode, test.testcase.input, test.id);
                let tVerdict;

                if (result.error) {
                    if (result.error.toLowerCase().includes("time limit")) {
                        tVerdict = "TLE";
                    } else {
                        tVerdict = "RTE";
                    }
                } else if (String(result.output || "").trimEnd() === String(test.testcase.output || "").trimEnd()) {
                    tVerdict = "ACCEPTED";
                } else {
                    tVerdict = "WRONG ANSWER";
                }

                testResults.push({
                    output: result.output ?? null,
                    error: result.error ?? null,
                    executionTime: result.executionTime ?? null,
                    verdict: tVerdict,
                });
                if (result.executionTime) {
                    const parsed = parseFloat(String(result.executionTime).replace(/[^\d.]/g, ""));
                    totalExecutionTime += Number.isFinite(parsed) ? parsed : 0;
                }

                if (tVerdict === "TLE") {
                    verdict = "TLE";
                    break;
                }
                if (tVerdict === "RTE") {
                    verdict = "RTE";
                    break;
                }
                if (tVerdict === "WRONG ANSWER") {
                    verdict = "WRONG ANSWER";
                    break;
                }
            }
        }

        const result = await pool.query(
            `
            INSERT INTO public.interview_code_submissions (
                session_id, turn_id, user_id, language, source_code, stdin,
                verdict, test_results, execution_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
            RETURNING id, session_id, turn_id, user_id, language, created_at, verdict
        `,
            [
                sessionId,
                turnId,
                userId,
                language.toLowerCase(),
                sourceCode,
                resolvedStdin || null,
                verdict,
                testResults ? JSON.stringify(testResults) : null,
                Number.isFinite(totalExecutionTime) ? Math.round(totalExecutionTime) : null,
            ],
        );

        return res.status(201).json({
            success: true,
            submission: result.rows[0],
            verdict,
            testResults,
        });
    } catch (error) {
        console.error("[InterviewCodeController] Error submitting interview code:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to submit interview code",
        });
    }
};
