import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

import Header from "../../Header.jsx";

const AdminCourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchCourseDetails = async () => {
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const response = await axios.get(`${API_BASE_URL}/api/admin/courses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCourse(response.data.course);
      }
    } catch (error) {
      console.error("Error fetching course details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const response = await axios.delete(`${API_BASE_URL}/api/admin/courses/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        navigate("/admin/courses");
      }
    } catch (error) {
      console.error("Error deleting course:", error);
      alert("Failed to delete course. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  useEffect(() => {
    if (id) {
      fetchCourseDetails();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="bg-black/95 min-h-screen">
        <Header />
        <div className="pt-28 px-10 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-white/70 mt-2">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="bg-black/95 min-h-screen">
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
    <div className="bg-black/95 min-h-screen">
      <Header />
      <div className="pt-28 px-10 max-w-6xl mx-auto">
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
            <li className="text-white/70 truncate max-w-xs">
              {course?.title || 'Loading...'}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{course.title}</h1>
              <div className="flex items-center space-x-4 text-sm">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                  {course.category}
                </span>
                <span className="text-white/60">
                  Created: {new Date(course.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/admin/courses/edit/${id}`)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
              >
                Edit Course
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
              >
                {deleting ? "Deleting..." : "Delete Course"}
              </button>
            </div>
          </div>
        </div>

        {/* Course Overview */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Course Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{course.total_problems}</div>
              <div className="text-white/70">Total Problems</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{course.total_points}</div>
              <div className="text-white/70">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {course.problems?.reduce((sum, p) => {
                  const difficulty = p.difficulty?.toLowerCase();
                  return sum + (difficulty === 'hard' ? 1 : difficulty === 'medium' ? 0.5 : 0.25);
                }, 0).toFixed(1) || '0'}
              </div>
              <div className="text-white/70">Difficulty Score</div>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="text-white font-semibold mb-2">Description</h3>
            <p className="text-white/70">
              {course.description || "No description provided."}
            </p>
          </div>
        </div>

        {/* Problems List */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Course Problems</h2>
            <button
              onClick={() => navigate(`/admin/courses/edit/${id}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Manage Problems
            </button>
          </div>
          
          {course.problems && course.problems.length > 0 ? (
            <div className="space-y-4">
              {course.problems.map((problem, index) => (
                <div
                  key={problem.id}
                  className="p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-white/50 font-mono text-sm min-w-[3rem]">
                        #{index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-lg">
                          {problem.problem_title}
                        </h3>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(problem.difficulty)}`}>
                            {problem.difficulty}
                          </span>
                          <span className="text-white/50 text-sm">
                            {problem.problem_category}
                          </span>
                          <span className="text-white/50 text-sm">
                            ID: {problem.problem_id}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-blue-400 font-medium text-lg">
                        {problem.points} points
                      </div>
                      <div className="text-white/50 text-sm">
                        Visibility: {problem.visibility}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/70 mb-4">No problems added to this course yet.</p>
              <button
                onClick={() => navigate(`/admin/courses/edit/${id}`)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Problems
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCourseDetails;