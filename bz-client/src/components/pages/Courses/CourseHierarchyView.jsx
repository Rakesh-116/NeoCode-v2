import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { ChevronDown, ChevronRight, CheckCircle, Clock, BookOpen, FileText, Video, Code, ExternalLink } from "lucide-react";
import { toast } from "react-toastify";

import Header from "../Header.jsx";

/**
 * Hierarchical Course View
 * 
 * Displays course structure: Course → Modules → Topics → Content
 * Features:
 * - Collapsible modules and topics
 * - Progress tracking at all levels
 * - Content type icons (problem, video, markdown, etc.)
 * - Time estimates and difficulty indicators
 */
const CourseHierarchyView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [expandedTopics, setExpandedTopics] = useState(new Set());

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    if (id) {
      fetchCourseHierarchy();
    }
  }, [id]);

  const fetchCourseHierarchy = async () => {
    try {
      setPaymentRequired(false);
      const token = Cookies.get("neo_code_jwt_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(
        `${API_BASE_URL}/api/courses/${id}/hierarchy`, 
        { headers }
      );
      
      if (response.data.success) {
        setCourse(response.data.course);
        // Auto-expand first module and first topic
        if (response.data.course.modules?.length > 0) {
          const firstModuleId = response.data.course.modules[0].id;
          setExpandedModules(new Set([firstModuleId]));
          
          if (response.data.course.modules[0].topics?.length > 0) {
            const firstTopicId = response.data.course.modules[0].topics[0].id;
            setExpandedTopics(new Set([firstTopicId]));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching course hierarchy:", error);
      if (error.response?.status === 403 && error.response?.data?.error === "payment_required") {
        setCourse(error.response.data.course || null);
        setPaymentRequired(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCourse = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    if (!token) {
      navigate(`/login?next=/courses/${id}`);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/payments/checkout-session`,
        { courseId: id },
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

  const toggleModule = (moduleId) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const toggleTopic = (topicId) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const handleContentClick = async (content) => {
    if (content.content_type === "problem") {
      navigate(`/problems/${content.problem_id}?courseId=${id}&tab=description`);
    } else if (content.content_type === "external_link") {
      window.open(content.external_url, "_blank");
    }
    // Other content types will be handled in-place
  };

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case "problem":
        return <Code className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "markdown":
        return <FileText className="w-4 h-4" />;
      case "code":
        return <Code className="w-4 h-4" />;
      case "external_link":
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 1: return "text-green-400 bg-green-400/10";
      case 2: return "text-blue-400 bg-blue-400/10";
      case 3: return "text-yellow-400 bg-yellow-400/10";
      case 4: return "text-orange-400 bg-orange-400/10";
      case 5: return "text-red-400 bg-red-400/10";
      default: return "text-gray-400 bg-gray-400/10";
    }
  };

  const getDifficultyLabel = (level) => {
    switch (level) {
      case 1: return "Beginner";
      case 2: return "Easy";
      case 3: return "Medium";
      case 4: return "Hard";
      case 5: return "Expert";
      default: return "Unknown";
    }
  };

  const getProgressPercentage = (progress) => {
    if (!progress) return 0;
    return progress.completion_percentage || 0;
  };

  const isContentCompleted = (content) => {
    return content.progress?.status === "completed";
  };

  const formatPrice = (amount, currency = "eur") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format((amount || 0) / 100);
  };

  if (loading) {
    return (
      <div className="bg-black/95 min-h-screen">
        <Header />
        <div className="pt-28 px-10 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-white/70 mt-2">Loading course...</p>
        </div>
      </div>
    );
  }

  if (paymentRequired) {
    return (
      <div className="bg-black/95 min-h-screen">
        <Header />
        <div className="pt-28 px-10 max-w-5xl mx-auto">
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <button
                  onClick={() => navigate("/courses")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Courses
                </button>
              </li>
              <li className="text-white/50">{">"}</li>
              <li className="text-white/70">{course?.title || "Premium course"}</li>
            </ol>
          </nav>

          <div className="bg-white/5 p-8 rounded-lg border border-white/10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <span className="inline-flex px-3 py-1 bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-400/20 text-sm mb-5">
                  Premium SEPA course
                </span>
                <h1 className="text-4xl font-bold text-white mb-3">{course?.title || "Purchase required"}</h1>
                <p className="text-white/70 text-lg max-w-3xl">
                  {course?.description || "Buy this course to unlock the full curriculum and track progress."}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-5 text-sm">
                  {course?.category && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                      {course.category}
                    </span>
                  )}
                  <span className="text-white/60">Content unlocks after payment confirmation</span>
                </div>
              </div>

              <div className="w-full md:w-72 bg-black/30 border border-white/10 rounded-lg p-5">
                <p className="text-white/50 text-sm mb-1">Course price</p>
                <p className="text-3xl font-bold text-emerald-300 mb-4">
                  {formatPrice(course?.price_amount, course?.price_currency)}
                </p>
                <button
                  onClick={handleBuyCourse}
                  className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                >
                  Pay for this course
                </button>
                <p className="text-white/45 text-xs mt-3">
                  Secure checkout with Stripe SEPA Direct Debit.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-12 rounded-lg text-center border border-white/10 mt-8">
            <BookOpen className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 text-lg">Course content is locked</p>
            <p className="text-white/50 text-sm mt-2 mb-6">Complete payment to view modules, lessons, and problems.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleBuyCourse}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Pay for this course
              </button>
              <button
                onClick={() => navigate("/courses")}
                className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg"
              >
                Back to Courses
              </button>
            </div>
          </div>
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
      <div className="pt-28 px-10 max-w-7xl mx-auto pb-20">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <button
                onClick={() => navigate('/courses')}
                className="text-blue-400 hover:text-blue-300"
              >
                Courses
              </button>
            </li>
            <li className="text-white/50">›</li>
            <li className="text-white/70">{course.title}</li>
          </ol>
        </nav>

        {/* Course Header */}
        <div className="bg-white/5 p-8 rounded-lg border border-white/10 mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">{course.title}</h1>
          <p className="text-white/70 text-lg mb-4">{course.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full">
              {course.category}
            </span>
            <span className="text-white/60">
              {course.modules?.length || 0} Modules
            </span>
          </div>
        </div>

        {/* Modules List */}
        <div className="space-y-4">
          {course.modules && course.modules.length > 0 ? (
            course.modules.map((module, moduleIndex) => (
              <div
                key={module.id}
                className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
              >
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full font-bold">
                      {moduleIndex + 1}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white mb-1">
                        {module.title}
                      </h2>
                      <p className="text-white/60 text-sm">{module.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                        <span>{module.topics?.length || 0} Topics</span>
                        {module.is_default && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                            Default
                          </span>
                        )}
                        {module.is_custom && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  )}
                </button>

                {/* Topics List (Collapsible) */}
                {expandedModules.has(module.id) && module.topics && (
                  <div className="border-t border-white/10 p-4 space-y-3">
                    {module.topics.map((topic, topicIndex) => (
                      <div
                        key={topic.id}
                        className="bg-black/30 rounded-lg overflow-hidden"
                      >
                        {/* Topic Header */}
                        <button
                          onClick={() => toggleTopic(topic.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 text-left">
                            <span className="text-sm font-mono text-white/50">
                              {moduleIndex + 1}.{topicIndex + 1}
                            </span>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-1">
                                {topic.title}
                              </h3>
                              <p className="text-white/50 text-sm">{topic.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className={`px-2 py-0.5 rounded ${getDifficultyColor(topic.difficulty_level)}`}>
                                  {getDifficultyLabel(topic.difficulty_level)}
                                </span>
                                {topic.estimated_duration_minutes && (
                                  <span className="flex items-center gap-1 text-white/50">
                                    <Clock className="w-3 h-3" />
                                    {topic.estimated_duration_minutes} min
                                  </span>
                                )}
                                <span className="text-white/50">
                                  {topic.contents?.length || 0} Items
                                </span>
                              </div>
                            </div>
                          </div>
                          {expandedTopics.has(topic.id) ? (
                            <ChevronDown className="w-4 h-4 text-white/50" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/50" />
                          )}
                        </button>

                        {/* Content Items (Collapsible) */}
                        {expandedTopics.has(topic.id) && topic.contents && (
                          <div className="border-t border-white/10 p-3 space-y-2">
                            {topic.contents.map((content, contentIndex) => (
                              <button
                                key={content.id}
                                onClick={() => handleContentClick(content)}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 hover:bg-white/10 transition-colors text-left ${
                                  isContentCompleted(content) ? 'bg-green-500/5' : 'bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`flex items-center justify-center w-6 h-6 rounded ${
                                    isContentCompleted(content) 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : 'bg-white/10 text-white/50'
                                  }`}>
                                    {isContentCompleted(content) ? (
                                      <CheckCircle className="w-4 h-4" />
                                    ) : (
                                      getContentIcon(content.content_type)
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-white font-medium">{content.title}</div>
                                    {content.description && (
                                      <div className="text-white/50 text-xs mt-1">{content.description}</div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 text-xs">
                                      <span className="px-2 py-0.5 bg-white/10 text-white/60 rounded capitalize">
                                        {content.content_type.replace('_', ' ')}
                                      </span>
                                      {content.points > 0 && (
                                        <span className="text-yellow-400">+{content.points} pts</span>
                                      )}
                                      {content.is_mandatory && (
                                        <span className="text-red-400">Required</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white/5 p-12 rounded-lg text-center border border-white/10">
              <BookOpen className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70 text-lg">No modules in this course yet.</p>
              <p className="text-white/50 text-sm mt-2">Check back later for content updates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseHierarchyView;
