import dotenv from "dotenv";
import path from "path";

// Works whether CWD is the repo root or bz-server/
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const get = (name, fallback) => process.env[name] ?? fallback;

const config = {
    JWT_SECRET_KEY: get("JWT_SECRET_KEY", "dev_secret_fallback"),
    PYTHON_CONTAINER_NAME: get("PYTHON_CONTAINER_NAME", "python-container"),
    JAVA_CONTAINER_NAME: get("JAVA_CONTAINER_NAME", "java-container"),
    CPP_CONTAINER_NAME: get("CPP_CONTAINER_NAME", "cpp-container"),
    // worker directories (relative to this file's parent 'src')
    WORKERS_DIR: get("WORKERS_DIR", "src/workers"),
    // Code execution provider
    CODE_EXECUTION_PROVIDER: get("CODE_EXECUTION_PROVIDER", "docker"),
    JUDGE0_BASE_URL: get("JUDGE0_BASE_URL", ""),
    JUDGE0_API_KEY: get("JUDGE0_API_KEY", ""),

    // AI/LLM Configuration
    AI: {
        // Feature flags
        ENABLE_AI_COACH: get("ENABLE_AI_COACH", "true") === "true",
        ENABLE_AI_INTERVIEW: get("ENABLE_AI_INTERVIEW", "true") === "true",
        ENABLE_AI_CODE_REVIEW: get("ENABLE_AI_CODE_REVIEW", "true") === "true",
        ENABLE_AI_SUPPORT: get("ENABLE_AI_SUPPORT", "true") === "true",

        // Default provider (local, openai, gemini)
        DEFAULT_PROVIDER: get("AI_DEFAULT_PROVIDER", "local"),

        // LLM request configuration
        REQUEST_TIMEOUT: parseInt(get("AI_REQUEST_TIMEOUT", "30000")), // 30 seconds
        MAX_RETRIES: parseInt(get("AI_MAX_RETRIES", "2")),
        CACHE_ENABLED: get("AI_CACHE_ENABLED", "true") === "true",
        CACHE_EXPIRY: parseInt(get("AI_CACHE_EXPIRY", "86400")), // 24 hours in seconds

        // Provider-specific configuration
        OLLAMA: {
            BASE_URL: get("OLLAMA_BASE_URL", "http://localhost:11434"),
            MODEL: get("OLLAMA_MODEL", "orca-mini"),
            TEMPERATURE: parseFloat(get("OLLAMA_TEMPERATURE", "0.2")),
        },

        OPENAI: {
            API_KEY: get("OPENAI_API_KEY", ""),
            MODEL: get("OPENAI_MODEL", "gpt-3.5-turbo"),
            TEMPERATURE: parseFloat(get("OPENAI_TEMPERATURE", "0.2")),
        },

        GEMINI: {
            API_KEY: get("GEMINI_API_KEY", ""),
            MODEL: get("GEMINI_MODEL", "gemini-2.0-flash"),
            TEMPERATURE: parseFloat(get("GEMINI_TEMPERATURE", "0.2")),
        },
    },
};

export default config;
