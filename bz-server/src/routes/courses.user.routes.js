import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  getAllCoursesController,
  getCourseDetailsController,
} from "../controllers/courses.user.controller.js";

const userCoursesRoute = Router();

// Get all courses for users
userCoursesRoute.get("/", getAllCoursesController);

// Get course details for users (with progress) - requires authentication
userCoursesRoute.get("/:id", userAuthentication, getCourseDetailsController);

export default userCoursesRoute;