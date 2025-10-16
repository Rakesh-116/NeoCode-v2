import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  getAllCoursesController,
  getCourseDetailsController,
  getUserCourseProgressController,
  enrollInCourseController,
} from "../controllers/courses.user.controller.js";

const userCoursesRoute = Router();

// Get all courses for users
userCoursesRoute.get("/", getAllCoursesController);

// Get user's course progress across all courses - MUST come before /:id
userCoursesRoute.get("/progress/all", userAuthentication, getUserCourseProgressController);

// Get course details for users (with progress)
userCoursesRoute.get("/:id", userAuthentication, getCourseDetailsController);

// Enroll in a course
userCoursesRoute.post("/:id/enroll", userAuthentication, enrollInCourseController);

export default userCoursesRoute;