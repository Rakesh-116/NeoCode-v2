#!/usr/bin/env node

/**
 * Quick Setup Script for Course Management System
 * 
 * Automates the setup process:
 * 1. Checks PostgreSQL connection
 * 2. Runs database migration
 * 3. Seeds OS course with sample data
 * 4. Verifies installation
 * 
 * Usage: node setup-course-system.js
 */

import { execSync } from "child_process";
import { pool } from "./src/database/connect.db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[36m",
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function checkDatabaseConnection() {
    log("\n1. Checking database connection...", colors.blue);
    try {
        const result = await pool.query("SELECT NOW()");
        log(`✓ Database connected successfully at ${result.rows[0].now}`, colors.green);
        return true;
    } catch (error) {
        log(`✗ Database connection failed: ${error.message}`, colors.red);
        return false;
    }
}

async function runMigration() {
    log("\n2. Running database migration...", colors.blue);
    try {
        const migrationPath = path.join(__dirname, "database", "migrations", "003_course_hierarchy.sql");
        
        if (!fs.existsSync(migrationPath)) {
            log(`✗ Migration file not found at: ${migrationPath}`, colors.red);
            return false;
        }

        const migrationSQL = fs.readFileSync(migrationPath, "utf8");
        
        // Execute migration
        await pool.query(migrationSQL);
        
        log("✓ Migration completed successfully", colors.green);
        return true;
    } catch (error) {
        // Check if error is "already exists" (safe to ignore)
        if (error.message.includes("already exists")) {
            log("⚠ Migration already applied (tables exist). Skipping...", colors.yellow);
            return true;
        }
        
        log(`✗ Migration failed: ${error.message}`, colors.red);
        return false;
    }
}

async function seedCourse() {
    log("\n3. Seeding Operating Systems course...", colors.blue);
    try {
        const seedPath = path.join(__dirname, "src", "database", "seedOsCourse.js");
        
        if (!fs.existsSync(seedPath)) {
            log(`✗ Seed file not found at: ${seedPath}`, colors.red);
            return false;
        }

        // Import and run seed dynamically
        const { default: seedModule } = await import("./src/database/seedOsCourse.js");
        
        log("⚠ Note: Ensure ADMIN_USER_ID is updated in seedOsCourse.js", colors.yellow);
        log("Running seed script...", colors.blue);
        
        // Note: The seed script runs on import, so it should execute
        
        log("✓ Course seeded successfully", colors.green);
        return true;
    } catch (error) {
        log(`✗ Seeding failed: ${error.message}`, colors.red);
        log("Tip: Check ADMIN_USER_ID in src/database/seedOsCourse.js", colors.yellow);
        return false;
    }
}

async function verifySetup() {
    log("\n4. Verifying setup...", colors.blue);
    try {
        // Check if tables exist
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('course_modules', 'course_topics', 'course_content', 'course_progress')
            ORDER BY table_name
        `);
        
        if (tableCheck.rowCount === 4) {
            log(`✓ All 4 tables created:`, colors.green);
            tableCheck.rows.forEach((row) => {
                log(`  - ${row.table_name}`, colors.green);
            });
        } else {
            log(`⚠ Only ${tableCheck.rowCount}/4 tables found`, colors.yellow);
            return false;
        }
        
        // Check if OS course exists
        const courseCheck = await pool.query(`
            SELECT id, title FROM public.courses 
            WHERE title = 'Operating Systems Fundamentals'
        `);
        
        if (courseCheck.rowCount > 0) {
            log(`✓ OS Course created (ID: ${courseCheck.rows[0].id})`, colors.green);
            
            // Count modules
            const moduleCount = await pool.query(`
                SELECT COUNT(*) as count FROM public.course_modules 
                WHERE course_id = $1
            `, [courseCheck.rows[0].id]);
            
            log(`✓ ${moduleCount.rows[0].count} modules created`, colors.green);
            
            // Count topics
            const topicCount = await pool.query(`
                SELECT COUNT(*) as count FROM public.course_topics ct
                JOIN public.course_modules cm ON cm.id = ct.module_id
                WHERE cm.course_id = $1
            `, [courseCheck.rows[0].id]);
            
            log(`✓ ${topicCount.rows[0].count} topics created`, colors.green);
            
            // Count content
            const contentCount = await pool.query(`
                SELECT COUNT(*) as count FROM public.course_content cc
                JOIN public.course_topics ct ON ct.id = cc.topic_id
                JOIN public.course_modules cm ON cm.id = ct.module_id
                WHERE cm.course_id = $1
            `, [courseCheck.rows[0].id]);
            
            log(`✓ ${contentCount.rows[0].count} content items created`, colors.green);
        } else {
            log("⚠ OS Course not found (seed may have failed)", colors.yellow);
            return false;
        }
        
        return true;
    } catch (error) {
        log(`✗ Verification failed: ${error.message}`, colors.red);
        return false;
    }
}

async function main() {
    log("=====================================", colors.blue);
    log("Course Management System Setup", colors.blue);
    log("=====================================", colors.blue);
    
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
        log("\n⚠ Setup cannot continue without database connection", colors.red);
        process.exit(1);
    }
    
    const migrated = await runMigration();
    if (!migrated) {
        log("\n⚠ Setup cannot continue without successful migration", colors.red);
        process.exit(1);
    }
    
    const seeded = await seedCourse();
    if (!seeded) {
        log("\n⚠ Seeding failed. You can run it manually later:", colors.yellow);
        log("   node src/database/seedOsCourse.js", colors.yellow);
    }
    
    const verified = await verifySetup();
    
    log("\n=====================================", colors.blue);
    if (verified) {
        log("✓ Setup Complete!", colors.green);
        log("\nNext Steps:", colors.blue);
        log("1. Start the backend server: npm start", colors.reset);
        log("2. Access course hierarchy API at:", colors.reset);
        log("   GET /api/courses/:courseId/hierarchy", colors.reset);
        log("3. View frontend at http://localhost:5173/courses", colors.reset);
    } else {
        log("⚠ Setup completed with warnings", colors.yellow);
        log("\nCheck errors above and resolve before using the system", colors.yellow);
    }
    log("=====================================\n", colors.blue);
    
    await pool.end();
    process.exit(verified ? 0 : 1);
}

main().catch((error) => {
    log(`\n✗ Setup failed with error: ${error.message}`, colors.red);
    process.exit(1);
});
