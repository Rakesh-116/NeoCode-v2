import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import { LuTrash2 } from "react-icons/lu";
import { RxCross2 } from "react-icons/rx";
import { FaCaretDown, FaArrowLeft } from "react-icons/fa";
import { Oval } from "react-loader-spinner"; // make sure you have this installed
import Header from "../Header";
import Breadcrumb from "../../Common/Breadcrumb";

const getAllUsersApiStatusConstant = {
  initial: "INITIAL",
  inProgress: "IN_PROGRESS",
  success: "SUCCESS",
  failure: "FAILURE",
};

const renderLoader = () => (
  <div className="flex justify-center items-center mt-28 h-[70vh]">
    <Oval
      height={50}
      width={50}
      color="#4fa94d"
      strokeWidth={4}
      strokeWidthSecondary={4}
    />
  </div>
);

const UserDataCard = ({ userDetails, onRequestDelete, onRoleChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="bg-black/95 p-3 rounded-md shadow-lg border border-white/20 w-full
        transition-all duration-300 ease-in-out mt-2 overflow-hidden"
    >
      <div
        className={`flex justify-between ${
          isOpen ? "items-start" : "items-center"
        }`}
      >
        <div>
          <h1 className="text-gray-400 text-[16px]">
            Name: <span className="text-white">{userDetails.username}</span>
          </h1>
          <p
            className={`text-gray-400 text-[13px] ${
              isOpen ? "mt-2 text-[16px]" : ""
            }`}
          >
            Role:{" "}
            <span className="text-white/90">
              {userDetails.role === "admin" ? "Admin" : "User"}
            </span>
          </p>
        </div>

        <div className="flex space-x-2 items-start">
          {isOpen && (
            <>
              <select
                value={userDetails.role}
                onChange={(e) => onRoleChange(userDetails.id, e.target.value)}
                className="border border-green-400 px-2 py-1 rounded-md text-green-400 text-[12px] bg-black/80 hover:bg-green-400/10 transition-colors focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                <option value="user" className="bg-black text-green-400">User</option>
                <option value="admin" className="bg-black text-green-400">Admin</option>
              </select>
              <button
                onClick={() => window.open(`/admin/users/analysis/${userDetails.id}`, '_blank')}
                className="border border-blue-400 px-2 py-1 rounded-md text-blue-400 text-[12px] hover:bg-blue-400/10 transition-colors"
              >
                View Analysis
              </button>
            </>
          )}
          <button
            className="text-red-500 border border-red-500 rounded-lg p-1 hover:text-red-600 hover:bg-red-500/10 transition-colors duration-300 self-start"
            onClick={() =>
              onRequestDelete(
                userDetails.id,
                `Are you sure you want to delete ${userDetails.username}?`
              )
            }
          >
            <LuTrash2 />
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white border border-white rounded-lg p-1 hover:text-white hover:bg-white/10 transition-colors duration-300 self-start"
          >
            <FaCaretDown
              className={`transform transition-transform duration-300 ${
                isOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 text-gray-300 text-sm">
          <p className="text-gray-400 text-[16px]">
            Email: <span className="text-white/90">{userDetails.email}</span>
          </p>
        </div>
      )}
    </div>
  );
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const [usersData, setUsersData] = useState([]);
  const [apiStatus, setApiStatus] = useState(
    getAllUsersApiStatusConstant.initial
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [toDeleteId, setToDeleteId] = useState(null);
  
  // Role change modal state
  const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);
  const [roleChangeData, setRoleChangeData] = useState({ userId: null, newRole: "", username: "" });

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setApiStatus(getAllUsersApiStatusConstant.inProgress);
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsersData(res.data.response);
      setApiStatus(getAllUsersApiStatusConstant.success);
    } catch (err) {
      console.error(err);
      setApiStatus(getAllUsersApiStatusConstant.failure);
    }
  };

  const handleRequestDelete = (id, message) => {
    setToDeleteId(id);
    setWarningMessage(message);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    try {
      await axios.delete(
        `${API_BASE_URL}/api/admin/users/delete/${toDeleteId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await fetchAllUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    // Find user to get username for confirmation
    const user = usersData.find(u => u.id === userId);
    if (user && user.role !== newRole) {
      setRoleChangeData({
        userId,
        newRole,
        username: user.username
      });
      setRoleChangeModalOpen(true);
    }
  };

  const confirmRoleChange = async () => {
    const token = Cookies.get("neo_code_jwt_token");
    const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
    
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/users/role/${roleChangeData.userId}`,
        { role: roleChangeData.newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Update local state immediately for better UX
      setUsersData(prevUsers => 
        prevUsers.map(user => 
          user.id === roleChangeData.userId ? { ...user, role: roleChangeData.newRole } : user
        )
      );
      
      setRoleChangeModalOpen(false);
      setRoleChangeData({ userId: null, newRole: "", username: "" });
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update user role. Please try again.");
      setRoleChangeModalOpen(false);
      
      // Reset the dropdown to original value by refetching
      await fetchAllUsers();
    }
  };

  const renderFailure = () => (
    <div className="text-center text-red-500 py-20 mt-28">
      Failed to load users.{" "}
      <button onClick={fetchAllUsers} className="underline hover:text-red-700">
        Try again
      </button>
    </div>
  );

  const renderUsersList = () => (
    <div className="">
      {usersData.map((user) => (
        <UserDataCard
          key={user.id}
          userDetails={user}
          onRequestDelete={handleRequestDelete}
          onRoleChange={handleRoleChange}
        />
      ))}
    </div>
  );

  return (
    <div>
      <Header />
      <div className="bg-black/95 min-h-screen pt-28 px-10">
        <Breadcrumb 
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "User Management" }
          ]}
        />
        
        <h1 className="text-white text-[40px]">Users Data</h1>
        {(() => {
          switch (apiStatus) {
            case getAllUsersApiStatusConstant.inProgress:
              return renderLoader();
            case getAllUsersApiStatusConstant.failure:
              return renderFailure();
            case getAllUsersApiStatusConstant.success:
              return renderUsersList();
            default:
              return null;
          }
        })()}

        {/* Delete Confirmation Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
            <div className="w-1/3 bg-gray-800 text-white rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h1 className="font-semibold text-xl">Confirm Delete</h1>
                <button
                  className="text-white"
                  onClick={() => setModalOpen(false)}
                >
                  <RxCross2 />
                </button>
              </div>
              <p className="text-center mb-6">{warningMessage}</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => {
                    handleConfirmDelete();
                    setModalOpen(false);
                    setToDeleteId(null);
                  }}
                  className="bg-red-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  YES
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="bg-gray-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role Change Confirmation Modal */}
        {roleChangeModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
            <div className="w-1/3 bg-gray-800 text-white rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h1 className="font-semibold text-xl">Confirm Role Change</h1>
                <button
                  className="text-white"
                  onClick={() => {
                    setRoleChangeModalOpen(false);
                    // Reset to original role by refetching
                    fetchAllUsers();
                  }}
                >
                  <RxCross2 />
                </button>
              </div>
              <p className="text-center mb-6">
                Are you sure you want to change <span className="font-semibold text-blue-400">{roleChangeData.username}</span>'s role to <span className="font-semibold text-green-400 capitalize">{roleChangeData.newRole}</span>?
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={confirmRoleChange}
                  className="bg-green-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  YES
                </button>
                <button
                  onClick={() => {
                    setRoleChangeModalOpen(false);
                    // Reset to original role by refetching
                    fetchAllUsers();
                  }}
                  className="bg-gray-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
