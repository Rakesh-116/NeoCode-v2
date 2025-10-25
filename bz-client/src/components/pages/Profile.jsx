import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import { Oval } from "react-loader-spinner";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import Header from "./Header";
import { useUser } from "../../context/UserContext";

ChartJS.register(ArcElement, Tooltip, Legend);

const apiStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const Profile = () => {
  const { userData } = useUser(); // Get user info from context
  const navigate = useNavigate();
  const [verdictCounts, setVerdictCounts] = useState({
    accepted: 0,
    wrongAnswer: 0,
    rte: 0,
    tle: 0,
  });
  const [totalNeoCodePoints, setTotalNeoCodePoints] = useState(0);
  const [totalCategoryPoints, setTotalCategoryPoints] = useState(0);
  const [categoryPoints, setCategoryPoints] = useState([]);
  const [problemsSolved, setProblemsSolved] = useState(0);
  const [apiStatus, setApiStatus] = useState(apiStatusConstant.initial);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userData) {
      fetchUserVerdictData();
    }
  }, [userData]);

  const fetchUserVerdictData = async () => {
    const jwtToken = Cookies.get("neo_code_jwt_token");
    if (!jwtToken) {
      navigate("/login");
      return;
    }
    setApiStatus(apiStatusConstant.inProgress);
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/score`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      const { verdictCounts: problems, totalNeoCodePoints, totalCategoryPoints, categoryPoints, problemsSolved } = response.data;
      
      setVerdictCounts({
        accepted: problems.accepted,
        wrongAnswer: problems.wrongAnswer,
        rte: problems.rte,
        tle: problems.tle,
      });
      setTotalNeoCodePoints(totalNeoCodePoints || 0);
      setTotalCategoryPoints(totalCategoryPoints || 0);
      setCategoryPoints(categoryPoints || []);
      setProblemsSolved(problemsSolved || 0);
      setApiStatus(apiStatusConstant.success);
    } catch (error) {
      setError("Error fetching score data");
      setApiStatus(apiStatusConstant.failure);
    }
  };

  const renderContent = () => {
    switch (apiStatus) {
      case apiStatusConstant.inProgress:
        return renderLoader();
      case apiStatusConstant.failure:
        return <div className="text-white">{error}</div>;
      case apiStatusConstant.success:
        return renderProfileContent();
      default:
        return null;
    }
  };

  const renderProfileContent = () => {
    return (
      <div className="w-full min-h-[80vh]">
        {/* User Info Section */}
        <div className="mb-8">
          <h2 className="text-3xl text-white font-semibold">
            {`Welcome, ${userData?.username || "User"}`} 👋
          </h2>
          <p className="text-lg text-white/70">{userData?.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Points Summary Cards */}
          <div className="space-y-4">
            <h3 className="text-xl text-white font-semibold mb-4">Points Summary</h3>
            
            {/* NeoCode Points Card */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg">
              <h4 className="text-white font-semibold text-lg">NeoCode Points</h4>
              <p className="text-white text-3xl font-bold">{totalNeoCodePoints}</p>
              <p className="text-white/80 text-sm">Points from solved problems</p>
            </div>

            {/* Category Points Card */}
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-lg">
              <h4 className="text-white font-semibold text-lg">Category Points</h4>
              <p className="text-white text-3xl font-bold">{totalCategoryPoints}</p>
              <p className="text-white/80 text-sm">Points across all categories</p>
            </div>

            {/* Problems Solved Card */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-lg">
              <h4 className="text-white font-semibold text-lg">Problems Solved</h4>
              <p className="text-white text-3xl font-bold">{problemsSolved}</p>
              <p className="text-white/80 text-sm">Total accepted solutions</p>
            </div>
          </div>

          {/* Pie Chart Section */}
          <div className="border border-white/70 p-6 rounded-lg">
            <h3 className="text-xl text-white font-semibold mb-4">Submission Statistics</h3>
            <div className="max-w-sm mx-auto">
              <Pie
                data={{
                  labels: ["Accepted", "Wrong Answer", "RTE", "TLE"],
                  datasets: [
                    {
                      label: "Verdict Distribution",
                      data: [
                        verdictCounts.accepted,
                        verdictCounts.wrongAnswer,
                        verdictCounts.rte,
                        verdictCounts.tle,
                      ],
                      backgroundColor: [
                        "rgba(34,197,94,0.8)",
                        "rgba(239,68,68,0.8)",
                        "rgba(59,130,246,0.8)",
                        "rgba(234,179,8,0.8)",
                      ],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: "#ffffff",
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (tooltipItem) => {
                          return `${tooltipItem.label}: ${tooltipItem.raw}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Category Analysis Section */}
        {categoryPoints.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl text-white font-semibold mb-6">Category Analysis</h3>
            
            {/* Category Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {categoryPoints.map((category, index) => {
                const getCategoryIcon = (cat) => {
                  const iconMap = {
                    'Array': '📊', 'String': '🔤', 'Math': '🔢',
                    'Dynamic Programming': '🧠', 'Graph': '🕸️', 
                    'Pattern': '🎯', 'Web': '🌐', 'I/O': '💻'
                  };
                  return iconMap[cat] || '💡';
                };

                return (
                  <div key={index} className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/20 hover:bg-white/10 transition-colors">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl" role="img">
                        {getCategoryIcon(category.category)}
                      </span>
                      <h4 className="text-white font-semibold text-lg">
                        {category.category}
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/70 text-sm">Points:</span>
                        <span className="text-green-400 font-semibold">{category.total_points}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70 text-sm">Problems Solved:</span>
                        <span className="text-white font-semibold">{category.problems_solved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70 text-sm">Avg Points:</span>
                        <span className="text-blue-400 font-semibold">
                          {category.problems_solved > 0 
                            ? (category.total_points / category.problems_solved).toFixed(1)
                            : '0'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category Performance Chart */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/20">
              <h4 className="text-white font-semibold text-lg mb-4">Category Performance</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categoryPoints.slice(0, 4).map((category, index) => (
                  <div key={index} className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="4"
                          fill="none"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="#10B981"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - (category.total_points / 100))}`}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {category.problems_solved}
                        </span>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm">{category.category}</p>
                    <p className="text-green-400 text-sm font-semibold">{category.total_points} pts</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-black/95 min-h-screen">
      <Header />
      <div className="pt-28 px-12">{renderContent()}</div>
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

export default Profile;
