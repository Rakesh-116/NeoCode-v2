import { Link, useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { useState, useEffect, useRef } from "react";
import { FaGithub } from "react-icons/fa";
import { HiMenu, HiX } from "react-icons/hi";

import { useUser } from "../../context/UserContext";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const { isLoggedIn, userData, updateUserData, clearUserData } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const jwtToken = Cookies.get("neo_code_jwt_token");
    if (jwtToken !== undefined && !userData) {
      fetchUserData();
    }
  }, [userData]);

  const fetchUserData = async () => {
    try {
      const jwtToken = Cookies.get("neo_code_jwt_token");
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        updateUserData(data.user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const onLogOut = () => {
    Cookies.remove("neo_code_jwt_token");
    localStorage.removeItem("user");
    clearUserData();
    setShowDropdown(false);
    setIsMobileMenuOpen(false);
    navigate("/login");
  };

  const onLogIn = () => {
    navigate("/login");
  };

  return (
    <div className="w-full flex justify-center transition-all bg-transparent">
      <div
        className={`w-[90vw] max-w-7xl border border-white/20 rounded-xl px-4 md:px-6 py-2 bg-black text-white flex justify-between items-center transition-all duration-300 fixed top-5 ${
          isScrolled ? "bg-black/50 backdrop-blur-md shadow-lg" : "bg-black"
        } z-40`}
      >
        {/* Logo */}
        <Link to="/" className="flex justify-start space-x-2 items-center">
          <img src="/logo.png" className="w-8 h-6" />
          <span className="font-medium text-xl text-white/90 hover:text-white transition duration-300">
            NeoCode
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex space-x-6 xl:space-x-8">
          <Link
            to="/"
            className={`hover:text-white transition-colors ${
              location.pathname === "/" ? "text-white" : "text-white/70"
            }`}
          >
            Home
          </Link>
          <Link
            to="/blogs"
            className={`hover:text-white transition-colors ${
              location.pathname === "/blogs" ? "text-white" : "text-white/70"
            }`}
          >
            Blogs
          </Link>
          <Link
            to="/problemset"
            className={`hover:text-white transition-colors ${
              location.pathname === "/problemset"
                ? "text-white"
                : "text-white/70"
            }`}
          >
            Problems
          </Link>
          {isLoggedIn && (
            <Link
              to="/courses"
              className={`hover:text-white transition-colors ${
                location.pathname === "/courses"
                  ? "text-white"
                  : "text-white/70"
              }`}
            >
              Courses
            </Link>
          )}
          {isLoggedIn && (
            <Link
              to="/compiler"
              className={`hover:text-white transition-colors ${
                location.pathname === "/compiler"
                  ? "text-white"
                  : "text-white/70"
              }`}
            >
              Code
            </Link>
          )}
          {userData && userData.role === "admin" && (
            <Link
              to="/admin"
              className={`hover:text-white transition-colors ${
                location.pathname === "/admin" ? "text-white" : "text-white/70"
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Desktop Right Side */}
        <div className="hidden lg:flex items-center space-x-4">
          <a
            href="https://github.com/Rakesh-116/NeoCode-v2"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:opacity-80 transition border border-white/20 hover:border-white/25 hover:bg-white/10 p-2 rounded-md"
          >
            <FaGithub className="h-4 w-4" />
            <span className="hidden xl:inline text-white/80 font-medium">
              Open Source
            </span>
          </a>
          {isLoggedIn ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                className="px-4 py-2 text-white rounded-md font-medium border border-white/20 hover:border-white/25 hover:bg-white/10 transition duration-300 flex items-center gap-2"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span className="max-w-24 truncate">{userData?.username || "User"}</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-md bg-black/95 backdrop-blur-sm border border-white/20 shadow-lg p-1 transition-all duration-300">
                  {userData.role !== "admin" && (
                    <h1 className="p-2 opacity-50 cursor-default text-sm truncate">
                      {userData.email}
                    </h1>
                  )}
                  <Link
                    to="/profile"
                    className="block p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/submissions"
                    className="block p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    My Submissions
                  </Link>
                  <Link
                    to="/savedsnippets"
                    className="block p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    My Snippets
                  </Link>
                  <button
                    onClick={onLogOut}
                    className="w-full text-left p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="px-6 py-2 border border-white/25 text-white rounded-md font-medium hover:bg-white/10 transition duration-300"
              onClick={() => onLogIn()}
            >
              LogIn
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md border border-white/20 hover:border-white/25 hover:bg-white/10 transition duration-300"
          >
            {isMobileMenuOpen ? (
              <HiX className="h-6 w-6" />
            ) : (
              <HiMenu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="fixed top-20 left-[5vw] right-[5vw] bg-black/95 backdrop-blur-md border border-white/20 rounded-xl p-4 z-30 lg:hidden"
        >
          <div className="flex flex-col space-y-4">
            <Link
              to="/"
              className={`hover:text-white transition-colors ${
                location.pathname === "/" ? "text-white" : "text-white/70"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/blogs"
              className={`hover:text-white transition-colors ${
                location.pathname === "/blogs" ? "text-white" : "text-white/70"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Blogs
            </Link>
            <Link
              to="/problemset"
              className={`hover:text-white transition-colors ${
                location.pathname === "/problemset"
                  ? "text-white"
                  : "text-white/70"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Problems
            </Link>
            {isLoggedIn && (
              <Link
                to="/courses"
                className={`hover:text-white transition-colors ${
                  location.pathname === "/courses"
                    ? "text-white"
                    : "text-white/70"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Courses
              </Link>
            )}
            {isLoggedIn && (
              <Link
                to="/compiler"
                className={`hover:text-white transition-colors ${
                  location.pathname === "/compiler"
                    ? "text-white"
                    : "text-white/70"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Code
              </Link>
            )}
            {userData && userData.role === "admin" && (
              <Link
                to="/admin"
                className={`hover:text-white transition-colors ${
                  location.pathname === "/admin" ? "text-white" : "text-white/70"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            
            <div className="border-t border-white/20 pt-4 mt-4">
              <a
                href="https://github.com/Rakesh-116/NeoCode-v2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:opacity-80 transition p-2 rounded-md hover:bg-white/10"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FaGithub className="h-4 w-4" />
                <span className="text-white/80 font-medium">Open Source</span>
              </a>
            </div>

            {isLoggedIn ? (
              <div className="border-t border-white/20 pt-4 mt-4">
                <div className="mb-2">
                  <span className="text-white font-medium">{userData?.username || "User"}</span>
                  {userData?.email && userData.role !== "admin" && (
                    <p className="text-white/50 text-sm">{userData.email}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2">
                  <Link
                    to="/profile"
                    className="text-white/70 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/submissions"
                    className="text-white/70 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Submissions
                  </Link>
                  <Link
                    to="/savedsnippets"
                    className="text-white/70 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Snippets
                  </Link>
                  <button
                    onClick={onLogOut}
                    className="text-left text-white/70 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-white/20 pt-4 mt-4">
                <button
                  type="button"
                  className="w-full px-6 py-2 border border-white/25 text-white rounded-md font-medium hover:bg-white/10 transition duration-300"
                  onClick={() => {
                    onLogIn();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  LogIn
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
