import { Router } from "express";
import { 
  getUserCategoryPointsController, 
  getCategoryLeaderboardController,
  getAllCategoriesStatsController,
  getUserCategoryProgressController
} from "../controllers/category.points.controller.js";
import { userAuthentication } from "../middlewares/authentication.js";

const categoryPointsRoute = Router();

// Get user's category points breakdown
categoryPointsRoute
  .route("/user")
  .get(userAuthentication, getUserCategoryPointsController);

// Get user's progress in a specific category
categoryPointsRoute
  .route("/user/category/:category")
  .get(userAuthentication, getUserCategoryProgressController);

// Get leaderboard for a specific category
categoryPointsRoute
  .route("/leaderboard/:category")
  .get(getCategoryLeaderboardController);

// Get all categories statistics
categoryPointsRoute
  .route("/categories/stats")
  .get(getAllCategoriesStatsController);

export { categoryPointsRoute };