import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";

import Header from "../../Header.jsx";
import Breadcrumb from "../../../Common/Breadcrumb.jsx";
import { categoriesList, difficultyLevelsProperties } from "../../../Common/constants.js";

const EditCourse = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchCourseDetails(), fetchProblems()]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const fetchCourseDetails = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/courses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const courseData = response.data.course;
        setCourse(courseData);
        setFormData({
          title: courseData.title,
          category: courseData.category,
          description: courseData.description || "",
        });
        // Set selected problems from course
        setSelectedProblems(courseData.problems?.map(p => ({
          id: p.problem_id,
          title: p.problem_title,
          difficulty: p.difficulty,
          category: p.problem_category
        })) || []);
      }
    } catch (error) {
      console.error("Error fetching course details:", error);
    }
  };

  const fetchProblems = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/problems/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllProblems(response.data.problems || []);
    } catch (error) {
      console.error("Error fetching problems:", error);
    }
  };

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

  const updateCourse = async () => {
    if (!formData.title || !formData.category || selectedProblems.length === 0) return;

    setUpdating(true);
    const token = Cookies.get("neo_code_jwt_token");

    const problemsWithPoints = selectedProblems.map((p) => ({
      problem_id: p.id,
      points: difficultyLevelsProperties[p.difficulty.toLowerCase()]?.coursePoints || 1,
    }));

    try {
      // Update course using proper PUT endpoint
      await axios.put(
        `${API_BASE_URL}/api/admin/courses/update/${id}`,
        { ...formData, problems: problemsWithPoints },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      navigate("/admin/courses");
    } catch (error) {
      console.error("Error updating course:", error);
      alert("Failed to update course. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  // Filter problems by category
  const filteredProblems = allProblems.filter((p) =>
    formData.category ? p.category.includes(formData.category) : true
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black/95">
        <Header />
        <div className="pt-28 px-10 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-white/70 mt-2">Loading course data...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-black/95">
        <Header />
        <div className="pt-28 px-10 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Course Not Found</h1>
          <button
            onClick={() => navigate("/admin/courses")}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/95">
      <Header />
      <div className="max-w-5xl mx-auto p-6 pt-28">
        <Breadcrumb 
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "Course Management", href: "/admin/courses" },
            { label: course?.title || 'Course', href: `/admin/courses/${id}` },
            { label: "Edit Course" }
          ]}
        />
        
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin/courses")}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center"
          >
            ← Back to Course Management
          </button>
          <h1 className="text-2xl font-bold text-white">Edit Course</h1>
        </div>

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

          {filteredProblems.length === 0 ? (
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

        <div className="mt-6 flex space-x-4">
          <button
            onClick={updateCourse}
            disabled={!formData.title || !formData.category || selectedProblems.length === 0 || updating}
            className={`flex-1 py-3 rounded-md font-medium transition-colors ${
              !formData.title || !formData.category || selectedProblems.length === 0 || updating
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {updating ? "Updating..." : "Update Course"}
          </button>
          
          <button
            onClick={() => navigate("/admin/courses")}
            className="px-6 py-3 border border-gray-600 text-white rounded-md hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCourse;