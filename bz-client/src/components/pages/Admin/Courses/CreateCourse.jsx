import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";

import Header from "../../Header.jsx";
import { categoriesList, difficultyLevelsProperties } from "../../../Common/constants.js";

const CreateCourse = () => {
  const navigate = useNavigate();
  const [allProblems, setAllProblems] = useState([]);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchProblems = async () => {
      const token = Cookies.get("neo_code_jwt_token");
      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/problems/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAllProblems(response.data.problems || []);
      } catch (error) {
        console.error("Error fetching problems:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProblems();
  }, []);

  const handleInputChange = (e, field) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const toggleProblemSelection = (problem) => {
    const exists = selectedProblems.find((p) => p.id === problem.id);
    if (exists) {
      setSelectedProblems(selectedProblems.filter((p) => p.id !== problem.id));
    } else {
      setSelectedProblems([...selectedProblems, problem]);
    }
  };

  const createCourse = async () => {
    if (!formData.title || !formData.category || selectedProblems.length === 0) return;

    const token = Cookies.get("neo_code_jwt_token");

    const problemsWithPoints = selectedProblems.map((p) => ({
      problem_id: p.id,
      points: difficultyLevelsProperties[p.difficulty.toLowerCase()]?.coursePoints || 1,
    }));

    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/courses/create`,
        { ...formData, problems: problemsWithPoints },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate("/admin/courses");
    } catch (error) {
      console.error("Error creating course:", error);
    }
  };

  // Filter problems by category
  const filteredProblems = allProblems.filter((p) =>
    formData.category ? p.category.includes(formData.category) : true
  );

  return (
    <div className="min-h-screen bg-black/95">
      <Header />
      <div className="max-w-5xl mx-auto p-6 pt-28">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <button
                onClick={() => navigate('/admin')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Admin
              </button>
            </li>
            <li className="text-white/50">›</li>
            <li>
              <button
                onClick={() => navigate('/admin/courses')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Course Management
              </button>
            </li>
            <li className="text-white/50">›</li>
            <li className="text-white/70">
              Create New Course
            </li>
          </ol>
        </nav>
        
        <h1 className="text-2xl font-bold mb-6 text-white">Create New Course</h1>

        {/* Course Info */}
        <div className="space-y-4 bg-white/5 p-6 rounded-lg">
          <input
            type="text"
            placeholder="Course Title"
            value={formData.title}
            onChange={(e) => handleInputChange(e, "title")}
            className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Course Description"
            value={formData.description}
            onChange={(e) => handleInputChange(e, "description")}
            className="w-full p-2 border bg-white/10 text-white border-gray-700 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={formData.category}
            onChange={(e) => handleInputChange(e, "category")}
            className="w-full p-2 border bg-black text-white border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Category</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Problem Selection */}
        <div className="mt-6 bg-white/5 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Select Problems</h2>
            <p className="text-white/70">{selectedProblems.length} selected</p>
          </div>

          {loading ? (
            <p className="text-white/70">Loading problems...</p>
          ) : filteredProblems.length === 0 ? (
            <p className="text-white/70">No problems available for this category</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {filteredProblems.map((problem) => {
                const isSelected = selectedProblems.some((p) => p.id === problem.id);
                return (
                  <div
                    key={problem.id}
                    onClick={() => toggleProblemSelection(problem)}
                    className={`p-4 rounded-md border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-500 border-blue-400 text-white"
                        : "bg-white/10 border-gray-700 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <h3 className="font-medium">{problem.title}</h3>
                    <p className="text-sm text-white/70">{problem.difficulty}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={createCourse}
          disabled={!formData.title || !formData.category || selectedProblems.length === 0}
          className={`mt-6 w-full py-3 rounded-md font-medium transition-colors ${
            !formData.title || !formData.category || selectedProblems.length === 0
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Create Course
        </button>
      </div>
    </div>
  );
};

export default CreateCourse;
