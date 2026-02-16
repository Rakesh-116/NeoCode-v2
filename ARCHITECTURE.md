# 🏗️ NeoCode Learning OS - Architecture Overview

## 📐 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + TailwindCSS)                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Problem     │  │  Learning    │  │  Training    │  │  Recommendations│ │
│  │  Page        │  │  Profile     │  │  Plans       │  │  Dashboard      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                 │                 │                   │          │
└─────────┼─────────────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                 │                   │
          │          HTTP / REST API (JSON)                       │
          │                 │                 │                   │
┌─────────▼─────────────────▼─────────────────▼───────────────────▼──────────┐
│                        BACKEND (Node.js + Express)                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     LEARNING CORE MODULE (New)                         │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │              EVALUATION SERVICE (Orchestrator)                   │ │ │
│  │  │  • Receives submissions (any type)                               │ │ │
│  │  │  • Routes to appropriate plugin                                  │ │ │
│  │  │  • Stores results                                                │ │ │
│  │  │  • Updates learning profile                                      │ │ │
│  │  │  • Extracts & logs mistakes                                      │ │ │
│  │  │  • Returns recommendations                                        │ │ │
│  │  └────────────┬─────────────────────────────────────────────────────┘ │ │
│  │               │                                                        │ │
│  │  ┌────────────▼─────────┐  ┌──────────────────┐  ┌─────────────────┐ │ │
│  │  │  PLUGIN REGISTRY    │  │  LEARNING        │  │  MISTAKE        │ │ │
│  │  │  • Register plugins │  │  PROFILE         │  │  ENGINE         │ │ │
│  │  │  • Route evaluations│  │  SERVICE         │  │  SERVICE        │ │ │
│  │  └──────────┬───────────┘  │                  │  │                 │ │ │
│  │             │              │  • Track weak/   │  │  • Log mistakes │ │ │
│  │  ┏━━━━━━━━━━▼━━━━━━━━━━┓   │    strong topics │  │  • Detect       │ │ │
│  │  ┃ IEvaluationPlugin  ┃   │  • Update memory │  │    patterns     │ │ │
│  │  ┃     (Interface)    ┃   │  • Calc stats    │  │  • Provide      │ │ │
│  │  ┗━━━━━━━━━┬━━━━━━━━━━┛   └──────────────────┘  │    feedback     │ │ │
│  │             │                                    └─────────────────┘ │ │
│  │   ┌─────────┴─────────┐                          ┌─────────────────┐ │ │
│  │   │  CODE PLUGIN      │                          │  TRAINING       │ │ │
│  │   │  • evaluate()     │                          │  PLANNER        │ │ │
│  │   │  • extractMistakes│                          │  SERVICE        │ │ │
│  │   └──────────┬────────┘                          │                 │ │ │
│  │              │                                    │  • Generate     │ │ │
│  │              │                                    │    plans        │ │ │
│  │   ┌──────────▼────────┐                          │  • Recommend    │ │ │
│  │   │  COMPILER LAYER   │                          │    next Qs      │ │ │
│  │   │  • Java executor  │                          │  • Rule-based   │ │ │
│  │   │  • Python executor│                          │    (no AI yet)  │ │ │
│  │   │  • C++ executor   │                          └─────────────────┘ │ │
│  │   └──────────┬────────┘                                              │ │
│  └──────────────┼───────────────────────────────────────────────────────┘ │
│                 │                                                          │
│  ┌──────────────▼────────┐         ┌──────────────────────────────────┐  │
│  │   DOCKER CONTAINERS   │         │  OLD CONTROLLERS (Legacy)        │  │
│  │   • java-container    │         │  • Still work (backward compat)  │  │
│  │   • python-container  │         │  • Gradually deprecated           │  │
│  │   • cpp-container     │         └──────────────────────────────────┘  │
│  └───────────────────────┘                                                │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         API ROUTES                                   │ │
│  │                                                                       │ │
│  │  NEW ROUTES (Learning Core):                                         │ │
│  │  • POST   /api/learning/evaluate              → Submit any question  │ │
│  │  • GET    /api/learning/profile               → Get learning profile │ │
│  │  • GET    /api/learning/recommendations       → Get next questions   │ │
│  │  • POST   /api/learning/training-plan         → Generate plan        │ │
│  │  • GET    /api/learning/mistakes              → Get mistake history  │ │
│  │  • GET    /api/learning/recurring-patterns    → Find patterns        │ │
│  │                                                                       │ │
│  │  LEGACY ROUTES (Still work):                                         │ │
│  │  • POST   /api/problem/submit                 → Old submission       │ │
│  │  • GET    /api/user/profile                   → Old profile          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                               │
│                                                                              │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │    NEW TABLES (Learning OS) │  │        LEGACY TABLES                 │  │
│  │                             │  │                                      │  │
│  │  • learning_profiles        │  │  • users                             │  │
│  │  • evaluation_results       │  │  • problem                           │  │
│  │  • normalized_questions     │  │  • submissions (extended)            │  │
│  │  • training_plans           │  │  • testcases                         │  │
│  │  • mistake_catalog          │  │  • courses                           │  │
│  │  • user_mistakes_log        │  │  • user_category_points              │  │
│  │  • plugin_registry          │  │  • blogs                             │  │
│  └────────────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow: Code Submission

```
USER SUBMITS CODE
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/learning/evaluate                                     │
│ {                                                               │
│   questionId: "1",                                              │
│   evaluationType: "code",                                       │
│   answer: {code: "...", language: "python"},                   │
│   context: {timeSpent: 300, userFailureReason: "..."}          │
│ }                                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ EVALUATION SERVICE                                              │
│                                                                 │
│  1. Get question data                                           │
│  2. Get plugin (CodeEvaluationPlugin)                           │
│  3. Validate plugin can handle question                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CODE EVALUATION PLUGIN                                          │
│                                                                 │
│  4. Execute code in Docker container                            │
│  5. Compare output with test cases                              │
│  6. Determine verdict (ACCEPTED / WRONG ANSWER / TLE / RTE)     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ MISTAKE EXTRACTION                                              │
│                                                                 │
│  7. Analyze failures                                            │
│  8. Identify mistake types (array_bounds, TLE, edge_case, etc.) │
│  9. Return detected mistakes                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STORE RESULTS                                                   │
│                                                                 │
│  10. INSERT INTO evaluation_results                             │
│  11. INSERT INTO user_mistakes_log                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ UPDATE LEARNING PROFILE                                         │
│                                                                 │
│  12. Calculate success rate per topic                           │
│  13. Mark topics as weak (< 50% success) or strong (> 75%)      │
│  14. Update mistake_patterns                                    │
│  15. Update learning_style (hints used, time spent)             │
│  16. Update streak_days                                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ GENERATE RECOMMENDATIONS                                        │
│                                                                 │
│  17. Get user's weak topics                                     │
│  18. Get unsolved problems in weak topics                       │
│  19. Sort by difficulty (easy first if struggling)              │
│  20. Return top 3 recommendations                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ RETURN TO USER                                                  │
│ {                                                               │
│   success: true,                                                │
│   evaluationResult: {verdict, score, details},                  │
│   mistakes: [{type, category, severity, description}],          │
│   recommendations: [{id, title, difficulty, topic}],            │
│   learningInsights: {totalSessions, streakDays}                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🧩 Plugin System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IEvaluationPlugin                            │
│                      (Interface)                                │
│                                                                 │
│  Methods that ALL plugins MUST implement:                       │
│  • getType() → 'code' | 'quiz' | 'pdf' | etc.                  │
│  • canHandle(question) → boolean                                │
│  • evaluate(input) → Promise<EvaluationResult>                  │
│  • extractMistakes(result) → Promise<Mistakes[]>                │
│                                                                 │
│  Optional:                                                      │
│  • getRecommendations() → suggestions based on performance      │
│  • healthCheck() → is plugin operational?                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ implements
             │
    ┌────────┴────────┬────────────────┬────────────────┐
    │                 │                │                │
    ▼                 ▼                ▼                ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  CODE   │     │  QUIZ   │     │   PDF   │     │INTERVIEW│
│ PLUGIN  │     │ PLUGIN  │     │ PLUGIN  │     │ PLUGIN  │
│         │     │         │     │         │     │         │
│ ✅ Done │     │ 🚧 TODO │     │ 🚧 TODO │     │ 🚧 TODO │
└─────────┘     └─────────┘     └─────────┘     └─────────┘

Each plugin is:
• Self-contained (all evaluation logic inside)
• Independently testable
• Swappable (change Docker to Judge0? Just update plugin)
• Registerable (pluginRegistry.register(new CodePlugin()))
```

## 🗄️ Database Schema Relationships

```
┌──────────────────┐         ┌──────────────────────┐
│      users       │─────────│  learning_profiles   │
│                  │  1:1    │                      │
│  • id (PK)       │────────▶│  • user_id (PK, FK)  │
│  • username      │         │  • weak_topics       │
│  • email         │         │  • strong_topics     │
│  • role          │         │  • mistake_patterns  │
└────────┬─────────┘         │  • learning_style    │
         │                   │  • streak_days       │
         │                   └──────────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────────────────────────────────────────────┐
│              evaluation_results                             │
│                                                             │
│  • id (PK)                                                  │
│  • user_id (FK → users)                                     │
│  • question_id (FK → normalized_questions)                  │
│  • evaluation_type ('code' | 'quiz' | etc.)                 │
│  • verdict                                                  │
│  • score                                                    │
│  • evaluation_data (JSONB)                                  │
│  • detected_mistakes (JSONB)                                │
│  • user_failure_reason (User's explanation!)                │
└────────┬────────────────────────────────────────────────────┘
         │
         │ 1:N
         │
┌────────▼─────────────────────────────────────────────────────┐
│             user_mistakes_log                                │
│                                                              │
│  • id (PK)                                                   │
│  • user_id (FK → users)                                      │
│  • evaluation_result_id (FK → evaluation_results)            │
│  • mistake_type (FK → mistake_catalog.mistake_type)          │
│  • question_id                                               │
│  • topic                                                     │
│  • resolved (boolean)                                        │
└──────────────────────────────────────────────────────────────┘


┌──────────────────────────┐         ┌────────────────────────┐
│ normalized_questions     │         │  training_plans        │
│                          │         │                        │
│  • id (PK)               │         │  • id (PK)             │
│  • question_type         │         │  • user_id (FK)        │
│  • source ('neocode' |   │         │  • plan_type           │
│    'leetcode' | 'ai')    │         │  • plan_structure      │
│  • topics (Array)        │         │    (JSONB)             │
│  • primary_topic         │         │  • current_day         │
│  • difficulty            │         │  • completed_questions │
│  • question_data (JSONB) │         │  • status              │
│  • legacy_problem_id (FK)│         └────────────────────────┘
└──────────────────────────┘

Unified question format supports:
• Code problems         → {testcases, constraints, samples}
• MCQ quizzes          → {options, correct_answers}
• PDF exams            → {sections, rubric}
• Interview questions  → {evaluation_criteria}
```

## 🔀 Old vs New Architecture Comparison

### **BEFORE (Tightly Coupled)** ❌

```
┌────────────────────────────────────────┐
│ problem.execute.controller.js          │
│                                        │
│  • Get problem                         │
│  • Get testcases                       │
│  • Execute Docker (Java/Python/C++)    │
│  • Compare outputs                     │
│  • Calculate verdict                   │
│  • Store submission                    │
│  • Update problem stats                │
│  • Update user points                  │
│  • Return response                     │
│                                        │
│  👎 1000+ lines                        │
│  👎 Can't easily add quiz/PDF          │
│  👎 Hard to test                       │
│  👎 No learning memory                 │
└────────────────────────────────────────┘
```

### **AFTER (Modular Plugin System)** ✅

```
┌────────────────────────────┐
│   EvaluationService        │  👈 Orchestrator (100 lines)
│   • Route to plugin        │
│   • Store results          │
│   • Update profile         │
└───────────┬────────────────┘
            │
    ┌───────┴────────┐
    │                │
┌───▼─────────┐  ┌──▼────────────────┐
│ CodePlugin  │  │ LearningProfile   │  👈 Separate concerns
│ (300 lines) │  │ (200 lines)       │
└─────────────┘  └───────────────────┘

✅ Modular (each < 300 lines)
✅ Testable (isolated units)
✅ Extensible (add plugins easily)
✅ Learning memory (separate service)
```

## 🚀 Future Plugin Expansion

```
                    ┌────────────────────┐
                    │ Plugin Registry    │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌─────▼─────┐         ┌────▼────┐
   │         │          │           │         │         │
   │  Code   │          │   Quiz    │         │   PDF   │
   │ Plugin  │          │  Plugin   │         │  Plugin │
   │         │          │           │         │         │
   │ ✅ V1.0 │          │ 🚧 Phase 3│         │ 🚧 Phase 3│
   └─────────┘          └───────────┘         └─────────┘

   ┌────────────┐       ┌──────────────┐     ┌─────────────┐
   │            │       │              │     │             │
   │ Interview  │       │   Database   │     │  AI-Generated│
   │   Plugin   │       │Query Plugin  │     │   Question   │
   │            │       │              │     │   Importer   │
   │ 🚧 Phase 3 │       │ 🚧 Future    │     │ 🚧 Phase 3   │
   └────────────┘       └──────────────┘     └─────────────┘

Same learning profile updates for ALL plugins!
Same mistake tracking!
Same recommendation engine!
```

## 💡 Key Design Decisions

### 1. **Deterministic First, AI Second**

```
❌ WRONG: LLM decides what user is weak at
✅ RIGHT: Rule-based logic decides → LLM explains better

Why? AI is:
• Expensive
• Unpredictable
• Can fail

Rule-based is:
• Fast
• Predictable
• Always works
```

### 2. **Plugin Pattern for Extensibility**

```
Why not just add quiz code to existing controller?

❌ Would make it 2000+ lines
❌ Would mix concerns
❌ Would be hard to test

✅ Plugin = 300 lines, isolated, testable
✅ Learning core doesn't know about Docker/quizzes
✅ Easy to swap implementations
```

### 3. **JSONB for Flexibility**

```sql
-- Instead of rigid columns:
weak_topics: array        ❌
strong_topics: array      ❌

-- Use JSONB (flexible, queryable):
weak_topics: JSONB        ✅
{
  "arrays": {
    "attempts": 5,
    "success": 1,
    "failure_rate": 0.8,
    "last_failed": "2026-02-15"
  }
}

Why? Can add fields without migration!
```

### 4. **Dual System During Migration**

```
Old endpoint works → New endpoint works → Switch traffic → Deprecate old

NOT:
Old endpoint works → Break everything → Fix in production ❌
```

---

**Architecture is done. Now build features on top! 🎉**
