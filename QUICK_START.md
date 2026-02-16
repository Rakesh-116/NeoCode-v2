# 🚀 NeoCode Learning OS - Quick Start Guide

## 📦 What Was Created

### ✅ Complete Phase 1 Foundation (Production-Ready)

```
NEW FILES CREATED:
├── 📁 bz-server/src/
│   ├── 📁 learning-core/                    # NEW MODULE
│   │   ├── index.js                          # Main export & initialization
│   │   ├── 📁 interfaces/
│   │   │   └── IEvaluationPlugin.js          # Plugin interface
│   │   ├── 📁 plugins/
│   │   │   └── CodeEvaluationPlugin.js       # Code evaluation implementation
│   │   └── 📁 services/
│   │       ├── evaluation.service.js         # Main orchestrator
│   │       ├── learningProfile.service.js    # Learning memory agent
│   │       ├── mistakeEngine.service.js      # Mistake tracking
│   │       └── trainingPlanner.service.js    # Training recommendations
│   ├── 📁 routes/
│   │   └── learning.routes.js                # NEW API routes
│   └── 📁 database/
│       └── 📁 migrations/
│           └── 001_learning_platform_foundation.sql  # Database schema
├── 📁 Documentation/
│   ├── PHASE1_IMPLEMENTATION_GUIDE.md        # Step-by-step implementation
│   ├── PROJECT_ROADMAP.md                    # Complete vision & roadmap
│   └── QUICK_START.md                        # This file
```

---

## ⚡ 5-Minute Setup

### Step 1: Run Database Migration

```bash
# Navigate to project
cd c:/Users/rakes/Desktop/Practice-Dump/NeoCode-v2/bz-server

# Run migration
psql -U postgres -d Neocode-v2 -f src/database/migrations/001_learning_platform_foundation.sql

# Verify
psql -U postgres -d Neocode-v2 -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'learning_%' OR table_name = 'evaluation_results';"
```

**Expected Output:**

```
 learning_profiles
 evaluation_results
 normalized_questions
 training_plans
 mistake_catalog
 user_mistakes_log
 plugin_registry
```

### Step 2: Install Dependencies (if any new)

```bash
cd bz-server
npm install
```

### Step 3: Initialize Learning Core in Server

**Edit: `bz-server/src/index.js`**

Add at the top (after imports):

```javascript
import { initializeLearningCore } from "./learning-core/index.js";
import learningRoutes from "./routes/learning.routes.js";
```

Add before `connection()` call:

```javascript
// Initialize Learning Core
(async () => {
    try {
        await connection(); // Connect to DB first
        await initializeLearningCore(); // Then initialize learning core
        console.log("✅ Learning Core initialized");
    } catch (error) {
        console.error("❌ Failed to initialize:", error);
        process.exit(1);
    }
})();
```

Add with other routes:

```javascript
// Learning Core routes
app.use("/api/learning", learningRoutes);
```

### Step 4: Start Server

```bash
npm run dev
```

**Look for:**

```
🚀 Initializing NeoCode Learning OS...
✅ Registered plugin: code v1.0.0
✅ Learning Core initialized successfully
✅ Learning Core initialized
App is listening at the 5000
```

### Step 5: Test API

```bash
# Health check
curl http://localhost:5000/api/learning/health

# Expected: {"success":true,"healthy":true,"plugins":[{"type":"code","healthy":true}]}
```

---

## 🧪 Test the System

### Test 1: Submit Code (New Endpoint)

```bash
curl -X POST http://localhost:5000/api/learning/evaluate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "questionId": "1",
    "evaluationType": "code",
    "answer": {
      "code": "def solve():\n    return 42",
      "language": "python"
    },
    "context": {
      "timeSpent": 300,
      "userFailureReason": "Not sure about edge cases"
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "evaluationResult": {
    "verdict": "ACCEPTED",
    "score": 100,
    "details": {...}
  },
  "mistakes": [],
  "recommendations": [
    {"id": "2", "title": "Next Problem", "difficulty": "medium"}
  ],
  "learningInsights": {
    "totalSessions": 1,
    "streakDays": 1
  }
}
```

### Test 2: Get Learning Profile

```bash
curl http://localhost:5000/api/learning/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 3: Get Recommendations

```bash
curl http://localhost:5000/api/learning/recommendations?count=5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 4: Generate Training Plan

```bash
curl -X POST http://localhost:5000/api/learning/training-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "planType": "weak_topic_focus",
    "durationDays": 7,
    "dailyTarget": 3
  }'
```

---

## 🔄 Migration Strategy (Gradual Rollout)

### Phase A: Dual System (Week 1)

**Keep both endpoints:**

- ✅ OLD: `POST /api/problem/submit` (still works)
- ✅ NEW: `POST /api/learning/evaluate` (runs in parallel)

**Frontend uses OLD endpoint** (no changes yet)

**Backend:** Modify old controller to ALSO call learning core:

```javascript
// In problem.execute.controller.js
const submitProblemController = async (req, res) => {
  // ... existing code ...

  // OLD system: Store in submissions
  await pool.query(...);

  // NEW system: Also update learning profile (non-breaking)
  try {
    import('../learning-core/services/evaluation.service.js').then(module => {
      const service = new module.default();
      service.evaluate({
        userId,
        questionId: problemId,
        evaluationType: 'code',
        answer: { code: sourceCode, language },
        context: {}
      }).catch(err => console.error('Learning core update failed:', err));
    });
  } catch (e) {
    // Silently fail - don't break submissions
  }

  // ... return existing response ...
};
```

### Phase B: Frontend Migration (Week 2)

**Update frontend to use NEW endpoint:**

```javascript
// OLD:
await axios.post('/api/problem/submit', {...});

// NEW:
await axios.post('/api/learning/evaluate', {
  questionId: problemId,
  evaluationType: 'code',
  answer: { code: sourceCode, language },
  context: {
    timeSpent: elapsed,
    hintsUsed: hintsCount,
    confidenceLevel: confidence
  }
});
```

### Phase C: Deprecate Old Endpoint (Week 3+)

Once 100% traffic on new endpoint:

- Mark old endpoint as `@deprecated`
- Eventually remove (after 1 month buffer)

---

## 📊 Key Database Tables

### `learning_profiles`

Stores user's learning memory (weak/strong topics)

```sql
SELECT * FROM learning_profiles WHERE user_id = 'USER_UUID';
```

**Key Fields:**

- `weak_topics` - JSONB: Topics with < 50% success rate
- `strong_topics` - JSONB: Topics with > 75% success rate
- `mistake_patterns` - JSONB: Most common mistakes
- `streak_days` - INT: Current learning streak

### `evaluation_results`

Plugin-agnostic evaluation storage (replaces submissions)

```sql
SELECT * FROM evaluation_results
WHERE user_id = 'USER_UUID'
ORDER BY submitted_at DESC
LIMIT 10;
```

**Key Fields:**

- `evaluation_type` - VARCHAR: 'code' | 'quiz' | 'pdf-exam' | etc.
- `verdict` - VARCHAR: 'ACCEPTED' | 'WRONG_ANSWER' | etc.
- `detected_mistakes` - JSONB: Array of mistakes
- `user_failure_reason` - TEXT: User's explanation (gold!)

### `training_plans`

Generated personalized learning paths

```sql
SELECT * FROM training_plans
WHERE user_id = 'USER_UUID'
AND status = 'active';
```

---

## 🐛 Troubleshooting

### Issue: Migration fails

```bash
# Drop everything and retry
psql -U postgres -d Neocode-v2 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Re-run original schema
# Re-run migration
```

### Issue: Plugin not found

```
Error: No plugin registered for type: code
```

**Fix:** Ensure `initializeLearningCore()` is called AFTER database connection:

```javascript
await connection();
await initializeLearningCore();
```

### Issue: JWT token not working

Get a fresh token:

```bash
# Login
curl -X POST http://localhost:5000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your_password"}'
```

---

## 📈 What to Monitor

### Day 1:

- [ ] Learning profiles created for new submissions?
- [ ] Weak topics being detected?
- [ ] Recommendations returning results?

```sql
-- Check profile creation
SELECT COUNT(*) FROM learning_profiles;

-- Check evaluations stored
SELECT COUNT(*) FROM evaluation_results;

-- Check mistakes logged
SELECT COUNT(*) FROM user_mistakes_log;
```

### Week 1:

- [ ] Old + new endpoints both working?
- [ ] No performance degradation?
- [ ] Database queries fast (< 100ms)?

```sql
-- Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🎯 Next Steps

### Immediate (This Week):

1. ✅ Run migration
2. ✅ Initialize learning core
3. ✅ Test API endpoints
4. ⏳ Add learning profile UI page
5. ⏳ Add "Why did this fail?" input in submission UI

### Short-term (Next 2 Weeks):

- Migrate frontend to new API
- Build learning profile dashboard
- Add recommendation cards
- Monitor weak topic detection accuracy

### Medium-term (Next Month):

- Add AI coach (Phase 2)
- Build quiz plugin
- Implement training plan UI
- Add progress visualization (charts)

---

## 📚 Documentation

- **Full Implementation Guide**: [`PHASE1_IMPLEMENTATION_GUIDE.md`](PHASE1_IMPLEMENTATION_GUIDE.md)
- **Complete Roadmap**: [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md)
- **Database Schema**: [`bz-server/src/database/migrations/001_learning_platform_foundation.sql`](bz-server/src/database/migrations/001_learning_platform_foundation.sql)

---

## 🆘 Getting Help

**Check logs:**

```bash
# Server logs
cd bz-server
npm run dev

# Database logs
psql -U postgres -d Neocode-v2 -c "SELECT * FROM pg_stat_activity;"
```

**Test plugin health:**

```bash
curl http://localhost:5000/api/learning/health
```

**Verify database:**

```sql
-- Check if tables exist
\dt learning_*

-- Check if triggers work
INSERT INTO users ...
SELECT * FROM learning_profiles WHERE user_id = <new_user_id>;
```

---

## 🎉 Success Checklist

- [ ] Database migration successful (7 new tables)
- [ ] Learning core initializes on server start
- [ ] Code plugin registered
- [ ] Health check endpoint returns healthy
- [ ] Can submit code via `/api/learning/evaluate`
- [ ] Learning profiles created automatically
- [ ] Weak topics detected after 2+ failures
- [ ] Recommendations return results
- [ ] Training plan generated successfully
- [ ] Old submission endpoint still works (backward compatible)

---

**You're now ready to build on top of the Learning OS foundation! 🚀**

The hard part (architecture refactoring) is DONE. Now you can add features modularly:

- AI Coach (Phase 2)
- Quiz plugin
- PDF learning
- Interview simulator
- And more...

Each new feature is just a plugin or service - no touching core logic!
