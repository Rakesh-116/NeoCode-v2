import { pool } from "../database/connect.db.js";
import generateUuid from "../constants/generateUuid.js";

const createProblemController = async (req, res) => {
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
  } = req.body;

  const userId = req.userId;

  const createProblemQuery = `
    INSERT INTO Problem (
      title, description, input_format, output_format,
      constraints, prohibited_keys, sample_testcase,
      explaination, difficulty, score, category,
      solution, solution_language, created_by
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14
    ) RETURNING id
  `;

  const createProblemProps = [
    title,
    description,
    input_format,
    output_format,
    constraints,
    prohibited_keys,
    sample_testcase,
    explaination || "Self Explainary!",
    difficulty,
    score,
    category || [],
    solution || "No Solution",
    solutionLanguage || null,
    userId,
  ];

  try {
    const createProblemResult = await pool.query(
      createProblemQuery,
      createProblemProps
    );

    if (createProblemResult.rowCount > 0) {
      const problemId = createProblemResult.rows[0].id;

      const insertHiddenTestcasesQuery = `
        INSERT INTO testcases (id, testcase, problem_id)
        VALUES ($1, $2, $3)
      `;

      for (const test of hidden_testcases) {
        await pool.query(insertHiddenTestcasesQuery, [
          generateUuid(),
          test,
          problemId,
        ]);
      }

      return res.status(200).json({
        success: true,
        message: "Problem created successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Problem creation failed. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error creating problem:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const deleteProblemController = async (req, res) => {
  const { id } = req.params;
  const deleteProblemQuery = "DELETE FROM Problem WHERE id = $1";
  try {
    await pool.query(deleteProblemQuery, [id]);
    return res.status(200).json({
      success: true,
      response: "Problem Successfully Deleted",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
};

const getAllProblemsForCourseController = async (req, res) => {
  const { categories, difficulty, search, visibility } = req.query;

  const categoryList = categories ? categories.split(",") : [];
  let baseQuery = `
    SELECT id, title, score, difficulty, category, COALESCE(hidden, false) as hidden
    FROM problem
  `;
  const conditions = [];
  const values = [];

  if (categoryList.length > 0) {
    values.push(categoryList);
    conditions.push(`category && $${values.length}`);
  }

  if (difficulty) {
    values.push(difficulty.toLowerCase());
    conditions.push(`LOWER(difficulty::text) = $${values.length}`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`LOWER(title) LIKE $${values.length}`);
  }

  // Handle visibility filter
  if (visibility) {
    if (visibility === 'hidden') {
      conditions.push(`hidden = true`);
    } else if (visibility === 'visible') {
      conditions.push(`(hidden IS NULL OR hidden = false)`);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderClause = "ORDER BY id ASC";

  const finalQuery = `${baseQuery} ${whereClause} ${orderClause}`;

  try {
    const result = await pool.query(finalQuery, values);
    return res.status(result.rowCount > 0 ? 200 : 404).json({
      success: result.rowCount > 0,
      problems: result.rows,
      message: result.rowCount > 0 ? undefined : "No problems found",
    });
  } catch (error) {
    console.error("Error fetching problems:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const getProblemByIdController = async (req, res) => {
  const { id } = req.params;

  try {
    const problemQuery = `
      SELECT id, title, description, input_format, output_format, constraints, 
             prohibited_keys, sample_testcase, explaination, 
             score, difficulty, category, solution, 
             solution_language, hidden
      FROM problem
      WHERE id = $1
    `;
    const problemResult = await pool.query(problemQuery, [id]);
    
    if (problemResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Problem not found",
      });
    }

    const testcasesQuery = `
      SELECT id, testcase
      FROM testcases
      WHERE problem_id = $1
      ORDER BY id ASC
    `;
    const testcasesResult = await pool.query(testcasesQuery, [id]);

    return res.status(200).json({
      success: true,
      problem: problemResult.rows[0],
      testcases: testcasesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching problem:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const updateProblemController = async (req, res) => {
  const { id } = req.params;
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
    category, 
    solution, 
    solutionLanguage, 
    hidden_testcases, 
    hidden 
  } = req.body;

  if (!title || !description || !difficulty || !score || !category || !Array.isArray(category) || category.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: title, description, difficulty, score, and category are required",
    });
  }

  if (!hidden_testcases || !Array.isArray(hidden_testcases) || hidden_testcases.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one test case is required",
    });
  }

  try {
    await pool.query('BEGIN');

    // Update problem
    const updateProblemQuery = `
      UPDATE problem 
      SET title = $1, description = $2, input_format = $3, output_format = $4,
          constraints = $5, prohibited_keys = $6, sample_testcase = $7,
          explaination = $8, difficulty = $9::difficulty_level, 
          score = $10::score_level, category = $11, solution = $12,
          solution_language = $13, hidden = $14, updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
    `;
    
    await pool.query(updateProblemQuery, [
      title,
      description,
      input_format,
      output_format,
      constraints,
      prohibited_keys,
      sample_testcase,
      explaination || "Self Explanatory",
      difficulty,
      score,
      category,
      solution,
      solutionLanguage,
      hidden || false,
      id
    ]);

    // Delete existing testcases
    await pool.query('DELETE FROM testcases WHERE problem_id = $1', [id]);

    // Insert new testcases
    for (const testcase of hidden_testcases) {
      if (!testcase.input || !testcase.output) {
        throw new Error("Invalid test case data");
      }
      
      await pool.query(
        'INSERT INTO testcases (id, testcase, problem_id) VALUES ($1, $2, $3)',
        [generateUuid(), JSON.stringify(testcase), id]
      );
    }

    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Problem updated successfully",
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error updating problem:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update problem. Please try again.",
    });
  }
};

const toggleProblemVisibilityController = async (req, res) => {
  const { id } = req.params;
  const { hidden } = req.body;

  if (typeof hidden !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: "Hidden field must be a boolean value",
    });
  }

  try {
    const updateQuery = `
      UPDATE problem 
      SET hidden = $1
      WHERE id = $2
    `;
    
    const result = await pool.query(updateQuery, [hidden, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Problem not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Problem ${hidden ? 'hidden' : 'made visible'} successfully`,
    });
  } catch (error) {
    console.error("Error updating problem visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update problem visibility. Please try again.",
    });
  }
};

export { 
  createProblemController, 
  deleteProblemController, 
  getAllProblemsForCourseController,
  getProblemByIdController,
  updateProblemController,
  toggleProblemVisibilityController
};
