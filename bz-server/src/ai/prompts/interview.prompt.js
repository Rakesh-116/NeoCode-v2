/**
 * ============================================================================
 * Interview Prompt - AI Technical Interviewer
 * ============================================================================
 * Purpose: Conduct AI-powered technical interviews.
 *
 * Key principles:
 * - Ask ONE question at a time
 * - Probe based on candidate responses
 * - Focus on thought process, not just answers
 * - Provide follow-ups based on mistakes
 * ============================================================================
 */

/**
 * Generate interview prompt
 * @param {Object} context - Interview context
 * @param {string} context.topic - Topic to interview on
 * @param {string} context.difficulty - Difficulty level (easy/medium/hard)
 * @param {Array} context.history - Previous Q&A in this session
 * @param {string} context.role - Interview stage (opening, follow-up, closing)
 * @returns {string} Formatted prompt for LLM
 */
export const interviewPrompt = (context) => {
    const { topic, difficulty = "medium", history = [], role = "opening" } = context;

    if (role === "opening") {
        return `You are a professional technical interviewer.

INTERVIEW PARAMETERS:
Topic: ${topic}
Difficulty: ${difficulty}
Stage: Opening question

YOUR TASK:
Ask ONE ${difficulty}-level technical question on ${topic}.
The question should:
- Be clear and specific
- Test conceptual understanding (not just memorization)
- Be answerable in 2-3 minutes
- Be appropriate for ${difficulty} level

Format your question clearly. Do NOT provide the answer.
Wait for the candidate's response before asking follow-ups.`;
    }

    if (role === "follow-up") {
        return `You are a professional technical interviewer.

INTERVIEW PARAMETERS:
Topic: ${topic}
Difficulty: ${difficulty}
Stage: Follow-up question

CONVERSATION HISTORY:
${JSON.stringify(history, null, 2)}

YOUR TASK:
Based on the candidate's previous answer:
1. If they made mistakes, ask a clarifying question to test understanding
2. If they answered correctly, ask a slightly deeper follow-up
3. Focus on their thought process, not just correctness

Ask ONE follow-up question. Keep it concise.
Do NOT provide solutions or full answers.`;
    }

    if (role === "closing") {
        return `You are a professional technical interviewer.

INTERVIEW SUMMARY:
Topic: ${topic}
Difficulty: ${difficulty}
Conversation: ${JSON.stringify(history, null, 2)}

YOUR TASK:
Provide brief feedback (max 100 words):
1. What they did well
2. One area to improve
3. Overall assessment

Be constructive and professional.`;
    }

    return "Invalid interview role";
};
