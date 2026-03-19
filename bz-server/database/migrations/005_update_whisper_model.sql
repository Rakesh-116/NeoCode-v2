-- Migration: Update Whisper model from base to tiny (faster on CPU)
-- Date: 2026-03-08

-- Update Whisper provider config to use tiny model
UPDATE ai_voice_providers 
SET config = jsonb_set(config, '{model}', '"tiny"'::jsonb)
WHERE provider_name = 'whisper' 
  AND provider_type = 'stt';

-- Verify the change
SELECT provider_name, provider_type, config->'model' as model
FROM ai_voice_providers
WHERE provider_name = 'whisper';
