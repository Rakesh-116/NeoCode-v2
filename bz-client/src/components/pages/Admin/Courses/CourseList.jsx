import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

import Header from "../../Header.jsx";
import Breadcrumb from "../../../Common/Breadcrumb";

const CourseList = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const formatPrice = (amount, currency = "eur") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format((amount || 0) / 100);
  };

  // Fetch courses from backend
  const fetchCourses = async () => {
    try {
      const token = Cookies.get("neo_code_jwt_token");
      const response = await axios.get(`${API_BASE_URL}/api/admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <div className="bg-black/95 min-h-screen text-white">
      <Header />
      <div className="mt-28 px-10">
        <Breadcrumb 
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "Course Management" }
          ]}
        />
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Courses</h1>
          <button
            onClick={() => navigate("/admin/newcourse")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
          >
            + Create Course
          </button>
        </div>

        {loading ? (
          <p className="text-white/70">Loading courses...</p>
        ) : courses.length === 0 ? (
          <p className="text-white/70">No courses available. Create one!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-6 border border-white/30 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-xl font-semibold">{course.title}</h2>
                  <span
                    className={`shrink-0 px-2 py-1 rounded-md text-xs border ${
                      course.is_paid
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/20"
                        : "bg-blue-500/15 text-blue-300 border-blue-400/20"
                    }`}
                  >
                    {course.is_paid ? formatPrice(course.price_amount, course.price_currency) : "Free"}
                  </span>
                </div>
                <p className="text-white/70 mb-4">{course.description || "No description provided."}</p>
                <p className="text-white/70 mb-4">
                  Category: <span className="font-medium">{course.category}</span>
                </p>
                <p className="text-white/70 mb-4">
                  Problems: <span className="font-medium">{course.total_problems}</span> | 
                  Points: <span className="font-medium">{course.total_points}</span>
                </p>
                {course.is_paid && (
                  <p className="text-emerald-300/80 text-sm mb-4">SEPA Direct Debit checkout enabled</p>
                )}
                <button
                  onClick={() => navigate(`/admin/courses/${course.id}`)}
                  className="px-4 py-2 border border-white/30 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseList;
