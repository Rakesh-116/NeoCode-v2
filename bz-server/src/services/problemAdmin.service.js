import { pool } from "../database/connect.db.js";
import generateUuid from "../constants/generateUuid.js";

const toScoreLevel = (score) => {
    const numeric = typeof score === "number" ? score : parseInt(score, 10);
    const allowed = new Set([10, 15, 20, 25, 30, 35]);
    if (!allowed.has(numeric)) return "10";
    return String(numeric);
};

const normalizeConstraints = (constraints) => {
    if (!constraints) return null;
    if (Array.isArray(constraints)) return constraints.join(", ").slice(0, 255);
    return String(constraints).slice(0, 255);
};

/**
 * Creates a problem + hidden testcases (admin-style), optionally hidden.
 * This is shared by admin APIs and internal systems (e.g., interviews).
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.data - problem payload (same shape as admin create)
 * @param {boolean} [params.forceHidden] - override hidden flag
 * @returns {Promise<number>} problemId
 */
export const createProblemWithTestcases = async ({ userId, data, forceHidden }) => {
    const {
        title,
        description,
        input_format,
        output_format,
        constraints,
        prohibited_keys,
        sample_testcase,
        explaination,
        difficulty,
        score,
        hidden_testcases,
        category,
        solution,
        solutionLanguage,
        hidden,
    } = data || {};

    if (!title || !description || !input_format || !output_format) {
        const error = new Error("Missing required problem fields");
        error.statusCode = 400;
        throw error;
    }

    const hiddenValue = forceHidden ? true : Boolean(hidden);

    const createProblemQuery = `
        INSERT INTO problem (
            title, description, input_format, output_format,
            constraints, prohibited_keys, sample_testcase,
            explaination, difficulty, score, category,
            solution, solution_language, created_by, hidden
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15
        )
        RETURNING id
    `;

    const createProblemProps = [
        title,
        description,
        input_format,
        output_format,
        normalizeConstraints(constraints),
        prohibited_keys || null,
        sample_testcase || null,
        explaination || "Self Explainary!",
        (difficulty || "easy").toLowerCase(),
        toScoreLevel(score || 10),
        category || [],
        solution || "No Solution",
        solutionLanguage || null,
        userId,
        hiddenValue,
    ];

    const createProblemResult = await pool.query(createProblemQuery, createProblemProps);
    const problemId = createProblemResult.rows?.[0]?.id;

    if (!problemId) {
        const error = new Error("Problem creation failed");
        error.statusCode = 500;
        throw error;
    }

    const tests = Array.isArray(hidden_testcases) ? hidden_testcases : [];
    if (tests.length > 0) {
        const insertHiddenTestcasesQuery = `
            INSERT INTO testcases (id, testcase, problem_id)
            VALUES ($1, $2, $3)
        `;

        for (const test of tests) {
            await pool.query(insertHiddenTestcasesQuery, [generateUuid(), test, problemId]);
        }
    }

    return problemId;
};

