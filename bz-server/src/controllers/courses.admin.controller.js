import { pool } from "../database/connect.db.js";

const createCourseController = async (req, res) => {
  const { title, category, description, problems } = req.body;

  if (!title || !category || !problems || problems.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide title, category, and at least one problem",
    });
  }

  const createCourseQuery = `
    INSERT INTO courses (title, category, description)
    VALUES ($1, $2, $3) RETURNING id
  `;

  try {
    // Create the course
    const courseResult = await pool.query(createCourseQuery, [
      title,
      category,
      description,
    ]);

    const courseId = courseResult.rows[0].id;

    // Insert course problems
    const insertProblemsQuery = `
      INSERT INTO course_problems (course_id, problem_id, points)
      VALUES ($1, $2, $3)
    `;

    for (const problem of problems) {
      await pool.query(insertProblemsQuery, [
        courseId,
        problem.problem_id,
        problem.points,
      ]);
    }

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      courseId: courseId,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const getAllCoursesController = async (req, res) => {
  const getAllCoursesQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.created_at,
      c.updated_at,
      COUNT(cp.problem_id) as total_problems,
      COALESCE(SUM(cp.points), 0) as total_points
    FROM courses c
    LEFT JOIN course_problems cp ON c.id = cp.course_id
    GROUP BY c.id, c.title, c.category, c.description, c.created_at, c.updated_at
    ORDER BY c.created_at DESC
  `;

  try {
    const result = await pool.query(getAllCoursesQuery);
    return res.status(200).json({
      success: true,
      courses: result.rows,
      message: result.rowCount > 0 ? undefined : "No courses found",
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const getCourseDetailsController = async (req, res) => {
  const courseId = req.params.id;

  const getCourseQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.created_at,
      c.updated_at
    FROM courses c
    WHERE c.id = $1
  `;

  const getCourseProblemsQuery = `
    SELECT 
      cp.id,
      cp.points,
      cp.visibility,
      p.id as problem_id,
      p.title as problem_title,
      p.difficulty,
      p.category as problem_category,
      p.score
    FROM course_problems cp
    JOIN problem p ON cp.problem_id = p.id
    WHERE cp.course_id = $1
    ORDER BY cp.created_at ASC
  `;

  try {
    const courseResult = await pool.query(getCourseQuery, [courseId]);
    
    if (courseResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const problemsResult = await pool.query(getCourseProblemsQuery, [courseId]);
    
    const course = courseResult.rows[0];
    course.problems = problemsResult.rows;
    course.total_problems = problemsResult.rowCount;
    course.total_points = problemsResult.rows.reduce((sum, p) => sum + (p.points || 0), 0);

    return res.status(200).json({
      success: true,
      course: course,
    });
  } catch (error) {
    console.error("Error fetching course details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const updateCourseController = async (req, res) => {
  const courseId = req.params.id;
  const { title, category, description, problems } = req.body;

  if (!title || !category || !problems || problems.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide title, category, and at least one problem",
    });
  }

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Update course details
    const updateCourseQuery = `
      UPDATE courses 
      SET title = $1, category = $2, description = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;
    
    const courseResult = await pool.query(updateCourseQuery, [
      title,
      category,
      description,
      courseId,
    ]);

    if (courseResult.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get current course problems
    const getCurrentProblemsQuery = `SELECT problem_id FROM course_problems WHERE course_id = $1`;
    const currentProblemsResult = await pool.query(getCurrentProblemsQuery, [courseId]);
    const currentProblemIds = currentProblemsResult.rows.map(row => row.problem_id);

    // Get new problem IDs
    const newProblemIds = problems.map(p => p.problem_id);

    // Find problems to remove (in current but not in new)
    const problemsToRemove = currentProblemIds.filter(id => !newProblemIds.includes(id));

    // Find problems to add (in new but not in current)
    const problemsToAdd = problems.filter(p => !currentProblemIds.includes(p.problem_id));

    // Remove problems that are no longer in the course
    if (problemsToRemove.length > 0) {
      // First, set course_id to NULL for submissions of removed problems
      const updateSubmissionsQuery = `
        UPDATE submissions 
        SET course_id = NULL 
        WHERE course_id = $1 AND problem_id = ANY($2)
      `;
      await pool.query(updateSubmissionsQuery, [courseId, problemsToRemove]);

      // Then remove the problems from course_problems
      const removeProblemsQuery = `
        DELETE FROM course_problems 
        WHERE course_id = $1 AND problem_id = ANY($2)
      `;
      await pool.query(removeProblemsQuery, [courseId, problemsToRemove]);
    }

    // Add new problems
    if (problemsToAdd.length > 0) {
      const insertProblemsQuery = `
        INSERT INTO course_problems (course_id, problem_id, points)
        VALUES ($1, $2, $3)
      `;

      for (const problem of problemsToAdd) {
        await pool.query(insertProblemsQuery, [
          courseId,
          problem.problem_id,
          problem.points,
        ]);
      }
    }

    // Update points for existing problems
    const updatePointsQuery = `
      UPDATE course_problems 
      SET points = $1 
      WHERE course_id = $2 AND problem_id = $3
    `;

    for (const problem of problems) {
      if (currentProblemIds.includes(problem.problem_id)) {
        await pool.query(updatePointsQuery, [
          problem.points,
          courseId,
          problem.problem_id,
        ]);
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      courseId: courseId,
    });
  } catch (error) {
    // Rollback transaction on error
    await pool.query('ROLLBACK');
    console.error("Error updating course:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const deleteCourseController = async (req, res) => {
  const courseId = req.params.id;

  const deleteCourseQuery = "DELETE FROM courses WHERE id = $1";

  try {
    const result = await pool.query(deleteCourseQuery, [courseId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

export {
  createCourseController,
  getAllCoursesController,
  getCourseDetailsController,
  updateCourseController,
  deleteCourseController,
};