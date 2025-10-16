Users Table
CREATE TABLE Users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Problem Table
CREATE TABLE Problem (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  constraints VARCHAR(255),
  prohibited_keys JSONB,
  sample_testcase JSONB,
  explaination TEXT DEFAULT 'Self Explainary',
  no_of_submissions INT DEFAULT 0,
  hidden BOOLEAN DEFAULT FALSE,
  difficulty difficulty_level NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES Users(id) ON DELETE CASCADE,
  score score_level DEFAULT '10',
  category VARCHAR(100),
  solution TEXT,
  solution_language VARCHAR(100)
);

Default Code Table
CREATE TABLE defaultCode (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  problem_id INT REFERENCES Problem(id) ON DELETE CASCADE,
  language VARCHAR(100) NOT NULL
);

Programming Languages Table
CREATE TABLE language (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

Testcases Table
CREATE TABLE testcases (
  id SERIAL PRIMARY KEY,
  testcase JSONB NOT NULL,
  problem_id INT REFERENCES Problem(id) ON DELETE CASCADE
);

Submissions Table
CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  problem_id INT REFERENCES Problem(id) ON DELETE CASCADE,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  language VARCHAR(100) NOT NULL,
  test_results JSONB NOT NULL,
  verdict submission_status NOT NULL,
  submission_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time VARCHAR(255) NOT NULL
);

Saved Snippets Table
CREATE TABLE savedSnippets(
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Blog Table
CREATE TABLE Blog (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  tags TEXT[],
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES Users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES Users(id),
  visible BOOLEAN DEFAULT TRUE
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- corresponds to problem.category
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE course_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    problem_id integer REFERENCES problem(id) ON DELETE CASCADE,
    points INT NOT NULL, -- points earned for this problem (calculated by difficulty)
    visibility VARCHAR(20) DEFAULT 'course_only', -- course_only | public | contest
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    solved_problems INT DEFAULT 0,     -- total solved
    total_problems INT DEFAULT 0,      -- cached total problems
    course_points INT DEFAULT 0,       -- cumulative points from solved problems
    full_completion BOOLEAN DEFAULT FALSE, -- TRUE if all course problems solved
    last_solved_at TIMESTAMP DEFAULT NOW()
);