import { pool } from "../database/connect.db.js";

export async function canAccessCourse(userId, courseId) {
    const courseResult = await pool.query(
        "SELECT is_paid, access_type FROM courses WHERE id = $1",
        [courseId]
    );

    if (!courseResult.rows.length) {
        return false;
    }

    const course = courseResult.rows[0];
    if (!course.is_paid || course.access_type === "free") {
        return true;
    }

    if (!userId) {
        return false;
    }

    const enrollResult = await pool.query(
        "SELECT 1 FROM course_enrollments WHERE user_id = $1 AND course_id = $2 AND status = $3",
        [userId, courseId, "active"]
    );

    return enrollResult.rows.length > 0;
}
