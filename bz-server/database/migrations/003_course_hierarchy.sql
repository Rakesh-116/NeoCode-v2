/**
 * Course Hierarchy Migration
 * 
 * Extends the flat course structure with modules, topics, and flexible content.
 * Backward compatible with existing course_problems table.
 * 
 * Hierarchy: Course → Modules → Topics → Content
 * 
 * Features:
 * - Role-based module creation (admin can create all, user has limited scope)
 * - Default templates with custom submodule support
 * - Multiple content types (problem, pdf, video, markdown, code, quiz)
 * - Preserves existing course_problems integration
 */

-- ============================================================================
-- Course Modules Table
-- Represents major sections within a course (e.g., "Foundations", "Interviews")
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_modules (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    course_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_custom BOOLEAN DEFAULT FALSE,
    role_permission VARCHAR(20) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    
    CONSTRAINT fk_course_modules_course FOREIGN KEY (course_id) 
        REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_modules_created_by FOREIGN KEY (created_by) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT course_modules_role_permission_check 
        CHECK (role_permission IN ('admin', 'user', 'mentor')),
    CONSTRAINT course_modules_status_check 
        CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Indexes for performance
CREATE INDEX idx_course_modules_course_id ON public.course_modules(course_id);
CREATE INDEX idx_course_modules_display_order ON public.course_modules(course_id, display_order);
CREATE INDEX idx_course_modules_status ON public.course_modules(status);

-- Table comments
COMMENT ON TABLE public.course_modules IS 'Major sections within courses (e.g., Foundations, Interviews). Supports role-based creation.';
COMMENT ON COLUMN public.course_modules.is_default IS 'Whether this is a provided default module template';
COMMENT ON COLUMN public.course_modules.is_custom IS 'Whether this is a user-created custom submodule';
COMMENT ON COLUMN public.course_modules.role_permission IS 'Minimum role required to create this type of module';
COMMENT ON COLUMN public.course_modules.display_order IS 'Order in which modules appear in the course';

-- ============================================================================
-- Course Topics Table
-- Individual learning units within modules (e.g., "Processes", "Threads")
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_topics (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    module_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    estimated_duration_minutes INTEGER,
    difficulty_level INTEGER DEFAULT 2,
    is_prerequisite BOOLEAN DEFAULT FALSE,
    prerequisite_topics UUID[],
    created_by UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    
    CONSTRAINT fk_course_topics_module FOREIGN KEY (module_id) 
        REFERENCES public.course_modules(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_topics_created_by FOREIGN KEY (created_by) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT course_topics_difficulty_level_check 
        CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    CONSTRAINT course_topics_status_check 
        CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Indexes for performance
CREATE INDEX idx_course_topics_module_id ON public.course_topics(module_id);
CREATE INDEX idx_course_topics_display_order ON public.course_topics(module_id, display_order);
CREATE INDEX idx_course_topics_difficulty ON public.course_topics(difficulty_level);
CREATE INDEX idx_course_topics_status ON public.course_topics(status);

-- Table comments
COMMENT ON TABLE public.course_topics IS 'Individual learning units within modules';
COMMENT ON COLUMN public.course_topics.estimated_duration_minutes IS 'Expected time to complete this topic';
COMMENT ON COLUMN public.course_topics.difficulty_level IS 'Difficulty rating from 1 (easiest) to 5 (hardest)';
COMMENT ON COLUMN public.course_topics.prerequisite_topics IS 'Array of topic IDs that must be completed first';

-- ============================================================================
-- Course Content Table
-- Flexible content attached to topics (PDFs, videos, markdown, code, quizzes, problems)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_content (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    topic_id UUID NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    
    -- Content reference (varies by type)
    problem_id INTEGER,
    file_url TEXT,
    markdown_content TEXT,
    code_snippet TEXT,
    quiz_data JSONB,
    video_url TEXT,
    external_url TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    points INTEGER DEFAULT 0,
    is_mandatory BOOLEAN DEFAULT TRUE,
    estimated_duration_minutes INTEGER,
    
    -- Tracking
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    
    CONSTRAINT fk_course_content_topic FOREIGN KEY (topic_id) 
        REFERENCES public.course_topics(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_content_problem FOREIGN KEY (problem_id) 
        REFERENCES public.problem(id) ON DELETE SET NULL,
    CONSTRAINT fk_course_content_created_by FOREIGN KEY (created_by) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT course_content_type_check 
        CHECK (content_type IN ('problem', 'pdf', 'video', 'markdown', 'code', 'quiz', 'external_link'))
);

-- Indexes for performance
CREATE INDEX idx_course_content_topic_id ON public.course_content(topic_id);
CREATE INDEX idx_course_content_display_order ON public.course_content(topic_id, display_order);
CREATE INDEX idx_course_content_type ON public.course_content(content_type);
CREATE INDEX idx_course_content_problem_id ON public.course_content(problem_id) WHERE problem_id IS NOT NULL;

-- Table comments
COMMENT ON TABLE public.course_content IS 'Flexible content items attached to topics. Supports problems, PDFs, videos, markdown, code snippets, quizzes.';
COMMENT ON COLUMN public.course_content.content_type IS 'Type: problem, pdf, video, markdown, code, quiz, external_link';
COMMENT ON COLUMN public.course_content.problem_id IS 'For content_type=problem, links to existing problem table';
COMMENT ON COLUMN public.course_content.quiz_data IS 'JSON structure for quiz questions/answers';
COMMENT ON COLUMN public.course_content.metadata IS 'Flexible JSON for type-specific data (tags, language for code, etc.)';
COMMENT ON COLUMN public.course_content.points IS 'Points awarded for completing this content';

-- ============================================================================
-- Course Progress Tracking Table
-- Tracks user progress through modules, topics, and content
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_progress (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL,
    course_id UUID NOT NULL,
    module_id UUID,
    topic_id UUID,
    content_id UUID,
    
    -- Progress tracking
    status VARCHAR(20) DEFAULT 'not_started',
    completion_percentage INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    
    CONSTRAINT fk_course_progress_user FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_progress_course FOREIGN KEY (course_id) 
        REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_progress_module FOREIGN KEY (module_id) 
        REFERENCES public.course_modules(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_progress_topic FOREIGN KEY (topic_id) 
        REFERENCES public.course_topics(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_progress_content FOREIGN KEY (content_id) 
        REFERENCES public.course_content(id) ON DELETE CASCADE,
    CONSTRAINT course_progress_status_check 
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
    CONSTRAINT course_progress_completion_check 
        CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Unique constraint: one progress record per user per content
    CONSTRAINT unique_user_content_progress 
        UNIQUE (user_id, course_id, module_id, topic_id, content_id)
);

-- Indexes for performance
CREATE INDEX idx_course_progress_user_id ON public.course_progress(user_id);
CREATE INDEX idx_course_progress_course_id ON public.course_progress(course_id);
CREATE INDEX idx_course_progress_user_course ON public.course_progress(user_id, course_id);
CREATE INDEX idx_course_progress_status ON public.course_progress(status);

-- Table comments
COMMENT ON TABLE public.course_progress IS 'Tracks user progress through course hierarchy (modules, topics, content)';
COMMENT ON COLUMN public.course_progress.status IS 'Current status: not_started, in_progress, completed, skipped';
COMMENT ON COLUMN public.course_progress.completion_percentage IS 'Progress percentage for this specific item (0-100)';
COMMENT ON COLUMN public.course_progress.time_spent_minutes IS 'Total time user spent on this item';

-- ============================================================================
-- Backward Compatibility: Update course_problems table
-- Add optional topic_id to link existing problems to new hierarchy
-- ============================================================================
ALTER TABLE public.course_problems 
ADD COLUMN IF NOT EXISTS topic_id UUID,
ADD CONSTRAINT fk_course_problems_topic 
    FOREIGN KEY (topic_id) REFERENCES public.course_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_problems_topic_id ON public.course_problems(topic_id);

COMMENT ON COLUMN public.course_problems.topic_id IS 'Optional link to topic for hierarchical organization (backward compatible)';

-- ============================================================================
-- Helper View: Full Course Hierarchy
-- Provides denormalized view for easy querying
-- ============================================================================
CREATE OR REPLACE VIEW public.v_course_hierarchy AS
SELECT 
    c.id AS course_id,
    c.title AS course_title,
    c.category AS course_category,
    cm.id AS module_id,
    cm.title AS module_title,
    cm.display_order AS module_order,
    cm.is_default AS is_default_module,
    ct.id AS topic_id,
    ct.title AS topic_title,
    ct.display_order AS topic_order,
    ct.difficulty_level AS topic_difficulty,
    ct.estimated_duration_minutes AS topic_duration,
    cc.id AS content_id,
    cc.content_type,
    cc.title AS content_title,
    cc.display_order AS content_order,
    cc.problem_id,
    cc.points AS content_points,
    cc.is_mandatory
FROM public.courses c
LEFT JOIN public.course_modules cm ON cm.course_id = c.id
LEFT JOIN public.course_topics ct ON ct.module_id = cm.id
LEFT JOIN public.course_content cc ON cc.topic_id = ct.id
WHERE cm.status = 'active' 
  AND ct.status = 'active'
ORDER BY c.title, cm.display_order, ct.display_order, cc.display_order;

COMMENT ON VIEW public.v_course_hierarchy IS 'Denormalized view of complete course hierarchy for easy querying';

-- ============================================================================
-- Grant permissions (assuming standard role setup)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_topics TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_content TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_progress TO postgres;
GRANT SELECT ON public.v_course_hierarchy TO postgres;
