import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  createProblemController,
  deleteProblemController,
  getAllProblemsForCourseController,
} from "../controllers/problems.admin.controller.js";

const problemsRoute = Router();

problemsRoute
  .route("/create")
  .post(userAuthentication, createProblemController);

problemsRoute.delete(
  "/delete/:id",
  userAuthentication,
  deleteProblemController
);

// Get all problems for course creation
problemsRoute.get(
  "/all",
  userAuthentication,
  getAllProblemsForCourseController
);

export default problemsRoute;
