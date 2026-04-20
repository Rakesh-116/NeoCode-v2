import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";

import Header from "../Header.jsx";

const Courses = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || ""
  });

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchCourses = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      const token = Cookies.get("neo_code_jwt_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API_BASE_URL}/api/courses?${params}`, { headers });
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount, currency = "eur") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format((amount || 0) / 100);
  };

  const handleBuyCourse = async (event, courseId) => {
    event.stopPropagation();

    const token = Cookies.get("neo_code_jwt_token");
    if (!token) {
      navigate(`/login?next=/courses/${courseId}`);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/payments/checkout-session`,
        { courseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      const message = error.response?.data?.error || "Unable to start checkout. Please try again.";
      toast.error(message);
    }
  };

  // Sync filters with URL params on mount and URL changes
  useEffect(() => {
    const searchFromUrl = searchParams.get('search') || "";
    setFilters({
      search: searchFromUrl
    });
  }, [searchParams]);

  useEffect(() => {
    fetchCourses();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newSearchParams.set(key, value);
    } else {
      newSearchParams.delete(key);
    }
    setSearchParams(newSearchParams);
  };

  const getDifficultyColor = (totalPoints) => {
    if (totalPoints < 100) return "text-green-400";
    if (totalPoints < 300) return "text-yellow-400"; 
    return "text-red-400";
  };

  return (
    <div className="bg-black/95 min-h-screen">
      <Header />
      <div className="pt-28 px-10">
        <div className="mb-8 max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-white text-3xl font-bold mb-2">Available Courses</h1>
              <p className="text-white/55">
                Free tracks open instantly. Premium tracks use secure Stripe SEPA checkout and unlock after payment confirmation.
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="px-3 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-400/20">Free</span>
              <span className="px-3 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">SEPA paid</span>
            </div>
          </div>
          
          {/* Search Filter */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search courses..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="px-4 py-2 bg-white/10 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-white/70 mt-2">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/70 text-lg">No courses found matching your search.</p>
            <p className="text-white/50 mt-2">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const isUnlocked = Boolean(course.user_has_access);
              return (
              <div
                key={course.id}
                className="p-6 border border-white/30 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {course.title}
                    </h2>
                    <span
                      className={`shrink-0 px-2 py-1 rounded-md text-xs border ${
                        course.is_paid
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/20"
                          : "bg-blue-500/15 text-blue-300 border-blue-400/20"
                      }`}
                    >
                      {course.is_paid ? (isUnlocked ? "Paid" : "Premium") : "Free"}
                    </span>
                  </div>
                </div>
                
                <p className="text-white/70 mb-4 line-clamp-3">
                  {course.description || "Explore this course to enhance your skills."}
                </p>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-4">
                    <span className="text-white/60">
                      {course.total_problems} Problems
                    </span>
                    {course.is_paid && (
                      <span className="px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded-md border border-emerald-400/20 font-medium">
                        {formatPrice(course.price_amount, course.price_currency)}
                      </span>
                    )}
                  </div>
                  
                  {course.is_paid && !isUnlocked ? (
                    <button
                      onClick={(event) => handleBuyCourse(event, course.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Pay with SEPA
                    </button>
                  ) : (
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                      View Course
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}

export default Courses
