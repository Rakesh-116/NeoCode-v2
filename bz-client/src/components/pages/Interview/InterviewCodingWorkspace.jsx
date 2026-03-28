import { useMemo } from "react";
import CodeEditor from "../problems/CodeEditor";
import AudioPlayer from "./AudioPlayer";
import { difficultyLevelsProperties } from "../../Common/constants";

const normalizeProblemData = (question, turnNumber) => {
  const raw = question?.problem;
  if (raw) {
    return {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      difficulty: raw.difficulty || question?.difficulty || "medium",
      inputFormat: raw.input_format,
      outputFormat: raw.output_format,
      constraints: raw.constraints,
      prohibitedKeys: raw.prohibited_keys,
      sampleTestcases: raw.sample_testcase || { input: "", output: "" },
      explaination: raw.explaination,
      solution: raw.solution,
      solutionLanguage: raw.solution_language,
      category: raw.category,
    };
  }

  const tryParseQuestionJson = (value) => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes('"question"')) return null;

    let candidate = trimmed;
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidate = candidate.slice(firstBrace, lastBrace + 1);
    }
    candidate = candidate.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");

    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < candidate.length; i += 1) {
      const ch = candidate[i];
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        out += ch;
        inString = !inString;
        continue;
      }
      if (!inString && (ch === "{" || ch === ",")) {
        out += ch;
        let j = i + 1;
        while (j < candidate.length && /\s/.test(candidate[j])) {
          out += candidate[j];
          j += 1;
        }
        if (candidate[j] === "\"") {
          i = j - 1;
          continue;
        }
        const keyStart = j;
        while (j < candidate.length && /[A-Za-z0-9_]/.test(candidate[j])) {
          j += 1;
        }
        const key = candidate.slice(keyStart, j);
        if (key.length > 0) {
          let k = j;
          while (k < candidate.length && /\s/.test(candidate[k])) {
            k += 1;
          }
          if (candidate[k] === ":") {
            out += `"${key}"`;
            i = j - 1;
            continue;
          }
        }
      }
      out += ch;
    }

    out = out.replace(/,\s*([}\]])/g, "$1").trim();

    try {
      return JSON.parse(out);
    } catch (error) {
      return null;
    }
  };

  const parsed = tryParseQuestionJson(question?.question);
  if (parsed?.problemSpec) {
    const spec = parsed.problemSpec || {};
    return {
      id: question?.problemId || null,
      title: spec.title || `Interview Coding Question ${turnNumber}`,
      description: spec.description || parsed.question || "Problem statement is unavailable.",
      difficulty: parsed.difficulty || question?.difficulty || "medium",
      inputFormat: spec.input_format || "N/A",
      outputFormat: spec.output_format || "N/A",
      constraints: spec.constraints || "N/A",
      prohibitedKeys: spec.prohibited_keys || null,
      sampleTestcases: spec.sample_testcase || { input: "", output: "" },
      explaination: spec.explaination,
      solution: null,
      solutionLanguage: null,
      category: spec.category || [],
    };
  }

  return {
    id: question?.problemId || null,
    title: `Interview Coding Question ${turnNumber}`,
    description: question?.question || "Problem statement is unavailable.",
    difficulty: question?.difficulty || "medium",
    inputFormat: "N/A",
    outputFormat: "N/A",
    constraints: "N/A",
    prohibitedKeys: null,
    sampleTestcases: { input: "", output: "" },
    explaination: "",
    solution: null,
    solutionLanguage: null,
    category: [],
  };
};

const Section = ({ title, content }) => (
  <>
    <hr className="border-white/10 w-full my-4" />
    <h3 className="text-white text-lg font-semibold">{title}</h3>
    <p className="text-white/90">{content || "N/A"}</p>
  </>
);

const InterviewCodingWorkspace = ({ sessionId, turnNumber, question }) => {
  const editorTitle = `Interview ${sessionId} - Q${turnNumber}`;
  const turnId = question?.turnId;
  const executeEndpoint = `/api/interview/${sessionId}/turn/${turnId || "invalid"}/code/execute`;
  const submitEndpoint = `/api/interview/${sessionId}/turn/${turnId || "invalid"}/code/submit`;
  const problem = useMemo(() => normalizeProblemData(question, turnNumber), [question, turnNumber]);

  const difficultyKey = (problem.difficulty || "medium").toLowerCase();
  const difficultyStyles =
    difficultyLevelsProperties[difficultyKey] || difficultyLevelsProperties.medium;

  const constraints = problem.constraints || "N/A";
  const constraintList =
    typeof constraints === "string" && constraints.includes(",")
      ? constraints.split(",").map((item) => item.trim()).filter(Boolean)
      : null;

  const toDisplayString = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  };

  const sampleInput = toDisplayString(problem.sampleTestcases?.input || "");
  const sampleOutput = toDisplayString(problem.sampleTestcases?.output || "");

  const meta = question?.questionMeta || {};
  const conceptTags = question?.conceptTags || meta.conceptTags || [];
  const followUps = meta.followUps || [];
  const evaluationCriteria =
    question?.validationCriteria?.evaluation_criteria ||
    meta.evaluationCriteria ||
    null;
  const topic = meta.topic || question?.topic || null;
  const hasMeta =
    topic ||
    evaluationCriteria ||
    (conceptTags && conceptTags.length > 0) ||
    (followUps && followUps.length > 0);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,1fr)_minmax(520px,1.4fr)] gap-6">
        <div className="space-y-4">
          <div className="border border-white/10 rounded-xl py-6 px-6 bg-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-white/60 text-sm">Coding Question {turnNumber}</div>
              <span
                className={`p-[1px] px-[6px] font-bold text-xs rounded-md ${difficultyStyles.bgColor} ${difficultyStyles.color}`}
              >
                {String(problem.difficulty || "medium").toUpperCase()}
              </span>
            </div>

            <h3 className="text-white text-2xl font-bold mt-3">{problem.title}</h3>

            <Section title="Description" content={problem.description} />
            <Section title="Input Format" content={problem.inputFormat} />
            <Section title="Output Format" content={problem.outputFormat} />

            {hasMeta && (
              <>
                <hr className="border-white/10 w-full my-4" />
                <h3 className="text-white text-lg font-semibold">Interview Metadata</h3>
                {topic && (
                  <p className="text-white/90">
                    <span className="text-white/60">Topic:</span> {topic}
                  </p>
                )}
                {evaluationCriteria && (
                  <p className="text-white/90">
                    <span className="text-white/60">Evaluation Criteria:</span> {evaluationCriteria}
                  </p>
                )}
                {conceptTags && conceptTags.length > 0 && (
                  <p className="text-white/90">
                    <span className="text-white/60">Concept Tags:</span> {conceptTags.join(", ")}
                  </p>
                )}
                {followUps && followUps.length > 0 && (
                  <p className="text-white/90">
                    <span className="text-white/60">Suggested Follow-ups:</span> {followUps.join(" • ")}
                  </p>
                )}
              </>
            )}

            <hr className="border-white/10 w-full my-4" />
            <h3 className="text-white text-lg font-semibold">Constraints</h3>
            {constraintList ? (
              <div className="text-white/90">
                {constraintList.map((item, index) => (
                  <div key={`${item}-${index}`}>{item}</div>
                ))}
              </div>
            ) : (
              <p className="text-white/90">{constraints}</p>
            )}

            <hr className="border-white/10 w-full my-4" />
            <h3 className="text-white text-lg font-semibold">Example</h3>
            <div className="w-full flex flex-col md:flex-row gap-4 text-white mt-4">
              <div className="md:w-1/2 w-full">
                <p className="text-white/70">Input</p>
                <div className="bg-white/10 py-2 px-3 rounded-md mt-2">
                  {sampleInput ? (
                    sampleInput.split("\n").map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))
                  ) : (
                    <p className="text-white/60">No sample input provided.</p>
                  )}
                </div>
              </div>
              <div className="md:w-1/2 w-full">
                <p className="text-white/70">Output</p>
                <div className="bg-white/10 py-2 px-3 rounded-md mt-2">
                  {sampleOutput ? <pre>{sampleOutput}</pre> : <p className="text-white/60">No output provided.</p>}
                </div>
              </div>
            </div>

            {problem.explaination && (
              <div className="mt-4">
                <p className="text-white/70">Explanation</p>
                <div className="bg-white/10 py-2 px-3 rounded-md mt-2">
                  {problem.explaination}
                </div>
              </div>
            )}

            {question?.audio && (
              <div className="mt-6">
                <AudioPlayer audioBase64={question.audio} label="Question Audio" />
              </div>
            )}
          </div>
        </div>

        <div className="my-2">
          <div className="text-white max-h-[100vh] min-h-[540px] overflow-y-auto pr-2">
            <CodeEditor
              problemId={problem.id}
              title={editorTitle}
              sampleIO={problem.sampleTestcases}
              prohibitedKeys={problem.prohibitedKeys}
              solution={problem.solution}
              allowSubmit={Boolean(turnId)}
              allowExpectedOutput={false}
              executeEndpoint={executeEndpoint}
              submitEndpoint={submitEndpoint}
              submitRequiresProblemId={false}
              enableSubmissionModal={false}
              storageKey="interviewStoredDataList"
              editorHeight="42vh"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewCodingWorkspace;
