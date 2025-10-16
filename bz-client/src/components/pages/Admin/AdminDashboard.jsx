import React from "react";
import { useNavigate } from "react-router-dom";

import Header from "../Header";
import { useUser } from "../../../context/UserContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { userData } = useUser();

  const features = [
    {
      title: "Manage Users",
      description: "View, edit, or delete registered users.",
      buttonText: "Go to Users",
      onClick: () => navigate("/admin/users"),
    },
    // {
    //   title: "Manage Blogs",
    //   description: "Add, edit, or remove blogs authored by you or others.",
    //   buttonText: "Go to Blogs",
    //   onClick: () => navigate("/admin/newblog"),
    // },
    // {
    //   title: "Manage Problems",
    //   description: "Add, edit, or delete coding problems for courses and contests.",
    //   buttonText: "Go to Problems",
    //   onClick: () => navigate("/admin/problems"),
    // },
    {
      title: "Manage Courses",
      description: "Create courses, assign problems, and monitor submissions.",
      buttonText: "Go to Courses",
      onClick: () => navigate("/admin/courses"),
    },
    // {
    //   title: "Review Submissions",
    //   description: "Check user code submissions and provide feedback.",
    //   buttonText: "Go to Submissions",
    //   onClick: () => navigate("/admin/submissions"),
    // },
  ];

  return (
    <div className="bg-black/95 min-h-screen text-white">
      <Header />
      <div className="mt-28 px-10">
        <h1 className="text-3xl font-semibold mb-6">
          Welcome, {userData?.username || "Admin"} 👋
        </h1>
        <p className="text-white/80 mb-8">
          You have access to powerful administrative features. Choose a task below to get started:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 border border-white/30 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <h2 className="text-xl font-semibold mb-2">{feature.title}</h2>
              <p className="text-white/70 mb-4">{feature.description}</p>
              <button
                onClick={feature.onClick}
                className="px-4 py-2 border border-white/30 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
              >
                {feature.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
