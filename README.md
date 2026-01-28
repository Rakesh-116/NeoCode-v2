# 🚀 NeoCode - Online Code Compiler and Problem Platform

NeoCode is a full-stack, developer-focused coding platform that allows users to solve problems, write code, and run it in a secure Docker-based environment. Built with scalability, role-based access, and smooth developer experience in mind.

![Editor](https://img.shields.io/badge/Editor-Monaco-blue?logo=visualstudiocode)
![Docker](https://img.shields.io/badge/Containerized-Docker-blue?logo=docker)
![Auth](https://img.shields.io/badge/Auth-JWT-green?logo=jwt)
![Styling](https://img.shields.io/badge/Styled%20With-TailwindCSS-blueviolet?logo=tailwind-css)

---

https://github.com/user-attachments/assets/9a86aaae-2e85-4fa0-9990-0fd6b6b11bb3

---

## 🧱 Project Overview

### 🔐 Role-Based Authentication
- **JWT-based authentication** with user roles.
- Admin and User roles:
  - Admin: full CRUD access to Blogs, Problems, Submissions, Users.
  - User: Can solve problems, write and run code, save snippets.

### 👨‍💻 Online Code Compiler
- Supported Languages: **Java**, **C++**, **Python**.
- **Monaco Editor** for modern, VS Code-like coding experience.
- Save snippets for future use.
- Support for input-based code execution.
- Output validated against test cases stored in **PostgreSQL**.

### 🐳 Docker-based Container Reuse
- Prebuilt language containers:
  - e.g., C++ uses a GCC-installed container.
- Containers are **reused**:
  - Checked on each request whether the container is running.
  - If not, it is started and reused for multiple executions.
- Steps:
  1. Copy code and input to the container.
  2. Execute code inside the container.
  3. Extract the output.
  4. Compare with expected output from database.
  5. Return result.

### 📦 Modular Features
- 📝 **Blogs** (Admin-only CRUD with rich text editor)
- 💡 **Problems** (Admin-only CRUD with category organization)
- 📤 **Submissions** (View and manage with detailed analytics)
- 💻 **My Code** (Test any code anytime with snippet-saving)
- 🎓 **Course Management** (Complete course platform with enrollment)
- 🧠 **AI Complexity Analysis** (Gemini-powered Big O notation detection)
- 📊 **Category Points System** (Advanced progress tracking with charts)
- 🏆 **Leaderboards** (Category-wise ranking system)
- 👥 **User Analytics** (Comprehensive admin dashboard)
- 🎯 **Smart Caching** (Intelligent complexity and code caching)

### 🎯 Smart Execution Pipeline
- Unique problem IDs mapped to expected outputs in DB.
- Submission compared and judged automatically.

### 🤖 AI-Powered Features
- **Gemini AI Integration** for real-time complexity analysis
- **Big O Notation Detection** with intelligent caching
- **Smart Code Analysis** across multiple programming languages
- **LRU Cache Management** for optimal performance

### 🎓 Course Management System
- **Complete Course Platform** with problem assignments
- **Student Enrollment** and progress tracking
- **Course-specific Submissions** and analytics
- **Category-based Organization** for better learning paths
- **Points-based Progression** system

### 📊 Advanced Analytics Dashboard
- **Category Points System** with visual progress tracking
- **Interactive Charts** using Chart.js for data visualization
- **Leaderboard System** for competitive programming
- **Difficulty-based Statistics** and completion tracking
- **Real-time Progress Updates** across all categories

### 🧾 Tech Stack

| Layer         | Technology                                  |
| ------------- | -------------------------------------------- |
| Frontend      | React.js, Tailwind CSS, React Router, Monaco |
| Backend       | Node.js, Express.js                          |
| Authentication| JWT                                          |
| Code Execution| Docker (GCC, Python, Java containers)        |
| DB            | PostgreSQL                                   |
| AI Integration| Google Gemini AI                             |
| Data Visualization | Chart.js, React Chart.js 2                 |
| Rich Text     | Quill.js, React Quill                       |
| Animations    | Framer Motion, React Particles               |
| Styling       | Tailwind CSS                                 |
| Code Editor   | Monaco Editor                                |

---

## ✨ Highlights

- ✅ **Reusable Docker containers** for efficient code execution.
- 🎯 **Role-based access control** with comprehensive admin dashboard.
- 📄 **Full CRUD operations** for blogs, problems, users, courses, and submissions.
- 🧪 **Automated judging** with output matching against PostgreSQL test cases.
- 🧠 **AI-Powered Complexity Analysis** using Google Gemini for Big O notation.
- 🎓 **Complete Course Management** with enrollment and progress tracking.
- � **Advanced Analytics** with category points, leaderboards, and visual charts.
- 🔄 **Intelligent Caching** for complexity analysis and code persistence.
- 🎨 **Modern UI/UX** with Tailwind CSS, animations, and responsive design.
- 🏆 **Category-wise Progress** tracking with detailed statistics and achievements.

---

## 🆕 Advanced Features

### 🧠 Complexity Analysis
- **Real-time AI Analysis**: Powered by Google Gemini AI for instant Big O notation detection
- **Multi-language Support**: Analyze Java, Python, C++, JavaScript, and C code
- **Smart Caching**: LRU cache system stores previous analyses for faster results
- **Visual Integration**: Seamless integration with code editor for instant feedback

### 📊 Category Points & Analytics
- **Category-wise Tracking**: Monitor progress across different algorithm categories
- **Visual Dashboard**: Interactive charts showing progress distribution and statistics  
- **Leaderboard System**: Compete with other users in category-specific rankings
- **Achievement System**: Track completion percentages and earned points
- **Detailed Analytics**: Difficulty breakdown and problem-solving patterns

### 🎓 Course Management
- **Structured Learning**: Organized courses with curated problem sets
- **Progress Tracking**: Monitor student advancement through course materials
- **Enrollment System**: Easy course registration and management
- **Course Analytics**: Comprehensive statistics for instructors and students
- **Points Integration**: Earn category points through course completion

### 🎨 Enhanced User Experience  
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Rich Animations**: Smooth transitions using Framer Motion
- **Interactive Elements**: Particle effects and dynamic visual feedback
- **Code Persistence**: Automatic saving of code progress per problem
- **Multi-theme Support**: Customizable editor themes and preferences

---

## 📁 Folder Structure
```bash
NeoCode/
├── README.md                      # Project documentation
├── bz-client/                    # Frontend (React + Vite)
│   ├── public/                   # Public assets
│   │   ├── logo.png
│   │   ├── logo.svg
│   │   └── vite.svg
│   ├── src/
│   │   ├── assets/               # Static images
│   │   │   ├── stars.png
│   │   │   ├── stars-black.png
│   │   │   └── zoro-s.png
│   │   ├── components/
│   │   │   ├── Common/           # Shared UI components
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── ChartComponent.jsx
│   │   │   │   └── constants.js
│   │   │   └── pages/            # Route-level components
│   │   │       ├── Admin/
│   │   │       │   ├── AdminDashboard.jsx
│   │   │       │   ├── AdminUsers.jsx
│   │   │       │   ├── CreateBlog.jsx
│   │   │       │   └── CreateProblem.jsx
│   │   │       ├── Auth/
│   │   │       │   ├── AdminRoute.jsx
│   │   │       │   ├── Login.jsx
│   │   │       │   └── Register.jsx
│   │   │       ├── Blogs/
│   │   │       │   ├── BlogCard.jsx
│   │   │       │   ├── BlogPage.jsx
│   │   │       │   └── Blogs.jsx
│   │   │       ├── MyCode/
│   │   │       │   └── MyCodePage.jsx
│   │   │       ├── problems/
│   │   │       │   ├── CodeEditor.jsx
│   │   │       │   ├── ProblemCard.jsx
│   │   │       │   ├── ProblemPage.jsx
│   │   │       │   └── Problems.jsx
│   │   │       ├── Submissions/
│   │   │       │   ├── SubmissionsPage.jsx
│   │   │       │   └── SubmissionViewPage.jsx
│   │   │       ├── Footer.jsx
│   │   │       ├── Header.jsx
│   │   │       ├── Home.jsx
│   │   │       ├── NotFound.jsx
│   │   │       ├── Profile.jsx
│   │   │       └── SavedSnippets.jsx
│   │   ├── context/
│   │   │   └── UserContext.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── dist/                     # Build output
│   │   ├── index.html
│   │   ├── logo.png
│   │   ├── logo.svg
│   │   ├── vite.svg
│   │   └── assets/
│   │       ├── index-*.js
│   │       ├── index-*.css
│   │       └── zoro-s-*.png
│   ├── .env
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── .eslintrc.cjs
├── bz-server/                    # Backend (Express.js)
│   ├── src/
│   │   ├── constants/
│   │   ├── controllers/
│   │   │   ├── compilers/
│   │   │   │   ├── executeCppCode.controller.js
│   │   │   │   ├── executeJavaCode.controller.js
│   │   │   │   └── executePythonCode.controller.js
│   │   │   ├── blogs.admin.controller.js
│   │   │   ├── blogs.users.controller.js
│   │   │   ├── problem.controller.js
│   │   │   ├── problem.execute.controller.js
│   │   │   ├── problems.admin.controller.js
│   │   │   ├── profile.user.controller.js
│   │   │   ├── snippets.controller.js
│   │   │   └── users.admin.controller.js
│   │   ├── database/
│   │   │   ├── connect.db.js
│   │   │   └── schema.md
│   │   ├── middlewares/
│   │   │   └── authentication.js
│   │   ├── routes/
│   │   │   ├── blogs.admin.routes.js
│   │   │   ├── blogs.user.routes.js
│   │   │   ├── problem.execute.routes.js
│   │   │   ├── problems.admin.routes.js
│   │   │   ├── profile.user.routes.js
│   │   │   ├── snippets.routes.js
│   │   │   └── users.admin.routes.js
│   │   ├── workers/
│   │   │   ├── cpp-worker/
│   │   │   │   ├── Dockerfile
│   │   │   │   ├── input.txt
│   │   │   │   └── NeoCode.cpp
│   │   │   ├── java-worker/
│   │   │   │   ├── Dockerfile
│   │   │   │   ├── input.txt
│   │   │   │   ├── NeoCode.java
│   │   │   │   └── exec_sample_*.*
│   │   │   └── python-worker/
│   │   │       ├── Dockerfile
│   │   │       ├── input.txt
│   │   │       └── NeoCode.py
│   │   └── index.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json

```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Rakesh-116/NeoCode.git
cd NeoCode
```
🚀 Running the App
🐳 Prerequisite: Start Docker Daemon
Ensure Docker is running on your machine.

1. Backend
```bash
cd bz-server
npm install
npm run dev
```
3. Frontend
```bash
cd ../bz-client
npm install
npm run dev
```

### 2. Setup Environment Variables
Create a .env file inside the /bz-server folder and add the following variables:

🛠️ Sample .env for /bz-server
```bash
PORT=8080

# 🔐 PostgreSQL connection
DB_USER_NAME=your_database_user
DB_PASS=your_database_password
DB_HOST=your_database_host_url
DB_PORT=5432
DB_NAME=your_database_name
SSL_MODE=require

# 🔑 JWT Auth Secret
JWT_SECRET_KEY=your_super_secret_key

# 🤖 AI Integration
GEMINI_API_KEY=your_gemini_api_key_here
```

✅ Ready to Use
Visit the app in your browser at:
http://localhost:5173 (or your Vite dev port)

Backend runs on:
http://localhost:8080

### 3. Docker Setup for Compilation Workers

After cloning the repository, follow these steps to set up Docker containers for the compilers.

### Prerequisites

Ensure that you have [Docker](https://docs.docker.com/get-docker/) installed on your system. Docker is required to build images and run containers for compilation tasks. If you don't have Docker installed, please refer to the provided link for installation instructions for your platform.

### Build Docker Images

Once Docker is installed, navigate to the root directory of the cloned repository.

1. **Navigate to the Dockerfile directory**:
   The Dockerfiles for each language (C++, Java, and Python) are located in the `bz-server/src/workers` folder. 
   
2. **Build Docker images**:
   You will need to create Docker images for each language using the Dockerfiles. Run the following commands to build the Docker images:

   - **For C++**:
     ```bash
     docker build -t cpp-comp bz-server/src/workers/cpp-worker
     ```

   - **For Java**:
     ```bash
     docker build -t java-comp bz-server/src/workers/java-worker
     ```

   - **For Python**:
     ```bash
     docker build -t python-comp bz-server/src/workers/python-worker
     ```

   This will create three Docker images:
   - `cpp-comp` (for C++ compilation)
   - `java-comp` (for Java compilation)
   - `python-comp` (for Python compilation)

### Run Docker Containers

After successfully building the Docker images, you can now create containers from these images. The container names should match the image names as per your instructions.

1. **Run containers**:
   To start a container for each language, execute the following commands:

   - **For C++**:
     ```bash
     docker run -d --name cpp-container cpp-comp
     ```

   - **For Java**:
     ```bash
     docker run -d --name java-container java-comp
     ```

   - **For Python**:
     ```bash
     docker run -d --name python-container python-comp
     ```

   This will create and start three containers with the following names:
   - `cpp-container` (for C++ compilation)
   - `java-container` (for Java compilation)
   - `python-container` (for Python compilation)

### Verify Containers

To verify that the containers are running correctly, use the following command:

```bash
docker ps
```
This will display a list of running containers. You should see the containers cpp-container, java-container, and python-container listed.

Stopping and Removing Containers
To stop and remove any container, use the following commands:

Stop containers:

```bash
docker stop cpp-container
docker stop java-container
docker stop python-container
```
Remove containers:

```bash
docker rm cpp-container
docker rm java-container
docker rm python-container
```
### Conclusion
You have now successfully set up Docker containers for C++, Java, and Python compilation. You can interact with these containers via your application's API to compile code for each language.

If you encounter any issues with Docker setup or running containers, refer to the Docker Documentation for more information and troubleshooting steps.

### Explanation:
- This section assumes the user has already cloned the repo and focuses on building Docker images and running containers.
- The user will be guided to build images for C++, Java, and Python using their respective Dockerfiles.
- Each image corresponds to a container, and the instructions clearly specify the naming conventions (`cpp-container`, `java-container`, and `python-container`).
- It provides basic Docker commands to verify and manage containers, including stopping and removing them.

## Author

This project is made with ❤️ by [Rakesh Penugonda].  
Feel free to explore and contribute to the repository!

---

## Feedback & Doubts

If you have any feedback, suggestions, or doubts about this project, feel free to reach out.  
We value your input and aim to improve continuously.

- For feedback or suggestions, you can email us directly at: **rakeshwgpcgr@gmail.com**

We appreciate your contributions and involvement!


