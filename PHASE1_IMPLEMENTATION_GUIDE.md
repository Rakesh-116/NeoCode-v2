# 🚀 NeoCode Learning OS - Phase 1 Implementation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Database Migration](#database-migration)
5. [Integration with Existing Code](#integration)
6. [Testing Strategy](#testing)
7. [Deployment Checklist](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide walks you through transforming NeoCode from a **tightly-coupled code compiler** into a **modular Learning OS platform**.

### What Changed

**BEFORE (Tightly Coupled)**:

```
problem.execute.controller.js:
  - Runs Docker
  - Judges output
  - Decides verdict
  - Updates points
  - Updates DB
  - Everything mixed together ❌
```

**AFTER (Modular Plugin System)**:

```
EvaluationService (Orchestrator)
    ↓
CodeEvaluationPlugin (Just evaluates code)
    ↓
LearningProfileService (Updates memory)
    ↓
MistakeEngineService (Tracks mistakes)
    ↓
TrainingPlannerService (Recommends next steps) ✅
```

### Key Benefits

- ✅ **Pluggable**: Add quiz/PDF/interview plugins without touching core
- ✅ **Testable**: Each component is independently testable
- ✅ **Scalable**: Learning logic separate from execution
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **AI-Ready**: LLM can enhance without breaking core logic

---

## 🏗️ Architecture Changes

### New Components

#### 1. **learning-core/** Module

```
bz-server/src/learning-core/
├── index.js                          # Main export & initialization
├── interfaces/
│   └── IEvaluationPlugin.js         # Plugin interface
├── plugins/
│   └── CodeEvaluationPlugin.js      # Code evaluation implementation
└── services/
    ├── evaluation.service.js         # Main orchestrator
    ├── learningProfile.service.js    # Memory/profile management
    ├── mistakeEngine.service.js      # Mistake tracking
    └── trainingPlanner.service.js    # Recommendations
```

#### 2. **New Database Tables**

- `learning_profiles` - User's learning memory (weak/strong topics)
- `evaluation_results` - Plugin-agnostic evaluation storage
- `normalized_questions` - Universal question format
- `training_plans` - Generated learning plans
- `mistake_catalog` - Common mistake database
- `user_mistakes_log` - Individual mistake tracking
- `plugin_registry` - Registered plugins

#### 3. **Enhanced Existing Tables**

- `submissions` - Added: `user_failure_reason`, `detected_mistakes`, `time_spent_seconds`

---

## 📝 Step-by-Step Implementation

### Phase 1A: Database Setup (Day 1)

#### Step 1: Run Database Migration

```bash
# Navigate to migrations directory
cd bz-server/src/database/migrations

# Run migration
psql -U postgres -d Neocode-v2 -f 001_learning_platform_foundation.sql

# Verify tables created
psql -U postgres -d Neocode-v2 -c "\dt learning_*"
```

**Expected Output:**

```
 learning_profiles
 normalized_questions
 evaluation_results
 training_plans
 mistake_catalog
 user_mistakes_log
```

#### Step 2: Verify Indexes

```sql
-- Check indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('learning_profiles', 'evaluation_results', 'submissions');
```

#### Step 3: Test Triggers

```sql
-- Insert test user and verify learning profile auto-created
INSERT INTO users (id, username, email, password, role)
VALUES (gen_random_uuid(), 'test_user', 'test@example.com', 'hash', 'user')
RETURNING id;

-- Check if learning profile was auto-created
SELECT * FROM learning_profiles WHERE user_id = '<insert-user-id>';
```

---

### Phase 1B: Learning Core Integration (Days 2-3)

#### Step 1: Initialize Learning Core in Server

**Edit:** `bz-server/src/index.js`

```javascript
import { initializeLearningCore, healthCheck } from "./learning-core/index.js";

// ... existing imports ...

const app = express();

// Initialize learning core BEFORE routes
(async () => {
    try {
        await initializeLearningCore();
        console.log("✅ Learning Core initialized");

        // Health check endpoint
        app.get("/api/health/learning-core", async (req, res) => {
            const health = await healthCheck();
            res.status(health.healthy ? 200 : 503).json(health);
        });
    } catch (error) {
        console.error("❌ Failed to initialize Learning Core:", error);
        process.exit(1);
    }
})();

// ... rest of your code ...
```

#### Step 2: Create New Evaluation Controller

**Create:** `bz-server/src/controllers/evaluation.controller.js`

```javascript
import EvaluationService from "../learning-core/services/evaluation.service.js";

const evaluationService = new EvaluationService();

/**
 * New unified submission endpoint (replaces submitProblemController)
 */
export const submitEvaluationController = async (req, res) => {
    try {
        const {
            questionId,
            evaluationType, // 'code' | 'quiz' | etc.
            answer, // {code, language} for code | {answers: []} for quiz
            context, // Optional: {hintsUsed, timeSpent, userFailureReason, confidenceLevel}
        } = req.body;

        const userId = req.userId; // From JWT middleware

        // Validate input
        if (!questionId || !evaluationType || !answer) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: questionId, evaluationType, answer",
            });
        }

        // Call learning core
        const result = await evaluationService.evaluate({
            userId,
            questionId,
            evaluationType,
            answer,
            context: context || {},
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Evaluation controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during evaluation",
            error: error.message,
        });
    }
};

/**
 * Get user's learning profile
 */
export const getLearningProfileController = async (req, res) => {
    try {
        const userId = req.userId;
        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();

        const summary = await profileService.getLearningummary(userId);

        return res.status(200).json({
            success: true,
            profile: summary,
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch learning profile",
        });
    }
};

/**
 * Get personalized recommendations
 */
export const getRecommendationsController = async (req, res) => {
    try {
        const userId = req.userId;
        const { count = 3 } = req.query;

        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const recommendations = await plannerService.getNextRecommendations(userId, parseInt(count));

        return res.status(200).json({
            success: true,
            recommendations: recommendations.map((q) => ({
                id: q.id || q.legacy_problem_id,
                title: q.title,
                difficulty: q.difficulty,
                topics: q.topics || q.category,
            })),
        });
    } catch (error) {
        console.error("Get recommendations error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recommendations",
        });
    }
};

/**
 * Generate training plan
 */
export const generateTrainingPlanController = async (req, res) => {
    try {
        const userId = req.userId;
        const { planType = "weak_topic_focus", durationDays = 7, dailyTarget = 3 } = req.body;

        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const plan = await plannerService.generatePlan(userId, {
            planType,
            durationDays,
            dailyTarget,
        });

        return res.status(200).json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error("Generate plan error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate training plan",
        });
    }
};
```

#### Step 3: Create New Routes

**Create:** `bz-server/src/routes/learning.routes.js`

```javascript
import express from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
    submitEvaluationController,
    getLearningProfileController,
    getRecommendationsController,
    generateTrainingPlanController,
} from "../controllers/evaluation.controller.js";

const router = express.Router();

// All routes require authentication
router.use(userAuthentication);

// Evaluation (replaces /api/problem/submit)
router.post("/evaluate", submitEvaluationController);

// Learning Profile
router.get("/profile", getLearningProfileController);

// Recommendations
router.get("/recommendations", getRecommendationsController);

// Training Plans
router.post("/training-plan", generateTrainingPlanController);

export default router;
```

#### Step 4: Register Routes in Server

**Edit:** `bz-server/src/index.js`

```javascript
import learningRoutes from "./routes/learning.routes.js";

// Add after other routes
app.use("/api/learning", learningRoutes);
```

---

### Phase 1C: Gradual Migration (Days 4-7)

#### Strategy: Dual System (Old + New Run in Parallel)

**Goal**: Keep old endpoints working while testing new system.

#### Step 1: Migrate WRITE Operations First

Keep `POST /api/problem/submit` but have it ALSO write to new tables:

**Edit:** `bz-server/src/controllers/problem.execute.controller.js`

```javascript
import EvaluationService from '../learning-core/services/evaluation.service.js';

const evaluationService = new EvaluationService();

const submitProblemController = async (req, res) => {
  try {
    // ... existing code execution logic ...

    // OLD: Store in submissions table (keep this)
    const insertSubmissionQuery = `...`;
    await pool.query(insertSubmissionQuery, [...]);

    // NEW: ALSO call learning core (non-blocking)
    try {
      await evaluationService.evaluate({
        userId,
        questionId: problemId,
        evaluationType: 'code',
        answer: { code: sourceCode, language },
        context: {
          timeSpent: /* track this */,
          hintsUsed: /* track this */
        }
      });
    } catch (learningError) {
      // Don't fail submission if learning core has issues
      console.error('Learning core update failed:', learningError);
    }

    // ... rest of existing code ...
  }
};
```

#### Step 2: Add User Failure Reason to UI

**Frontend:** Add optional feedback field after wrong answer

```jsx
// In ProblemPage.jsx or wherever submissions happen

{
    verdict === "WRONG_ANSWER" && (
        <div className="mt-4">
            <label>Why do you think this went wrong? (Optional)</label>
            <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g., I forgot to handle empty array case..."
                className="w-full p-2 border rounded"
            />
        </div>
    );
}
```

Include this in submission request:

```javascript
const response = await axios.post("/api/problem/submit", {
    problemId,
    sourceCode,
    language,
    userFailureReason: failureReason, // NEW
    confidenceLevel: confidenceSlider, // NEW (1-5 scale)
});
```

#### Step 3: Test Both Systems in Parallel

Create a test script:

```javascript
// test/learning-core-integration.test.js

const testSubmission = async () => {
  // Submit via old endpoint
  const oldResponse = await axios.post('/api/problem/submit', {...});

  // Submit via new endpoint
  const newResponse = await axios.post('/api/learning/evaluate', {...});

  // Compare verdicts
  console.assert(oldResponse.verdict === newResponse.evaluationResult.verdict);

  // New system should provide additional data
  console.log('Mistakes detected:', newResponse.mistakes);
  console.log('Recommendations:', newResponse.recommendations);
};
```

---

### Phase 1D: Frontend Integration (Days 8-10)

#### Add Learning Profile Page

**Create:** `bz-client/src/components/pages/LearningProfile.jsx`

```jsx
import { useEffect, useState } from "react";
import axios from "axios";

const LearningProfile = () => {
    const [profile, setProfile] = useState(null);
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        fetchProfile();
        fetchRecommendations();
    }, []);

    const fetchProfile = async () => {
        const response = await axios.get("/api/learning/profile");
        setProfile(response.data.profile);
    };

    const fetchRecommendations = async () => {
        const response = await axios.get("/api/learning/recommendations?count=5");
        setRecommendations(response.data.recommendations);
    };

    const generatePlan = async () => {
        await axios.post("/api/learning/training-plan", {
            planType: "weak_topic_focus",
            durationDays: 7,
            dailyTarget: 3,
        });
        alert("Training plan generated!");
    };

    if (!profile) return <div>Loading...</div>;

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">Your Learning Profile</h1>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="text-gray-600">Streak</h3>
                    <p className="text-3xl font-bold">{profile.profile.streakDays} days</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="text-gray-600">Total Sessions</h3>
                    <p className="text-3xl font-bold">{profile.profile.totalSessions}</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="text-gray-600">Last Active</h3>
                    <p className="text-xl">{profile.profile.lastActive}</p>
                </div>
            </div>

            {/* Weak Topics */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Focus Areas</h2>
                <div className="space-y-2">
                    {profile.weakTopics.map((topic) => (
                        <div key={topic.topic} className="bg-red-50 p-4 rounded">
                            <h3 className="font-semibold">{topic.topic}</h3>
                            <p className="text-sm text-gray-600">
                                {topic.attempts} attempts, {(topic.failureRate * 100).toFixed(0)}% failure rate
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Strong Topics */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Strengths</h2>
                <div className="space-y-2">
                    {profile.strongTopics.map((topic) => (
                        <div key={topic.topic} className="bg-green-50 p-4 rounded">
                            <h3 className="font-semibold">{topic.topic}</h3>
                            <p className="text-sm text-gray-600">
                                {topic.attempts} attempts, {(topic.successRate * 100).toFixed(0)}% success rate
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Recommendations */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Recommended for You</h2>
                <div className="space-y-2">
                    {recommendations.map((rec) => (
                        <div key={rec.id} className="bg-blue-50 p-4 rounded flex justify-between">
                            <div>
                                <h3 className="font-semibold">{rec.title}</h3>
                                <p className="text-sm text-gray-600">
                                    {rec.difficulty} · {rec.topics?.join(", ")}
                                </p>
                            </div>
                            <button
                                onClick={() => (window.location.href = `/problems/${rec.id}`)}
                                className="bg-blue-500 text-white px-4 py-2 rounded"
                            >
                                Solve
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Generate Plan */}
            <button
                onClick={generatePlan}
                className="bg-green-500 text-white px-6 py-3 rounded-lg text-lg font-semibold"
            >
                Generate 7-Day Training Plan
            </button>
        </div>
    );
};

export default LearningProfile;
```

#### Add Route

**Edit:** `bz-client/src/App.jsx`

```jsx
import LearningProfile from "./components/pages/LearningProfile";

// In Routes:
<Route path="/learning/profile" element={<LearningProfile />} />;
```

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
// test/learning-core/learningProfile.test.js

describe("LearningProfileService", () => {
    it("should mark topic as weak after 2 failures", async () => {
        const service = new LearningProfileService();
        // ... test logic
    });

    it("should mark topic as strong after 3+ successes", async () => {
        // ... test logic
    });
});
```

### Integration Tests

```javascript
// test/integration/evaluation-flow.test.js

describe("Evaluation Flow", () => {
    it("should evaluate code, extract mistakes, and update profile", async () => {
        const result = await evaluationService.evaluate({
            userId: testUserId,
            questionId: testQuestionId,
            evaluationType: "code",
            answer: { code: testCode, language: "python" },
        });

        expect(result.success).toBe(true);
        expect(result.mistakes).toBeDefined();
        expect(result.recommendations).toHaveLength(3);
    });
});
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Run database migration on staging
- [ ] Verify all indexes created
- [ ] Test plugin registration on startup
- [ ] Run integration tests
- [ ] Check backward compatibility with old endpoints
- [ ] Update environment variables if needed

### Deployment Steps

1. **Backup Database**

```bash
pg_dump -U postgres Neocode-v2 > backup_before_learning_os.sql
```

2. **Deploy Code**

```bash
git add .
git commit -m "feat: Phase 1 Learning OS foundation"
git push origin main
```

3. **Run Migration**

```bash
# On production server
psql -U postgres -d Neocode-v2 -f 001_learning_platform_foundation.sql
```

4. **Restart Server**

```bash
pm2 restart neocode-server
```

5. **Verify Health**

```bash
curl https://neocode.rakeshp.me/api/health/learning-core
```

### Post-Deployment

- [ ] Monitor error logs for issues
- [ ] Check that learning profiles are being created
- [ ] Verify submissions still work via old endpoint
- [ ] Test new learning profile UI
- [ ] Monitor database performance (indexes working?)

---

## 🔧 Troubleshooting

### Issue: Migration Fails

**Error:** `relation "learning_profiles" already exists`

```sql
-- Drop all learning tables and retry
DROP TABLE IF EXISTS user_mistakes_log CASCADE;
DROP TABLE IF EXISTS mistake_catalog CASCADE;
DROP TABLE IF EXISTS training_plans CASCADE;
DROP TABLE IF EXISTS evaluation_results CASCADE;
DROP TABLE IF EXISTS normalized_questions CASCADE;
DROP TABLE IF EXISTS learning_profiles CASCADE;
DROP TABLE IF EXISTS plugin_registry CASCADE;
```

### Issue: Plugin Not Found

**Error:** `No plugin registered for type: code`

**Fix:** Ensure `initializeLearningCore()` is called BEFORE routes are registered.

### Issue: Submission Fails with New System

**Temporary Fix:** Wrap learning core calls in try-catch so old system still works:

```javascript
try {
  await evaluationService.evaluate(...);
} catch (e) {
  console.error('Learning core failed, but submission succeeded');
}
```

---

## 📚 Next Steps (Phase 2)

After Phase 1 is stable:

1. **Add LLM Coach**
    - Create `LLMService` that enhances (not replaces) deterministic logic
    - LLM explains mistakes in personalized way
    - LLM provides motivational coaching

2. **Build Quiz Plugin**
    - Implement `IEvaluationPlugin` for MCQ questions
    - Same learning profile updates

3. **Add PDF Learning Plugin**
    - Extract questions from PDFs
    - Evaluate answers using rubrics

---

## 🎯 Success Metrics

After Phase 1 deployment, track:

- ✅ % of users with learning profiles created
- ✅ Average weak topics per user
- ✅ Training plan generation rate
- ✅ Recommendation click-through rate
- ✅ System performance (query times)
- ✅ Zero regressions in old submission flow

---

**Ready to build the future of adaptive learning! 🚀**
