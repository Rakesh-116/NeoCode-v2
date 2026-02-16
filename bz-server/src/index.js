import connection from "./database/connect.db.js";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { initializeLearningCore, healthCheck } from "./learning-core/index.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
const allowedOrigins = ["http://localhost:5173", "https://neocode.rakeshp.me"];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

(async () => {
    try {
        await initializeLearningCore();
        console.log("✅ Learning Core initialized");

        app.get("/api/health/learning-core", async (req, res) => {
            const health = await healthCheck();
            res.status(health.healthy ? 200 : 503).json(health);
        });
    } catch (error) {
        console.error("❌ Failed to initialize Learning Core:", error);
        process.exit(1);
    }
})();

import userRoute from "./routes/profile.user.routes.js";
import problemExecuteRoute from "./routes/problem.execute.routes.js";
import snippetsRoute from "./routes/snippets.routes.js";
import userBlogsRoute from "./routes/blogs.user.routes.js";
import complexityRoute from "./routes/complexity.routes.js";
import userCoursesRoute from "./routes/courses.user.routes.js";
import learningRoute from "./routes/learning.routes.js";

// User Routes
app.use("/api/user", userRoute);
app.use("/api/problem", problemExecuteRoute);
app.use("/api/snippets", snippetsRoute);
app.use("/api/blogs", userBlogsRoute);
app.use("/api/complexity", complexityRoute);
app.use("/api/courses", userCoursesRoute);
app.use("/api/learning", learningRoute);

import usersRoute from "./routes/users.admin.routes.js";
import problemsRoute from "./routes/problems.admin.routes.js";
import adminBlogsRoute from "./routes/blogs.admin.routes.js";
import coursesRoute from "./routes/courses.admin.routes.js";

// Admin Routes
app.use("/api/admin/users", usersRoute);
app.use("/api/admin/problems", problemsRoute);
app.use("/api/admin/blogs", adminBlogsRoute);
app.use("/api/admin/courses", coursesRoute);
// app.use("/api/admin/submissions", usersRoute);

connection();

const port = process.env.PORT;
app.listen(port, () => {
    console.log(`App is listening at the ${port}`);
});
