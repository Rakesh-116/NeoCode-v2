import { Router } from "express";
import jwt from "jsonwebtoken";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  getAllCoursesController,
  getCourseDetailsController,
} from "../controllers/courses.user.controller.js";

const userCoursesRoute = Router();

const optionalUserAuthentication = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const jwtToken = authHeader.split(" ")[1];
  jwt.verify(jwtToken, process.env.JWT_SECRET_KEY, (error, payload) => {
    if (!error && payload?.userId) {
      req.userId = payload.userId;
    }
    return next();
  });
};

// Get all courses for users
userCoursesRoute.get("/", optionalUserAuthentication, getAllCoursesController);

// Get course details for users (with progress) - requires authentication
userCoursesRoute.get("/:id", userAuthentication, getCourseDetailsController);

export default userCoursesRoute;
