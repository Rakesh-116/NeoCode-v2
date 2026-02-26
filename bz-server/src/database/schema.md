# NeoCode Database Schema Documentation

## Database Overview

**Database Name:** `Neocode-v2`  
**Database Version:** PostgreSQL 16.2  
**Total Tables:** 37  
**Last Updated:** February 26, 2026

---

## Table Categories

1. [Core System Tables](#core-system-tables) (7 tables)
2. [AI Learning & Mentor System](#ai-learning--mentor-system) (17 tables)
3. [Voice Interview System](#voice-interview-system) (6 tables)
4. [Course Management](#course-management) (4 tables)
5. [User Progress & Analytics](#user-progress--analytics) (3 tables)

---

## Core System Tables (7)

### users, problem, submissions, testcases, blog, savedsnippets, system_settings

**Key Features:**

- User authentication and profiles
- Coding problems with test cases
- Submission tracking with AI-detected mistakes
- Blog content management
- System-wide configuration

---

## AI Learning & Mentor System (17 tables)

### Learning Profiles & Skills

- `learning_profiles` - User learning preferences and patterns
- `user_skills` - Skill proficiency tracking (0-5 levels)
- `skill_catalog` - Master skill repository
- `skill_assessments` - Assessment templates
- `skill_assessment_results` - User assessment results

### Goals & Planning

- `user_goals` - Career goals with skill requirements
- `training_plans` - Personalized learning roadmaps
- `training_plan_items` - Individual plan items
- `daily_tasks` - Daily structured learning tasks
- `career_roadmap_templates` - Career path templates

### Evaluation & Feedback

- `normalized_questions` - Unified question format
- `evaluation_results` - Unified evaluation results
- `learning_validations` - Skill validation attempts
- `plugin_registry` - Pluggable evaluation system
- `roadmap_feedback` - User feedback on plans

### Mistake Tracking

- `mistake_catalog` - Common mistake patterns
- `user_mistakes_log` - User-specific mistake tracking

---

## Voice Interview System (6 tables)

### Interview Management

- `interview_sessions` - Voice interview sessions (topic/role-based)
- `interview_turns` - Individual Q&A turns
- `interview_templates` - Question templates
- `interview_analytics` - Performance analytics

### AI Provider Management

- `ai_voice_providers` - STT/TTS/LLM provider registry
- `audio_transcripts` - Raw STT transcripts

**Key Features:**

- Topic-based interviews (DSA, DP, etc.)
- Role-based interviews (job description matching)
- Real-time voice interaction
- AI-powered evaluation
- Pluggable provider system

---

## Course Management (4 tables)

### Course System

- `courses` - Course catalog
- `course_skills` - Skills taught by courses
- `course_problems` - Problems in courses
- `course_submissions` - Course progress tracking

---

## User Progress & Analytics (3 tables)

### Progress Tracking

- `user_course_progress` - Course completion tracking
- `user_category_points` - Points by category
- `user_problem_points` - Problem-specific points

---

## Custom Types

```sql
-- Difficulty levels
CREATE TYPE difficulty_level AS ENUM (
    'cakewalk', 'easy', 'easymedium',
    'medium', 'mediumhard', 'hard'
);

-- Score levels
CREATE TYPE score_level AS ENUM (
    '10', '15', '20', '25', '30', '35'
);

-- Submission status
CREATE TYPE submission_status AS ENUM (
    'AC', 'WRONG ANSWER', 'TLE', 'RTE'
);
```

---

## Key Relationships

### User-Centric

```
users (1) → (1) learning_profiles
users (1) → (N) user_skills
users (1) → (N) user_goals
users (1) → (N) training_plans
users (1) → (N) interview_sessions
users (1) → (N) submissions
```

### Learning Flow

```
user_goals → training_plans → daily_tasks
training_plans → training_plan_items
daily_tasks → learning_validations
```

### Interview Flow

```
interview_sessions → interview_turns → audio_transcripts
interview_sessions → interview_analytics
```

### Course System

```
courses → course_skills
courses → course_problems → problem
users → user_course_progress → courses
```

---

## Views

### v_user_learning_summary

Comprehensive user learning statistics including weak/strong topics, streak, submissions, and points.

### v_user_skill_summary

User skills with proficiency labels: none/beginner/intermediate/advanced/expert.

### v_user_goal_progress

Goal progress tracking with skill completion percentages.

### user_interview_summary

Aggregated interview performance by user.

### recent_interview_sessions

Recent interviews with completion metrics.

### problem_skill_mapping

Automatic mapping of problems to skills based on categories.

---

## Functions & Triggers

### Auto-Creation Triggers

- **Users**: Creates learning profile on registration
- **Goals**: Auto-creates required skills when goal is set

### Timestamp Triggers

- Auto-updates `updated_at` on changes
- Auto-sets `completed_at` when goals complete

### Specialized Functions

- `auto_create_goal_skills()` - Creates skills from goal requirements
- `create_learning_profile_for_new_user()` - Initialize learning profile
- `update_*_timestamp()` - Various timestamp update functions

---

## Schema Evolution

### Version History

1. **Legacy System**: Basic problem & submission tracking
2. **Learning OS v1**: Added skills, goals, training plans
3. **Voice Interviews**: Full voice interview system
4. **Pluggable System**: Normalized questions & evaluation plugins
5. **Current (v4)**: Fully integrated AI learning platform

### Migration Strategy

- Maintains backward compatibility with legacy tables
- `normalized_questions.legacy_problem_id` links to old `problem` table
- `evaluation_results.legacy_submission_id` links to old `submissions`
- Gradual migration to normalized system

---

## Performance Optimizations

### Indexes (100+)

- All foreign keys indexed
- Common query patterns (user_id, dates, status)
- GIN indexes for JSONB and array columns
- Covering indexes for hot paths

### Query Optimization

- Materialized views for analytics
- JSONB for flexible schemas
- Efficient relationship modeling
- Proper constraint usage

---

## Security Features

### Access Control

- Row-level security ready
- User isolation via user_id
- Role-based permissions

### Data Protection

- Password hashing (application layer)
- Optional setting encryption (`system_settings.is_encrypted`)
- Cascade deletions for data cleanup

---

## Skill System

### Skill Levels (0-5)

- **0**: None - No knowledge
- **1**: Beginner - Basic understanding
- **2**: Intermediate - Working knowledge
- **3**: Advanced - Strong proficiency
- **4**: Expert - Mastery level
- **5**: Master - Teaching/mentoring level

### Confidence Levels (0-100)

User self-reported confidence in their skill level.

---

## Interview System Details

### Session Modes

- **Topic Mode**: Interview on specific topics (DSA, Dynamic Programming, etc.)
- **Role Mode**: Job description-based interview with resume matching

### Evaluation Verdicts

- Excellent (90-100)
- Good (75-89)
- Average (60-74)
- Poor (40-59)
- Failed (<40)

### Provider System

Pluggable providers for:

- **STT**: Speech-to-Text (Whisper, Google, etc.)
- **TTS**: Text-to-Speech (ElevenLabs, Azure, etc.)
- **LLM**: Interview questions & evaluation (OpenAI, Ollama, etc.)

---

## Data Integrity Rules

### Constraints

- UUID for distributed system compatibility
- JSONB validation via CHECK constraints
- Proper CASCADE rules for deletions
- Unique constraints on natural keys

### Referential Integrity

- All foreign keys properly defined
- ON DELETE CASCADE where appropriate
- ON DELETE SET NULL for optional references

---

## JSONB Schema Examples

### user_skills.metadata

```json
{
    "source_type": "course_completion",
    "source_id": "uuid",
    "validated": true,
    "last_practice": "2026-02-26"
}
```

### training_plans.plan_structure

```json
{
    "days": [
        {
            "day": 1,
            "focus": "Arrays",
            "questions": ["q1", "q2", "q3"]
        }
    ],
    "prerequisites": ["basic_programming"]
}
```

### interview_sessions.session_metadata

```json
{
    "interview_type": "technical",
    "position_level": "mid",
    "focus_areas": ["algorithms", "system_design"],
    "feedback_type": "detailed"
}
```

---

## Documentation Maintained By

**NeoCode Development Team**  
Last Updated: February 26, 2026  
Database Version: PostgreSQL 16.2  
Schema Version: 4.0

For detailed column information and complete SQL, see `schema.sql`
