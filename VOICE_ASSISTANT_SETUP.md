# Karen Voice Assistant - Siri Style

## ✨ What Is This?

**Karen** is a Siri-inspired voice assistant for NeoCode that:
- ✅ **Always listens** for "Hey Karen" wake word
- ✅ **Voice-only** interaction (no buttons, no typing)
- ✅ **Beautiful Siri-style** UI with wave animations
- ✅ **Bottom-center** overlay when active
- ✅ **Auto-closes** after response
- ✅ **Context-aware** - knows what page you're on

## 🎤 How to Use

### Basic Usage

1. **Say "Hey Karen"** - The assistant activates automatically
2. **Speak your command** - It starts recording immediately
3. **Listen to response** - Karen speaks back and auto-closes
4. **Done!** - Returns to background wake word detection

### Example Commands

```
"Hey Karen"
→ [Activates] "Start an interview"
→ [Response] "Starting interview session..."

"Hey Karen"
→ [Activates] "Show my progress"  
→ [Response] "Here's your progress..."

"Hey Karen"
→ [Activates] "Explain binary search"
→ [Response] "Binary search is..."
```

## 🚀 Setup Instructions

### Prerequisites
- Backend server running on `http://localhost:3000`
- User must be logged in (JWT token required)
- Microphone permission granted

### Step 1: Database Setup
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
1. Open the app in browser
2. Browser will ask for **microphone permission** - Click **Allow**
3. Say "Hey Karen" to activate

## 💡 Available Commands

### Interview & Practice
- "Start interview"
- "Start an easy interview on arrays"  
- "Begin a hard dynamic programming interview"

### Learning & Help
- "Explain binary search"
- "What is dynamic programming"
- "Solve a problem"
- "Solve a medium graph problem"

### Navigation
- "Show dashboard"
- "Show my progress"
- "Open operating systems course"

### Context-Aware (on problem pages)
- "Give me a hint"
- "Explain this problem"

## 🎨 Design Features

### Siri-Style Interface
- **Position**: Bottom-center, full-width card
- **Backdrop**: Blur overlay with gradient
- **Animations**: 12 vertical wave bars that react to states
- **States**:
  - 🔴 **Listening** - Red gradient waves, pulsing
  - 🔵 **Thinking** - Blue gradient waves, steady
  - 🟢 **Speaking** - Green gradient waves, pulsing

### Auto-Behavior
- ✅ Always listening for "Hey Karen" in background
- ✅ Auto-activates when wake word detected
- ✅ Auto-starts recording after activation
- ✅ Auto-closes after 2-3 seconds
- ✅ No manual buttons required

## 🔧 Technical Details

### Architecture
```
BackgroundWakeWordDetection
   ↓ (detects "Hey Karen")
MediaRecorder API
   ↓ (records 10 seconds max)
POST /api/assistant/voice
   ↓
WhisperSTT → IntentRouter → ActionExecutor → PiperTTS
   ↓
Audio Response + Navigation
   ↓
Auto-close
```

### Wake Word Detection
- Uses browser `SpeechRecognition` API
- Runs continuously in background
- Low power consumption
- Chrome/Edge only (not Firefox/Safari)

## 🐛 Troubleshooting

### "Microphone access denied"
**Cause**: Browser blocked mic permissions  
**Fix**: 
1. Click the 🔒 lock icon in address bar
2. Allow microphone access
3. Reload the page

### "Speech recognition not supported"
**Cause**: Using Firefox or Safari  
**Fix**: Use Chrome or Edge browser (wake word detection only works in Chromium browsers)

### "No network calls to backend"
**Cause 1**: Not logged in  
**Fix**: Login first, JWT token required

**Cause 2**: Backend server not running  
**Fix**: 
```bash
cd bz-server
npm run dev
```

**Cause 3**: Wrong backend URL  
**Fix**: Check `bz-client/.env` has `VITE_BACKEND_URL=http://localhost:3000`

### "Notion meeting notification appearing"
**Cause**: Browser SpeechRecognition API triggers Notion's meeting detection  
**Fix**: This is a browser behavior - Notion detects microphone usage. You can:
- Ignore the notification (doesn't affect Karen)
- Disable Notion extension while using Karen
- Use Chrome incognito mode

### "Assistant not responding to 'Hey Karen'"
**Cause**: Background detection may have stopped  
**Fix**: Reload the page to restart wake word detection

### "Failed to process command" error
**Cause 1**: Backend voice providers not running  
**Fix**: Check backend logs - Whisper/Piper/Ollama must be available

**Cause 2**: Audio format issue  
**Fix**: Browser sends .webm audio - backend must support it

## 📊 Analytics

View assistant usage stats:
```sql
SELECT * FROM v_assistant_analytics;
```

Check conversation history:
```sql
SELECT * FROM assistant_interactions 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC LIMIT 10;
```

## 🎯 Comparison: Old vs New Design

### Old Design (Removed)
- ❌ Floating button in bottom-right
- ❌ Chat panel with text input
- ❌ Quick action buttons
- ❌ Manual activation required

### New Design (Siri-Style)
- ✅ No buttons - voice-only
- ✅ Bottom-center full-width card
- ✅ Wave animation like Siri
- ✅ Auto-activates on "Hey Karen"
- ✅ Auto-closes after response
- ✅ Minimal, beautiful, focused

## 🚀 Future Enhancements

- **Multi-turn conversations** - Remember context across commands
- **Custom wake words** - Porcupine for offline detection
- **Streaming responses** - Lower latency TTS
- **Voice navigation** - "Go to next problem"
- **Proactive hints** - Karen suggests help when stuck

---

**Note**: Karen is voice-only by design. If you need text-based AI support, use the regular chat assistant instead.
