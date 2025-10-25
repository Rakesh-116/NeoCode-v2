import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Register from "./components/pages/Auth/Register";
import Login from "./components/pages/Auth/Login";
import Home from "./components/pages/Home";
import Blogs from "./components/pages/Blogs/Blogs";
import Problems from "./components/pages/problems/Problems";
import ProblemPage from "./components/pages/problems/ProblemPage";
import NotFound from "./components/pages/NotFound";
import MyCodePage from "./components/pages/MyCode/MyCodePage";
import Submissions from "./components/pages/Submissions/SubmissionsPage";
import Profile from "./components/pages/Profile";
import { UserProvider } from "./context/UserContext";
import SavedSnippets from "./components/pages/SavedSnippets";
import Courses from "./components/pages/Courses/Courses";
import CourseDetails from "./components/pages/Courses/CourseDetails";


import AdminRoute from "./components/pages/Auth/AdminRoute";
import AdminDashboard from "./components/pages/Admin/AdminDashboard";
import AdminUsers from "./components/pages/Admin/AdminUsers";
import CreateProblem from "./components/pages/Admin/Problems/CreateProblem";
import CreateBlog from "./components/pages/Admin/CreateBlog";
import BlogPage from "./components/pages/Blogs/BlogPage";
import CreateCourse from "./components/pages/Admin/Courses/CreateCourse";
import CourseList from "./components/pages/Admin/Courses/CourseList";
import AdminCourseDetails from "./components/pages/Admin/Courses/AdminCourseDetails";
import EditCourse from "./components/pages/Admin/Courses/EditCourse";
import AdminUserAnalysis from "./components/pages/Admin/AdminUserAnalysis";
import AdminProblemManagement from "./components/pages/Admin/Problems/AdminProblemManagement";
import EditProblem from "./components/pages/Admin/Problems/EditProblem";

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blog/:id" element={<BlogPage />} />
          <Route path="/submissions" element={<Submissions />} />
          <Route path="/problemset" element={<Problems />} />
          <Route path="/problems/:id" element={<ProblemPage />} />
          <Route path="/compiler" element={<MyCodePage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/savedsnippets" element={<SavedSnippets />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetails />} />

          {/* Admin-only Route */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/problems" element={<AdminProblemManagement />} />
            <Route path="/admin/createproblem" element={<CreateProblem />} />
            <Route path="/admin/editproblem/:id" element={<EditProblem />} />
            <Route path="/admin/newblog" element={<CreateBlog />} />
            <Route path="/admin/courses" element={<CourseList />} />
            <Route path="/admin/courses/:id" element={<AdminCourseDetails />} />
            <Route path="/admin/courses/edit/:id" element={<EditCourse />} />
            <Route path="/admin/newcourse" element={<CreateCourse />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/analysis/:userId" element={<AdminUserAnalysis />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </UserProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        style={{ zIndex: 9999 }}
      />
    </BrowserRouter>
  );
}

export default App;
