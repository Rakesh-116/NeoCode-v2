import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import { Oval } from "react-loader-spinner";
import { FaAngleRight } from "react-icons/fa6";
import Editor from "@monaco-editor/react";

import CodeEditor from "./CodeEditor";
import Header from "../Header";
import { useUser } from "../../../context/UserContext";
import { difficultyLevelsProperties } from "../../Common/constants";

const apiStatusConstants = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const submissionStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const selectRequestConstants = {
  description: "DESCRIPTION",
  submissions: "SUBMISSIONS",
};

const ProblemPage = () => {
  const [problem, setProblem] = useState(null);
  const [apiStatus, setApiStatus] = useState(apiStatusConstants.initial);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [selectRequest, setSelectRequest] = useState(
    selectRequestConstants.description
  );
  const [submissionStatus, setSubmissionStatus] = useState(
    submissionStatusConstant.initial
  );
  const [submissionList, setSubmissionList] = useState([]);
  const [selectSubmission, setSelectSubmission] = useState(null);
  const { userData } = useUser();
  const [openEditorData, setOpenEditorData] = useState({
    code: null,
    language: null,
  });
  const [courseDetails, setCourseDetails] = useState(null);
  const [courseProblems, setCourseProblems] = useState([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(-1);

  const { id } = useParams();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get("submission_id");
  const courseId = searchParams.get("courseId");
  const tabFromUrl = searchParams.get("tab");

  // Initialize tab from URL on component mount
  useEffect(() => {
    if (tabFromUrl === "submissions") {
      setSelectRequest(selectRequestConstants.submissions);
    } else if (tabFromUrl === "description") {
      setSelectRequest(selectRequestConstants.description);
    } else if (!tabFromUrl) {
      // If no tab parameter in URL, set default to description and update URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("tab", "description");
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (selectRequest === selectRequestConstants.description) fetchProblem();
    else if (selectRequest === selectRequestConstants.submissions) {
      fetchSubmissions();
    }
  }, [id, selectRequest, courseId]);



  // Fetch course details if courseId is present
  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId, id]); // Add 'id' to dependency array so it refetches when problem changes



  const fetchCourseDetails = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_BASE_URL}/api/courses/${courseId}`, { headers });
      
      if (response.data.success) {
        setCourseDetails(response.data.course);
        setCourseProblems(response.data.course.problems || []);
        
        // Find current problem index in the course (convert both to string for comparison)
        const problemIndex = response.data.course.problems?.findIndex(p => 
          String(p.problem_id) === String(id)
        ) ?? -1;
        
        console.log('Setting problem index:', problemIndex, 'for problem ID:', id);
        console.log('Course problems:', response.data.course.problems?.map(p => ({id: p.problem_id, title: p.problem_title})));
        
        setCurrentProblemIndex(problemIndex);
      }
    } catch (error) {
      console.error("Error fetching course details:", error);
    }
  };

  const fetchProblem = async () => {
    setApiStatus(apiStatusConstants.inProgress);
    const token = Cookies.get("neo_code_jwt_token");
    if (!token) {
      navigate("/login");
      return;
    }
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    try {
      let url = `${API_BASE_URL}/api/problem/get/${id}`;
      if (submissionId) {
        url += `?submission_id=${submissionId}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(response);
      const data = response.data.problem;

      const updatedData = {
        id: data.id,
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        inputFormat: data.input_format,
        outputFormat: data.output_format,
        constraints: data.constraints,
        prohibitedKeys: data.prohibited_keys,
        sampleTestcases: data.sample_testcase,
        explaination: data.explaination,
        solution: data.solution,
        solutionLanguage: data.solution_language,
        score: data.score,
        category: data.category,
      };
      console.log(updatedData);
      setProblem(updatedData);

      const submissionData = response.data.submission;
      if (submissionData != null) {
        openEditor(submissionData.code, submissionData.language);
      }

      setApiStatus(apiStatusConstants.success);
    } catch (error) {
      console.error("Error: ", error);
      setApiStatus(apiStatusConstants.failure);
      if (error.response.status === 405) {
        navigate("/login");
      }
    }
  };

  const fetchSubmissions = async () => {
    setSelectSubmission(null);
    setSubmissionStatus(submissionStatusConstant.inProgress);
    const token = Cookies.get("neo_code_jwt_token");
    if (!token) {
      navigate("/login");
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    try {
      // If courseId is present, use course-specific endpoint
      let endpoint = `${API_BASE_URL}/api/problem/${id}/get-all-submissions`;
      if (courseId) {
        endpoint += `?courseId=${courseId}`;
      }

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(response.data.submissionDetails);
      setSubmissionList(response.data.submissionDetails);
      setSubmissionStatus(submissionStatusConstant.success);
    } catch (error) {
      console.error("Error: ", error);
      setSubmissionStatus(submissionStatusConstant.failure);
      if (error.response.status === 405) {
        navigate("/login");
      }
    }
  };

  const handleDrag = (e) => {
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 20 && newWidth < 80) {
      setDividerPosition(newWidth);
    }
  };

  const handleMouseDown = () => {
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener(
      "mouseup",
      () => {
        document.removeEventListener("mousemove", handleDrag);
      },
      { once: true }
    );
  };

  const renderLoader = () => (
    <div className="flex justify-center items-center h-screen">
      <Oval
        height={50}
        width={50}
        color="#4fa94d"
        strokeWidth={4}
        strokeWidthSecondary={4}
      />
    </div>
  );

  const renderFailure = () => (
    <div className="text-center text-white mt-10">
      <h2 className="text-2xl font-semibold">Failed to fetch problem</h2>
      <p className="text-lg">Please try again later.</p>
    </div>
  );

  const calculateTime = (submissionTime) => {
    const now = new Date();
    const submissionDate = new Date(submissionTime); // milliseconds
    const diffInSeconds = Math.floor((now - submissionDate) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 365) {
      return `${diffInDays} days ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} years ago`;
  };

  const fetchSubTaskInfo = (testResults) => {
    // console.log(testResults);
    let c = 0;
    testResults.forEach((res) => {
      if (res.verdict === "ACCEPTED") c++;
    });
    return (
      <p>
        {c}/{testResults.length}
      </p>
    );
  };

  const openEditor = (code, language) => {
    switchTab(selectRequestConstants.description);
    setOpenEditorData({
      code,
      language,
    });
  };

  // Helper function to update both state and URL when switching tabs
  const switchTab = (tabType) => {
    setSelectRequest(tabType);
    
    // Update URL parameters
    const newSearchParams = new URLSearchParams(searchParams);
    if (tabType === selectRequestConstants.description) {
      newSearchParams.set("tab", "description");
    } else if (tabType === selectRequestConstants.submissions) {
      newSearchParams.set("tab", "submissions");
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  // Navigation helpers for course problems
  const navigateToPreviousProblem = () => {
    if (currentProblemIndex > 0 && courseProblems.length > 0) {
      const prevProblem = courseProblems[currentProblemIndex - 1];
      navigate(`/problems/${prevProblem.problem_id}?courseId=${courseId}&tab=description`);
    }
  };

  const navigateToNextProblem = () => {
    if (currentProblemIndex < courseProblems.length - 1 && courseProblems.length > 0) {
      const nextProblem = courseProblems[currentProblemIndex + 1];
      navigate(`/problems/${nextProblem.problem_id}?courseId=${courseId}&tab=description`);
    }
  };

  const onMount = (editor) => {
    editor.focus();

    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener(
        "wheel",
        (e) => {
          const target = e.currentTarget;
          if (target) {
            const { scrollHeight, clientHeight, scrollTop } = target;
            const atTop = scrollTop === 0 && e.deltaY < 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight;

            if (atTop || atBottom) {
              e.preventDefault();
              e.stopPropagation();
              window.scrollBy(0, e.deltaY);
            }
          }
        },
        { passive: false }
      );
    }
  };

  const renderSuccess = () => (
    <div>
      {selectRequest === selectRequestConstants.description ? (
        <div className="flex justify-evenly">
          <div className="w-1/2 h-screen overflow-y-scroll scroll-smooth">
            <h3 className="my-2 text-2xl text-white font-bold">
              {problem.title}
            </h3>
            {/* {courseId && (
              <div className="mb-4 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-sm flex items-center">
                  📚 You're solving this problem as part of a course
                  <button
                    onClick={() => navigate(`/courses/${courseId}`)}
                    className="ml-2 text-blue-300 hover:text-blue-200 underline"
                  >
                    Back to Course
                  </button>
                </p>
              </div>
            )} */}
            <span
              className={`p-[1px] px-[4px] font-bold text-xs rounded-md ${
                difficultyLevelsProperties[problem.difficulty.toLowerCase()]
                  .bgColor
              } ${
                difficultyLevelsProperties[problem.difficulty.toLowerCase()]
                  .color
              }`}
            >
              {problem.difficulty.toUpperCase()}
            </span>
            <Section title="Description" content={problem.description} />
            <Section
              title="Prohibited Keywords"
              content={
                !problem.prohibitedKeys
                  ? "No prohibited keys for this problem."
                  : ""
              }
            />
            {problem.prohibitedKeys && (
              <div className="text-white">
                {Object.entries(problem.prohibitedKeys).map(([lang, key]) => (
                  <p key={lang}>
                    {lang} : {key}
                  </p>
                ))}
              </div>
            )}
            {/* {console.log(problem.prohibitedKeys)} */}
            <Section title="Input Format" content={problem.inputFormat} />
            <Section title="Output Format" content={problem.outputFormat} />
            <hr className="border-white/20 w-full my-4" />
            <h3 className="text-white text-lg font-semibold">Constraints</h3>
            {console.log(problem.constraints)}
            {problem.constraints.split(",").map((item, index) => (
              <span key={index} className="text-white">
                {item.trim()}
                <br />
              </span>
            ))}
            {/* {console.log(problem.sampleTestcases)} */}
            <hr className="border-white/20 w-full my-4" />
            <h3 className="text-white text-lg font-semibold">Example</h3>
            <div className="w-full flex items-start text-white mt-4">
              <div className="w-1/2 mr-2">
                <p>Input</p>
                <div className="bg-slate-600 py-2 px-3 rounded-md my-2">
                  {problem.sampleTestcases.input
                    .split("\n")
                    .map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                </div>
              </div>
              <div className="w-1/2 mr-2">
                <p>Output</p>
                <div className="bg-slate-600 py-2 px-3 rounded-md my-2">
                  {/* {problem.sampleTestcases.output
                    .split("\n")
                    .map((line, index) => {
                      console.log(line);
                      return <pre key={index}>{line}</pre>;
                    })} */}
                  <pre>{problem.sampleTestcases.output}</pre>
                </div>
              </div>
              <div className="w-full mr-2">
                <p>Explaination</p>
                <div className="bg-slate-600 py-2 px-3 rounded-md my-2">
                  {problem.explaination}
                </div>
              </div>
            </div>
          </div>

          {/* Resizable Divider */}
          {/* <div
            className="w-2 bg-gray-400 cursor-col-resize"
            onMouseDown={(e) => handleMouseDown()}
          ></div> */}

          <div className="w-1/2">
            {problem.category[0] === "Web" ? (
              <div className="flex flex-col justify-center items-center text-center space-y-4 text-white h-full">
                {/* Instructions Section */}
                <h2 className="text-xl font-semibold">
                  Read Before Opening the IDE
                </h2>
                <p className="text-gray-300 max-w-lg">
                  Carefully read the problem statement before starting. This IDE
                  allows you to write, edit, and preview your code live.
                  Clicking the button below will open **GitHub Codespaces**,
                  where you can write the code in an pre-initialized
                  environment.
                </p>

                {/* Open IDE Button */}
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
                  onClick={() => {
                    const codespaceUrl = `https://laughing-space-adventure-j64wqrjw49x3qxgp.github.dev/`;
                    window.open(codespaceUrl, "_blank");
                  }}
                >
                  Open in GitHub Codespaces
                </button>
              </div>
            ) : (
              <div className="text-white">
                <CodeEditor
                  problemId={id}
                  title={problem.title}
                  sampleIO={problem.sampleTestcases}
                  prohibitedKeys={
                    problem.prohibitedKeys ? problem.prohibitedKeys : null
                  }
                  solution={problem.solution}
                  openEditorData={openEditorData}
                  courseId={courseId}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full flex scroll-smooth">
          <div className="w-[30%] my-4 h-[650px] overflow-auto pr-4">
            <div className="border-[1px] border-slate-500 rounded-lg py-6 px-4">
              <h1 className="text-white font-bold text-lg">
                {courseId ? "Course Submissions" : "Submissions"} for: {problem.title}
              </h1>
            </div>
            <div className="flex flex-col items-center">
              {submissionList.length === 0 ? (
                <h1 className="text-white my-2">No Submissions</h1>
              ) : (
                <div className="w-full">
                  {submissionList.map((submission) => (
                    <button
                      key={submission.id}
                      className={`my-2 border-[1px] border-slate-500 rounded-2xl p-3 text-white flex justify-between items-center w-full hover:bg-slate-600 ${
                        selectSubmission !== null &&
                        selectSubmission.id === submission.id
                          ? "bg-slate-700"
                          : ""
                      }`}
                      onClick={() => setSelectSubmission(submission)}
                    >
                      <div className="w-2/5 flex flex-col justify-start items-start">
                        <h1
                          className={`font-bold ${
                            submission.verdict === "ACCEPTED"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {submission.verdict}
                        </h1>
                        <p className="text-sm">
                          {calculateTime(submission.submission_time)}
                        </p>
                      </div>
                      <span className="p-[1px] px-[4px] bg-blue-400 text-blue-50 font-bold text-xs rounded-md">
                        {submission.language.toUpperCase()}
                      </span>
                      <FaAngleRight />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="w-[70%]">
            {selectSubmission === null ? (
              <h1 className="text-gray-400 text-center py-20">
                No Submission Selected.
              </h1>
            ) : (
              <div className="w-full p-6">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <Link
                      className="text-white text-xl cursor-pointer"
                      to="/profile"
                    >
                      {userData?.username || "User"}
                    </Link>
                    <p className="text-gray-500 font-semibold text-sm">
                      {new Date(
                        selectSubmission.submission_time
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-black/70 p-2 rounded-lg border border-white/20">
                    <button
                      className="text-blue-600"
                      onClick={() =>
                        openEditor(
                          selectSubmission.code,
                          selectSubmission.language
                        )
                      }
                    >
                      Open In Editor
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="flex flex-col justify-start items-start">
                      <h1 className="text-gray-200">Verdict:</h1>
                      <h1
                        className={`font-bold ${
                          selectSubmission.verdict === "ACCEPTED"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {selectSubmission.verdict}
                      </h1>
                    </div>
                    <span className="p-[1px] px-[4px] bg-blue-400 text-blue-50 font-bold text-xs rounded-md">
                      {selectSubmission.language.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-slate-300 flex gap-2 items-center">
                      {fetchSubTaskInfo(selectSubmission.test_results)}Sub Tasks
                    </h1>
                  </div>
                </div>
                <div className="my-4">
                  <Editor
                    height="60vh"
                    width="100%"
                    language={selectSubmission.language}
                    theme="vs-dark"
                    value={selectSubmission.code}
                    onMount={onMount}
                    options={{
                      fontSize: 16,
                      minimap: { enabled: false },
                      readOnly: true,
                      padding: { top: 10, bottom: 10 },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Header />
      <div className="w-full p-[2%] bg-black/95 min-h-screen pt-28">
        {/* Breadcrumb Navigation */}
        <nav className="mb-4">
          <ol className="flex items-center space-x-2 text-sm">
            {courseId ? (
              // Course context navigation
              <>
                <li>
                  <button
                    onClick={() => navigate('/courses')}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Courses
                  </button>
                </li>
                <li className="text-white/50">›</li>
                <li>
                  <button
                    onClick={() => navigate(`/courses/${courseId}`)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {courseDetails?.title || 'Course'}
                  </button>
                </li>
                <li className="text-white/50">›</li>
                <li className="text-white/70 truncate max-w-xs">
                  {problem?.title || 'Loading...'}
                </li>
              </>
            ) : (
              // Regular problems navigation
              <>
                <li>
                  <button
                    onClick={() => navigate('/problemset')}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Problem Set
                  </button>
                </li>
                <li className="text-white/50">›</li>
                <li className="text-white/70 truncate max-w-xs">
                  {problem?.title || 'Loading...'}
                </li>
              </>
            )}
          </ol>
        </nav>

        <div className="flex items-center justify-between mb-2">
          {/* Description/Submissions Tabs */}
          <div className="bg-slate-700 p-[4px] rounded-xl w-[240px] flex justify-between relative overflow-hidden">
          <div
            className={`absolute top-1 bottom-1 w-[48%] bg-blue-600 rounded-2xl transition-transform duration-300 ${
              selectRequest === selectRequestConstants.submissions
                ? "translate-x-full"
                : "translate-x-0"
            }`}
          ></div>

          <button
            className="p-[10px] rounded-2xl text-white font-semibold  z-10 w-[50%]"
            onClick={() => switchTab(selectRequestConstants.description)}
          >
            Description
          </button>

          <button
            className="p-[10px] rounded-2xl text-white font-semibold z-10 w-[50%]"
            onClick={() => switchTab(selectRequestConstants.submissions)}
          >
            Submissions
          </button>
          </div>

          {/* Simple Prev/Next Navigation for Course Problems */}
          {courseId && courseProblems.length > 1 && currentProblemIndex >= 0 && (
            <div className="flex space-x-2">
              <button
                onClick={navigateToPreviousProblem}
                disabled={currentProblemIndex <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-lg transition-colors"
              >
                Prev
              </button>
              <button
                onClick={navigateToNextProblem}
                disabled={currentProblemIndex >= courseProblems.length - 1}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {selectRequest === selectRequestConstants.description ? (
          <>
            {apiStatus === apiStatusConstants.inProgress && renderLoader()}
            {apiStatus === apiStatusConstants.failure && renderFailure()}
            {apiStatus === apiStatusConstants.success && renderSuccess()}
          </>
        ) : (
          <>
            {submissionStatus === submissionStatusConstant.inProgress &&
              renderLoader()}
            {submissionStatus === submissionStatusConstant.success &&
              renderSuccess()}
          </>
        )}
      </div>
    </>
  );
};

const Section = ({ title, content }) => (
  <>
    <hr className="border-white/20 w-full my-4" />
    <h3 className="text-white text-lg font-semibold">{title}</h3>
    <p className="text-white">{content}</p>
  </>
);

export default ProblemPage;
