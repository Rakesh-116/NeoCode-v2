import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

import Header from "../Header.jsx";
import { useUser } from "../../../context/UserContext.jsx";

const CourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userData } = useUser();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchCourseDetails = async () => {
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API_BASE_URL}/api/courses/${id}`, { headers });
      
      if (response.data.success) {
        setCourse(response.data.course);
        // Check if user has progress (means enrolled)
        if (response.data.course.user_progress && response.data.course.user_progress.solved_problems >= 0) {
          setEnrolled(true);
        }
      }
    } catch (error) {
      console.error("Error fetching course details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!userData) {
      navigate("/login");
      return;
    }

    setEnrolling(true);
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const response = await axios.post(
        `${API_BASE_URL}/api/courses/${id}/enroll`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setEnrolled(true);
        // Refresh course details to get progress
        fetchCourseDetails();
      }
    } catch (error) {
      console.error("Error enrolling in course:", error);
      if (error.response?.status === 400) {
        setEnrolled(true); // Already enrolled
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleProblemClick = (problemId) => {
    navigate(`/problems/${problemId}`);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  const getProgressPercentage = () => {
    if (!course?.user_progress || course.total_problems === 0) return 0;
    return (course.user_progress.solved_problems / course.total_problems) * 100;
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
          <p className="text-white/70 mb-4">The course you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate("/courses")}
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
        {/* Course Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/courses")}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center"
          >
            ← Back to Courses
          </button>
          
          <div className="bg-white/5 p-8 rounded-lg border border-white/10">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-3">{course.title}</h1>
                <p className="text-white/70 text-lg mb-4">{course.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                    {course.category}
                  </span>
                  <span className="text-white/60">
                    📚 {course.total_problems} Problems
                  </span>
                  <span className="text-white/60">
                    🏆 {course.total_points} Total Points
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-4">
                {userData && enrolled && course.user_progress && (
                  <div className="text-right">
                    <div className="text-white/70 text-sm mb-2">Your Progress</div>
                    <div className="w-48 bg-gray-700 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercentage()}%` }}
                      ></div>
                    </div>
                    <div className="text-white text-sm">
                      {course.user_progress.solved_problems} / {course.total_problems} completed
                    </div>
                    <div className="text-blue-400 text-sm">
                      {course.user_progress.course_points} points earned
                    </div>
                  </div>
                )}
                
                {userData ? (
                  enrolled ? (
                    <div className="text-center">
                      <div className="px-6 py-2 bg-green-600 text-white rounded-lg mb-2">
                        ✓ Enrolled
                      </div>
                      {course.user_progress?.full_completion && (
                        <div className="text-green-400 text-sm">🎉 Course Completed!</div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
                    >
                      {enrolling ? "Enrolling..." : "Enroll in Course"}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Login to Enroll
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Course Problems */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Course Problems</h2>
          
          {course.problems && course.problems.length > 0 ? (
            <div className="space-y-4">
              {course.problems.map((problem, index) => (
                <div
                  key={problem.id}
                  className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => handleProblemClick(problem.problem_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-white/50 font-mono text-sm min-w-[3rem]">
                        #{index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-lg hover:text-blue-400 transition-colors">
                          {problem.problem_title}
                        </h3>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(problem.difficulty)}`}>
                            {problem.difficulty}
                          </span>
                          <span className="text-white/50 text-sm">
                            {problem.problem_category}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-blue-400 font-medium">
                        {problem.points} points
                      </div>
                      <button className="text-blue-400 hover:text-blue-300 text-sm mt-1">
                        Solve Problem →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/70">No problems available in this course yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;