import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { Oval } from "react-loader-spinner";
import { FiSearch, FiEdit, FiTrash2, FiPlus, FiEye, FiEyeOff } from "react-icons/fi";
import { FaArrowLeft, FaFilter } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";

import Header from "../../Header.jsx";
import Breadcrumb from "../../../Common/Breadcrumb.jsx";
import { categoriesList, difficultyLevels } from "../../../Common/constants.js";

const apiStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  noData: "NO_DATA",
  failure: "FAILURE",
};

const AdminProblemManagement = () => {
  const [problems, setProblems] = useState([]);
  const [apiStatus, setApiStatus] = useState(apiStatusConstant.initial);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();

  // Read params
  const selectedCategoriesString = searchParams.get("categories") || "";
  const selectedCategories = selectedCategoriesString
    ? selectedCategoriesString.split(",")
    : [];
  const selectedDifficulty = searchParams.get("difficulty") || "";
  const selectedVisibility = searchParams.get("visibility") || "";
  const searchQuery = searchParams.get("search") || "";

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState(null);

  useEffect(() => {
    fetchProblems();
  }, [searchParams]);

  const fetchProblems = async () => {
    setApiStatus(apiStatusConstant.inProgress);
    const token = Cookies.get("neo_code_jwt_token");
    if (!token) {
      navigate("/login");
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

    try {
      const queryParams = new URLSearchParams();
      if (selectedCategoriesString) {
        queryParams.set("categories", selectedCategoriesString);
      }
      if (selectedDifficulty) {
        queryParams.set("difficulty", selectedDifficulty.toLowerCase());
      }
      if (selectedVisibility) {
        queryParams.set("visibility", selectedVisibility);
      }
      if (searchQuery) {
        queryParams.set("search", searchQuery);
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/admin/problems/all?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setProblems(response.data.problems || []);
      setApiStatus(response.data.problems?.length > 0 ? apiStatusConstant.success : apiStatusConstant.noData);
    } catch (error) {
      console.error("Error fetching problems:", error);
      if (error.response?.status === 404) {
        setApiStatus(apiStatusConstant.noData);
      } else {
        setApiStatus(apiStatusConstant.failure);
      }
    }
  };

  const handleDeleteRequest = (problem) => {
    setProblemToDelete(problem);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProblem = async () => {
    if (!problemToDelete) return;

    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      await axios.delete(
        `${API_BASE_URL}/api/admin/problems/delete/${problemToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      setDeleteModalOpen(false);
      setProblemToDelete(null);
      await fetchProblems();
    } catch (error) {
      console.error("Error deleting problem:", error);
      alert("Failed to delete problem. Please try again.");
    }
  };

  const toggleProblemVisibility = async (problemId, currentHiddenStatus) => {
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/problems/visibility/${problemId}`,
        { hidden: !currentHiddenStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Refresh the problems list
      await fetchProblems();
    } catch (error) {
      console.error("Error toggling problem visibility:", error);
      alert("Failed to update problem visibility. Please try again.");
    }
  };



  const toggleCategory = (category) => {
    let updated = new Set(selectedCategories);
    if (updated.has(category)) {
      updated.delete(category);
    } else {
      updated.add(category);
    }

    const updatedArray = Array.from(updated);
    const updatedParams = new URLSearchParams(searchParams);

    if (updatedArray.length > 0) {
      updatedParams.set("categories", updatedArray.join(","));
    } else {
      updatedParams.delete("categories");
    }

    setSearchParams(updatedParams);
  };

  const handleDifficultyChange = (value) => {
    const updatedParams = new URLSearchParams(searchParams);
    if (value) {
      updatedParams.set("difficulty", value);
    } else {
      updatedParams.delete("difficulty");
    }
    setSearchParams(updatedParams);
  };

  const handleVisibilityChange = (value) => {
    const updatedParams = new URLSearchParams(searchParams);
    if (value) {
      updatedParams.set("visibility", value);
    } else {
      updatedParams.delete("visibility");
    }
    setSearchParams(updatedParams);
  };

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const updatedParams = new URLSearchParams(searchParams);
    if (searchInput) {
      updatedParams.set("search", searchInput);
    } else {
      updatedParams.delete("search");
    }
    setSearchParams(updatedParams);
  };

  const handleResetFilters = () => {
    setSearchParams({});
    setSearchInput("");
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'cakewalk': return 'text-blue-400 bg-blue-400/10';
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'easymedium': return 'text-yellow-400 bg-yellow-400/10';
      case 'medium': return 'text-orange-400 bg-orange-400/10';
      case 'mediumhard': return 'text-red-400 bg-red-400/10';
      case 'hard': return 'text-purple-400 bg-purple-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const renderLoader = () => (
    <div className="flex justify-center items-center h-64">
      <Oval height={50} width={50} color="#4fa94d" strokeWidth={4} />
    </div>
  );

  const renderFailure = () => (
    <div className="text-center text-red-500 py-20">
      <h2 className="text-2xl font-semibold mb-4">Failed to load problems</h2>
      <p className="text-white/70 mb-4">Please try again later.</p>
      <button
        onClick={fetchProblems}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        Retry
      </button>
    </div>
  );

  const renderNoProblems = () => (
    <div className="text-center text-white py-20">
      <h2 className="text-2xl font-semibold mb-4">No Problems Found</h2>
      <p className="text-white/70 mb-6">
        {searchQuery || selectedCategories.length > 0 || selectedDifficulty || selectedVisibility
          ? "Try adjusting your filters or search."
          : "Create your first problem to get started."}
      </p>
      <button
        onClick={() => navigate("/admin/createproblem")}
        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 mx-auto"
      >
        <FiPlus />
        <span>Create First Problem</span>
      </button>
    </div>
  );

  const renderProblemsTable = () => (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/10">
            <tr>
              <th className="text-left px-6 py-4 text-white font-medium">ID</th>
              <th className="text-left px-6 py-4 text-white font-medium">Title</th>
              <th className="text-left px-6 py-4 text-white font-medium">Visibility</th>
              <th className="text-left px-6 py-4 text-white font-medium">Difficulty</th>
              <th className="text-left px-6 py-4 text-white font-medium">Category</th>
              <th className="text-left px-6 py-4 text-white font-medium">Score</th>
              <th className="text-left px-6 py-4 text-white font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((problem, index) => (
              <tr
                key={problem.id}
                className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                  problem.hidden ? 'bg-red-900/10' : ''
                }`}
              >
                <td className="px-6 py-4 text-white/80 font-mono">
                  #{problem.id}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="text-white font-medium">{problem.title}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleProblemVisibility(problem.id, problem.hidden)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                      problem.hidden
                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                        : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                    }`}
                    title={problem.hidden ? 'Click to make visible' : 'Click to hide'}
                  >
                    {problem.hidden ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    <span className="text-sm">
                      {problem.hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(problem.category) ? (
                      problem.category.map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-gray-600/50 text-gray-300 rounded"
                        >
                          {cat}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-600/50 text-gray-300 rounded">
                        {problem.category || 'Uncategorized'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-white/80">
                  {problem.score} pts
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/admin/editproblem/${problem.id}`)}
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                      title="Edit Problem"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(problem)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete Problem"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-black/95 min-h-screen pb-8">
      <Header />
      <div className="pt-28 px-4 md:px-8 lg:px-12">
        <Breadcrumb 
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "Problem Management" }
          ]}
        />

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Problem Management</h1>
            <p className="text-white/70">Create, edit, and manage coding problems</p>
          </div>
          <button
            onClick={() => navigate("/admin/createproblem")}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
          >
            <FiPlus />
            <span>Create Problem</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
              <input
                type="text"
                placeholder="Search problems by title..."
                value={searchInput}
                onChange={handleSearchInputChange}
                className="w-full pl-10 pr-4 py-3 bg-white/10 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 border rounded-lg flex items-center space-x-2 transition-colors ${
                showFilters || selectedCategories.length > 0 || selectedDifficulty || selectedVisibility
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
              }`}
            >
              <FaFilter />
              <span>Filters</span>
            </button>
            {(searchQuery || selectedCategories.length > 0 || selectedDifficulty || selectedVisibility) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Reset
              </button>
            )}
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white/5 p-6 rounded-lg space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-white font-medium mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categoriesList.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.name)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedCategories.includes(category.name)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <h3 className="text-white font-medium mb-3">Difficulty</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDifficultyChange("")}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      !selectedDifficulty
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    All Levels
                  </button>
                  {difficultyLevels.map((difficulty) => (
                    <button
                      key={difficulty.id}
                      onClick={() => handleDifficultyChange(difficulty.name)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedDifficulty === difficulty.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {difficulty.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <h3 className="text-white font-medium mb-3">Visibility</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleVisibilityChange("")}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      !selectedVisibility
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    All Problems
                  </button>
                  <button
                    onClick={() => handleVisibilityChange("visible")}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
                      selectedVisibility === "visible"
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <FiEye size={14} />
                    <span>Visible Only</span>
                  </button>
                  <button
                    onClick={() => handleVisibilityChange("hidden")}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
                      selectedVisibility === "hidden"
                        ? 'bg-red-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <FiEyeOff size={14} />
                    <span>Hidden Only</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {(() => {
          switch (apiStatus) {
            case apiStatusConstant.inProgress:
              return renderLoader();
            case apiStatusConstant.failure:
              return renderFailure();
            case apiStatusConstant.noData:
              return renderNoProblems();
            case apiStatusConstant.success:
              return renderProblemsTable();
            default:
              return renderLoader();
          }
        })()}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && problemToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
            <div className="w-full max-w-md bg-gray-800 text-white rounded-lg p-6 mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-xl">Confirm Delete</h2>
                <button
                  className="text-white hover:text-gray-300"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setProblemToDelete(null);
                  }}
                >
                  <RxCross2 size={20} />
                </button>
              </div>
              <p className="text-center mb-6">
                Are you sure you want to delete the problem{" "}
                <span className="font-semibold text-blue-400">"{problemToDelete.title}"</span>?
                <br />
                <span className="text-red-400 text-sm">This action cannot be undone.</span>
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={confirmDeleteProblem}
                  className="bg-red-600 text-white rounded-md px-6 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  YES, DELETE
                </button>
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setProblemToDelete(null);
                  }}
                  className="bg-gray-600 text-white rounded-md px-6 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProblemManagement;