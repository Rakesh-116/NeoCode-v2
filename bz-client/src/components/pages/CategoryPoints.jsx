import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import { Oval } from "react-loader-spinner";
import { Bar, Doughnut } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement 
} from "chart.js";
import Header from "./Header";
import { difficultyLevelsProperties } from "../Common/constants";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const apiStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const CategoryPoints = () => {
  const navigate = useNavigate();
  const [categoryPointsData, setCategoryPointsData] = useState([]);
  const [categoriesStats, setCategoriesStats] = useState([]);
  const [apiStatus, setApiStatus] = useState(apiStatusConstant.initial);
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [categoryProgressData, setCategoryProgressData] = useState({});

  useEffect(() => {
    fetchCategoryPointsData();
    fetchCategoriesStats();
  }, []);

  const fetchCategoryPointsData = async () => {
    const jwtToken = Cookies.get("neo_code_jwt_token");
    if (!jwtToken) {
      navigate("/login");
      return;
    }
    
    setApiStatus(apiStatusConstant.inProgress);
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/category-points/user`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      
      setCategoryPointsData(response.data.categoryPoints || []);
      setApiStatus(apiStatusConstant.success);
    } catch (error) {
      console.error("Error fetching category points:", error);
      setError("Error fetching category points data");
      setApiStatus(apiStatusConstant.failure);
    }
  };

  const fetchCategoriesStats = async () => {
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/category-points/categories/stats`);
      setCategoriesStats(response.data.categoriesStats || []);
    } catch (error) {
      console.error("Error fetching categories stats:", error);
    }
  };

  const fetchCategoryProgress = async (category) => {
    const jwtToken = Cookies.get("neo_code_jwt_token");
    if (!jwtToken) {
      navigate("/login");
      return;
    }
    
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/category-points/user/category/${category}`,
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );
      
      setCategoryProgressData(prev => ({
        ...prev,
        [category]: response.data
      }));
    } catch (error) {
      console.error("Error fetching category progress:", error);
    }
  };

  const toggleCategoryExpansion = async (category) => {
    const newExpanded = new Set(expandedCategories);
    
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
      // Fetch detailed data if not already loaded
      if (!categoryProgressData[category]) {
        await fetchCategoryProgress(category);
      }
    }
    
    setExpandedCategories(newExpanded);
  };

  const getDifficultyColor = (difficulty) => {
    const diffProps = difficultyLevelsProperties[difficulty?.toLowerCase()];
    return diffProps ? diffProps.bgColor : "bg-gray-500";
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'arrays': '📊',
      'strings': '🔤', 
      'dynamic-programming': '🧠',
      'graphs': '🕸️',
      'trees': '🌳',
      'sorting': '📈',
      'searching': '🔍',
      'math': '🔢',
      'greedy': '💰',
      'backtracking': '🔙',
      'recursion': '🔄',
      'linked-list': '🔗',
      'stack': '📚',
      'queue': '🚶‍♂️',
      'heap': '⛰️',
      'hash-table': '#️⃣',
      'two-pointers': '👆',
      'sliding-window': '🪟',
      'binary-search': '🎯',
      'bit-manipulation': '🔌'
    };
    return iconMap[category.toLowerCase()] || '💡';
  };

  const renderContent = () => {
    switch (apiStatus) {
      case apiStatusConstant.inProgress:
        return renderLoader();
      case apiStatusConstant.failure:
        return <div className="text-white text-center">{error}</div>;
      case apiStatusConstant.success:
        return renderCategoryPointsContent();
      default:
        return null;
    }
  };

  const renderCategoryPointsContent = () => {
    const chartData = {
      labels: categoryPointsData.map(cat => cat.category.replace(/-/g, ' ').toUpperCase()),
      datasets: [
        {
          label: 'Points Earned',
          data: categoryPointsData.map(cat => cat.total_points),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: '#ffffff',
          },
        },
        title: {
          display: true,
          text: 'Category Points Distribution',
          color: '#ffffff',
          font: {
            size: 16,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#ffffff',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
        y: {
          ticks: {
            color: '#ffffff',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    };

    return (
      <div className="w-full min-h-[80vh]">
        <div className="mb-8">
          <h2 className="text-3xl text-white font-semibold mb-2">Category Points Dashboard</h2>
          <p className="text-white/70">Track your progress across different problem categories</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-lg">
            <h3 className="text-white font-semibold">Total Categories</h3>
            <p className="text-white text-2xl font-bold">{categoryPointsData.length}</p>
            <p className="text-white/80 text-sm">Categories with points</p>
          </div>
          
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-lg">
            <h3 className="text-white font-semibold">Total Points</h3>
            <p className="text-white text-2xl font-bold">
              {categoryPointsData.reduce((sum, cat) => sum + parseInt(cat.total_points), 0)}
            </p>
            <p className="text-white/80 text-sm">Across all categories</p>
          </div>
          
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-lg">
            <h3 className="text-white font-semibold">Problems Solved</h3>
            <p className="text-white text-2xl font-bold">
              {categoryPointsData.reduce((sum, cat) => sum + parseInt(cat.problems_solved), 0)}
            </p>
            <p className="text-white/80 text-sm">Total solved problems</p>
          </div>
        </div>

        {/* Chart */}
        {categoryPointsData.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/20 mb-8">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}

        {/* Categories Accordion */}
        <div className="mb-8">
          <h3 className="text-xl text-white font-semibold mb-4">Category Analysis</h3>
          <div className="space-y-4">
            {categoriesStats.map((category, index) => {
              const userProgress = categoryPointsData.find(
                cat => cat.category === category.category
              );
              const completionPercentage = category.total_problems > 0 
                ? ((userProgress?.problems_solved || 0) / category.total_problems * 100).toFixed(1)
                : 0;
              
              const isExpanded = expandedCategories.has(category.category);
              const progressData = categoryProgressData[category.category];

              return (
                <div
                  key={index}
                  className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden"
                >
                  {/* Accordion Header */}
                  <div
                    className="p-6 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => toggleCategoryExpansion(category.category)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl" role="img" aria-label={category.category}>
                            {getCategoryIcon(category.category)}
                          </span>
                          <h4 className="text-white font-semibold text-lg capitalize">
                            {category.category.replace(/-/g, ' ')}
                          </h4>
                          <span className="text-white/60 text-sm bg-white/10 px-2 py-1 rounded-full">
                            {userProgress?.problems_solved || 0}/{category.total_problems}
                          </span>
                          {completionPercentage >= 100 && (
                            <span className="text-green-400 text-lg" role="img" aria-label="completed">
                              ✅
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-white/70">Points: </span>
                            <span className="text-white font-semibold">
                              {userProgress?.total_points || 0}/{category.total_possible_points}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/70">Completion: </span>
                            <span className="text-green-400 font-semibold">{completionPercentage}%</span>
                          </div>
                          <div>
                            <span className="text-white/70">Avg Points: </span>
                            <span className="text-white font-semibold">
                              {parseFloat(category.avg_points_per_problem || 0).toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/20 rounded-full h-2 mt-4">
                          <div
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Expand/Collapse Icon */}
                      <div className="ml-4">
                        <svg
                          className={`w-6 h-6 text-white/70 transition-transform duration-300 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="border-t border-white/20 p-6 bg-white/5 animate-fadeIn">
                      {progressData ? (
                        <div className="space-y-6">
                          {/* Statistics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-lg text-center">
                              <p className="text-white/80 text-sm">Completion</p>
                              <p className="text-white text-2xl font-bold">
                                {progressData.userProgress.completion_percentage}%
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-4 rounded-lg text-center">
                              <p className="text-white/80 text-sm">Points Earned</p>
                              <p className="text-white text-2xl font-bold">
                                {progressData.userProgress.earned_points}
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 rounded-lg text-center">
                              <p className="text-white/80 text-sm">Problems Solved</p>
                              <p className="text-white text-2xl font-bold">
                                {progressData.userProgress.problems_solved}
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-lg text-center">
                              <p className="text-white/80 text-sm">Avg Points</p>
                              <p className="text-white text-2xl font-bold">
                                {progressData.userProgress.problems_solved > 0 
                                  ? (progressData.userProgress.earned_points / progressData.userProgress.problems_solved).toFixed(1)
                                  : '0'
                                }
                              </p>
                            </div>
                          </div>

                          {/* Difficulty Breakdown Chart */}
                          {progressData.solvedProblems.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="bg-white/5 p-4 rounded-lg">
                                <h5 className="text-white font-semibold mb-3">Difficulty Distribution</h5>
                                <div className="h-64">
                                  <Doughnut
                                    data={{
                                      labels: Object.keys(
                                        progressData.solvedProblems.reduce((acc, problem) => {
                                          acc[problem.difficulty] = (acc[problem.difficulty] || 0) + 1;
                                          return acc;
                                        }, {})
                                      ),
                                      datasets: [{
                                        data: Object.values(
                                          progressData.solvedProblems.reduce((acc, problem) => {
                                            acc[problem.difficulty] = (acc[problem.difficulty] || 0) + 1;
                                            return acc;
                                          }, {})
                                        ),
                                        backgroundColor: [
                                          'rgba(34, 197, 94, 0.8)',
                                          'rgba(59, 130, 246, 0.8)', 
                                          'rgba(245, 158, 11, 0.8)',
                                          'rgba(239, 68, 68, 0.8)',
                                          'rgba(168, 85, 247, 0.8)',
                                          'rgba(236, 72, 153, 0.8)'
                                        ],
                                      }]
                                    }}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: {
                                        legend: {
                                          labels: { color: '#ffffff', font: { size: 12 } }
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              
                              <div className="bg-white/5 p-4 rounded-lg">
                                <h5 className="text-white font-semibold mb-3">Points Distribution</h5>
                                <div className="h-64">
                                  <Bar
                                    data={{
                                      labels: Object.keys(
                                        progressData.solvedProblems.reduce((acc, problem) => {
                                          acc[problem.difficulty] = (acc[problem.difficulty] || 0) + problem.points_awarded;
                                          return acc;
                                        }, {})
                                      ),
                                      datasets: [{
                                        label: 'Points by Difficulty',
                                        data: Object.values(
                                          progressData.solvedProblems.reduce((acc, problem) => {
                                            acc[problem.difficulty] = (acc[problem.difficulty] || 0) + problem.points_awarded;
                                            return acc;
                                          }, {})
                                        ),
                                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                      }]
                                    }}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: {
                                        legend: {
                                          labels: { color: '#ffffff' }
                                        }
                                      },
                                      scales: {
                                        x: {
                                          ticks: { color: '#ffffff', font: { size: 11 } },
                                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                        },
                                        y: {
                                          ticks: { color: '#ffffff' },
                                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Solved Problems List */}
                          <div>
                            <h5 className="text-white font-semibold mb-3">
                              Solved Problems ({progressData.solvedProblems.length})
                            </h5>
                            {progressData.solvedProblems.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                                {progressData.solvedProblems.map((problem, idx) => (
                                  <div key={idx} className="bg-white/5 p-3 rounded-lg flex justify-between items-center">
                                    <div className="flex-1">
                                      <p className="text-white font-medium text-sm">{problem.title}</p>
                                      <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${getDifficultyColor(problem.difficulty)} text-white`}>
                                        {problem.difficulty}
                                      </span>
                                    </div>
                                    <div className="text-green-400 font-semibold text-sm ml-2">
                                      +{problem.points_awarded}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-white/70 text-center py-8 bg-white/5 rounded-lg">
                                No problems solved in this category yet. Start solving to earn points! 🚀
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-32">
                          <Oval height={30} width={30} color="#4fa94d" strokeWidth={4} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/95 min-h-screen">
      <Header />
      <div className="pt-28 px-4 md:px-8 lg:px-12">{renderContent()}</div>
    </div>
  );
};

const renderLoader = () => (
  <div className="flex justify-center items-center h-[200px]">
    <Oval
      height={50}
      width={50}
      color="#4fa94d"
      strokeWidth={4}
      strokeWidthSecondary={4}
    />
  </div>
);

export default CategoryPoints;