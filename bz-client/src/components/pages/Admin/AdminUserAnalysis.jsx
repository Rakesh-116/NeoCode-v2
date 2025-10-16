import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import { Oval } from "react-loader-spinner";
import { Pie, Bar } from "react-chartjs-2";
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
import Header from "../Header";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const apiStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const AdminUserAnalysis = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [userAnalysis, setUserAnalysis] = useState(null);
  const [apiStatus, setApiStatus] = useState(apiStatusConstant.initial);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userId) {
      fetchUserAnalysis();
    }
  }, [userId]);

  const fetchUserAnalysis = async () => {
    const jwtToken = Cookies.get("neo_code_jwt_token");
    if (!jwtToken) {
      navigate("/login");
      return;
    }
    
    setApiStatus(apiStatusConstant.inProgress);
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/users/analysis/${userId}`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      
      setUserAnalysis(response.data);
      setApiStatus(apiStatusConstant.success);
    } catch (error) {
      console.error("Error fetching user analysis:", error);
      setError("Error fetching user analysis data");
      setApiStatus(apiStatusConstant.failure);
    }
  };

  const renderContent = () => {
    switch (apiStatus) {
      case apiStatusConstant.inProgress:
        return renderLoader();
      case apiStatusConstant.failure:
        return <div className="text-white text-center">{error}</div>;
      case apiStatusConstant.success:
        return renderAnalysisContent();
      default:
        return null;
    }
  };

  const renderAnalysisContent = () => {
    const { userInfo, stats, categoryAnalysis, recentSubmissions } = userAnalysis;

    const pieData = {
      labels: ["Accepted", "Wrong Answer", "RTE", "TLE"],
      datasets: [
        {
          data: [
            stats.verdictCounts.accepted,
            stats.verdictCounts.wrongAnswer,
            stats.verdictCounts.rte,
            stats.verdictCounts.tle,
          ],
          backgroundColor: [
            "rgba(34,197,94,0.8)",
            "rgba(239,68,68,0.8)",
            "rgba(59,130,246,0.8)",
            "rgba(234,179,8,0.8)",
          ],
        },
      ],
    };

    const categoryData = {
      labels: categoryAnalysis.map(cat => cat.category),
      datasets: [
        {
          label: 'Points Earned',
          data: categoryAnalysis.map(cat => cat.total_points),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
        },
      ],
    };

    return (
      <div className="w-full min-h-[80vh]">
        {/* User Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/users')}
            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Users</span>
          </button>
          
          <h2 className="text-3xl text-white font-semibold mb-2">
            User Analysis: {userInfo.username}
          </h2>
          <div className="text-white/70 space-y-1">
            <p>Email: {userInfo.email}</p>
            <p>Role: {userInfo.role}</p>
            <p>Joined: {new Date(userInfo.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg">
            <h4 className="text-white font-semibold">NeoCode Points</h4>
            <p className="text-white text-2xl font-bold">{stats.totalNeoCodePoints}</p>
          </div>
          
          <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-lg">
            <h4 className="text-white font-semibold">Category Points</h4>
            <p className="text-white text-2xl font-bold">{stats.totalCategoryPoints}</p>
          </div>
          
          <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-lg">
            <h4 className="text-white font-semibold">Problems Solved</h4>
            <p className="text-white text-2xl font-bold">{stats.problemsSolved}</p>
          </div>
          
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-lg">
            <h4 className="text-white font-semibold">Total Submissions</h4>
            <p className="text-white text-2xl font-bold">{stats.totalSubmissions}</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Verdict Distribution */}
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/20">
            <h3 className="text-white font-semibold text-lg mb-4">Submission Verdicts</h3>
            <div className="max-w-sm mx-auto">
              <Pie
                data={pieData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      labels: { color: '#ffffff' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Category Performance */}
          {categoryAnalysis.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/20">
              <h3 className="text-white font-semibold text-lg mb-4">Category Performance</h3>
              <Bar
                data={categoryData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      labels: { color: '#ffffff' }
                    }
                  },
                  scales: {
                    x: {
                      ticks: { color: '#ffffff' },
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
          )}
        </div>

        {/* Category Analysis */}
        {categoryAnalysis.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl text-white font-semibold mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryAnalysis.map((category, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
                  <h4 className="text-white font-semibold text-lg">
                    {category.category}
                  </h4>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white/70 text-sm">Points:</span>
                      <span className="text-green-400 font-semibold">{category.total_points}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70 text-sm">Problems:</span>
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
              ))}
            </div>
          </div>
        )}

        {/* Recent Submissions */}
        {recentSubmissions.length > 0 && (
          <div>
            <h3 className="text-xl text-white font-semibold mb-4">Recent Submissions</h3>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10">
                    <tr>
                      <th className="text-left p-4 text-white font-semibold">Problem ID</th>
                      <th className="text-left p-4 text-white font-semibold">Verdict</th>
                      <th className="text-left p-4 text-white font-semibold">Points</th>
                      <th className="text-left p-4 text-white font-semibold">Difficulty</th>
                      <th className="text-left p-4 text-white font-semibold">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSubmissions.map((submission, index) => (
                      <tr key={index} className="border-t border-white/10">
                        <td className="p-4 text-white">{submission.problem_id}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            submission.verdict === 'ACCEPTED' ? 'bg-green-600 text-white' :
                            submission.verdict === 'WRONG ANSWER' ? 'bg-red-600 text-white' :
                            'bg-yellow-600 text-white'
                          }`}>
                            {submission.verdict}
                          </span>
                        </td>
                        <td className="p-4 text-white">{submission.score}</td>
                        <td className="p-4 text-white">{submission.difficulty}</td>
                        <td className="p-4 text-white/70 text-sm">
                          {new Date(submission.submission_time).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

export default AdminUserAnalysis;