import { pool } from "../database/connect.db.js";
import { execute } from "../execution/index.js";
import EvaluationService from "../learning-core/services/evaluation.service.js";
import CourseIntegrationService from "../services/courseIntegration.service.js";
import { canAccessCourse } from "../services/courseAccess.service.js";

import generateUuid from "../constants/generateUuid.js";

const executeProblemController = async (req, res) => {
    try {
        const { sourceCode, language, input } = req.body;
        console.log("Executing with input:", JSON.stringify(input.trim()));

        console.log(language, input);

        const userId = req.userId;

        if (typeof language === "string" && language.toLowerCase() === "java") {
            const result = await execute(sourceCode, language, input, `sample_${userId}`);
            console.log(result.output);
            return result.success ? res.status(200).json(result) : res.status(402).json(result);
        } else if (typeof language === "string" && language.toLowerCase() === "python") {
            const result = await execute(sourceCode, language, input, `sample_${userId}`);
            console.log(result);
            return result.success ? res.status(200).json(result) : res.status(402).json(result);
        } else if (typeof language === "string" && language.toLowerCase() === "cpp") {
            const result = await execute(sourceCode, language, input, `sample_${userId}`);
            console.log(result);
            return result.success ? res.status(200).json(result) : res.status(402).json(result);
        } else {
            return res.status(400).json({ success: false, message: "Unsupported language" });
        }
    } catch (error) {
        console.error("Controller error:", error);
        return res.status(500).json({ success: false, message: error });
    }
};

const submitProblemController = async (req, res) => {
    try {
        const { problemId, sourceCode, language, courseId } = req.body;
        const userId = req.userId;

        let checkProblemResult;
        if (courseId) {
            const hasCourseAccess = await canAccessCourse(userId, courseId);
            if (!hasCourseAccess) {
                return res.status(403).json({
                    success: false,
                    message: "Purchase this course to submit this problem",
                });
            }

            checkProblemResult = await pool.query(
                `SELECT p.id
                 FROM problem p
                 JOIN course_problems cp ON cp.problem_id = p.id
                 WHERE p.id = $1 AND cp.course_id = $2`,
                [problemId, courseId],
            );
        } else {
            checkProblemResult = await pool.query(
                "SELECT id FROM problem WHERE id = $1 AND (hidden IS NULL OR hidden = false)",
                [problemId],
            );
        }

        if (checkProblemResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Problem not found or not accessible",
            });
        }

        const getProblemTestcasesQuery = "SELECT * FROM testcases WHERE problem_id = $1";

        const getProblemTestcasesResult = await pool.query(getProblemTestcasesQuery, [problemId]);

        if (getProblemTestcasesResult.rowCount > 0) {
            // console.log(getProblemTestcasesResult);

            const hiddenTestcases = getProblemTestcasesResult.rows;
            console.log("lkfne:", hiddenTestcases);

            let executeCode = null;
            if (typeof language === "string" && language.toLowerCase() === "java") {
                executeCode = execute;
            } else if (typeof language === "string" && language.toLowerCase() === "python") {
                executeCode = execute;
            } else if (typeof language === "string" && language.toLowerCase() === "cpp") {
                executeCode = execute;
            } else {
                executeCode = null;
                return res.status(400).json({ success: false, message: "Unsupported language" });
            }

            if (executeCode != null) {
                let testResults = [];
                for (const test of hiddenTestcases) {
                    const result = await executeCode(sourceCode, language, test.testcase.input, test.id);
                    // console.log("result luffy: ", result);
                    // console.log(test);
                    // console.log(test.testcase.input);
                    let verdict;
                    // console.log("luffy");
                    // console.log(result.output);
                    // console.log("-------");
                    // console.log(test.testcase.output);
                    // console.log(test.testcase.output === result.output);

                    if (result.error) {
                        if (result.error.toLowerCase().includes("time limit")) {
                            verdict = "TLE";
                        } else {
                            verdict = "RTE";
                        }
                    } else if (result.output.trimEnd() === test.testcase.output.trimEnd()) {
                        verdict = "ACCEPTED";
                    } else {
                        verdict = "WRONG ANSWER";
                    }

                    testResults.push({ ...result, verdict });
                }
                // console.log("tr:", testResults);

                let verdict = "ACCEPTED";
                let totalExecutionTime = 0;

                for (let test of testResults) {
                    totalExecutionTime += test.executionTime;

                    if (test.verdict === "TLE") {
                        verdict = "TLE";
                        break;
                    }
                    if (test.verdict === "RTE") {
                        verdict = "RTE";
                        break;
                    }
                    if (test.verdict === "WRONG ANSWER") {
                        verdict = "WRONG ANSWER";
                        break;
                    }
                }

                // Insert into submissions table with courseId (NULL for regular submissions)
                const insertProblemSubmissionQuery =
                    "INSERT INTO submissions (id, problem_id, user_id, code, language, test_results, verdict, execution_time, course_id) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *";

                const submissionId = generateUuid();
                const insertHiddenTestcasesProps = [
                    submissionId,
                    problemId,
                    userId,
                    sourceCode,
                    language,
                    JSON.stringify(testResults),
                    verdict,
                    totalExecutionTime,
                    courseId || null, // NULL for regular submissions, courseId for course submissions
                ];

                const insertHiddenTestcasesResult = await pool.query(
                    insertProblemSubmissionQuery,
                    insertHiddenTestcasesProps,
                );

                if (insertHiddenTestcasesResult.rowCount === 0) {
                    return res.status(410).send("Submission Error");
                }

                console.log(insertHiddenTestcasesResult.rows);

                // If verdict is ACCEPTED, handle category points (for both course and regular submissions)
                if (verdict === "ACCEPTED") {
                    try {
                        // Get problem details for category points
                        const getProblemDetailsQuery = `
              SELECT category, difficulty, score FROM problem 
              WHERE id = $1
            `;
                        const problemDetailsResult = await pool.query(getProblemDetailsQuery, [problemId]);

                        if (problemDetailsResult.rowCount > 0) {
                            const { category, difficulty, score } = problemDetailsResult.rows[0];

                            // Check if user already solved this problem before (avoid duplicate category points)
                            const checkPreviousSolutionQuery = `
                SELECT COUNT(*) FROM user_problem_points 
                WHERE user_id = $1 AND problem_id = $2
              `;
                            const previousSolutionResult = await pool.query(checkPreviousSolutionQuery, [
                                userId,
                                problemId,
                            ]);
                            const alreadySolved = parseInt(previousSolutionResult.rows[0].count) > 0;

                            // Award category points only if this is the first time solving this problem
                            if (!alreadySolved && category) {
                                // Calculate category points based on difficulty level
                                const getDifficultyPoints = (difficulty) => {
                                    switch (difficulty?.toLowerCase()) {
                                        case "cakewalk":
                                            return 1;
                                        case "easy":
                                            return 2;
                                        case "easymedium":
                                            return 3;
                                        case "medium":
                                            return 4;
                                        case "mediumhard":
                                            return 5;
                                        case "hard":
                                            return 6;
                                        default:
                                            return 1; // Default to cakewalk points
                                    }
                                };

                                const categoryPointsAwarded = getDifficultyPoints(difficulty);
                                const problemScoreAwarded = parseInt(score) || 0;

                                // Insert into user_problem_points to track this problem is solved (use problem score for NeoCode points)
                                const insertProblemPointsQuery = `
                  INSERT INTO user_problem_points (user_id, problem_id, points_awarded)
                  VALUES ($1, $2, $3)
                `;
                                await pool.query(insertProblemPointsQuery, [userId, problemId, problemScoreAwarded]);

                                // Handle category - could be array format like {Math,I/O} or single string
                                let categories = [];
                                if (typeof category === "string") {
                                    // Check if it's PostgreSQL array format like {Math,I/O}
                                    if (category.startsWith("{") && category.endsWith("}")) {
                                        categories = category
                                            .slice(1, -1)
                                            .split(",")
                                            .map((cat) => cat.trim());
                                    } else {
                                        categories = [category];
                                    }
                                } else if (Array.isArray(category)) {
                                    categories = category;
                                }

                                // Award points for each category
                                for (const cat of categories) {
                                    if (cat && cat.trim()) {
                                        const cleanCategory = cat.trim();
                                        const updateCategoryPointsQuery = `
                      INSERT INTO user_category_points (user_id, category, total_points, problems_solved)
                      VALUES ($1, $2, $3, 1)
                      ON CONFLICT (user_id, category)
                      DO UPDATE SET 
                        total_points = user_category_points.total_points + EXCLUDED.total_points,
                        problems_solved = user_category_points.problems_solved + 1
                    `;
                                        await pool.query(updateCategoryPointsQuery, [
                                            userId,
                                            cleanCategory,
                                            categoryPointsAwarded,
                                        ]);
                                    }
                                }
                            }
                        }
                    } catch (categoryPointsError) {
                        console.error("Error updating category points:", categoryPointsError);
                        // Don't fail the submission if category points update fails
                    }
                }

                // If it's a course submission and verdict is ACCEPTED, update course tracking
                if (courseId && verdict === "ACCEPTED") {
                    try {
                        // Get points for this problem in the course
                        const getPointsQuery = `
              SELECT points FROM course_problems 
              WHERE course_id = $1 AND problem_id = $2
            `;
                        const pointsResult = await pool.query(getPointsQuery, [courseId, problemId]);
                        const pointsEarned = pointsResult.rows[0]?.points || 0;

                        // Insert or update course_submissions tracking (UNIQUE constraint handles duplicates)
                        const insertCourseSubmissionQuery = `
              INSERT INTO course_submissions (user_id, course_id, problem_id, submission_id, points_earned)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (user_id, course_id, problem_id) 
              DO UPDATE SET 
                submission_id = EXCLUDED.submission_id,
                points_earned = EXCLUDED.points_earned,
                solved_at = NOW()
            `;

                        await pool.query(insertCourseSubmissionQuery, [
                            userId,
                            courseId,
                            problemId,
                            submissionId,
                            pointsEarned,
                        ]);

                        // Course progress is now calculated dynamically from submissions
                        // No need to maintain separate user_course_progress table
                    } catch (progressError) {
                        console.error("Error updating course submission record:", progressError);
                        // Don't fail the submission if course submission tracking fails
                    }
                }

                const totalTestcases = testResults.length;
                const passedTestcases = testResults.filter((t) => t.verdict === "ACCEPTED").length;

                const responsePayload = {
                    success: verdict === "ACCEPTED",
                    verdict: verdict,
                    totalTestcases,
                    passedTestcases,
                    totalExecutionTime,
                    testResults, // Array of detailed results
                    submissionDetails: insertHiddenTestcasesResult.rows[0], // You can still send this
                };

                // ============================================================================
                // PHASE 1C: DUAL SYSTEM - Also write to learning core (non-blocking)
                // If learning core fails, old system still works
                // ============================================================================
                setImmediate(async () => {
                    try {
                        // Parse execution time: totalExecutionTime is numeric milliseconds
                        // Convert to seconds (integer) for learning system
                        let timeSpentSeconds = null;
                        if (typeof totalExecutionTime === "number") {
                            timeSpentSeconds = Math.round(totalExecutionTime / 1000);
                        } else if (typeof totalExecutionTime === "string") {
                            // Parse string like "646.1533 ms" or "0646.1533 ms682.9742 ms"
                            const match = totalExecutionTime.match(/(\d+\.?\d*)\s*ms/);
                            if (match) {
                                timeSpentSeconds = Math.round(parseFloat(match[1]) / 1000);
                            }
                        }

                        const evaluationService = new EvaluationService();
                        await evaluationService.evaluate({
                            userId,
                            questionId: problemId,
                            evaluationType: "code",
                            answer: {
                                code: sourceCode,
                                language: language.toLowerCase(),
                            },
                            context: {
                                timeSpent: timeSpentSeconds,
                                hintsUsed: 0, // Frontend can track this later
                                userFailureReason: req.body.userFailureReason || null,
                                confidenceLevel: req.body.confidenceLevel || null,
                            },
                        });
                        console.log("✅ Learning core updated successfully");

                        // ============================================================================
                        // AI MENTOR SYSTEM: Update user skills when problem is solved
                        // ============================================================================
                        if (verdict === "ACCEPTED") {
                            try {
                                const courseIntegrationService = new CourseIntegrationService();
                                await courseIntegrationService.onProblemSolved(userId, problemId, courseId, verdict);
                                console.log("✅ AI Mentor System: Skill updated for problem solved");
                            } catch (mentorError) {
                                console.error("⚠️ AI Mentor skill update failed (non-critical):", mentorError.message);
                            }
                        }
                    } catch (learningError) {
                        // Don't fail submission if learning core has issues
                        console.error("⚠️ Learning core update failed (non-critical):", learningError.message);
                    }
                });

                return res.status(verdict === "ACCEPTED" ? 200 : 402).json(responsePayload);
            }

            // if (typeof language === "string" && language.toLowerCase() === "java") {
            //   let testResults = [];
            //   for (const test of hiddenTestcases) {
            //     const result = await executeJavaCode(
            //       sourceCode,
            //       test.testcase.input,
            //       test.id
            //     );
            //     // console.log("result luffy: ", result);
            //     // console.log(test);
            //     // console.log(test.testcase.input);
            //     let verdict;
            //     if (result.output === test.testcase.output) {
            //       verdict = "ACCEPTED";
            //     } else {
            //       verdict = "WRONG ANSWER";
            //     }
            //     testResults.push({ ...result, verdict });
            //   }
            //   console.log("tr:", testResults);

            //   let verdict = "";
            //   let totalExecutionTime = 0;

            //   for (let test of testResults) {
            //     if (test.verdict === "WRONG ANSWER") {
            //       verdict = "WRONG ANSWER";
            //       break;
            //     } else {
            //       verdict = "ACCEPTED";
            //     }
            //     totalExecutionTime += test.executionTime;
            //   }

            //   const insertProblemSubmissionQuery =
            //     "INSERT INTO submissions (id,problem_id, user_id, code, language, test_results, verdict, execution_time) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *";

            //   const insertHiddenTestcasesProps = [
            //     generateUuid(),
            //     problemId,
            //     userId,
            //     sourceCode,
            //     language,
            //     JSON.stringify(testResults),
            //     verdict,
            //     totalExecutionTime,
            //   ];

            //   const insertHiddenTestcasesResult = await pool.query(
            //     insertProblemSubmissionQuery,
            //     insertHiddenTestcasesProps
            //   );

            //   if (insertHiddenTestcasesResult.rowCount === 0) {
            //     return res.status(410).send("Submission Error");
            //   }

            //   console.log(insertHiddenTestcasesResult);

            //   return res.status(200).json({
            //     success: true,
            //     insertHiddenTestcasesResult,
            //   });
            // } else if (
            //   typeof language === "string" &&
            //   language.toLowerCase() === "python"
            // ) {
            //   let testResults = [];
            //   for (const test of hiddenTestcases) {
            //     const result = await executePythonCode(
            //       sourceCode,
            //       test.testcase.input,
            //       test.id
            //     );
            //     let verdict;
            //     if (result.output === test.testcase.output) {
            //       verdict = "ACCEPTED";
            //     } else {
            //       verdict = "WRONG ANSWER";
            //     }
            //     testResults.push({ ...result, verdict });
            //   }
            //   console.log("tr:", testResults);

            //   let verdict = "";
            //   let totalExecutionTime = 0;

            //   for (let test of testResults) {
            //     if (test.verdict === "WRONG ANSWER") {
            //       verdict = "WRONG ANSWER";
            //       break;
            //     } else {
            //       verdict = "ACCEPTED";
            //     }
            //     totalExecutionTime += test.executionTime;
            //   }

            //   const insertProblemSubmissionQuery =
            //     "INSERT INTO submissions (id,problem_id, user_id, code, language, test_results, verdict, execution_time) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *";

            //   const insertHiddenTestcasesProps = [
            //     generateUuid(),
            //     problemId,
            //     userId,
            //     sourceCode,
            //     language,
            //     JSON.stringify(testResults),
            //     verdict,
            //     totalExecutionTime,
            //   ];

            //   const insertHiddenTestcasesResult = await pool.query(
            //     insertProblemSubmissionQuery,
            //     insertHiddenTestcasesProps
            //   );

            //   if (insertHiddenTestcasesResult.rowCount === 0) {
            //     return res.status(410).send("Submission Error");
            //   }

            //   console.log(insertHiddenTestcasesResult);

            //   return res.status(200).json({
            //     success: true,
            //     insertHiddenTestcasesResult,
            //   });
            // }
        } else {
            return res.status(400).json({ success: false, message: "No Testcases for the Problem" });
        }
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: "Internal Server Error" });
    }
};

const getExpectedOutputController = async (req, res) => {
    const { problemId, input, courseId } = req.body;
    const userId = req.userId;

    try {
        let getSolutionResult;
        if (courseId) {
            const hasCourseAccess = await canAccessCourse(userId, courseId);
            if (!hasCourseAccess) {
                return res.status(403).json({
                    success: false,
                    message: "Purchase this course to access expected output",
                });
            }

            getSolutionResult = await pool.query(
                `SELECT p.solution, p.solution_language
                 FROM problem p
                 JOIN course_problems cp ON cp.problem_id = p.id
                 WHERE p.id = $1 AND cp.course_id = $2`,
                [problemId, courseId],
            );
        } else {
            getSolutionResult = await pool.query(
                "SELECT solution, solution_language FROM problem WHERE id = $1 AND (hidden IS NULL OR hidden = false)",
                [problemId],
            );
        }

        if (getSolutionResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Problem not found or no predefined solution is present",
            });
        }

        const { solution, solution_language } = getSolutionResult.rows[0];

        if (typeof solution_language === "string" && solution_language.toLowerCase() === "java") {
            const result = await execute(solution, solution_language, input, `sample_${userId}`);
            return res.json(result);
        } else if (typeof solution_language === "string" && solution_language.toLowerCase() === "python") {
            const result = await execute(solution, solution_language, input, `sample_${userId}`);
            console.log(result);
            return res.json(result);
        } else if (typeof solution_language === "string" && solution_language.toLowerCase() === "cpp") {
            const result = await execute(solution, solution_language, input, `sample_${userId}`);
            console.log(result);
            return res.json(result);
        } else {
            return res.status(400).json({ success: false, message: "Unsupported language" });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later.",
        });
    }
};

export { executeProblemController, submitProblemController, getExpectedOutputController };
