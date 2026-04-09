/**
 * ============================================================================
 * Groq Interview LLM Provider Implementation
 * ============================================================================
 * Uses Groq's OpenAI-compatible chat completions API for interview question
 * generation and answer evaluation.
 * ============================================================================
 */

import axios from "axios";
import IInterviewLLM from "../interfaces/IInterviewLLM.js";

export default class GroqInterviewLLM extends IInterviewLLM {
    name = "groq";
    version = "1.0.0";
    modelName = "llama-3.3-70b-versatile";

    constructor(config = {}) {
        super();
        this.baseURL = config.baseURL || process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
        this.apiKey = config.apiKey || process.env.GROQ_API_KEY || "";
        this.modelName = config.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
        this.temperature = config.temperature || 0.7;
        this.maxTokens = config.maxTokens || 800;
        this.timeout = config.timeout || 60000;
    }

    async generateQuestion(context) {
        try {
            console.log(
                `[GroqInterviewLLM] Generating ${context.difficulty} question for topic: ${context.topic || context.role}`,
            );

            const response = await this._callGroq(this._buildQuestionPrompt(context));
            const question = this._parseQuestionResponse(response);

            console.log(`[GroqInterviewLLM] Generated question: ${question.question.substring(0, 50)}...`);
            return question;
        } catch (error) {
            console.error("[GroqInterviewLLM] Question generation failed:", error.message);
            throw new Error(`Failed to generate question: ${error.message}`);
        }
    }

    async evaluateAnswer(context) {
        try {
            console.log(`[GroqInterviewLLM] Evaluating answer for: ${context.question.substring(0, 50)}...`);

            const response = await this._callGroq(this._buildEvaluationPrompt(context));
            const evaluation = this._parseEvaluationResponse(response);

            console.log(`[GroqInterviewLLM] Evaluation complete: ${evaluation.verdict} (${evaluation.score}/100)`);
            return evaluation;
        } catch (error) {
            console.error("[GroqInterviewLLM] Answer evaluation failed:", error.message);
            throw new Error(`Failed to evaluate answer: ${error.message}`);
        }
    }

    async generateFollowUp(previousQA) {
        try {
            const response = await this._callGroq(this._buildFollowUpPrompt(previousQA));
            return this._parseQuestionResponse(response);
        } catch (error) {
            console.error("[GroqInterviewLLM] Follow-up generation failed:", error.message);
            throw new Error(`Failed to generate follow-up: ${error.message}`);
        }
    }

    _buildQuestionPrompt(context) {
        let basePrompt = `You are an expert technical interviewer. Generate a single interview question.

**Context:**
`;

        if (context.topic) {
            basePrompt += `- Topic: ${context.topic}\n`;
            basePrompt += `- Difficulty: ${context.difficulty}\n`;
        } else if (context.role) {
            basePrompt += `- Target Role: ${context.role}\n`;
            if (context.jd) {
                basePrompt += `- Job Description: ${context.jd.substring(0, 500)}...\n`;
            }
        }

        if (context.previousQuestions && context.previousQuestions.length > 0) {
            basePrompt += `\n**Already Asked:**\n`;
            context.previousQuestions.forEach((q, idx) => {
                basePrompt += `${idx + 1}. ${q}\n`;
            });
        }

        if (context.smartReview) {
            basePrompt += `\n**Smart Review Context:**\n`;
            basePrompt += `- Last Score: ${context.smartReview.lastScore}\n`;
            basePrompt += `- Missed Subconcepts: ${JSON.stringify(context.smartReview.missedSubconcepts || [])}\n`;
            basePrompt += `\n**Smart Review Instructions:**\n`;
            basePrompt += `Generate a question that specifically targets the user's gap, not a generic question about the concept.\n`;
        }

        basePrompt += `\n**Instructions:**
1. Generate ONE interview question appropriate for the context
2. Make it specific and technical
3. Avoid repeating previous questions
4. Return ONLY a JSON object with this structure:
{
  "question": "your question text",
  "type": "technical|behavioral|system_design|coding",
  "difficulty": "easy|medium|hard",
  "topic": "short topic label (e.g., React internals)",
  "expectedKeywords": ["keyword1", "keyword2"],
  "follow_ups": ["follow up 1", "follow up 2"],
  "evaluation_criteria": "1-2 sentences on what a great answer must cover",
  "concept_tags": ["tag1", "tag2", "tag3"],
  "problemSpec": null | {
    "title": "short title",
    "description": "full statement",
    "input_format": "input format",
    "output_format": "output format",
    "constraints": "comma-separated constraints",
    "sample_testcase": {"input": "...", "output": "..." },
    "hidden_testcases": [{"input":"...","output":"..."}],
    "explaination": "high level explanation (optional)",
    "category": ["Array", "String", "Graph", "Dynamic Programming", "Math", "Pattern", "I/O"],
    "prohibited_keys": {"cpp":"...", "java":"...", "python":"..."} | null
  }
}
5. If type is "coding", you MUST fill a complete problemSpec suitable for NeoCode's Create Problem API.
6. Always include follow_ups (empty array if none) and evaluation_criteria (short sentence if unknown).

Return ONLY valid JSON, no additional text.`;

        return basePrompt;
    }

    _buildEvaluationPrompt(context) {
        return `You are an expert technical interviewer evaluating a candidate's answer.

**Question Asked:**
${context.question}

**Candidate's Answer:**
${context.answer}

**Evaluation Criteria:**
- Topic: ${context.topic}
- Difficulty: ${context.difficulty}
${context.evaluationCriteria ? `- Specific Criteria: ${context.evaluationCriteria}` : ""}
${context.timeToAnswer ? `- Time Taken: ${context.timeToAnswer}s` : ""}

**Instructions:**
Evaluate the answer and return a JSON object with:
{
  "score": <0-100>,
  "verdict": "excellent|good|average|poor|failed",
  "feedback": "detailed feedback on the answer with quotes from the candidate",
  "detectedMistakes": ["mistake1", "mistake2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "followUpSuggested": true|false
}

Feedback rules:
- Quote the candidate verbatim at least 2 times (short phrases).
- For each quote, ground an evaluation point: "Based on the candidate saying X, their understanding of Y is Z."
- Be specific and actionable. Avoid generic praise.

Scoring Guide:
- 90-100: Excellent
- 70-89: Good
- 50-69: Average
- 30-49: Poor
- 0-29: Failed

Return ONLY valid JSON, no additional text.`;
    }

    _buildFollowUpPrompt(previousQA) {
        return `Based on this previous Q&A, generate a relevant follow-up question:

**Previous Question:** ${previousQA.question}
**Answer:** ${previousQA.answer}
**Score:** ${previousQA.score}/100

Generate a follow-up question that:
1. Digs deeper into the topic
2. Addresses gaps in the previous answer
3. Maintains appropriate difficulty

Return JSON with same structure as before.`;
    }

    async _callGroq(prompt) {
        if (!this.apiKey) {
            throw new Error("Groq API key not configured. Set GROQ_API_KEY in .env");
        }

        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: this.modelName,
                    messages: [{ role: "user", content: prompt }],
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                },
                {
                    timeout: this.timeout,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                },
            );

            return response.data?.choices?.[0]?.message?.content || "";
        } catch (error) {
            const apiMessage = error.response?.data?.error?.message;
            throw new Error(apiMessage || error.message || "Groq request failed");
        }
    }

    _parseQuestionResponse(response) {
        try {
            let cleanResponse = response.trim();
            cleanResponse = cleanResponse.replace(/^```json\s*/i, "");
            cleanResponse = cleanResponse.replace(/^```\s*/, "");
            cleanResponse = cleanResponse.replace(/\s*```$/, "");
            cleanResponse = cleanResponse.trim();

            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResponse);

            return {
                question: typeof parsed.question === "string" ? parsed.question : cleanResponse,
                type: parsed.type || "technical",
                difficulty: parsed.difficulty || "medium",
                topic: parsed.topic || null,
                followUps: parsed.follow_ups || parsed.followUps || [],
                evaluationCriteria: parsed.evaluation_criteria || parsed.evaluationCriteria || null,
                conceptTags: parsed.concept_tags || parsed.conceptTags || [],
                expectedKeywords: parsed.expectedKeywords || [],
                problemSpec: parsed.problemSpec || null,
                metadata: { rawResponse: response },
            };
        } catch (error) {
            console.error("[GroqInterviewLLM] Failed to parse question response:", error.message);
            return {
                question: response.trim(),
                type: "technical",
                difficulty: "medium",
                topic: null,
                followUps: [],
                evaluationCriteria: null,
                conceptTags: [],
                expectedKeywords: [],
                problemSpec: null,
                metadata: { parseError: true },
            };
        }
    }

    _parseEvaluationResponse(response) {
        try {
            let cleanResponse = response.trim();
            cleanResponse = cleanResponse.replace(/^```json\s*/i, "");
            cleanResponse = cleanResponse.replace(/^```\s*/, "");
            cleanResponse = cleanResponse.replace(/\s*```$/, "");
            cleanResponse = cleanResponse.trim();

            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResponse);

            return {
                score: Math.min(100, Math.max(0, parsed.score || 50)),
                verdict: parsed.verdict || "average",
                feedback: parsed.feedback || "No feedback provided",
                detectedMistakes: parsed.detectedMistakes || [],
                strengths: parsed.strengths || [],
                improvements: parsed.improvements || [],
                followUpSuggested: parsed.followUpSuggested || false,
                metadata: { rawResponse: response },
            };
        } catch (error) {
            console.error("[GroqInterviewLLM] Failed to parse evaluation response:", error.message);
            return {
                score: 50,
                verdict: "average",
                feedback: response.trim(),
                detectedMistakes: [],
                strengths: [],
                improvements: [],
                followUpSuggested: false,
                metadata: { parseError: true },
            };
        }
    }

    async healthCheck() {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                timeout: 5000,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error("[GroqInterviewLLM] Health check failed:", error.message);
            return false;
        }
    }
}
