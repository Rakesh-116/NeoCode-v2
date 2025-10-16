import { pool } from "../database/connect.db.js";

// Get user's category points breakdown
const getUserCategoryPointsController = async (req, res) => {
  try {
    const userId = req.userId;

  const categoryPointsQuery = `
    SELECT 
      ucp.category,
      ucp.total_points,
      ucp.problems_solved,
      COUNT(DISTINCT upp.problem_id) as actual_problems_solved
    FROM user_category_points ucp
    LEFT JOIN user_problem_points upp ON ucp.user_id = upp.user_id
    LEFT JOIN problem p ON upp.problem_id = p.id AND ucp.category = ANY(p.category)
    WHERE ucp.user_id = $1
    GROUP BY ucp.category, ucp.total_points, ucp.problems_solved
    ORDER BY ucp.total_points DESC;
  `;    const result = await pool.query(categoryPointsQuery, [userId]);

    if (result.rowCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No category points found",
        categoryPoints: [],
        totalPoints: 0,
      });
    }

    const categoryPoints = result.rows;
    const totalPoints = categoryPoints.reduce((sum, cat) => sum + parseInt(cat.total_points), 0);

    return res.status(200).json({
      success: true,
      message: "Category points fetched successfully",
      categoryPoints,
      totalPoints,
    });
  } catch (error) {
    console.error("Error fetching category points:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get leaderboard for a specific category
const getCategoryLeaderboardController = async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const leaderboardQuery = `
      SELECT 
        u.username,
        ucp.total_points,
        ucp.problems_solved
      FROM user_category_points ucp
      JOIN users u ON ucp.user_id = u.id
      WHERE ucp.category = $1
      ORDER BY ucp.total_points DESC, ucp.problems_solved DESC
      LIMIT $2;
    `;

    const result = await pool.query(leaderboardQuery, [category, limit]);

    return res.status(200).json({
      success: true,
      message: "Category leaderboard fetched successfully",
      leaderboard: result.rows,
      category,
    });
  } catch (error) {
    console.error("Error fetching category leaderboard:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all categories with their total problem counts
const getAllCategoriesStatsController = async (req, res) => {
  try {
  const categoriesStatsQuery = `
    SELECT 
      UNNEST(p.category) as category,
      COUNT(*) as total_problems,
      AVG(CAST(p.score AS INTEGER)) as avg_points_per_problem,
      SUM(CAST(p.score AS INTEGER)) as total_possible_points
    FROM problem p
    WHERE p.category IS NOT NULL
    GROUP BY UNNEST(p.category)
    ORDER BY category;
  `;    const result = await pool.query(categoriesStatsQuery);

    return res.status(200).json({
      success: true,
      message: "Categories statistics fetched successfully",
      categoriesStats: result.rows,
    });
  } catch (error) {
    console.error("Error fetching categories statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get user's progress in a specific category
const getUserCategoryProgressController = async (req, res) => {
  try {
    const userId = req.userId;
    const { category } = req.params;

    // Get category stats
    const categoryStatsQuery = `
      SELECT 
        COUNT(*) as total_problems,
        AVG(CAST(p.score AS INTEGER)) as avg_points,
        SUM(CAST(p.score AS INTEGER)) as total_possible_points
      FROM problem p
      WHERE $1 = ANY(p.category);
    `;

    // Get user's progress in this category
    const userProgressQuery = `
      SELECT 
        COALESCE(ucp.total_points, 0) as earned_points,
        COALESCE(ucp.problems_solved, 0) as problems_solved
      FROM user_category_points ucp
      WHERE ucp.user_id = $1 AND ucp.category = $2;
    `;

    // Get problems solved by user in this category
    const solvedProblemsQuery = `
      SELECT 
        p.id,
        p.title,
        p.difficulty,
        upp.points_awarded
      FROM user_problem_points upp
      JOIN problem p ON upp.problem_id = p.id
      WHERE upp.user_id = $1 AND $2 = ANY(p.category)
      ORDER BY p.difficulty, p.title;
    `;

    const [categoryStats, userProgress, solvedProblems] = await Promise.all([
      pool.query(categoryStatsQuery, [category]),
      pool.query(userProgressQuery, [userId, category]),
      pool.query(solvedProblemsQuery, [userId, category])
    ]);

    const stats = categoryStats.rows[0] || { total_problems: 0, avg_points: 0, total_possible_points: 0 };
    const progress = userProgress.rows[0] || { earned_points: 0, problems_solved: 0 };

    const completionPercentage = stats.total_problems > 0 
      ? (progress.problems_solved / stats.total_problems * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      message: "Category progress fetched successfully",
      category,
      categoryStats: {
        ...stats,
        total_problems: parseInt(stats.total_problems),
        avg_points: parseFloat(stats.avg_points || 0).toFixed(2),
        total_possible_points: parseInt(stats.total_possible_points || 0)
      },
      userProgress: {
        ...progress,
        earned_points: parseInt(progress.earned_points),
        problems_solved: parseInt(progress.problems_solved),
        completion_percentage: completionPercentage
      },
      solvedProblems: solvedProblems.rows
    });
  } catch (error) {
    console.error("Error fetching category progress:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export {
  getUserCategoryPointsController,
  getCategoryLeaderboardController,
  getAllCategoriesStatsController,
  getUserCategoryProgressController
};