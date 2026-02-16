Users Table
CREATE TABLE Users (
id UUID PRIMARY KEY,
username VARCHAR(50) NOT NULL UNIQUE,
password TEXT NOT NULL,
email VARCHAR(100) NOT NULL UNIQUE,
role ENUM('user', 'admin') DEFAULT 'user',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Problem Table
CREATE TABLE Problem (
id SERIAL PRIMARY KEY,
title VARCHAR(255) NOT NULL,
description TEXT NOT NULL,
input_format TEXT NOT NULL,
output_format TEXT NOT NULL,
constraints VARCHAR(255),
prohibited_keys JSONB,
sample_testcase JSONB,
explaination TEXT DEFAULT 'Self Explainary',
no_of_submissions INT DEFAULT 0,
hidden BOOLEAN DEFAULT FALSE,
difficulty difficulty_level NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by UUID REFERENCES Users(id) ON DELETE CASCADE,
score score_level DEFAULT '10',
category VARCHAR(100),
solution TEXT,
solution_language VARCHAR(100)
);

Default Code Table
CREATE TABLE defaultCode (
id SERIAL PRIMARY KEY,
code TEXT NOT NULL,
problem_id INT REFERENCES Problem(id) ON DELETE CASCADE,
language VARCHAR(100) NOT NULL
);

Programming Languages Table
CREATE TABLE language (
id SERIAL PRIMARY KEY,
name VARCHAR(100) UNIQUE NOT NULL
);

Testcases Table
CREATE TABLE testcases (
id SERIAL PRIMARY KEY,
testcase JSONB NOT NULL,
problem_id INT REFERENCES Problem(id) ON DELETE CASCADE
);

Submissions Table
CREATE TABLE submissions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
problem_id INT REFERENCES Problem(id) ON DELETE CASCADE,
user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
code TEXT NOT NULL,
language VARCHAR(100) NOT NULL,
test_results JSONB NOT NULL,
verdict VARCHAR(50) NOT NULL,
submission_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
execution_time VARCHAR(255) NOT NULL,
course_id UUID REFERENCES courses(id) ON DELETE SET NULL DEFAULT NULL
);

Saved Snippets Table
CREATE TABLE savedSnippets(
id UUID PRIMARY KEY,
user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
code TEXT NOT NULL,
explanation TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Blog Table
CREATE TABLE Blog (
id UUID PRIMARY KEY,
title TEXT NOT NULL,
tags TEXT[],
description TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
created_by UUID REFERENCES Users(id),
updated_at TIMESTAMPTZ DEFAULT NOW(),
updated_by UUID REFERENCES Users(id),
visible BOOLEAN DEFAULT TRUE
);

CREATE TABLE courses (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
title VARCHAR(255) NOT NULL,
category VARCHAR(50) NOT NULL, -- corresponds to problem.category
description TEXT,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE course_problems (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
problem_id integer REFERENCES problem(id) ON DELETE CASCADE,
points INT NOT NULL, -- points earned for this problem (calculated by difficulty)
visibility VARCHAR(20) DEFAULT 'course_only', -- course_only | public | contest
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_course_progress (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
solved_problems INT DEFAULT 0, -- total solved
total_problems INT DEFAULT 0, -- cached total problems
course_points INT DEFAULT 0, -- cumulative points from solved problems
full_completion BOOLEAN DEFAULT FALSE, -- TRUE if all course problems solved
last_solved_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE course_submissions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
problem_id integer REFERENCES problem(id) ON DELETE CASCADE,
submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
points_earned INT DEFAULT 0,
solved_at TIMESTAMP DEFAULT NOW(),
UNIQUE(user_id, course_id, problem_id) -- One solution per problem per course
);

Tracks how many points a user has per category.
CREATE TABLE user_category_points (
id SERIAL PRIMARY KEY,
user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
category VARCHAR(100) NOT NULL,
total_points INT DEFAULT 0,
problems_solved INT DEFAULT 0,
last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
UNIQUE (user_id, category)
);

Tracks which problems have already awarded category points.
CREATE TABLE user_problem_points (
id SERIAL PRIMARY KEY,
user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
problem_id INT REFERENCES Problem(id) ON DELETE CASCADE,
points_awarded INT DEFAULT 0,
awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
UNIQUE (user_id, problem_id)
);

-- ============================================================================
-- LEARNING OS TABLES (Added Feb 2026)
-- ============================================================================

-- Store users' learning profile (deterministic memory system)
CREATE TABLE learning_profiles (
user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
weak_topics JSONB DEFAULT '{}'::jsonb,
strong_topics JSONB DEFAULT '{}'::jsonb,
mistake_patterns JSONB DEFAULT '{}'::jsonb,
learning_style JSONB DEFAULT '{}'::jsonb,
last_recommendation JSONB,
training_preferences JSONB DEFAULT '{"focus_areas": [], "daily_target": 3, "difficulty_preference": "mixed"}'::jsonb,
total_learning_sessions INTEGER DEFAULT 0,
streak_days INTEGER DEFAULT 0,
last_active_date DATE,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_profiles_last_active ON learning_profiles(last_active_date);
CREATE INDEX idx_learning_profiles_streak ON learning_profiles(streak_days DESC);

-- Store evaluation results from plugin system
CREATE TABLE evaluation_results (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
evaluation_type VARCHAR(50) NOT NULL,
plugin_version VARCHAR(20) DEFAULT '1.0.0',
question_id TEXT NOT NULL, -- TEXT to support both integer and UUID
question_source VARCHAR(50),
verdict VARCHAR(50) NOT NULL,
score NUMERIC(5,2),
evaluation_data JSONB,
detected_mistakes JSONB,
user_failure_reason TEXT,
user_confidence_level INTEGER,
time_spent_seconds INTEGER,
hints_used INTEGER DEFAULT 0,
attempts_count INTEGER DEFAULT 1,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evaluation_results_user_id ON evaluation_results(user_id);
CREATE INDEX idx_evaluation_results_question_id ON evaluation_results(question_id);
CREATE INDEX idx_evaluation_results_verdict ON evaluation_results(verdict);

-- Normalized question format (unified across different sources)
CREATE TABLE normalized_questions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
question_type VARCHAR(50) NOT NULL,
source VARCHAR(50) NOT NULL,
source_id VARCHAR(255),
title VARCHAR(500) NOT NULL,
statement TEXT NOT NULL,
difficulty VARCHAR(20),
topics TEXT[] NOT NULL,
primary_topic VARCHAR(100),
question_data JSONB NOT NULL,
estimated_time_minutes INTEGER,
difficulty_score NUMERIC(5,2),
success_rate NUMERIC(5,2),
is_active BOOLEAN DEFAULT true,
visibility VARCHAR(20) DEFAULT 'public',
legacy_problem_id INTEGER REFERENCES problem(id) ON DELETE SET NULL,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_normalized_questions_type ON normalized_questions(question_type);
CREATE INDEX idx_normalized_questions_source ON normalized_questions(source);
CREATE INDEX idx_normalized_questions_difficulty ON normalized_questions(difficulty);
CREATE INDEX idx_normalized_questions_primary_topic ON normalized_questions(primary_topic);
CREATE INDEX idx_normalized_questions_topics ON normalized_questions USING GIN(topics);

-- Catalog of known mistake types
CREATE TABLE mistake_catalog (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
mistake_type VARCHAR(100) UNIQUE NOT NULL,
category VARCHAR(50) NOT NULL,
name VARCHAR(255) NOT NULL,
description TEXT NOT NULL,
detection_rules JSONB,
explanation TEXT,
fix_strategy TEXT,
example_correct_code TEXT,
related_concepts TEXT[],
severity INTEGER CHECK (severity >= 1 AND severity <= 5),
occurrence_count INTEGER DEFAULT 0,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mistake_catalog_type ON mistake_catalog(mistake_type);
CREATE INDEX idx_mistake_catalog_category ON mistake_catalog(category);

-- Log of user mistakes per evaluation
CREATE TABLE user_mistakes_log (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
evaluation_result_id UUID REFERENCES evaluation_results(id) ON DELETE CASCADE,
mistake_type VARCHAR(100) NOT NULL,
question_id TEXT NOT NULL, -- TEXT to support both integer and UUID
topic VARCHAR(100),
difficulty VARCHAR(20),
occurrence_count INTEGER DEFAULT 1,
severity INTEGER,
resolved BOOLEAN DEFAULT false,
resolved_at TIMESTAMP,
notes TEXT,
detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_mistakes_log_user_id ON user_mistakes_log(user_id);
CREATE INDEX idx_user_mistakes_log_mistake_type ON user_mistakes_log(mistake_type);
CREATE INDEX idx_user_mistakes_log_resolved ON user_mistakes_log(resolved);

-- Training plans generated for users
CREATE TABLE training_plans (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
plan_name VARCHAR(255) NOT NULL,
plan_type VARCHAR(50) NOT NULL,
plan_structure JSONB NOT NULL,
current_day INTEGER DEFAULT 1,
total_days INTEGER NOT NULL,
completed_questions TEXT[] DEFAULT '{}', -- TEXT array to support both integer and UUID
generation_method VARCHAR(50) NOT NULL,
generation_metadata JSONB,
status VARCHAR(20) DEFAULT 'active',
started_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP,
last_activity_at TIMESTAMP DEFAULT NOW(),
created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_plans_user_id ON training_plans(user_id);
CREATE INDEX idx_training_plans_status ON training_plans(status);

-- Individual items in training plans
CREATE TABLE training_plan_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
question_id TEXT NOT NULL, -- TEXT to support both integer and UUID
day_number INTEGER NOT NULL,
order_in_day INTEGER NOT NULL,
is_completed BOOLEAN DEFAULT false,
completed_at TIMESTAMP,
attempts INTEGER DEFAULT 0
);

CREATE INDEX idx_training_plan_items_plan_id ON training_plan_items(plan_id);
CREATE INDEX idx_training_plan_items_question_id ON training_plan_items(question_id);

-- Plugin registry for evaluation system
CREATE TABLE plugin_registry (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
plugin_name VARCHAR(100) UNIQUE NOT NULL,
plugin_type VARCHAR(50) NOT NULL,
version VARCHAR(20) NOT NULL,
description TEXT,
supported_question_types TEXT[],
config_schema JSONB,
default_config JSONB,
is_enabled BOOLEAN DEFAULT true,
is_beta BOOLEAN DEFAULT false,
maintainer VARCHAR(255),
documentation_url TEXT,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);
