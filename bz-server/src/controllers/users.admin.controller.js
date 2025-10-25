import { pool } from "../database/connect.db.js";

const getAllUsersController = async (req, res) => {
  const getAllUsersQuery =
    "SELECT id, email, username, role, created_at, updated_at FROM users ORDER BY id ASC";
  try {
    const getAllUsersResult = await pool.query(getAllUsersQuery);

    return res.status(200).json({
      success: true,
      response:
        getAllUsersResult.rowCount > 0
          ? getAllUsersResult.rows
          : "No Users Found",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
};

const deleteUserController = async (req, res) => {
  const { id } = req.params;
  // console.log(id);
  const deleteUserQuery = "DELETE FROM Users WHERE id = $1";
  try {
    await pool.query(deleteUserQuery, [id]);

    return res.status(200).json({
      success: true,
      response: "User Successfully Deleted",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
};

const getUserAnalysisController = async (req, res) => {
  const { userId } = req.params;

  try {
    // Get user basic info
    const userInfoQuery = `
      SELECT id, username, email, role, created_at
      FROM users WHERE id = $1
    `;
    const userInfoResult = await pool.query(userInfoQuery, [userId]);
    
    if (userInfoResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const userInfo = userInfoResult.rows[0];

    // Basic submissions analysis - simplified to avoid casting issues
    const problemAnalysisQuery = `
      SELECT 
        s.problem_id, 
        s.verdict,
        p.score,
        p.difficulty,
        s.submission_time
      FROM submissions s
      JOIN problem p ON s.problem_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.submission_time DESC;
    `;

    const result = await pool.query(problemAnalysisQuery, [userId]);

    // Initialize counters
    let verdictCounts = {
      accepted: 0,
      wrongAnswer: 0,
      rte: 0,
      tle: 0,
    };
    
    let totalNeoCodePoints = 0;
    const solvedProblems = new Set();
    let submissions = result.rows || [];

    // Count each verdict type and calculate NeoCode points
    for (const row of submissions) {
      const { verdict, problem_id, score } = row;
      
      if (verdict === "ACCEPTED") {
        verdictCounts.accepted += 1;
        if (!solvedProblems.has(problem_id)) {
          // Handle score regardless of type
          let points = 0;
          if (typeof score === 'string') {
            points = parseInt(score) || 0;
          } else if (typeof score === 'number') {
            points = score;
          }
          totalNeoCodePoints += points;
          solvedProblems.add(problem_id);
        }
      } else if (verdict === "WRONG ANSWER") {
        verdictCounts.wrongAnswer += 1;
      } else if (verdict === "RTE") {
        verdictCounts.rte += 1;
      } else if (verdict === "TLE") {
        verdictCounts.tle += 1;
      }
    }

    // Get category analysis with error handling
    let categoryAnalysis = [];
    let totalCategoryPoints = 0;
    
    try {
      const categoryPointsQuery = `
        SELECT category, total_points, problems_solved
        FROM user_category_points
        WHERE user_id = $1
        ORDER BY total_points DESC;
      `;
      
      const categoryPointsResult = await pool.query(categoryPointsQuery, [userId]);
      
      if (categoryPointsResult.rows) {
        categoryAnalysis = categoryPointsResult.rows.map(row => ({
          category: row.category || '',
          total_points: parseInt(row.total_points) || 0,
          problems_solved: parseInt(row.problems_solved) || 0
        }));
        
        totalCategoryPoints = categoryAnalysis.reduce((sum, cat) => sum + cat.total_points, 0);
      }
    } catch (categoryError) {
      console.error("Category points error (table might not exist):", categoryError.message);
      // Continue without category points
    }

    // Get recent activity (last 10 submissions)
    const recentSubmissions = submissions.slice(0, 10);

    return res.status(200).json({
      success: true,
      message: "User analysis fetched successfully",
      userInfo,
      stats: {
        verdictCounts,
        totalNeoCodePoints,
        totalCategoryPoints,
        problemsSolved: solvedProblems.size,
        totalSubmissions: submissions.length
      },
      categoryAnalysis,
      recentSubmissions,
    });
  } catch (error) {
    console.error("Error fetching user analysis:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
};

const updateUserRoleController = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  // Validate role
  if (!role || !['admin', 'user'].includes(role.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: "Invalid role. Must be 'admin' or 'user'"
    });
  }

  try {
    const updateRoleQuery = `
      UPDATE users 
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, role
    `;
    
    const result = await pool.query(updateRoleQuery, [role.toLowerCase(), userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error("Error updating user role:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
};

export { getAllUsersController, deleteUserController, getUserAnalysisController, updateUserRoleController };
