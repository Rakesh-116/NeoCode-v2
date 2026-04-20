import { pool } from "../database/connect.db.js";
import { canAccessCourse } from "../services/courseAccess.service.js";

const getAllCoursesController = async (req, res) => {
  const { category, search } = req.query;
  const userId = req.userId;
  
  let baseQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.is_paid,
      c.price_amount,
      c.price_currency,
      c.access_type,
      c.created_at,
      CASE
        WHEN c.is_paid = false OR c.access_type = 'free' THEN true
        WHEN $1::uuid IS NOT NULL AND ce.id IS NOT NULL THEN true
        ELSE false
      END AS user_has_access,
      COUNT(cp.problem_id) as total_problems,
      COALESCE(SUM(cp.points), 0) as total_points
    FROM courses c
    LEFT JOIN course_problems cp ON c.id = cp.course_id
    LEFT JOIN course_enrollments ce
      ON ce.course_id = c.id
     AND ce.user_id = $1::uuid
     AND ce.status = 'active'
  `;
  
  const conditions = [];
  const values = [userId || null];

  if (category) {
    values.push(category);
    conditions.push(`c.category = $${values.length}`);
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`LOWER(c.title) LIKE $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const groupByClause = `GROUP BY c.id, c.title, c.category, c.description, c.is_paid, c.price_amount, c.price_currency, c.access_type, c.created_at, ce.id`;
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
  const userId = req.userId; // User is always authenticated now

  const getCourseQuery = `
    SELECT 
      c.id,
      c.title,
      c.category,
      c.description,
      c.is_paid,
      c.price_amount,
      c.price_currency,
      c.access_type,
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
    WHERE cp.course_id = $1
    ORDER BY cp.created_at ASC
  `;

  // Calculate user progress dynamically based on actual submissions
  const getUserProgressQuery = `
    SELECT 
      cp.problem_id,
      cp.points,
      CASE WHEN s.problem_id IS NOT NULL THEN 1 ELSE 0 END as is_solved
    FROM course_problems cp
    LEFT JOIN (
      SELECT DISTINCT problem_id 
      FROM submissions 
      WHERE user_id = $1 AND course_id = $2 AND verdict = 'ACCEPTED'
    ) s ON cp.problem_id = s.problem_id
    WHERE cp.course_id = $2
  `;

  try {
    const courseResult = await pool.query(getCourseQuery, [courseId]);
    
    if (courseResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const hasAccess = await canAccessCourse(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "payment_required",
        message: "Purchase this course to access content",
        course: {
          ...courseResult.rows[0],
          problems: [],
          total_problems: 0,
          total_points: 0,
          user_has_access: false,
        },
      });
    }

    const problemsResult = await pool.query(getCourseProblemsQuery, [courseId]);
    
    const course = courseResult.rows[0];
    course.problems = problemsResult.rows;
    course.total_problems = problemsResult.rowCount;
    course.total_points = problemsResult.rows.reduce((sum, p) => sum + (p.points || 0), 0);
    
    // Calculate user progress based on actual submissions
    const progressResult = await pool.query(getUserProgressQuery, [userId, courseId]);
    
    // Calculate dynamic progress based on actual submissions
    const solvedProblems = progressResult.rows.filter(p => p.is_solved === 1);
    const totalSolved = solvedProblems.length;
    const totalProblems = progressResult.rows.length;
    const coursePointsEarned = solvedProblems.reduce((sum, p) => sum + (p.points || 0), 0);
    const isFullyCompleted = totalSolved === totalProblems && totalProblems > 0;

    course.user_progress = {
      solved_problems: totalSolved,
      total_problems: totalProblems,
      course_points: coursePointsEarned,
      full_completion: isFullyCompleted,
      last_solved_at: null // Could be calculated if needed
    };

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

export {
  getAllCoursesController,
  getCourseDetailsController,
};
