import { pool } from "../database/connect.db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import generateUuid from "../constants/generateUuid.js";

const createUser = async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({
      success: false,
      message: "Please provide all required fields",
    });
  }

  const userCheckQuery = "SELECT * FROM users WHERE username = $1";

  try {
    const userCheck = await pool.query(userCheckQuery, [username]);
    if (userCheck.rowCount > 0) {
      return res.status(401).json({
        success: false,
        message: "Username already exists",
      });
    }
    const userInsertQuery =
      "INSERT INTO users (id, username, password, email) VALUES ($1, $2, $3, $4) RETURNING *;";

    const hashedPassword = await bcrypt.hash(password, 10);

    const userDetails = [generateUuid(), username, hashedPassword, email];

    const user = await pool.query(userInsertQuery, userDetails);

    const token = jwt.sign(
      { userId: user.rows[0].id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "4h" }
    );

    // console.log(user.rows[0]);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.rows[0],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide all required fields",
    });
  }

  const userCheckQuery = "SELECT * FROM users WHERE username = $1";

  try {
    const userCheck = await pool.query(userCheckQuery, [username]);

    if (userCheck.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid User",
      });
    }

    const comparePassword = await bcrypt.compare(
      password,
      userCheck.rows[0].password
    );

    if (comparePassword) {
      const token = jwt.sign(
        { userId: userCheck.rows[0].id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "4h" }
      );

      // console.log(userCheck.rows[0]);

      res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token,
        user: userCheck.rows[0],
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid Password",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Database error",
    });
  }
};

const fetchUser = async (req, res) => {
  const userId = req.userId;
  const userDetailsQuery =
    "SELECT id, username, email, role FROM users WHERE id = $1";
  try {
    const userDetails = await pool.query(userDetailsQuery, [userId]);
    return res.status(200).json({ success: true, user: userDetails.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Database error" });
  }
};

const getProblemAnalysisController = async (req, res) => {
  const userId = req.userId;

  try {
    // Basic submissions analysis - simplified query to avoid casting issues
    const problemAnalysisQuery = `
      SELECT 
        s.problem_id, 
        s.verdict,
        p.score,
        p.difficulty
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

    // Count each verdict type and calculate NeoCode points
    for (const row of result.rows) {
      const { verdict, problem_id, score } = row;
      
      if (verdict === "ACCEPTED") {
        verdictCounts.accepted += 1;
        // Add points only once per problem (avoid duplicate points for same problem)
        if (!solvedProblems.has(problem_id)) {
          // Handle score regardless of its type
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

    // Simple category points fetching with error handling
    let categoryPoints = [];
    let totalCategoryPoints = 0;
    
    try {
      // Check if user_category_points table exists and has data
      const categoryPointsQuery = `
        SELECT category, total_points, problems_solved
        FROM user_category_points
        WHERE user_id = $1
        ORDER BY total_points DESC;
      `;
      
      const categoryPointsResult = await pool.query(categoryPointsQuery, [userId]);
      
      if (categoryPointsResult.rows) {
        categoryPoints = categoryPointsResult.rows.map(row => ({
          category: row.category || '',
          total_points: parseInt(row.total_points) || 0,
          problems_solved: parseInt(row.problems_solved) || 0
        }));
        
        totalCategoryPoints = categoryPoints.reduce((sum, cat) => sum + cat.total_points, 0);
      }
    } catch (categoryError) {
      console.error("Category points error (table might not exist):", categoryError.message);
      // Continue without category points - this is expected if tables don't exist yet
    }

    return res.status(200).json({
      success: true,
      message: "User analysis fetched successfully",
      verdictCounts,
      totalNeoCodePoints,
      problemsSolved: solvedProblems.size,
      categoryPoints,
      totalCategoryPoints,
    });
  } catch (error) {
    console.error("Error fetching problem analysis:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
};

export { createUser, loginUser, fetchUser, getProblemAnalysisController };
