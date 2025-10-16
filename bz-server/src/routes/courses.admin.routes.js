import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  createCourseController,
  getAllCoursesController,
  getCourseDetailsController,
  deleteCourseController,
} from "../controllers/courses.admin.controller.js";

const coursesRoute = Router();

// Get all courses
coursesRoute.get("/", userAuthentication, getAllCoursesController);

// Create a new course
coursesRoute.post("/create", userAuthentication, createCourseController);

// Get course details by ID
coursesRoute.get("/:id", userAuthentication, getCourseDetailsController);

// Delete a course by ID
coursesRoute.delete("/delete/:id", userAuthentication, deleteCourseController);

export default coursesRoute;