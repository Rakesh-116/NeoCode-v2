-- ============================================================================
-- Migration 004: Voice Assistant System
-- ============================================================================
-- Creates tables for voice assistant interactions and analytics
-- 
-- Tables:
-- - assistant_interactions: Conversation history
-- 
-- Version: 1.0.0
-- Created: 2026-03-08
-- ============================================================================

-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS assistant_interactions CASCADE;

-- ============================================================================
-- Table: assistant_interactions
-- ============================================================================
-- Stores all voice assistant interactions for history and analytics
-- ============================================================================

CREATE TABLE assistant_interactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Input/Output
    transcription TEXT NOT NULL,              -- User's speech as text
    intent VARCHAR(100) NOT NULL,             -- Detected intent (start_interview, explain_concept, etc.)
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1), -- Intent confidence (0-1)
    response TEXT NOT NULL,                   -- Assistant's response text
    
    -- Metadata
    success BOOLEAN DEFAULT true,             -- Whether action succeeded
    context JSONB,                            -- Context data (page, problem, course)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT valid_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Fast lookup by user
CREATE INDEX idx_assistant_user ON assistant_interactions(user_id);

-- Fast lookup by date
CREATE INDEX idx_assistant_created ON assistant_interactions(created_at DESC);

-- Fast lookup by intent (for analytics)
CREATE INDEX idx_assistant_intent ON assistant_interactions(intent);

-- JSONB context search
CREATE INDEX idx_assistant_context ON assistant_interactions USING gin(context);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE assistant_interactions IS 'Voice assistant conversation history and analytics';
COMMENT ON COLUMN assistant_interactions.transcription IS 'User speech converted to text';
COMMENT ON COLUMN assistant_interactions.intent IS 'Parsed intent from user speech';
COMMENT ON COLUMN assistant_interactions.confidence IS 'Intent detection confidence (0-1)';
COMMENT ON COLUMN assistant_interactions.response IS 'Assistant text response';
COMMENT ON COLUMN assistant_interactions.success IS 'Whether the action completed successfully';
COMMENT ON COLUMN assistant_interactions.context IS 'Context data (current page, problem, course, etc.)';

-- ============================================================================
-- Analytics View
-- ============================================================================
-- View for assistant usage analytics
-- ============================================================================

CREATE OR REPLACE VIEW v_assistant_analytics AS
SELECT 
    intent,
    COUNT(*) as total_interactions,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_count,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_count,
    ROUND(
        COUNT(CASE WHEN success = true THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL * 100, 
        2
    ) as success_rate_percent
FROM assistant_interactions
GROUP BY intent
ORDER BY total_interactions DESC;

COMMENT ON VIEW v_assistant_analytics IS 'Assistant usage statistics by intent';

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

-- Uncomment to add sample data:
-- INSERT INTO assistant_interactions (id, user_id, transcription, intent, confidence, response, success, context)
-- VALUES (
--     gen_random_uuid(),
--     (SELECT id FROM users LIMIT 1),
--     'Hey Karen, start an interview',
--     'start_interview',
--     0.95,
--     'Starting medium difficulty interview on dynamic programming.',
--     true,
--     '{"currentPage": "/dashboard"}'::jsonb
-- );

-- ============================================================================
-- Migration Complete
-- ============================================================================
