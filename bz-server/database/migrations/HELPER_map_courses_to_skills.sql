-- ============================================================================
-- Helper: Map Your Actual Courses to Skills
-- ============================================================================
-- This script helps you map your existing courses to skills in the AI Mentor System
-- 
-- STEP 1: Run this query to see your existing courses
-- ============================================================================

SELECT 
    id, 
    title, 
    category, 
    difficulty,
    created_at
FROM courses 
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Copy a course ID and map it to skills
-- ============================================================================
-- Example: If you have a course "DSA with Striver" with id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--
-- Replace 'YOUR-COURSE-UUID-HERE' with the actual course ID
-- ============================================================================

-- Example mapping for a DSA course:
-- INSERT INTO course_skills (course_id, skill_name, skill_weight, target_level, description)
-- VALUES 
--   ('YOUR-COURSE-UUID-HERE', 'DSA', 10, 3, 'Core Data Structures and Algorithms proficiency'),
--   ('YOUR-COURSE-UUID-HERE', 'Arrays', 8, 3, 'Array manipulation and problem solving'),
--   ('YOUR-COURSE-UUID-HERE', 'Sorting', 7, 2, 'Sorting algorithms and techniques'),
--   ('YOUR-COURSE-UUID-HERE', 'Hashing', 7, 2, 'Hash tables and hash-based problem solving'),
--   ('YOUR-COURSE-UUID-HERE', 'Trees', 9, 3, 'Binary trees, BST, tree traversals'),
--   ('YOUR-COURSE-UUID-HERE', 'Graphs', 9, 3, 'Graph algorithms: BFS, DFS, shortest path'),
--   ('YOUR-COURSE-UUID-HERE', 'Dynamic Programming', 10, 4, 'DP patterns and optimization'),
--   ('YOUR-COURSE-UUID-HERE', 'Greedy Algorithms', 8, 3, 'Greedy approach and optimization'),
--   ('YOUR-COURSE-UUID-HERE', 'Recursion', 7, 2, 'Recursive problem solving')
-- ON CONFLICT (course_id, skill_name) DO UPDATE SET
--   skill_weight = EXCLUDED.skill_weight,
--   target_level = EXCLUDED.target_level,
--   description = EXCLUDED.description;

-- ============================================================================
-- STEP 3: Verify the mapping worked
-- ============================================================================

SELECT 
    c.title as course_title,
    cs.skill_name,
    cs.skill_weight,
    cs.target_level,
    cs.description
FROM course_skills cs
JOIN courses c ON c.id = cs.course_id
ORDER BY c.title, cs.skill_weight DESC;

-- ============================================================================
-- STEP 4: Initialize skills for a test user (optional)
-- ============================================================================
-- This creates user_skills entries so the system can start tracking progress
-- Replace 'USER-UUID-HERE' with an actual user ID
-- ============================================================================

-- SELECT id, username FROM users LIMIT 5;  -- Find a user ID

-- INSERT INTO user_skills (user_id, skill_name, level, confidence, source)
-- SELECT 
--   'USER-UUID-HERE',
--   skill_name,
--   0,
--   50,
--   'manual_init'
-- FROM skill_catalog
-- WHERE category IN ('DSA', 'XR Development')
-- ON CONFLICT (user_id, skill_name) DO NOTHING;

-- ============================================================================
-- Quick Reference: Skill Weights and Target Levels
-- ============================================================================
-- 
-- SKILL_WEIGHT (1-10): How important is this skill in the course?
--   10 = Core skill (e.g., "DSA" in a DSA course)
--   8-9 = Major topic (e.g., "Trees", "Graphs")
--   5-7 = Important but secondary (e.g., "Sorting", "Hashing")
--   1-4 = Supplementary skill
--
-- TARGET_LEVEL (1-5): What skill level should users reach?
--   1 = Beginner (basic understanding)
--   2 = Intermediate (can solve standard problems)
--   3 = Advanced (can solve complex problems)
--   4 = Expert (can teach others, optimize solutions)
--   5 = Master (contributes to the field, creates new patterns)
--
-- ============================================================================
-- Common Course → Skills Mappings
-- ============================================================================

-- DSA Course Skills:
--   DSA, Arrays, Sorting, Hashing, Trees, Graphs, Dynamic Programming, 
--   Greedy Algorithms, Recursion, Linked Lists, Stacks, Queues

-- VR Development Course Skills:
--   VR Basics, Unity Fundamentals, C#, 3D Math, Graphics Programming,
--   XR Interaction, Performance Optimization, Spatial Audio

-- Web Development Course Skills:
--   HTML/CSS, JavaScript, React, Node.js, REST APIs, Database Design,
--   Authentication, Deployment

-- Machine Learning Course Skills:
--   Python, NumPy, Pandas, Scikit-learn, TensorFlow, Neural Networks,
--   Feature Engineering, Model Evaluation

-- ============================================================================
