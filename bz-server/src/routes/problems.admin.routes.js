import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
  createProblemController,
  deleteProblemController,
  getAllProblemsForCourseController,
  getProblemByIdController,
  updateProblemController,
  toggleProblemVisibilityController,
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

// Get single problem by ID
problemsRoute.get(
  "/:id",
  userAuthentication,
  getProblemByIdController
);

// Update problem
problemsRoute.put(
  "/update/:id",
  userAuthentication,
  updateProblemController
);

// Toggle problem visibility
problemsRoute.patch(
  "/visibility/:id",
  userAuthentication,
  toggleProblemVisibilityController
);

export default problemsRoute;
