# Karen Voice Assistant (Project Implementation)

## Overview
Karen is a click-to-talk voice assistant embedded in the NeoCode UI. It records audio in the browser, sends it to the backend, and plays a spoken response with optional navigation or external link actions. There is no wake-word detection in the current implementation.

Key traits in this build:
- Click-to-activate (floating button)
- Voice-only interaction (no text box)
- Siri-style overlay UI with animated bars and status states
- Context-aware (current page, current problem, current course)
- Auto-closes after response

## How to Use
1. Click the floating purple button in the bottom-left.
2. Speak your command.
3. The assistant processes and speaks back.
4. The panel auto-closes after the response.

## Example Commands (Based on Intent Router)
- "Start an interview on arrays"
- "Open interviews"
- "Explain binary search"
- "Show dashboard"
- "Open operating systems course"
- "Review flashcards"
- "Show my progress"
- "Solve a medium problem"
- "Give me a hint" (only works when you are on a problem page)
- "Open YouTube"

## Setup Instructions

### Prerequisites
- Backend server running at `VITE_BACKEND_URL` (defaults to `http://localhost:3000`)
- User must be logged in (JWT cookie `neo_code_jwt_token`)
- Microphone permission granted in the browser

### Step 1: Database Setup
Run the voice assistant migration (creates `assistant_interactions` and analytics view):

```bash
cd bz-server
node setup-voice-assistant.js
```

### Step 2: Start Servers
```bash
# Terminal 1 - Backend
cd bz-server
npm run dev

# Terminal 2 - Frontend
cd bz-client
npm run dev
```

### Step 3: Grant Permissions
1. Open the app in the browser.
2. Allow microphone access when prompted.
3. Click the floating button to talk.

## UI and Behavior (Actual Client Implementation)
- Floating action button: bottom-left, purple gradient orb
- Active overlay: full-screen blur backdrop + bottom panel
- Status states:
  - Listening (red/pink bars)
  - Thinking (blue/cyan bars)
  - Speaking (green bars)
- Auto-stop recording after 10 seconds
- Auto-close after response (2 seconds) or error (3 seconds)

## Client Flow (bz-client)
Component: `bz-client/src/components/Common/VoiceAssistant.jsx`

1. Click button to activate.
2. Start `MediaRecorder` and collect a `.webm` audio blob.
3. Run browser live transcription using `SpeechRecognition` if available.
4. POST multipart form to `POST /api/assistant/voice` with:
   - `audio`: `.webm` file
   - `context`: `{ currentPage, currentProblem?, currentCourse? }`
   - `clientTranscript` (if browser STT provides it)
5. Receive WAV audio and metadata via headers, then:
   - Play audio response
   - Navigate if `X-Navigate` is present
   - Open external URL if `X-Open-Url` is present

## Backend Flow (bz-server)
Service: `bz-server/src/ai/voice-assistant/services/VoiceAssistantService.js`

Pipeline:
1. Audio or client transcript input
2. STT (Whisper) if client transcript missing
3. Intent parsing (`IntentRouter`)
4. Action execution (`ActionExecutor`)
5. LLM generation for certain actions (`llm_interview` provider)
6. TTS (Piper) to generate audio response
7. Log interaction in `assistant_interactions`

## API Endpoints
Base path: `/api/assistant`

- `POST /voice`
  - multipart/form-data: `audio`, `context`, `clientTranscript`
  - Response: audio/wav with headers:
    - `X-Transcription`
    - `X-Intent`
    - `X-Response-Text`
    - `X-Navigate`
    - `X-Open-Url`
    - `X-Action`

- `POST /text`
  - Body: `{ text, context, needsAudio }`
  - Response: JSON with response fields and optional audio flag

- `GET /history?limit=20`
  - Returns the user's recent assistant interactions

- `GET /health`
  - Returns provider health (Whisper STT, Piper TTS, Ollama LLM)

- `POST /greeting`
  - Returns a personalized greeting string

## Supported Intents (Current Router)
- `greeting`
- `start_interview` (requires topic; asks if missing)
- `open_interviews`
- `open_external` (YouTube, Google, GitHub, LeetCode, StackOverflow, Reddit, LinkedIn, X)
- `explain_concept` (LLM-generated)
- `show_dashboard`
- `open_course` (finds best matching course)
- `review_flashcards` (checks due count)
- `check_progress`
- `solve_problem` (filters by difficulty/topic)
- `get_hints` (only if `currentProblem` is available)
- `unknown` (fallback)

## Data Storage and Analytics
The assistant logs every interaction to `assistant_interactions` via the migration in `bz-server/database/migrations/004_voice_assistant.sql`.

Example queries:
```sql
SELECT * FROM assistant_interactions
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

```sql
SELECT * FROM v_assistant_analytics;
```

## Troubleshooting

### "Microphone access denied"
Cause: Browser blocked mic permission.
Fix:
1. Click the lock icon in the address bar.
2. Allow microphone access.
3. Reload the page.

### "Speech recognition not supported"
Cause: Browser does not support Web Speech API.
Fix: Live transcript will be skipped; voice still works using server STT.

### "Please login first"
Cause: Missing JWT cookie (`neo_code_jwt_token`).
Fix: Log in before using the assistant.

### "Failed to process command"
Cause: Voice providers not running or backend error.
Fix: Check backend logs and provider health.

---

Note: Wake-word detection ("Hey Karen") is not implemented in the current client. Activation is click-only.
