import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { toast } from 'react-toastify';

import Header from "../../Header";
import Breadcrumb from "../../../Common/Breadcrumb";
import Modal from "../../../Common/Modal";
import {
  categories,
  difficultyLevels,
  languages,
  difficultyLevelsProperties,
  categoriesList,
} from "../../../Common/constants";

const EditProblem = () => {
  const [solutionLanguage, setSolutionLanguage] = useState(languages[1]);
  const navigate = useNavigate();
  const { id: problemId } = useParams();
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    input_format: "",
    output_format: "",
    prohibited_keys: {
      cpp: "",
      java: "",
      python: "",
    },
    constraints: [],
    sample_testcase: {
      input: "",
      output: "",
    },
    difficulty: difficultyLevels[0],
    score: difficultyLevelsProperties[difficultyLevels[0].toLowerCase()].score,
    hidden_testcases: [
      {
        input: "",
        output: "",
      },
    ],
    explaination: "",
    category: [],
    solution: "",
    hidden: false,
  });

  // New state for form change detection and modal control
  const [originalFormData, setOriginalFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load existing problem data
  useEffect(() => {
    if (problemId) {
      fetchProblemData();
    }
  }, [problemId]);

  const fetchProblemData = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/admin/problems/${problemId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const problem = response.data.problem;
      const testcases = response.data.testcases || [];
      
      // Convert testcases format
      const hiddenTestcases = testcases.map(tc => ({
        input: tc.testcase?.input || "",
        output: tc.testcase?.output || ""
      }));

      const loadedFormData = {
        title: problem.title || "",
        description: problem.description || "",
        input_format: problem.input_format || "",
        output_format: problem.output_format || "",
        prohibited_keys: problem.prohibited_keys || {
          cpp: "",
          java: "",
          python: "",
        },
        constraints: Array.isArray(problem.constraints) ? problem.constraints : [],
        sample_testcase: problem.sample_testcase || {
          input: "",
          output: "",
        },
        difficulty: problem.difficulty || difficultyLevels[0],
        score: problem.score || difficultyLevelsProperties[difficultyLevels[0].toLowerCase()].score,
        hidden_testcases: hiddenTestcases.length > 0 ? hiddenTestcases : [{ input: "", output: "" }],
        explaination: problem.explaination || "",
        category: Array.isArray(problem.category) ? problem.category : 
                  (problem.category ? [problem.category] : []),
        solution: problem.solution || "",
        hidden: problem.hidden || false,
      };

      setFormData(loadedFormData);
      setOriginalFormData(JSON.parse(JSON.stringify(loadedFormData))); // Deep copy
      setSolutionLanguage(problem.solution_language || languages[1]);
    } catch (error) {
      console.error("Error fetching problem data:", error);
      toast.error("Failed to load problem data. Redirecting back to problem management.");
      navigate("/admin/problems");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Function to check if form data has changed
  const checkForChanges = (newFormData) => {
    if (!originalFormData) return;
    
    const hasFormChanges = JSON.stringify(newFormData) !== JSON.stringify(originalFormData);
    setHasChanges(hasFormChanges);
  };

  const toggleCategory = (category) => {
    let updated = new Set(formData.category);
    if (updated.has(category)) {
      updated.delete(category);
    } else {
      updated.add(category);
    }

    const updatedArray = Array.from(updated);
    const newFormData = {
      ...formData,
      category: updatedArray,
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const handleSolutionLanguageChange = (e) => {
    setSolutionLanguage(e.target.value);
  };

  const handleInputChange = (e, field, nestedField = null) => {
    const { value, type, checked } = e.target;
    let newFormData;
    
    if (field === "constraints") {
      newFormData = {
        ...formData,
        constraints: value.split(",").map((item) => item.trim()),
      };
    } else if (field === "difficulty") {
      newFormData = {
        ...formData,
        difficulty: value,
        score: difficultyLevelsProperties[value.toLowerCase()].score,
      };
    } else if (field === "hidden") {
      newFormData = {
        ...formData,
        hidden: checked,
      };
    } else if (nestedField) {
      newFormData = {
        ...formData,
        [field]: {
          ...formData[field],
          [nestedField]: value,
        },
      };
    } else {
      newFormData = {
        ...formData,
        [field]: value,
      };
    }
    
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const handleProhibitedKeysChange = (e, language) => {
    const newFormData = {
      ...formData,
      prohibited_keys: {
        ...formData.prohibited_keys,
        [language]: e.target.value,
      },
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const handleHiddenTestcaseChange = (index, field, value) => {
    const updatedTestcases = [...formData.hidden_testcases];
    updatedTestcases[index] = {
      ...updatedTestcases[index],
      [field]: value,
    };
    const newFormData = {
      ...formData,
      hidden_testcases: updatedTestcases,
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const addHiddenTestcase = () => {
    const newFormData = {
      ...formData,
      hidden_testcases: [
        ...formData.hidden_testcases,
        { input: "", output: "" },
      ],
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const removeHiddenTestcase = (indexToRemove) => {
    const newFormData = {
      ...formData,
      hidden_testcases: formData.hidden_testcases.filter(
        (_, index) => index !== indexToRemove
      ),
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const handleSolutionChange = (value) => {
    const newFormData = {
      ...formData,
      solution: value,
    };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const updateProblem = async () => {
    setIsUpdating(true);
    const token = Cookies.get("neo_code_jwt_token");

    const submissionData = { ...formData, solutionLanguage };

    const filteredProhibitedKeys = {};
    Object.entries(formData.prohibited_keys).forEach(([lang, keys]) => {
      if (keys.trim()) {
        filteredProhibitedKeys[lang] = keys;
      }
    });

    if (Object.keys(filteredProhibitedKeys).length > 0) {
      submissionData.prohibited_keys = filteredProhibitedKeys;
    } else {
      delete submissionData.prohibited_keys;
    }

    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/admin/problems/update/${problemId}`,
        submissionData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(response.data);
      toast.success("Problem updated successfully!");
      setShowUpdateModal(false);
      setOriginalFormData(JSON.parse(JSON.stringify(formData))); // Update original data
      setHasChanges(false);
      navigate("/admin/problems");
    } catch (error) {
      console.error("Error:", error);
      if (error.response?.status === 405) {
        navigate("/login");
      }
      toast.error("Error updating problem. Please try again.");
      setShowUpdateModal(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateClick = () => {
    if (!hasChanges) {
      toast.info("No changes detected to update.");
      return;
    }
    setShowUpdateModal(true);
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center">
        <Header />
        <div className="text-white">Loading problem data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/95">
      <Header />
      <div className="max-w-4xl mx-auto p-6 pt-28">
        <Breadcrumb 
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "Problems", href: "/admin/problems" },
            { label: `Edit Problem #${problemId}` }
          ]}
        />
        <h1 className="text-2xl font-bold mb-6 text-white">
          Edit Problem
        </h1>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4 bg-white/5 p-6 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1 text-white">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange(e, "title")}
                className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-white">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange(e, "description")}
                className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Input Format
                </label>
                <textarea
                  value={formData.input_format}
                  onChange={(e) => handleInputChange(e, "input_format")}
                  className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Output Format
                </label>
                <textarea
                  value={formData.output_format}
                  onChange={(e) => handleInputChange(e, "output_format")}
                  className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-white">
                Explanation
              </label>
              <textarea
                value={formData.explaination}
                onChange={(e) => handleInputChange(e, "explaination")}
                className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Explain the problem solution..."
              />
            </div>

            <div className="flex justify-between items-center space-x-4 relative mb-4">
              <div className="flex overflow-x-auto space-x-2 pr-4 scrollbar-hide">
                {categoriesList.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleCategory(item.name)}
                    className={`px-3 py-1 rounded-full border transition text-sm whitespace-nowrap ${
                      formData.category.includes(item.name)
                        ? "bg-white text-black font-semibold"
                        : "text-white/80 border-white/80 hover:bg-white/10"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prohibited Keys */}
          <div className="bg-white/5 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-white">
              Prohibited Keys
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(formData.prohibited_keys).map((language) => (
                <div key={language}>
                  <label className="block text-sm font-medium mb-1 capitalize text-white">
                    {language}
                  </label>
                  <input
                    type="text"
                    value={formData.prohibited_keys[language]}
                    onChange={(e) => handleProhibitedKeysChange(e, language)}
                    className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sample Testcase */}
          <div className="bg-white/5 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-white">
              Sample Testcase
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Input
                </label>
                <textarea
                  value={formData.sample_testcase.input}
                  onChange={(e) =>
                    handleInputChange(e, "sample_testcase", "input")
                  }
                  className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Output
                </label>
                <textarea
                  value={formData.sample_testcase.output}
                  onChange={(e) =>
                    handleInputChange(e, "sample_testcase", "output")
                  }
                  className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Hidden Testcases */}
          <div className="bg-white/5 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-white">
                Hidden Testcases
              </h2>
              <button
                onClick={addHiddenTestcase}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add Testcase
              </button>
            </div>
            {formData.hidden_testcases.map((testcase, index) => (
              <div
                key={index}
                className="mb-4 p-4 border border-gray-700 rounded-md bg-white/5"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-white">
                    Testcase {index + 1}
                  </h3>
                  {formData.hidden_testcases.length > 1 && (
                    <button
                      onClick={() => removeHiddenTestcase(index)}
                      className="text-red-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      Input
                    </label>
                    <textarea
                      value={testcase.input}
                      onChange={(e) =>
                        handleHiddenTestcaseChange(
                          index,
                          "input",
                          e.target.value
                        )
                      }
                      className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      Output
                    </label>
                    <textarea
                      value={testcase.output}
                      onChange={(e) =>
                        handleHiddenTestcaseChange(
                          index,
                          "output",
                          e.target.value
                        )
                      }
                      className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Problem Settings */}
          <div className="bg-white/5 p-6 rounded-lg">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => handleInputChange(e, "difficulty")}
                  className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level} className="text-black">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="hidden"
                  checked={formData.hidden}
                  onChange={(e) => handleInputChange(e, "hidden")}
                  className="w-4 h-4 text-blue-600 bg-white/10 border-gray-700 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="hidden" className="text-sm font-medium text-white">
                  Hide this problem (make it invisible to users)
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Constraints
            </label>
            <textarea
              value={formData.constraints}
              onChange={(e) => handleInputChange(e, "constraints")}
              className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Replace Solution textarea with Editor */}
          <div className="bg-white/5 p-6 rounded-lg">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium mb-1 text-white">
                Solution
              </label>
              <select
                id="language"
                value={solutionLanguage}
                onChange={handleSolutionLanguageChange}
                className="rounded p-[4px] my-1 bg-white/10 text-white"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang} className="text-black">
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-[400px] border border-gray-700 rounded-md overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="cpp"
                theme="vs-dark"
                value={formData.solution}
                language={solutionLanguage}
                onChange={handleSolutionChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  lineNumbers: "on",
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          <button
            onClick={handleUpdateClick}
            disabled={!hasChanges || isUpdating}
            className={`w-full py-3 rounded-md transition-colors font-medium ${
              !hasChanges || isUpdating
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isUpdating ? 'Updating...' : 'Update Problem'}
          </button>
        </div>
      </div>

      {/* Update Confirmation Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title="Confirm Update"
        type="success"
        onConfirm={updateProblem}
        onCancel={() => setShowUpdateModal(false)}
        confirmText="Update Problem"
        cancelText="Cancel"
      >
        <p>Are you sure you want to update this problem?</p>
        <p className="text-sm text-gray-400 mt-2">This action will save all your changes.</p>
      </Modal>
    </div>
  );
};

export default EditProblem;