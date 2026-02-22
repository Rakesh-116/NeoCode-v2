/**
 * ============================================================================
 * Code Review Prompt - AI Code Reviewer
 * ============================================================================
 * Purpose: Provide constructive code feedback on accepted submissions.
 *
 * Key principles:
 * - Do NOT judge correctness (already accepted)
 * - Focus on readability, performance, edge cases
 * - Suggest improvements, not rewrites
 * - Be senior engineer, not compiler
 * ============================================================================
 */

/**
 * Generate code review prompt
 * @param {Object} context - Code review context
 * @param {string} context.code - The submitted code
 * @param {string} context.language - Programming language
 * @param {Object} context.problem - Problem details
 * @param {string} context.complexity - Time complexity if available
 * @returns {string} Formatted prompt for LLM
 */
export const codeReviewPrompt = (context) => {
    const { code, language, problem = {}, complexity = "Unknown" } = context;

    return `You are a senior software engineer conducting a code review.

CODE SUBMISSION (ALREADY ACCEPTED):
Language: ${language}
Problem: ${problem.title || "N/A"}
Description: ${problem.description || "N/A"}
Time Complexity: ${complexity}

CODE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

CRITICAL RULES:
- Do NOT judge correctness. This code passed all test cases.
- Do NOT rewrite the entire code.
- Focus on professional code review aspects.
- Keep feedback concise (max 150 words).

YOUR TASK:
Provide constructive feedback on:
1. Readability & Code Style (2 specific improvements)
2. Performance (1 optimization suggestion if applicable)
3. Edge Cases (1 potential issue they might not have considered)
4. Professional tip (1 best practice relevant to this code)

Format:
📖 Readability:
  - [Specific improvement]
  - [Specific improvement]

⚡ Performance:
  - [Optimization suggestion or "Looks good"]

🔍 Edge Cases:
  - [Potential issue or "Well covered"]

✨ Pro Tip: [One best practice]

Keep it actionable and specific.`;
};
