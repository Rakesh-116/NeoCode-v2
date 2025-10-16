import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

import Header from "../Header.jsx";
import { useUser } from "../../../context/UserContext.jsx";

const UserProgress = () => {
  const navigate = useNavigate();
  const { userData } = useUser();
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalPoints: 0,
    totalProblemsSolved: 0
  });

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchProgress = async () => {
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const response = await axios.get(`${API_BASE_URL}/api/courses/progress/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const progressData = response.data.progress || [];
        setProgress(progressData);
        
        // Calculate stats
        const totalCourses = progressData.length;
        const completedCourses = progressData.filter(p => p.full_completion).length;
        const totalPoints = progressData.reduce((sum, p) => sum + (p.course_points || 0), 0);
        const totalProblemsSolved = progressData.reduce((sum, p) => sum + (p.solved_problems || 0), 0);
        
        setStats({
          totalCourses,
          completedCourses,
          totalPoints,
          totalProblemsSolved
        });
      }
    } catch (error) {
      console.error("Error fetching progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (course) => {
    if (course.actual_total_problems === 0) return 0;
    return (course.solved_problems / course.actual_total_problems) * 100;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not started";
    return new Date(dateString).toLocaleDateString();
  };

  useEffect(() => {
    if (!userData) {
      navigate("/login");
      return;
    }
    fetchProgress();
  }, [userData]);

  if (!userData) {
    return (
      <div className="bg-black/95 min-h-screen">
        <Header />
        <div className="pt-28 px-10 text-center">
          <p className="text-white/70">Please login to view your progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/95 min-h-screen">
      <Header />
      <div className="pt-28 px-10 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Learning Progress</h1>
          <p className="text-white/70">Track your progress across all enrolled courses</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-blue-400">{stats.totalCourses}</div>
            <div className="text-white/70">Enrolled Courses</div>
          </div>
          
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-green-400">{stats.completedCourses}</div>
            <div className="text-white/70">Completed Courses</div>
          </div>
          
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-yellow-400">{stats.totalPoints}</div>
            <div className="text-white/70">Points Earned</div>
          </div>
          
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="text-2xl font-bold text-purple-400">{stats.totalProblemsSolved}</div>
            <div className="text-white/70">Problems Solved</div>
          </div>
        </div>

        {/* Progress List */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Course Progress</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="text-white/70 mt-2">Loading progress...</p>
            </div>
          ) : progress.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg mb-4">You haven't enrolled in any courses yet.</p>
              <button
                onClick={() => navigate("/courses")}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Browse Courses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {progress.map((course) => {
                const progressPercent = getProgressPercentage(course);
                
                return (
                  <div
                    key={course.course_id}
                    className="p-6 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => navigate(`/courses/${course.course_id}`)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-1 hover:text-blue-400 transition-colors">
                          {course.course_title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                            {course.category}
                          </span>
                          <span className="text-white/60">
                            Last activity: {formatDate(course.last_solved_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-white font-medium mb-1">
                          {course.solved_problems} / {course.actual_total_problems} Problems
                        </div>
                        <div className="text-blue-400 text-sm">
                          {course.course_points} / {course.actual_total_points} Points
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70 text-sm">Progress</span>
                        <span className="text-white/70 text-sm">{progressPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            course.full_completion ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-white/70 text-sm line-clamp-2 flex-1 mr-4">
                        {course.description || "Continue your learning journey in this course."}
                      </p>
                      
                      <div className="flex items-center space-x-2">
                        {course.full_completion && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                            ✓ Completed
                          </span>
                        )}
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                          Continue
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProgress;