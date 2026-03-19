/**
 * ============================================================================
 * Voice Assistant Routes
 * ============================================================================
 * API endpoints for voice assistant interactions
 * Base path: /api/assistant
 * ============================================================================
 */

import express from "express";
import fileUpload from "express-fileupload";
import {
    processVoiceCommandController,
    processTextCommandController,
    getHistoryController,
    healthCheckController,
    getGreetingController,
} from "../controllers/assistant.controller.js";
import { userAuthentication } from "../../../middlewares/authentication.js";

const router = express.Router();

// File upload middleware for voice commands
router.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    abortOnLimit: true,
}));

/**
 * POST /api/assistant/voice
 * Process voice command (multipart/form-data with audio file)
 * Auth: Required
 */
router.post("/voice", userAuthentication, processVoiceCommandController);

/**
 * POST /api/assistant/text
 * Process text command (JSON)
 * Auth: Required
 */
router.post("/text", userAuthentication, processTextCommandController);

/**
 * GET /api/assistant/history
 * Get conversation history
 * Auth: Required
 */
router.get("/history", userAuthentication, getHistoryController);

/**
 * GET /api/assistant/health
 * Health check (no auth required)
 * Public endpoint
 */
router.get("/health", healthCheckController);

/**
 * POST /api/assistant/greeting
 * Get personalized greeting
 * Auth: Required
 */
router.post("/greeting", userAuthentication, getGreetingController);

export default router;
