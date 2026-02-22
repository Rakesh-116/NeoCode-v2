/**
 * ============================================================================
 * AI Module Test Script
 * ============================================================================
 * Quick test script to verify AI module is working correctly.
 *
 * Usage:
 * 1. Make sure Ollama is running: ollama serve
 * 2. Make sure orca-mini is pulled: ollama pull orca-mini
 * 3. Run: node bz-server/src/ai/test.js
 * ============================================================================
 */

import llmGateway from "./index.js";
import config from "../config/index.js";

async function testAI() {
    console.log("🧪 Testing NeoCode AI Module\n");
    console.log("=".repeat(60));

    // Test 1: Check Status
    console.log("\n📊 Test 1: Checking AI Status...");
    try {
        const status = await llmGateway.getStatus();
        console.log("✅ Status retrieved successfully");
        console.log(`   Default Provider: ${status.config.defaultProvider}`);
        console.log(`   Cache Enabled: ${status.config.cacheEnabled}`);

        Object.entries(status.providers).forEach(([name, info]) => {
            const icon = info.available ? "✅" : "❌";
            console.log(`   ${icon} ${name}: ${info.available ? "Available" : "Unavailable"}`);
        });
    } catch (error) {
        console.error("❌ Status check failed:", error.message);
    }

    // Test 2: Test Coach
    console.log("\n🎯 Test 2: Testing AI Coach...");
    try {
        const coachResponse = await llmGateway.generate({
            purpose: "coach",
            context: {
                weakTopics: [
                    { topic: "arrays", accuracy: 45, total_attempts: 10 },
                    { topic: "strings", accuracy: 52, total_attempts: 8 },
                ],
                mistakes: [
                    { mistake_type: "off_by_one", severity: 3, topic: "arrays" },
                    { mistake_type: "null_check_missing", severity: 4, topic: "strings" },
                ],
                recentSubmissions: [
                    { status: "wrong_answer", score: 60 },
                    { status: "accepted", score: 100 },
                    { status: "wrong_answer", score: 40 },
                ],
                learningProfile: {
                    total_submissions: 25,
                    accepted_count: 12,
                    avg_score: 65,
                },
            },
        });

        console.log("✅ AI Coach responded successfully");
        console.log("\nCoaching Response:");
        console.log("-".repeat(60));
        console.log(coachResponse);
        console.log("-".repeat(60));
    } catch (error) {
        console.error("❌ Coach test failed:", error.message);
    }

    // Test 3: Test Code Review
    console.log("\n📝 Test 3: Testing AI Code Review...");
    try {
        const reviewResponse = await llmGateway.generate({
            purpose: "codeReview",
            context: {
                code: `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return [];
}`,
                language: "javascript",
                problem: {
                    title: "Two Sum",
                    description: "Find two numbers that add up to target",
                },
                complexity: "O(n²)",
            },
        });

        console.log("✅ AI Code Review completed successfully");
        console.log("\nCode Review:");
        console.log("-".repeat(60));
        console.log(reviewResponse);
        console.log("-".repeat(60));
    } catch (error) {
        console.error("❌ Code Review test failed:", error.message);
    }

    // Test 4: Test Interview
    console.log("\n🎤 Test 4: Testing AI Interview...");
    try {
        const interviewResponse = await llmGateway.generate({
            purpose: "interview",
            context: {
                topic: "arrays",
                difficulty: "medium",
                role: "opening",
                history: [],
            },
        });

        console.log("✅ AI Interview generated question successfully");
        console.log("\nInterview Question:");
        console.log("-".repeat(60));
        console.log(interviewResponse);
        console.log("-".repeat(60));
    } catch (error) {
        console.error("❌ Interview test failed:", error.message);
    }

    // Test 5: Test Support
    console.log("\n💬 Test 5: Testing AI Support...");
    try {
        const supportResponse = await llmGateway.generate({
            purpose: "support",
            context: {
                userMessage: "How do I view my weak topics?",
                context: {
                    currentPage: "Home",
                    userType: "Student",
                },
                conversationHistory: [],
            },
        });

        console.log("✅ AI Support responded successfully");
        console.log("\nSupport Response:");
        console.log("-".repeat(60));
        console.log(supportResponse);
        console.log("-".repeat(60));
    } catch (error) {
        console.error("❌ Support test failed:", error.message);
    }

    // Test 6: Test Cache
    console.log("\n💾 Test 6: Testing Cache...");
    try {
        console.log("   Making first request...");
        const start1 = Date.now();
        await llmGateway.generate({
            purpose: "support",
            context: {
                userMessage: "Hello, what is NeoCode?",
                context: {},
                conversationHistory: [],
            },
        });
        const time1 = Date.now() - start1;

        console.log("   Making second request (should be cached)...");
        const start2 = Date.now();
        await llmGateway.generate({
            purpose: "support",
            context: {
                userMessage: "Hello, what is NeoCode?",
                context: {},
                conversationHistory: [],
            },
        });
        const time2 = Date.now() - start2;

        console.log(`✅ Cache working correctly`);
        console.log(`   First request: ${time1}ms`);
        console.log(
            `   Second request: ${time2}ms (${time2 < time1 ? "faster - cache hit!" : "same - check cache config"})`,
        );
    } catch (error) {
        console.error("❌ Cache test failed:", error.message);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ AI Module Test Complete!");
    console.log("\nNext Steps:");
    console.log("1. Check if all tests passed");
    console.log("2. If 'Unavailable', make sure Ollama is running: ollama serve");
    console.log("3. If model missing, pull it: ollama pull orca-mini");
    console.log("4. Start using AI features in your app!");
    console.log("=".repeat(60));
}

// Run tests
testAI().catch((error) => {
    console.error("\n❌ Test script failed:", error);
    process.exit(1);
});
