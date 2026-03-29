import executeJavaCode from "../../controllers/compilers/executeJavaCode.controller.js";
import executePythonCode from "../../controllers/compilers/executePythonCode.controller.js";
import executeCppCode from "../../controllers/compilers/executeCppCode.controller.js";

const getExecutor = (languageRaw) => {
  const language = (languageRaw || "").toLowerCase();
  if (language === "java") return executeJavaCode;
  if (language === "python") return executePythonCode;
  if (language === "cpp" || language === "c++") return executeCppCode;
  return null;
};

export async function execute(code, language, stdin, testId) {
  const executor = getExecutor(language);
  if (!executor) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return executor(code, stdin || "", testId);
}
