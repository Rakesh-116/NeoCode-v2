/**
 * Voice Assistant Setup Script
 * 
 * Run this to set up the voice assistant database table:
 * node setup-voice-assistant.js
 */

import { pool } from "./src/database/connect.db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setup() {
    const client = await pool.connect();

    try {
        console.log("🎤 Voice Assistant Setup\n");
        console.log("=".repeat(60));

        // Step 1: Run migration
        console.log("\n📋 Step 1: Running database migration...");
        
        const migrationPath = path.join(__dirname, "database", "migrations", "004_voice_assistant.sql");
        const migrationSQL = fs.readFileSync(migrationPath, "utf8");

        await client.query(migrationSQL);
        console.log("✅ Migration completed");

        // Step 2: Verify table exists
        console.log("\n🔍 Step 2: Verifying table...");
        
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'assistant_interactions'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            throw new Error("Table creation failed");
        }

        console.log("✅ Table 'assistant_interactions' created");

        // Step 3: Check voice interview providers
        console.log("\n🎙️  Step 3: Checking voice providers...");
        
        const { getVoiceInterviewHealth } = await import("./src/ai/voice-interview/index.js");
        const health = await getVoiceInterviewHealth();

        console.log("\nProvider Status:");
        for (const [type, providers] of Object.entries(health.details)) {
            for (const [name, status] of Object.entries(providers)) {
                const icon = status.healthy ? "✅" : "❌";
                console.log(`  ${icon} ${type}:${name}`);
            }
        }

        if (!health.healthy) {
            console.log("\n⚠️  Warning: Some providers are unhealthy");
            console.log("   Voice assistant will work in degraded mode");
        }

        // Step 4: Summary
        console.log("\n" + "=".repeat(60));
        console.log("✅ Voice Assistant Setup Complete!\n");
        console.log("Next steps:");
        console.log("1. Start backend: cd bz-server && npm run dev");
        console.log("2. Start frontend: cd bz-client && npm run dev");
        console.log("3. Look for the floating purple orb in bottom-right");
        console.log('4. Say "Hey Karen" to activate (or click the orb)\n');
        console.log("Available commands:");
        console.log('  - "Start interview"');
        console.log('  - "Explain [concept]"');
        console.log('  - "Show progress"');
        console.log('  - "Review flashcards"');
        console.log('  - "Solve a problem"');
        console.log("=".repeat(60) + "\n");

    } catch (error) {
        console.error("\n❌ Setup failed:", error.message);
        console.error("\nFull error:", error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

setup();
