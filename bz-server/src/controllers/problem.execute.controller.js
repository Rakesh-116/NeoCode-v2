import { pool } from "../database/connect.db.js";
import executeJavaCode from "./compilers/executeJavaCode.controller.js";
import executePythonCode from "./compilers/executePythonCode.controller.js";
import executeCppCode from "./compilers/executeCppCode.controller.js";

import generateUuid from "../constants/generateUuid.js";

const executeProblemController = async (req, res) => {
  try {
    const { sourceCode, language, input } = req.body;
    console.log("Executing with input:", JSON.stringify(input.trim()));

    console.log(language, input);

    const userId = req.userId;

    if (typeof language === "string" && language.toLowerCase() === "java") {
      const result = await executeJavaCode(
        sourceCode,
        input,
        `sample_${userId}`
      );
      console.log(result.output);
      return result.success
        ? res.status(200).json(result)
        : res.status(402).json(result);
    } else if (
      typeof language === "string" &&
      language.toLowerCase() === "python"
    ) {
      const result = await executePythonCode(
        sourceCode,
        input,
        `sample_${userId}`
      );
      console.log(result);
      return result.success
        ? res.status(200).json(result)
        : res.status(402).json(result);
    } else if (
      typeof language === "string" &&
      language.toLowerCase() === "cpp"
    ) {
      const result = await executeCppCode(
        sourceCode,
        input,
        `sample_${userId}`
      );
      console.log(result);
      return result.success
        ? res.status(200).json(result)
        : res.status(402).json(result);
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unsupported language" });
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

    const getProblemTestcasesQuery =
      "SELECT * FROM testcases WHERE problem_id = $1";

    const getProblemTestcasesResult = await pool.query(
      getProblemTestcasesQuery,
      [problemId]
    );

    if (getProblemTestcasesResult.rowCount > 0) {
      // console.log(getProblemTestcasesResult);

      const hiddenTestcases = getProblemTestcasesResult.rows;
      console.log("lkfne:", hiddenTestcases);

      let executeCode = null;
      if (typeof language === "string" && language.toLowerCase() === "java") {
        executeCode = executeJavaCode;
      } else if (
        typeof language === "string" &&
        language.toLowerCase() === "python"
      ) {
        executeCode = executePythonCode;
      } else if (
        typeof language === "string" &&
        language.toLowerCase() === "cpp"
      ) {
        executeCode = executeCppCode;
      } else {
        executeCode = null;
        return res
          .status(400)
          .json({ success: false, message: "Unsupported language" });
      }

      if (executeCode != null) {
        let testResults = [];
        for (const test of hiddenTestcases) {
          const result = await executeCode(
            sourceCode,
            test.testcase.input,
            test.id
          );
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
          } else if (
            result.output.trimEnd() === test.testcase.output.trimEnd()
          ) {
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
          insertHiddenTestcasesProps
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
              const previousSolutionResult = await pool.query(checkPreviousSolutionQuery, [userId, problemId]);
              const alreadySolved = parseInt(previousSolutionResult.rows[0].count) > 0;
              
              // Award category points only if this is the first time solving this problem
              if (!alreadySolved && category) {
                const pointsAwarded = parseInt(score) || 0;
                
                // Insert into user_problem_points to track this problem is solved
                const insertProblemPointsQuery = `
                  INSERT INTO user_problem_points (user_id, problem_id, points_awarded)
                  VALUES ($1, $2, $3)
                `;
                await pool.query(insertProblemPointsQuery, [userId, problemId, pointsAwarded]);
                
                // Handle category - could be array format like {Math,I/O} or single string
                let categories = [];
                if (typeof category === 'string') {
                  // Check if it's PostgreSQL array format like {Math,I/O}
                  if (category.startsWith('{') && category.endsWith('}')) {
                    categories = category.slice(1, -1).split(',').map(cat => cat.trim());
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
                    await pool.query(updateCategoryPointsQuery, [userId, cleanCategory, pointsAwarded]);
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
              pointsEarned
            ]);

            // Course progress is now calculated dynamically from submissions
            // No need to maintain separate user_course_progress table

          } catch (progressError) {
            console.error("Error updating course submission record:", progressError);
            // Don't fail the submission if course submission tracking fails
          }
        }

        const totalTestcases = testResults.length;
        const passedTestcases = testResults.filter(
          (t) => t.verdict === "ACCEPTED"
        ).length;

        const responsePayload = {
          success: verdict === "ACCEPTED",
          verdict: verdict,
          totalTestcases,
          passedTestcases,
          totalExecutionTime,
          testResults, // Array of detailed results
          submissionDetails: insertHiddenTestcasesResult.rows[0], // You can still send this
        };

        return res
          .status(verdict === "ACCEPTED" ? 200 : 402)
          .json(responsePayload);
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
      return res
        .status(400)
        .json({ success: false, message: "No Testcases for the Problem" });
    }
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Internal Server Error" });
  }
};

const getExpectedOutputController = async (req, res) => {
  const { problemId, input } = req.body;
  const userId = req.userId;

  const getSolutionQuery =
    "SELECT solution, solution_language FROM problem WHERE id = $1";

  try {
    const getSolutionResult = await pool.query(getSolutionQuery, [problemId]);

    if (getSolutionResult.rowCount === 0) {
      return res.status(404).json({
        success: true,
        message: "No Predefined Solution is Present",
      });
    }

    const { solution, solution_language } = getSolutionResult.rows[0];

    if (
      typeof solution_language === "string" &&
      solution_language.toLowerCase() === "java"
    ) {
      const result = await executeJavaCode(solution, input, `sample_${userId}`);
      return res.json(result);
    } else if (
      typeof solution_language === "string" &&
      solution_language.toLowerCase() === "python"
    ) {
      const result = await executePythonCode(
        solution,
        input,
        `sample_${userId}`
      );
      console.log(result);
      return res.json(result);
    } else if (
      typeof solution_language === "string" &&
      solution_language.toLowerCase() === "cpp"
    ) {
      const result = await executeCppCode(solution, input, `sample_${userId}`);
      console.log(result);
      return res.json(result);
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unsupported language" });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

export {
  executeProblemController,
  submitProblemController,
  getExpectedOutputController,
};
