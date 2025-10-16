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
  deleteCourseController,
};