import axios from "axios";
import config from "../../config/index.js";
import { JUDGE0_LANGUAGE_IDS } from "../languageMap.js";

const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 10;
const RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getLanguageId = (languageRaw) => {
  const language = (languageRaw || "").toLowerCase();
  if (language === "c++") return JUDGE0_LANGUAGE_IDS.cpp;
  return JUDGE0_LANGUAGE_IDS[language] ?? null;
};

export async function execute(code, language, stdin, testId) {
  const languageId = getLanguageId(language);
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const baseUrl = (config.JUDGE0_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("JUDGE0_BASE_URL not configured");
  }

  const apiKey = config.JUDGE0_API_KEY || "";

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey && {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    }),
  };

  const submitResponse = await axios.post(
    `${baseUrl}/submissions?base64_encoded=false&wait=false`,
    {
      source_code: code,
      language_id: languageId,
      stdin: stdin || "",
    },
    { headers },
  );

  const token = submitResponse?.data?.token;
  if (!token) {
    throw new Error("Failed to submit Judge0 job");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const pollResponse = await axios.get(
      `${baseUrl}/submissions/${token}?base64_encoded=false`,
      { headers },
    );

    const data = pollResponse?.data || {};
    const statusId = data?.status?.id ?? 0;

    if (statusId > 2) {
      const statusDescription = data?.status?.description || "";
      let error = data.stderr || data.compile_output || "";

      if (statusId === 5) {
        error = "Time Limit Exceeded";
      } else if (statusId === 6) {
        error = "Compilation Error";
      } else if (statusId === 11) {
        error = "Runtime Error";
      }

      const timeSeconds = parseFloat(data.time);
      const executionTime = Number.isFinite(timeSeconds) ? timeSeconds * 1000 : 0;

      return {
        success: statusId === 3,
        output: (data.stdout || "").trimEnd(),
        error,
        executionTime,
      };
    }
  }

  throw new Error("EXECUTION_TIMEOUT");
}
