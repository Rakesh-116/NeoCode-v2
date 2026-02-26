--
-- PostgreSQL database dump
--

-- Dumped from database version 16.2
-- Dumped by pg_dump version 16.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: difficulty_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.difficulty_level AS ENUM (
    'cakewalk',
    'easy',
    'easymedium',
    'medium',
    'mediumhard',
    'hard'
);


ALTER TYPE public.difficulty_level OWNER TO postgres;

--
-- Name: score_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.score_level AS ENUM (
    '10',
    '15',
    '20',
    '25',
    '30',
    '35'
);


ALTER TYPE public.score_level OWNER TO postgres;

--
-- Name: submission_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.submission_status AS ENUM (
    'AC',
    'WRONG ANSWER',
    'TLE',
    'RTE'
);


ALTER TYPE public.submission_status OWNER TO postgres;

--
-- Name: auto_create_goal_skills(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_create_goal_skills() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    skill_record JSONB;
BEGIN
    -- Loop through required_skills and ensure they exist in user_skills
    FOR skill_record IN SELECT * FROM jsonb_array_elements(NEW.required_skills)
    LOOP
        INSERT INTO user_skills (user_id, skill_name, level, source)
        VALUES (
            NEW.user_id,
            skill_record->>'skill',
            0,
            'goal_requirement'
        )
        ON CONFLICT (user_id, skill_name) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_create_goal_skills() OWNER TO postgres;

--
-- Name: create_learning_profile_for_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_learning_profile_for_new_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO learning_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_learning_profile_for_new_user() OWNER TO postgres;

--
-- Name: update_interview_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_interview_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_interview_timestamp() OWNER TO postgres;

--
-- Name: update_learning_profile_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_learning_profile_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_learning_profile_timestamp() OWNER TO postgres;

--
-- Name: update_user_goals_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_goals_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_user_goals_timestamp() OWNER TO postgres;

--
-- Name: update_user_skills_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_skills_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_user_skills_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_voice_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_voice_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type character varying(50) NOT NULL,
    provider_name character varying(100) NOT NULL,
    version character varying(20) DEFAULT '1.0.0'::character varying,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    priority integer DEFAULT 1,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT ai_voice_providers_provider_type_check CHECK (((provider_type)::text = ANY ((ARRAY['stt'::character varying, 'tts'::character varying, 'llm_interview'::character varying])::text[])))
);


ALTER TABLE public.ai_voice_providers OWNER TO postgres;

--
-- Name: TABLE ai_voice_providers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ai_voice_providers IS 'Registry for pluggable STT, TTS, and interview LLM providers';


--
-- Name: COLUMN ai_voice_providers.provider_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_voice_providers.provider_type IS 'Type: stt (speech-to-text), tts (text-to-speech), llm_interview';


--
-- Name: COLUMN ai_voice_providers.is_default; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_voice_providers.is_default IS 'Whether this is the default provider for its type';


--
-- Name: audio_transcripts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audio_transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    turn_id uuid,
    audio_type character varying(20),
    raw_transcript text NOT NULL,
    confidence_score numeric(5,2),
    language character varying(10) DEFAULT 'en'::character varying,
    provider_name character varying(100),
    provider_version character varying(20),
    audio_duration_seconds numeric(6,2),
    audio_format character varying(20),
    audio_size_bytes integer,
    segments jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT audio_transcripts_audio_type_check CHECK (((audio_type)::text = ANY ((ARRAY['question'::character varying, 'answer'::character varying])::text[])))
);


ALTER TABLE public.audio_transcripts OWNER TO postgres;

--
-- Name: TABLE audio_transcripts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audio_transcripts IS 'Raw STT transcripts for quality tracking and debugging';


--
-- Name: blog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog (
    id uuid NOT NULL,
    title text NOT NULL,
    tags text[],
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    visible boolean DEFAULT true
);


ALTER TABLE public.blog OWNER TO postgres;

--
-- Name: career_roadmap_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.career_roadmap_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(100) NOT NULL,
    display_name character varying(200) NOT NULL,
    description text,
    required_skills jsonb NOT NULL,
    prerequisite_order text[],
    estimated_weeks integer,
    difficulty_level integer,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT career_roadmap_templates_difficulty_level_check CHECK (((difficulty_level >= 1) AND (difficulty_level <= 5)))
);


ALTER TABLE public.career_roadmap_templates OWNER TO postgres;

--
-- Name: course_problems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_problems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    problem_id integer,
    points integer NOT NULL,
    visibility character varying(20) DEFAULT 'course_only'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.course_problems OWNER TO postgres;

--
-- Name: course_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    skill_weight integer DEFAULT 1,
    target_level integer DEFAULT 2,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT course_skills_skill_weight_check CHECK (((skill_weight >= 1) AND (skill_weight <= 10))),
    CONSTRAINT course_skills_target_level_check CHECK (((target_level >= 1) AND (target_level <= 5)))
);


ALTER TABLE public.course_skills OWNER TO postgres;

--
-- Name: TABLE course_skills; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.course_skills IS 'Maps courses to skills they teach with target proficiency levels';


--
-- Name: COLUMN course_skills.skill_weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.course_skills.skill_weight IS 'Importance of this skill in the course (1-10)';


--
-- Name: COLUMN course_skills.target_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.course_skills.target_level IS 'Expected skill level after course completion (1-5)';


--
-- Name: course_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    course_id uuid,
    problem_id integer,
    submission_id uuid,
    points_earned integer DEFAULT 0,
    solved_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.course_submissions OWNER TO postgres;

--
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- Name: daily_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    task_date date NOT NULL,
    task_order integer DEFAULT 1,
    task_type character varying(50) NOT NULL,
    title text NOT NULL,
    description text,
    resource_url text,
    reference_id text,
    estimated_duration_minutes integer,
    skill_focus character varying(100),
    difficulty_level integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    completed_at timestamp without time zone,
    validation_required boolean DEFAULT false,
    validation_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT daily_tasks_difficulty_level_check CHECK (((difficulty_level >= 1) AND (difficulty_level <= 5)))
);


ALTER TABLE public.daily_tasks OWNER TO postgres;

--
-- Name: TABLE daily_tasks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.daily_tasks IS 'Daily structured learning tasks for users';


--
-- Name: evaluation_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    evaluation_type character varying(50) NOT NULL,
    plugin_version character varying(20) DEFAULT '1.0.0'::character varying,
    question_id text NOT NULL,
    question_source character varying(50),
    verdict character varying(50) NOT NULL,
    score numeric(5,2),
    evaluation_data jsonb NOT NULL,
    detected_mistakes jsonb DEFAULT '[]'::jsonb,
    user_failure_reason text,
    user_confidence_level integer,
    time_spent_seconds integer,
    hints_used integer DEFAULT 0,
    attempts_count integer DEFAULT 1,
    submitted_at timestamp without time zone DEFAULT now(),
    legacy_submission_id uuid,
    CONSTRAINT evaluation_results_user_confidence_level_check CHECK (((user_confidence_level >= 1) AND (user_confidence_level <= 5)))
);


ALTER TABLE public.evaluation_results OWNER TO postgres;

--
-- Name: COLUMN evaluation_results.question_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.evaluation_results.question_id IS 'Question identifier - supports both integer (legacy) and UUID (normalized) formats';


--
-- Name: interview_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_type character varying(20),
    period_start date,
    period_end date,
    total_sessions integer DEFAULT 0,
    completed_sessions integer DEFAULT 0,
    average_session_duration_minutes integer DEFAULT 0,
    average_score numeric(5,2) DEFAULT 0,
    total_questions_answered integer DEFAULT 0,
    excellent_answers integer DEFAULT 0,
    good_answers integer DEFAULT 0,
    average_answers integer DEFAULT 0,
    poor_answers integer DEFAULT 0,
    topic_scores jsonb DEFAULT '{}'::jsonb,
    weak_areas text[] DEFAULT '{}'::text[],
    strong_areas text[] DEFAULT '{}'::text[],
    common_mistakes jsonb DEFAULT '[]'::jsonb,
    last_calculated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT interview_analytics_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'all_time'::character varying])::text[])))
);


ALTER TABLE public.interview_analytics OWNER TO postgres;

--
-- Name: TABLE interview_analytics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interview_analytics IS 'Aggregated interview performance analytics';


--
-- Name: interview_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_mode character varying(50) NOT NULL,
    topic character varying(100),
    difficulty character varying(20),
    target_role character varying(100),
    job_description text,
    resume_text text,
    total_questions integer DEFAULT 0,
    current_question_number integer DEFAULT 0,
    overall_score numeric(5,2) DEFAULT 0,
    stt_provider character varying(100),
    tts_provider character varying(100),
    llm_provider character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    session_metadata jsonb DEFAULT '{}'::jsonb,
    started_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone,
    duration_seconds integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    target_questions integer DEFAULT 5,
    CONSTRAINT interview_sessions_difficulty_check CHECK (((difficulty)::text = ANY ((ARRAY['easy'::character varying, 'medium'::character varying, 'hard'::character varying])::text[]))),
    CONSTRAINT interview_sessions_session_mode_check CHECK (((session_mode)::text = ANY ((ARRAY['topic'::character varying, 'role'::character varying])::text[]))),
    CONSTRAINT interview_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'abandoned'::character varying])::text[]))),
    CONSTRAINT interview_sessions_target_questions_check CHECK (((target_questions >= 1) AND (target_questions <= 20)))
);


ALTER TABLE public.interview_sessions OWNER TO postgres;

--
-- Name: TABLE interview_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interview_sessions IS 'Voice interview sessions with topic or role-based modes';


--
-- Name: COLUMN interview_sessions.session_mode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.interview_sessions.session_mode IS 'Interview type: topic (DSA, DP, etc.) or role (job description based)';


--
-- Name: COLUMN interview_sessions.target_questions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.interview_sessions.target_questions IS 'User-selected number of questions for this interview (1-20)';


--
-- Name: interview_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_type character varying(50) NOT NULL,
    template_name character varying(255) NOT NULL,
    topic character varying(100),
    skill_name character varying(100),
    target_role character varying(100),
    question_pool jsonb NOT NULL,
    evaluation_criteria jsonb DEFAULT '{}'::jsonb,
    difficulty_distribution jsonb DEFAULT '{"easy": 0.3, "hard": 0.2, "medium": 0.5}'::jsonb,
    total_questions integer DEFAULT 0,
    average_duration_minutes integer DEFAULT 30,
    is_active boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT interview_templates_template_type_check CHECK (((template_type)::text = ANY ((ARRAY['topic'::character varying, 'role'::character varying])::text[])))
);


ALTER TABLE public.interview_templates OWNER TO postgres;

--
-- Name: TABLE interview_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interview_templates IS 'Question templates for topic and role-based interviews';


--
-- Name: COLUMN interview_templates.question_pool; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.interview_templates.question_pool IS 'Array of question objects with difficulty, type, etc.';


--
-- Name: interview_turns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    turn_number integer NOT NULL,
    question_text text NOT NULL,
    question_type character varying(50),
    question_difficulty character varying(20),
    question_audio_url text,
    question_generated_at timestamp without time zone DEFAULT now(),
    user_answer_text text,
    user_answer_audio_url text,
    transcription_confidence numeric(5,2),
    time_to_answer_seconds integer,
    score integer,
    verdict character varying(20),
    feedback text,
    detected_mistakes jsonb DEFAULT '[]'::jsonb,
    follow_up_suggested boolean DEFAULT false,
    stt_metadata jsonb DEFAULT '{}'::jsonb,
    llm_metadata jsonb DEFAULT '{}'::jsonb,
    tts_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT interview_turns_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT interview_turns_verdict_check CHECK (((verdict)::text = ANY ((ARRAY['excellent'::character varying, 'good'::character varying, 'average'::character varying, 'poor'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.interview_turns OWNER TO postgres;

--
-- Name: TABLE interview_turns; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interview_turns IS 'Individual question-answer turns in voice interviews';


--
-- Name: COLUMN interview_turns.transcription_confidence; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.interview_turns.transcription_confidence IS 'STT confidence score 0-100';


--
-- Name: learning_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_profiles (
    user_id uuid NOT NULL,
    weak_topics jsonb DEFAULT '{}'::jsonb,
    strong_topics jsonb DEFAULT '{}'::jsonb,
    mistake_patterns jsonb DEFAULT '{}'::jsonb,
    learning_style jsonb DEFAULT '{}'::jsonb,
    last_recommendation jsonb,
    training_preferences jsonb DEFAULT '{"focus_areas": [], "daily_target": 3, "difficulty_preference": "mixed"}'::jsonb,
    total_learning_sessions integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    last_active_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.learning_profiles OWNER TO postgres;

--
-- Name: learning_validations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_validations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    validation_type character varying(50) NOT NULL,
    reference_id text,
    score integer,
    passing_score integer DEFAULT 70,
    passed boolean DEFAULT false,
    attempt_number integer DEFAULT 1,
    time_spent_seconds integer,
    feedback text,
    metadata jsonb DEFAULT '{}'::jsonb,
    validated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT learning_validations_score_check CHECK (((score >= 0) AND (score <= 100)))
);


ALTER TABLE public.learning_validations OWNER TO postgres;

--
-- Name: TABLE learning_validations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.learning_validations IS 'Validation attempts for skill level progression';


--
-- Name: COLUMN learning_validations.validation_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.learning_validations.validation_type IS 'Type of validation performed';


--
-- Name: COLUMN learning_validations.passed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.learning_validations.passed IS 'Whether validation was successful';


--
-- Name: mistake_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mistake_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mistake_type character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    detection_rules jsonb,
    explanation text,
    fix_strategy text,
    example_correct_code text,
    related_concepts text[],
    severity integer,
    occurrence_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT mistake_catalog_severity_check CHECK (((severity >= 1) AND (severity <= 5)))
);


ALTER TABLE public.mistake_catalog OWNER TO postgres;

--
-- Name: normalized_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.normalized_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_type character varying(50) NOT NULL,
    source character varying(50) NOT NULL,
    source_id character varying(255),
    title character varying(500) NOT NULL,
    statement text NOT NULL,
    difficulty character varying(20),
    topics text[] NOT NULL,
    primary_topic character varying(100),
    question_data jsonb NOT NULL,
    estimated_time_minutes integer,
    difficulty_score numeric(5,2),
    success_rate numeric(5,2),
    is_active boolean DEFAULT true,
    visibility character varying(20) DEFAULT 'public'::character varying,
    legacy_problem_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.normalized_questions OWNER TO postgres;

--
-- Name: plugin_registry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plugin_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plugin_name character varying(100) NOT NULL,
    plugin_type character varying(50) NOT NULL,
    version character varying(20) NOT NULL,
    description text,
    supported_question_types text[],
    config_schema jsonb,
    default_config jsonb,
    is_enabled boolean DEFAULT true,
    is_beta boolean DEFAULT false,
    maintainer character varying(255),
    documentation_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.plugin_registry OWNER TO postgres;

--
-- Name: problem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    input_format text NOT NULL,
    output_format text NOT NULL,
    constraints character varying(255),
    sample_testcase jsonb,
    explaination text DEFAULT 'Self Explainary'::text,
    no_of_submissions integer DEFAULT 0,
    hidden boolean DEFAULT false,
    difficulty public.difficulty_level NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    score public.score_level DEFAULT '10'::public.score_level,
    prohibited_keys jsonb,
    category text[],
    solution text,
    solution_language character varying(255)
);


ALTER TABLE public.problem OWNER TO postgres;

--
-- Name: problem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.problem_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.problem_id_seq OWNER TO postgres;

--
-- Name: problem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.problem_id_seq OWNED BY public.problem.id;


--
-- Name: problem_skill_mapping; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.problem_skill_mapping AS
 SELECT id AS problem_id,
    category AS original_category,
        CASE
            WHEN ((category)::text ~~* '%array%'::text) THEN 'Arrays'::text
            WHEN ((category)::text ~~* '%sort%'::text) THEN 'Sorting'::text
            WHEN ((category)::text ~~* '%hash%'::text) THEN 'Hashing'::text
            WHEN ((category)::text ~~* '%tree%'::text) THEN 'Trees'::text
            WHEN ((category)::text ~~* '%graph%'::text) THEN 'Graphs'::text
            WHEN (((category)::text ~~* '%dp%'::text) OR ((category)::text ~~* '%dynamic%'::text)) THEN 'Dynamic Programming'::text
            WHEN ((category)::text ~~* '%greedy%'::text) THEN 'Greedy Algorithms'::text
            WHEN ((category)::text ~~* '%recurs%'::text) THEN 'Recursion'::text
            ELSE 'DSA'::text
        END AS skill_name
   FROM public.problem p;


ALTER VIEW public.problem_skill_mapping OWNER TO postgres;

--
-- Name: recent_interview_sessions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.recent_interview_sessions AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS user_id,
    NULL::character varying(255) AS username,
    NULL::character varying(50) AS session_mode,
    NULL::character varying(100) AS topic,
    NULL::character varying(100) AS target_role,
    NULL::integer AS total_questions,
    NULL::numeric(5,2) AS overall_score,
    NULL::character varying(20) AS status,
    NULL::integer AS duration_seconds,
    NULL::timestamp without time zone AS started_at,
    NULL::bigint AS turns_completed,
    NULL::numeric AS avg_turn_score;


ALTER VIEW public.recent_interview_sessions OWNER TO postgres;

--
-- Name: VIEW recent_interview_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.recent_interview_sessions IS 'Recent interview sessions with completion metrics';


--
-- Name: roadmap_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roadmap_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    question_id text,
    difficulty_rating integer,
    usefulness_rating integer,
    clarity_rating integer,
    feedback_text text,
    suggested_improvement text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT roadmap_feedback_clarity_rating_check CHECK (((clarity_rating >= 1) AND (clarity_rating <= 5))),
    CONSTRAINT roadmap_feedback_difficulty_rating_check CHECK (((difficulty_rating >= 1) AND (difficulty_rating <= 5))),
    CONSTRAINT roadmap_feedback_usefulness_rating_check CHECK (((usefulness_rating >= 1) AND (usefulness_rating <= 5)))
);


ALTER TABLE public.roadmap_feedback OWNER TO postgres;

--
-- Name: TABLE roadmap_feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roadmap_feedback IS 'User feedback on learning plans and recommendations';


--
-- Name: COLUMN roadmap_feedback.difficulty_rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roadmap_feedback.difficulty_rating IS '1=Too Easy, 2=Easy, 3=Just Right, 4=Hard, 5=Too Hard';


--
-- Name: COLUMN roadmap_feedback.usefulness_rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roadmap_feedback.usefulness_rating IS '1=Not Useful, 5=Very Useful';


--
-- Name: savedsnippets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.savedsnippets (
    id uuid NOT NULL,
    user_id uuid,
    code text NOT NULL,
    explanation text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title text NOT NULL,
    language text NOT NULL
);


ALTER TABLE public.savedsnippets OWNER TO postgres;

--
-- Name: skill_assessment_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skill_assessment_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    score integer,
    passed boolean DEFAULT false,
    time_spent_seconds integer,
    answers jsonb,
    analysis jsonb,
    recommended_level integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT skill_assessment_results_score_check CHECK (((score >= 0) AND (score <= 100)))
);


ALTER TABLE public.skill_assessment_results OWNER TO postgres;

--
-- Name: TABLE skill_assessment_results; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.skill_assessment_results IS 'User performance on skill assessments';


--
-- Name: skill_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skill_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_name character varying(100) NOT NULL,
    assessment_name character varying(200) NOT NULL,
    assessment_type character varying(50) DEFAULT 'quiz'::character varying,
    difficulty_level integer,
    questions jsonb NOT NULL,
    passing_score integer DEFAULT 70,
    time_limit_minutes integer,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT skill_assessments_difficulty_level_check CHECK (((difficulty_level >= 1) AND (difficulty_level <= 5)))
);


ALTER TABLE public.skill_assessments OWNER TO postgres;

--
-- Name: TABLE skill_assessments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.skill_assessments IS 'Assessment templates for skill evaluation';


--
-- Name: skill_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skill_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_name character varying(100) NOT NULL,
    display_name character varying(200) NOT NULL,
    category character varying(50),
    description text,
    prerequisites text[],
    learning_resources jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.skill_catalog OWNER TO postgres;

--
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissions (
    id uuid NOT NULL,
    problem_id integer,
    user_id uuid,
    code text NOT NULL,
    language character varying(100) NOT NULL,
    test_results jsonb NOT NULL,
    verdict text NOT NULL,
    submission_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    execution_time character varying(255) NOT NULL,
    course_id uuid,
    user_failure_reason text,
    user_confidence_level integer,
    time_spent_seconds integer,
    hints_used integer DEFAULT 0,
    detected_mistakes jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT submissions_user_confidence_level_check CHECK (((user_confidence_level >= 1) AND (user_confidence_level <= 5)))
);


ALTER TABLE public.submissions OWNER TO postgres;

--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissions_id_seq OWNER TO postgres;

--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    category character varying(50) NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    data_type character varying(10) DEFAULT 'string'::character varying,
    description text,
    is_encrypted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_settings_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['string'::character varying, 'json'::character varying, 'boolean'::character varying, 'number'::character varying])::text[])))
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: testcases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.testcases (
    id uuid NOT NULL,
    testcase jsonb NOT NULL,
    problem_id integer
);


ALTER TABLE public.testcases OWNER TO postgres;

--
-- Name: training_plan_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    question_id text NOT NULL,
    day_number integer NOT NULL,
    order_in_day integer NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    attempts integer DEFAULT 0
);


ALTER TABLE public.training_plan_items OWNER TO postgres;

--
-- Name: training_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_name character varying(255) NOT NULL,
    plan_type character varying(50) NOT NULL,
    plan_structure jsonb NOT NULL,
    current_day integer DEFAULT 1,
    total_days integer NOT NULL,
    completed_questions text[] DEFAULT '{}'::uuid[],
    generation_method character varying(50) NOT NULL,
    generation_metadata jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    started_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    last_activity_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    version integer DEFAULT 1,
    parent_plan_id uuid,
    goal_id uuid,
    is_active boolean DEFAULT true
);


ALTER TABLE public.training_plans OWNER TO postgres;

--
-- Name: TABLE training_plans; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.training_plans IS 'User training plans with flexible question ID support (integer or UUID)';


--
-- Name: COLUMN training_plans.completed_questions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.training_plans.completed_questions IS 'Array of completed question IDs (supports both integer and UUID as text)';


--
-- Name: user_category_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_category_points (
    id integer NOT NULL,
    user_id uuid,
    category character varying(100) NOT NULL,
    total_points integer DEFAULT 0,
    problems_solved integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_category_points OWNER TO postgres;

--
-- Name: user_category_points_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_category_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_category_points_id_seq OWNER TO postgres;

--
-- Name: user_category_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_category_points_id_seq OWNED BY public.user_category_points.id;


--
-- Name: user_course_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_course_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    course_id uuid,
    solved_problems integer DEFAULT 0,
    total_problems integer DEFAULT 0,
    course_points integer DEFAULT 0,
    full_completion boolean DEFAULT false,
    last_solved_at timestamp without time zone DEFAULT now(),
    skills_gained jsonb DEFAULT '[]'::jsonb,
    last_skill_update timestamp without time zone
);


ALTER TABLE public.user_course_progress OWNER TO postgres;

--
-- Name: user_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal_type character varying(50) DEFAULT 'career'::character varying NOT NULL,
    title text NOT NULL,
    description text,
    target_role character varying(100),
    required_skills jsonb DEFAULT '[]'::jsonb,
    deadline date,
    priority integer DEFAULT 1,
    status character varying(20) DEFAULT 'active'::character varying,
    progress integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    CONSTRAINT user_goals_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT user_goals_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


ALTER TABLE public.user_goals OWNER TO postgres;

--
-- Name: TABLE user_goals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_goals IS 'User career goals and learning objectives';


--
-- Name: COLUMN user_goals.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_goals.priority IS 'Goal priority: 1=Critical, 2=High, 3=Medium, 4=Low, 5=Someday';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: user_interview_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.user_interview_summary AS
 SELECT u.id AS user_id,
    u.username,
    count(DISTINCT is_sess.id) AS total_interviews,
    count(DISTINCT is_sess.id) FILTER (WHERE ((is_sess.status)::text = 'completed'::text)) AS completed_interviews,
    avg(is_sess.overall_score) AS avg_score,
    sum(is_sess.total_questions) AS total_questions_answered,
    max(is_sess.started_at) AS last_interview_date,
    array_agg(DISTINCT is_sess.topic) FILTER (WHERE (is_sess.topic IS NOT NULL)) AS topics_covered
   FROM (public.users u
     LEFT JOIN public.interview_sessions is_sess ON ((u.id = is_sess.user_id)))
  GROUP BY u.id, u.username;


ALTER VIEW public.user_interview_summary OWNER TO postgres;

--
-- Name: VIEW user_interview_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.user_interview_summary IS 'Aggregated interview statistics per user';


--
-- Name: user_mistakes_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_mistakes_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    evaluation_result_id uuid,
    mistake_type character varying(100) NOT NULL,
    question_id text NOT NULL,
    topic character varying(100),
    difficulty character varying(20),
    occurrence_count integer DEFAULT 1,
    severity integer,
    resolved boolean DEFAULT false,
    resolved_at timestamp without time zone,
    notes text,
    detected_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_mistakes_log OWNER TO postgres;

--
-- Name: COLUMN user_mistakes_log.question_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_mistakes_log.question_id IS 'Question identifier - supports both integer (legacy) and UUID (normalized) formats';


--
-- Name: user_problem_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_problem_points (
    id integer NOT NULL,
    user_id uuid,
    problem_id integer,
    points_awarded integer DEFAULT 0,
    awarded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_problem_points OWNER TO postgres;

--
-- Name: user_problem_points_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_problem_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_problem_points_id_seq OWNER TO postgres;

--
-- Name: user_problem_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_problem_points_id_seq OWNED BY public.user_problem_points.id;


--
-- Name: user_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    level integer DEFAULT 0,
    confidence integer DEFAULT 50,
    last_assessed_at timestamp without time zone,
    assessment_count integer DEFAULT 0,
    source character varying(50) DEFAULT 'unknown'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_skills_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT user_skills_level_check CHECK (((level >= 0) AND (level <= 5)))
);


ALTER TABLE public.user_skills OWNER TO postgres;

--
-- Name: TABLE user_skills; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_skills IS 'User skill proficiency tracking with confidence levels';


--
-- Name: COLUMN user_skills.level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills.level IS 'Skill level: 0=None, 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master';


--
-- Name: COLUMN user_skills.confidence; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills.confidence IS 'User confidence in this skill (0-100)';


--
-- Name: COLUMN user_skills.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills.source IS 'How this skill level was determined';


--
-- Name: v_user_goal_progress; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_goal_progress AS
 SELECT ug.id AS goal_id,
    ug.user_id,
    u.username,
    ug.title,
    ug.target_role,
    ug.status,
    ug.progress,
    ug.deadline,
    count(DISTINCT us.skill_name) AS skills_acquired,
    jsonb_array_length(ug.required_skills) AS skills_required,
    round((((count(DISTINCT us.skill_name))::numeric / (NULLIF(jsonb_array_length(ug.required_skills), 0))::numeric) * (100)::numeric), 2) AS skill_completion_percentage
   FROM ((public.user_goals ug
     JOIN public.users u ON ((ug.user_id = u.id)))
     LEFT JOIN public.user_skills us ON (((ug.user_id = us.user_id) AND ((us.skill_name)::text IN ( SELECT jsonb_array_elements_text(jsonb_path_query_array(ug.required_skills, '$[*]."skill"'::jsonpath)) AS jsonb_array_elements_text)) AND (us.level >= ( SELECT ((elem.value ->> 'minLevel'::text))::integer AS int4
           FROM jsonb_array_elements(ug.required_skills) elem(value)
          WHERE ((elem.value ->> 'skill'::text) = (us.skill_name)::text)
         LIMIT 1)))))
  GROUP BY ug.id, ug.user_id, u.username, ug.title, ug.target_role, ug.status, ug.progress, ug.deadline, ug.required_skills;


ALTER VIEW public.v_user_goal_progress OWNER TO postgres;

--
-- Name: v_user_learning_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_learning_summary AS
 SELECT u.id AS user_id,
    u.username,
    lp.weak_topics,
    lp.strong_topics,
    lp.streak_days,
    COALESCE(lp.total_learning_sessions, 0) AS total_sessions,
    count(DISTINCT s.id) AS total_submissions,
    count(DISTINCT
        CASE
            WHEN (s.verdict = 'ACCEPTED'::text) THEN s.problem_id
            ELSE NULL::integer
        END) AS problems_solved,
    COALESCE(sum(ucp.total_points), (0)::bigint) AS total_points
   FROM (((public.users u
     LEFT JOIN public.learning_profiles lp ON ((u.id = lp.user_id)))
     LEFT JOIN public.submissions s ON ((u.id = s.user_id)))
     LEFT JOIN public.user_category_points ucp ON ((u.id = ucp.user_id)))
  GROUP BY u.id, u.username, lp.weak_topics, lp.strong_topics, lp.streak_days, lp.total_learning_sessions;


ALTER VIEW public.v_user_learning_summary OWNER TO postgres;

--
-- Name: v_user_skill_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_skill_summary AS
 SELECT us.user_id,
    u.username,
    us.skill_name,
    us.level,
    us.confidence,
    us.last_assessed_at,
    us.assessment_count,
    sc.category AS skill_category,
    sc.display_name AS skill_display_name,
        CASE
            WHEN (us.level >= 4) THEN 'expert'::text
            WHEN (us.level >= 3) THEN 'advanced'::text
            WHEN (us.level >= 2) THEN 'intermediate'::text
            WHEN (us.level >= 1) THEN 'beginner'::text
            ELSE 'none'::text
        END AS proficiency_label
   FROM ((public.user_skills us
     JOIN public.users u ON ((us.user_id = u.id)))
     LEFT JOIN public.skill_catalog sc ON (((us.skill_name)::text = (sc.skill_name)::text)));


ALTER VIEW public.v_user_skill_summary OWNER TO postgres;

--
-- Name: problem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem ALTER COLUMN id SET DEFAULT nextval('public.problem_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: user_category_points id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_category_points ALTER COLUMN id SET DEFAULT nextval('public.user_category_points_id_seq'::regclass);


--
-- Name: user_problem_points id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_problem_points ALTER COLUMN id SET DEFAULT nextval('public.user_problem_points_id_seq'::regclass);


--
-- Name: ai_voice_providers ai_voice_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_voice_providers
    ADD CONSTRAINT ai_voice_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_voice_providers ai_voice_providers_provider_type_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_voice_providers
    ADD CONSTRAINT ai_voice_providers_provider_type_provider_name_key UNIQUE (provider_type, provider_name);


--
-- Name: audio_transcripts audio_transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audio_transcripts
    ADD CONSTRAINT audio_transcripts_pkey PRIMARY KEY (id);


--
-- Name: blog blog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog
    ADD CONSTRAINT blog_pkey PRIMARY KEY (id);


--
-- Name: career_roadmap_templates career_roadmap_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.career_roadmap_templates
    ADD CONSTRAINT career_roadmap_templates_pkey PRIMARY KEY (id);


--
-- Name: career_roadmap_templates career_roadmap_templates_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.career_roadmap_templates
    ADD CONSTRAINT career_roadmap_templates_role_name_key UNIQUE (role_name);


--
-- Name: course_problems course_problems_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_problems
    ADD CONSTRAINT course_problems_pkey PRIMARY KEY (id);


--
-- Name: course_skills course_skills_course_id_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_skills
    ADD CONSTRAINT course_skills_course_id_skill_name_key UNIQUE (course_id, skill_name);


--
-- Name: course_skills course_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_skills
    ADD CONSTRAINT course_skills_pkey PRIMARY KEY (id);


--
-- Name: course_submissions course_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_pkey PRIMARY KEY (id);


--
-- Name: course_submissions course_submissions_user_id_course_id_problem_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_user_id_course_id_problem_id_key UNIQUE (user_id, course_id, problem_id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: daily_tasks daily_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_tasks
    ADD CONSTRAINT daily_tasks_pkey PRIMARY KEY (id);


--
-- Name: evaluation_results evaluation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_pkey PRIMARY KEY (id);


--
-- Name: interview_analytics interview_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_analytics
    ADD CONSTRAINT interview_analytics_pkey PRIMARY KEY (id);


--
-- Name: interview_analytics interview_analytics_user_id_period_type_period_start_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_analytics
    ADD CONSTRAINT interview_analytics_user_id_period_type_period_start_key UNIQUE (user_id, period_type, period_start);


--
-- Name: interview_sessions interview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_sessions
    ADD CONSTRAINT interview_sessions_pkey PRIMARY KEY (id);


--
-- Name: interview_templates interview_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_pkey PRIMARY KEY (id);


--
-- Name: interview_templates interview_templates_template_type_template_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_template_type_template_name_key UNIQUE (template_type, template_name);


--
-- Name: interview_turns interview_turns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_turns
    ADD CONSTRAINT interview_turns_pkey PRIMARY KEY (id);


--
-- Name: learning_profiles learning_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_profiles
    ADD CONSTRAINT learning_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: learning_validations learning_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_validations
    ADD CONSTRAINT learning_validations_pkey PRIMARY KEY (id);


--
-- Name: mistake_catalog mistake_catalog_mistake_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mistake_catalog
    ADD CONSTRAINT mistake_catalog_mistake_type_key UNIQUE (mistake_type);


--
-- Name: mistake_catalog mistake_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mistake_catalog
    ADD CONSTRAINT mistake_catalog_pkey PRIMARY KEY (id);


--
-- Name: normalized_questions normalized_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.normalized_questions
    ADD CONSTRAINT normalized_questions_pkey PRIMARY KEY (id);


--
-- Name: plugin_registry plugin_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plugin_registry
    ADD CONSTRAINT plugin_registry_pkey PRIMARY KEY (id);


--
-- Name: plugin_registry plugin_registry_plugin_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plugin_registry
    ADD CONSTRAINT plugin_registry_plugin_name_key UNIQUE (plugin_name);


--
-- Name: problem problem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem
    ADD CONSTRAINT problem_pkey PRIMARY KEY (id);


--
-- Name: roadmap_feedback roadmap_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roadmap_feedback
    ADD CONSTRAINT roadmap_feedback_pkey PRIMARY KEY (id);


--
-- Name: savedsnippets savedsnippets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.savedsnippets
    ADD CONSTRAINT savedsnippets_pkey PRIMARY KEY (id);


--
-- Name: skill_assessment_results skill_assessment_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_assessment_results
    ADD CONSTRAINT skill_assessment_results_pkey PRIMARY KEY (id);


--
-- Name: skill_assessments skill_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_assessments
    ADD CONSTRAINT skill_assessments_pkey PRIMARY KEY (id);


--
-- Name: skill_catalog skill_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_catalog
    ADD CONSTRAINT skill_catalog_pkey PRIMARY KEY (id);


--
-- Name: skill_catalog skill_catalog_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_catalog
    ADD CONSTRAINT skill_catalog_skill_name_key UNIQUE (skill_name);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_category_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_category_setting_key_key UNIQUE (category, setting_key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: testcases testcases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testcases
    ADD CONSTRAINT testcases_pkey PRIMARY KEY (id);


--
-- Name: training_plan_items training_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plan_items
    ADD CONSTRAINT training_plan_items_pkey PRIMARY KEY (id);


--
-- Name: training_plans training_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);


--
-- Name: user_category_points user_category_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_category_points
    ADD CONSTRAINT user_category_points_pkey PRIMARY KEY (id);


--
-- Name: user_category_points user_category_points_user_id_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_category_points
    ADD CONSTRAINT user_category_points_user_id_category_key UNIQUE (user_id, category);


--
-- Name: user_course_progress user_course_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_pkey PRIMARY KEY (id);


--
-- Name: user_goals user_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_pkey PRIMARY KEY (id);


--
-- Name: user_mistakes_log user_mistakes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_mistakes_log
    ADD CONSTRAINT user_mistakes_log_pkey PRIMARY KEY (id);


--
-- Name: user_problem_points user_problem_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_problem_points
    ADD CONSTRAINT user_problem_points_pkey PRIMARY KEY (id);


--
-- Name: user_problem_points user_problem_points_user_id_problem_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_problem_points
    ADD CONSTRAINT user_problem_points_user_id_problem_id_key UNIQUE (user_id, problem_id);


--
-- Name: user_skills user_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_pkey PRIMARY KEY (id);


--
-- Name: user_skills user_skills_user_id_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_user_id_skill_name_key UNIQUE (user_id, skill_name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_ai_voice_providers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_voice_providers_active ON public.ai_voice_providers USING btree (is_active, is_default);


--
-- Name: idx_ai_voice_providers_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_voice_providers_type ON public.ai_voice_providers USING btree (provider_type);


--
-- Name: idx_audio_transcripts_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audio_transcripts_session ON public.audio_transcripts USING btree (session_id);


--
-- Name: idx_audio_transcripts_turn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audio_transcripts_turn ON public.audio_transcripts USING btree (turn_id);


--
-- Name: idx_audio_transcripts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audio_transcripts_type ON public.audio_transcripts USING btree (audio_type);


--
-- Name: idx_career_roadmap_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_career_roadmap_templates_active ON public.career_roadmap_templates USING btree (is_active);


--
-- Name: idx_career_roadmap_templates_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_career_roadmap_templates_role ON public.career_roadmap_templates USING btree (role_name);


--
-- Name: idx_course_problems_course_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_problems_course_id ON public.course_problems USING btree (course_id);


--
-- Name: idx_course_problems_problem_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_problems_problem_id ON public.course_problems USING btree (problem_id);


--
-- Name: idx_course_skills_course; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_skills_course ON public.course_skills USING btree (course_id);


--
-- Name: idx_course_skills_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_course_skills_skill ON public.course_skills USING btree (skill_name);


--
-- Name: idx_daily_tasks_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_tasks_date ON public.daily_tasks USING btree (task_date);


--
-- Name: idx_daily_tasks_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_tasks_plan ON public.daily_tasks USING btree (plan_id);


--
-- Name: idx_daily_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_tasks_status ON public.daily_tasks USING btree (status);


--
-- Name: idx_daily_tasks_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_tasks_user ON public.daily_tasks USING btree (user_id);


--
-- Name: idx_evaluation_results_evaluation_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_results_evaluation_type ON public.evaluation_results USING btree (evaluation_type);


--
-- Name: idx_evaluation_results_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_results_question_id ON public.evaluation_results USING btree (question_id);


--
-- Name: idx_evaluation_results_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_results_submitted_at ON public.evaluation_results USING btree (submitted_at DESC);


--
-- Name: idx_evaluation_results_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_results_user_id ON public.evaluation_results USING btree (user_id);


--
-- Name: idx_evaluation_results_verdict; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evaluation_results_verdict ON public.evaluation_results USING btree (verdict);


--
-- Name: idx_interview_analytics_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_analytics_period ON public.interview_analytics USING btree (period_type, period_start DESC);


--
-- Name: idx_interview_analytics_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_analytics_user ON public.interview_analytics USING btree (user_id);


--
-- Name: idx_interview_sessions_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_mode ON public.interview_sessions USING btree (session_mode);


--
-- Name: idx_interview_sessions_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_started ON public.interview_sessions USING btree (started_at DESC);


--
-- Name: idx_interview_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_status ON public.interview_sessions USING btree (status);


--
-- Name: idx_interview_sessions_target_questions; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_target_questions ON public.interview_sessions USING btree (target_questions);


--
-- Name: idx_interview_sessions_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_topic ON public.interview_sessions USING btree (topic);


--
-- Name: idx_interview_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_sessions_user ON public.interview_sessions USING btree (user_id);


--
-- Name: idx_interview_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_templates_active ON public.interview_templates USING btree (is_active);


--
-- Name: idx_interview_templates_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_templates_role ON public.interview_templates USING btree (target_role);


--
-- Name: idx_interview_templates_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_templates_topic ON public.interview_templates USING btree (topic);


--
-- Name: idx_interview_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_templates_type ON public.interview_templates USING btree (template_type);


--
-- Name: idx_interview_turns_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_turns_score ON public.interview_turns USING btree (score DESC);


--
-- Name: idx_interview_turns_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_turns_session ON public.interview_turns USING btree (session_id, turn_number);


--
-- Name: idx_interview_turns_verdict; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_turns_verdict ON public.interview_turns USING btree (verdict);


--
-- Name: idx_learning_profiles_last_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_profiles_last_active ON public.learning_profiles USING btree (last_active_date);


--
-- Name: idx_learning_profiles_streak; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_profiles_streak ON public.learning_profiles USING btree (streak_days DESC);


--
-- Name: idx_learning_validations_passed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_validations_passed ON public.learning_validations USING btree (passed);


--
-- Name: idx_learning_validations_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_validations_reference ON public.learning_validations USING btree (reference_id);


--
-- Name: idx_learning_validations_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_validations_skill ON public.learning_validations USING btree (skill_name);


--
-- Name: idx_learning_validations_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_validations_type ON public.learning_validations USING btree (validation_type);


--
-- Name: idx_learning_validations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_validations_user ON public.learning_validations USING btree (user_id);


--
-- Name: idx_mistake_catalog_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mistake_catalog_category ON public.mistake_catalog USING btree (category);


--
-- Name: idx_mistake_catalog_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mistake_catalog_type ON public.mistake_catalog USING btree (mistake_type);


--
-- Name: idx_normalized_questions_difficulty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_normalized_questions_difficulty ON public.normalized_questions USING btree (difficulty);


--
-- Name: idx_normalized_questions_primary_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_normalized_questions_primary_topic ON public.normalized_questions USING btree (primary_topic);


--
-- Name: idx_normalized_questions_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_normalized_questions_source ON public.normalized_questions USING btree (source);


--
-- Name: idx_normalized_questions_topics; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_normalized_questions_topics ON public.normalized_questions USING gin (topics);


--
-- Name: idx_normalized_questions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_normalized_questions_type ON public.normalized_questions USING btree (question_type);


--
-- Name: idx_roadmap_feedback_difficulty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roadmap_feedback_difficulty ON public.roadmap_feedback USING btree (difficulty_rating);


--
-- Name: idx_roadmap_feedback_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roadmap_feedback_plan ON public.roadmap_feedback USING btree (plan_id);


--
-- Name: idx_roadmap_feedback_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roadmap_feedback_user ON public.roadmap_feedback USING btree (user_id);


--
-- Name: idx_skill_assessment_results_assessment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessment_results_assessment ON public.skill_assessment_results USING btree (assessment_id);


--
-- Name: idx_skill_assessment_results_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessment_results_skill ON public.skill_assessment_results USING btree (skill_name);


--
-- Name: idx_skill_assessment_results_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessment_results_user ON public.skill_assessment_results USING btree (user_id);


--
-- Name: idx_skill_assessments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessments_active ON public.skill_assessments USING btree (is_active);


--
-- Name: idx_skill_assessments_difficulty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessments_difficulty ON public.skill_assessments USING btree (difficulty_level);


--
-- Name: idx_skill_assessments_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_assessments_skill ON public.skill_assessments USING btree (skill_name);


--
-- Name: idx_skill_catalog_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_catalog_active ON public.skill_catalog USING btree (is_active);


--
-- Name: idx_skill_catalog_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_skill_catalog_category ON public.skill_catalog USING btree (category);


--
-- Name: idx_submissions_problem_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submissions_problem_id ON public.submissions USING btree (problem_id);


--
-- Name: idx_submissions_submission_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submissions_submission_time ON public.submissions USING btree (submission_time DESC);


--
-- Name: idx_submissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submissions_user_id ON public.submissions USING btree (user_id);


--
-- Name: idx_submissions_verdict; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submissions_verdict ON public.submissions USING btree (verdict);


--
-- Name: idx_training_plan_items_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plan_items_plan_id ON public.training_plan_items USING btree (plan_id);


--
-- Name: idx_training_plan_items_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plan_items_question_id ON public.training_plan_items USING btree (question_id);


--
-- Name: idx_training_plans_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plans_active ON public.training_plans USING btree (is_active);


--
-- Name: idx_training_plans_goal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plans_goal ON public.training_plans USING btree (goal_id);


--
-- Name: idx_training_plans_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plans_status ON public.training_plans USING btree (status);


--
-- Name: idx_training_plans_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plans_user_id ON public.training_plans USING btree (user_id);


--
-- Name: idx_training_plans_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_training_plans_version ON public.training_plans USING btree (version);


--
-- Name: idx_user_category_points_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_category_points_category ON public.user_category_points USING btree (category);


--
-- Name: idx_user_category_points_total_points; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_category_points_total_points ON public.user_category_points USING btree (total_points DESC);


--
-- Name: idx_user_course_progress_course_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_course_progress_course_id ON public.user_course_progress USING btree (course_id);


--
-- Name: idx_user_course_progress_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_course_progress_user_id ON public.user_course_progress USING btree (user_id);


--
-- Name: idx_user_goals_required_skills; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_goals_required_skills ON public.user_goals USING gin (required_skills);


--
-- Name: idx_user_goals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_goals_status ON public.user_goals USING btree (status);


--
-- Name: idx_user_goals_target_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_goals_target_role ON public.user_goals USING btree (target_role);


--
-- Name: idx_user_goals_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_goals_user ON public.user_goals USING btree (user_id);


--
-- Name: idx_user_mistakes_log_mistake_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mistakes_log_mistake_type ON public.user_mistakes_log USING btree (mistake_type);


--
-- Name: idx_user_mistakes_log_resolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mistakes_log_resolved ON public.user_mistakes_log USING btree (resolved);


--
-- Name: idx_user_mistakes_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mistakes_log_user_id ON public.user_mistakes_log USING btree (user_id);


--
-- Name: idx_user_skills_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_level ON public.user_skills USING btree (level);


--
-- Name: idx_user_skills_metadata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_metadata ON public.user_skills USING gin (metadata);


--
-- Name: idx_user_skills_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_skill ON public.user_skills USING btree (skill_name);


--
-- Name: idx_user_skills_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_skills_user ON public.user_skills USING btree (user_id);


--
-- Name: recent_interview_sessions _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.recent_interview_sessions AS
 SELECT is_sess.id,
    is_sess.user_id,
    u.username,
    is_sess.session_mode,
    is_sess.topic,
    is_sess.target_role,
    is_sess.total_questions,
    is_sess.overall_score,
    is_sess.status,
    is_sess.duration_seconds,
    is_sess.started_at,
    count(it.id) AS turns_completed,
    avg(it.score) AS avg_turn_score
   FROM ((public.interview_sessions is_sess
     JOIN public.users u ON ((is_sess.user_id = u.id)))
     LEFT JOIN public.interview_turns it ON ((is_sess.id = it.session_id)))
  GROUP BY is_sess.id, u.username
  ORDER BY is_sess.started_at DESC;


--
-- Name: user_goals trigger_auto_create_goal_skills; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_auto_create_goal_skills AFTER INSERT ON public.user_goals FOR EACH ROW EXECUTE FUNCTION public.auto_create_goal_skills();


--
-- Name: users trigger_create_learning_profile; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_learning_profile AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.create_learning_profile_for_new_user();


--
-- Name: learning_profiles trigger_update_learning_profile_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_learning_profile_timestamp BEFORE UPDATE ON public.learning_profiles FOR EACH ROW EXECUTE FUNCTION public.update_learning_profile_timestamp();


--
-- Name: user_goals trigger_update_user_goals_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_user_goals_timestamp BEFORE UPDATE ON public.user_goals FOR EACH ROW EXECUTE FUNCTION public.update_user_goals_timestamp();


--
-- Name: user_skills trigger_update_user_skills_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_user_skills_timestamp BEFORE UPDATE ON public.user_skills FOR EACH ROW EXECUTE FUNCTION public.update_user_skills_timestamp();


--
-- Name: ai_voice_providers update_ai_voice_providers_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_ai_voice_providers_timestamp BEFORE UPDATE ON public.ai_voice_providers FOR EACH ROW EXECUTE FUNCTION public.update_interview_timestamp();


--
-- Name: interview_sessions update_interview_sessions_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_interview_sessions_timestamp BEFORE UPDATE ON public.interview_sessions FOR EACH ROW EXECUTE FUNCTION public.update_interview_timestamp();


--
-- Name: interview_templates update_interview_templates_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_interview_templates_timestamp BEFORE UPDATE ON public.interview_templates FOR EACH ROW EXECUTE FUNCTION public.update_interview_timestamp();


--
-- Name: interview_turns update_interview_turns_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_interview_turns_timestamp BEFORE UPDATE ON public.interview_turns FOR EACH ROW EXECUTE FUNCTION public.update_interview_timestamp();


--
-- Name: audio_transcripts audio_transcripts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audio_transcripts
    ADD CONSTRAINT audio_transcripts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.interview_sessions(id) ON DELETE CASCADE;


--
-- Name: audio_transcripts audio_transcripts_turn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audio_transcripts
    ADD CONSTRAINT audio_transcripts_turn_id_fkey FOREIGN KEY (turn_id) REFERENCES public.interview_turns(id) ON DELETE CASCADE;


--
-- Name: blog blog_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog
    ADD CONSTRAINT blog_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: blog blog_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog
    ADD CONSTRAINT blog_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: course_problems course_problems_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_problems
    ADD CONSTRAINT course_problems_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_problems course_problems_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_problems
    ADD CONSTRAINT course_problems_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problem(id) ON DELETE CASCADE;


--
-- Name: course_skills course_skills_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_skills
    ADD CONSTRAINT course_skills_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_submissions course_submissions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_submissions course_submissions_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problem(id) ON DELETE CASCADE;


--
-- Name: course_submissions course_submissions_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: course_submissions course_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_submissions
    ADD CONSTRAINT course_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_tasks daily_tasks_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_tasks
    ADD CONSTRAINT daily_tasks_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE SET NULL;


--
-- Name: daily_tasks daily_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_tasks
    ADD CONSTRAINT daily_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_tasks daily_tasks_validation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_tasks
    ADD CONSTRAINT daily_tasks_validation_id_fkey FOREIGN KEY (validation_id) REFERENCES public.learning_validations(id);


--
-- Name: evaluation_results evaluation_results_legacy_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_legacy_submission_id_fkey FOREIGN KEY (legacy_submission_id) REFERENCES public.submissions(id) ON DELETE SET NULL;


--
-- Name: evaluation_results evaluation_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_analytics interview_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_analytics
    ADD CONSTRAINT interview_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_sessions interview_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_sessions
    ADD CONSTRAINT interview_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_templates interview_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: interview_turns interview_turns_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_turns
    ADD CONSTRAINT interview_turns_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.interview_sessions(id) ON DELETE CASCADE;


--
-- Name: learning_profiles learning_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_profiles
    ADD CONSTRAINT learning_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: learning_validations learning_validations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_validations
    ADD CONSTRAINT learning_validations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: normalized_questions normalized_questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.normalized_questions
    ADD CONSTRAINT normalized_questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: normalized_questions normalized_questions_legacy_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.normalized_questions
    ADD CONSTRAINT normalized_questions_legacy_problem_id_fkey FOREIGN KEY (legacy_problem_id) REFERENCES public.problem(id) ON DELETE SET NULL;


--
-- Name: roadmap_feedback roadmap_feedback_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roadmap_feedback
    ADD CONSTRAINT roadmap_feedback_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE SET NULL;


--
-- Name: roadmap_feedback roadmap_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roadmap_feedback
    ADD CONSTRAINT roadmap_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: skill_assessment_results skill_assessment_results_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_assessment_results
    ADD CONSTRAINT skill_assessment_results_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.skill_assessments(id) ON DELETE CASCADE;


--
-- Name: skill_assessment_results skill_assessment_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_assessment_results
    ADD CONSTRAINT skill_assessment_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problem(id) ON DELETE CASCADE;


--
-- Name: testcases testcases_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testcases
    ADD CONSTRAINT testcases_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problem(id) ON DELETE CASCADE;


--
-- Name: training_plan_items training_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plan_items
    ADD CONSTRAINT training_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;


--
-- Name: training_plans training_plans_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.user_goals(id) ON DELETE SET NULL;


--
-- Name: training_plans training_plans_parent_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_parent_plan_id_fkey FOREIGN KEY (parent_plan_id) REFERENCES public.training_plans(id) ON DELETE SET NULL;


--
-- Name: training_plans training_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_category_points user_category_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_category_points
    ADD CONSTRAINT user_category_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_course_progress user_course_progress_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: user_course_progress user_course_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_goals user_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_goals
    ADD CONSTRAINT user_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_mistakes_log user_mistakes_log_evaluation_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_mistakes_log
    ADD CONSTRAINT user_mistakes_log_evaluation_result_id_fkey FOREIGN KEY (evaluation_result_id) REFERENCES public.evaluation_results(id) ON DELETE CASCADE;


--
-- Name: user_mistakes_log user_mistakes_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_mistakes_log
    ADD CONSTRAINT user_mistakes_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_problem_points user_problem_points_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_problem_points
    ADD CONSTRAINT user_problem_points_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problem(id) ON DELETE CASCADE;


--
-- Name: user_problem_points user_problem_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_problem_points
    ADD CONSTRAINT user_problem_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_skills user_skills_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

