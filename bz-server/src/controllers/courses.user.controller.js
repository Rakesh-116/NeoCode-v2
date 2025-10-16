import { pool } from "../database/connect.db.js";

const getAllCoursesController = async (req, res) => {
  const { category, search } = req.query;
  
  let baseQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.created_at,
      COUNT(cp.problem_id) as total_problems,
      COALESCE(SUM(cp.points), 0) as total_points
    FROM courses c
    LEFT JOIN course_problems cp ON c.id = cp.course_id
  `;
  
  const conditions = [];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`c.category = $${values.length}`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`LOWER(c.title) LIKE $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const groupByClause = `GROUP BY c.id, c.title, c.category, c.description, c.created_at`;
  const orderClause = `ORDER BY c.created_at DESC`;

  const finalQuery = `${baseQuery} ${whereClause} ${groupByClause} ${orderClause}`;

  try {
    const result = await pool.query(finalQuery, values);
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
  const userId = req.userId;

  const getCourseQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.created_at
    FROM courses c
    WHERE c.id = $1
  `;

  const getCourseProblemsQuery = `
    SELECT 
      cp.id,
      cp.points,
      p.id as problem_id,
      p.title as problem_title,
      p.difficulty,
      p.category as problem_category,
      p.score
    FROM course_problems cp
    JOIN problem p ON cp.problem_id = p.id
    WHERE cp.course_id = $1 AND cp.visibility = 'course_only'
    ORDER BY cp.created_at ASC
  `;

  const getUserProgressQuery = `
    SELECT 
      ucp.solved_problems,
      ucp.total_problems,
      ucp.course_points,
      ucp.full_completion,
      ucp.last_solved_at
    FROM user_course_progress ucp
    WHERE ucp.user_id = $1 AND ucp.course_id = $2
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
    const progressResult = await pool.query(getUserProgressQuery, [userId, courseId]);
    
    const course = courseResult.rows[0];
    course.problems = problemsResult.rows;
    course.total_problems = problemsResult.rowCount;
    course.total_points = problemsResult.rows.reduce((sum, p) => sum + (p.points || 0), 0);
    
    // Add user progress if exists
    if (progressResult.rowCount > 0) {
      course.user_progress = progressResult.rows[0];
    } else {
      course.user_progress = {
        solved_problems: 0,
        total_problems: 0,
        course_points: 0,
        full_completion: false,
        last_solved_at: null
      };
    }

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

const getUserCourseProgressController = async (req, res) => {
  const userId = req.userId;

  const getUserProgressQuery = `
    SELECT 
      c.id as course_id,
      c.title as course_title,
      c.category,
      c.description,
      ucp.solved_problems,
      ucp.total_problems,
      ucp.course_points,
      ucp.full_completion,
      ucp.last_solved_at,
      COUNT(cp.problem_id) as actual_total_problems,
      COALESCE(SUM(cp.points), 0) as actual_total_points
    FROM user_course_progress ucp
    JOIN courses c ON ucp.course_id = c.id
    LEFT JOIN course_problems cp ON c.id = cp.course_id
    WHERE ucp.user_id = $1
    GROUP BY c.id, c.title, c.category, c.description, ucp.solved_problems, 
             ucp.total_problems, ucp.course_points, ucp.full_completion, ucp.last_solved_at
    ORDER BY ucp.last_solved_at DESC NULLS LAST
  `;

  try {
    const result = await pool.query(getUserProgressQuery, [userId]);
    return res.status(200).json({
      success: true,
      progress: result.rows,
      message: result.rowCount > 0 ? undefined : "No course progress found",
    });
  } catch (error) {
    console.error("Error fetching user course progress:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

const enrollInCourseController = async (req, res) => {
  const courseId = req.params.id;
  const userId = req.userId;

  // Check if course exists
  const checkCourseQuery = `SELECT id FROM courses WHERE id = $1`;
  
  // Check if already enrolled
  const checkEnrollmentQuery = `
    SELECT id FROM user_course_progress 
    WHERE user_id = $1 AND course_id = $2
  `;

  // Get course total problems and points
  const getCourseStatsQuery = `
    SELECT 
      COUNT(cp.problem_id) as total_problems,
      COALESCE(SUM(cp.points), 0) as total_points
    FROM course_problems cp
    WHERE cp.course_id = $1
  `;

  const enrollUserQuery = `
    INSERT INTO user_course_progress (user_id, course_id, total_problems, solved_problems)
    VALUES ($1, $2, $3, 0) RETURNING id
  `;

  try {
    // Check if course exists
    const courseExists = await pool.query(checkCourseQuery, [courseId]);
    if (courseExists.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if already enrolled
    const alreadyEnrolled = await pool.query(checkEnrollmentQuery, [userId, courseId]);
    if (alreadyEnrolled.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled in this course",
      });
    }

    // Get course stats
    const courseStats = await pool.query(getCourseStatsQuery, [courseId]);
    const totalProblems = courseStats.rows[0].total_problems || 0;

    // Enroll user
    const enrollResult = await pool.query(enrollUserQuery, [userId, courseId, totalProblems]);

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled in course",
      enrollment_id: enrollResult.rows[0].id,
    });
  } catch (error) {
    console.error("Error enrolling in course:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

export {
  getAllCoursesController,
  getCourseDetailsController,
  getUserCourseProgressController,
  enrollInCourseController,
};