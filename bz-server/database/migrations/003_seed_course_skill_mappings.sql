-- ============================================================================
-- Migration 003: Seed Course-Skill Mappings
-- ============================================================================
-- Purpose: Map existing/example courses to skills in the AI Mentor System
-- This enables cross-course skill aggregation in learning dashboard
--
-- NOTE: This migration uses sample course mappings. 
-- To use real courses, query your courses table first:
--   SELECT id, title FROM courses;
-- Then replace the UUIDs below with actual course IDs.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add skills to skill_catalog first (they must exist before mapping)
-- ============================================================================

-- DSA Skills
INSERT INTO skill_catalog (skill_name, display_name, category, description, prerequisites)
VALUES
  ('DSA', 'Data Structures & Algorithms', 'Computer Science', 'Core computer science fundamentals', ARRAY[]::TEXT[]),
  ('Arrays', 'Array Manipulation', 'DSA', 'Working with arrays and lists', ARRAY['DSA']),
  ('Sorting', 'Sorting Algorithms', 'DSA', 'Sorting techniques and complexity', ARRAY['Arrays']),
  ('Hashing', 'Hashing & Hash Tables', 'DSA', 'Hash-based data structures', ARRAY['Arrays']),
  ('Trees', 'Tree Data Structures', 'DSA', 'Binary trees, BST, AVL, etc.', ARRAY['DSA']),
  ('Graphs', 'Graph Algorithms', 'DSA', 'Graph traversal and algorithms', ARRAY['Trees']),
  ('Dynamic Programming', 'Dynamic Programming', 'DSA', 'DP patterns and optimization', ARRAY['Recursion']),
  ('Greedy Algorithms', 'Greedy Algorithms', 'DSA', 'Greedy approach to optimization', ARRAY['DSA']),
  ('Recursion', 'Recursion & Backtracking', 'DSA', 'Recursive problem solving', ARRAY['DSA']),
  
  -- VR Skills
  ('VR Basics', 'VR Development Basics', 'XR Development', 'Introduction to VR development', ARRAY[]::TEXT[]),
  ('Unity Fundamentals', 'Unity Game Engine', 'Game Development', 'Unity basics and VR integration', ARRAY['C#']),
  ('Graphics Programming', 'Graphics & Shaders', 'Graphics', 'Rendering and visual programming', ARRAY['3D Math']),
  ('C#', 'C# Programming', 'Programming Languages', 'C# for Unity and .NET', ARRAY[]::TEXT[]),
  ('3D Math', '3D Mathematics', 'Mathematics', 'Vector math and transformations', ARRAY[]::TEXT[]),
  ('XR Interaction', 'XR Interaction Design', 'XR Development', 'Hand tracking and spatial UI', ARRAY['VR Basics', 'Unity Fundamentals']),
  ('Performance Optimization', 'VR Performance', 'XR Development', 'Optimizing VR applications', ARRAY['Unity Fundamentals', 'Graphics Programming'])
ON CONFLICT (skill_name) DO NOTHING;

-- ============================================================================
-- STEP 2: Map courses to skills
-- ============================================================================
-- IMPORTANT: Replace the UUIDs below with actual course IDs from your database
-- Run this query first to get your course IDs:
--   SELECT id, title FROM courses WHERE title ILIKE '%dsa%' OR title ILIKE '%vr%';
-- ============================================================================

-- Example mapping for DSA course (REPLACE THE UUID!)
-- Uncomment and update these lines after getting real course IDs:

/*
INSERT INTO course_skills (course_id, skill_name, skill_weight, target_level, description)
VALUES 
  -- Replace 'COURSE-UUID-HERE' with actual UUID from courses table
  ('COURSE-UUID-HERE', 'DSA', 10, 3, 'Core Data Structures and Algorithms proficiency'),
  ('COURSE-UUID-HERE', 'Arrays', 8, 3, 'Array manipulation and problem solving'),
  ('COURSE-UUID-HERE', 'Sorting', 7, 2, 'Sorting algorithms and techniques'),
  ('COURSE-UUID-HERE', 'Hashing', 7, 2, 'Hash tables and hash-based problem solving'),
  ('COURSE-UUID-HERE', 'Trees', 9, 3, 'Binary trees, BST, tree traversals'),
  ('COURSE-UUID-HERE', 'Graphs', 9, 3, 'Graph algorithms: BFS, DFS, shortest path'),
  ('COURSE-UUID-HERE', 'Dynamic Programming', 10, 4, 'DP patterns and optimization'),
  ('COURSE-UUID-HERE', 'Greedy Algorithms', 8, 3, 'Greedy approach and optimization'),
  ('COURSE-UUID-HERE', 'Recursion', 7, 2, 'Recursive problem solving')
ON CONFLICT (course_id, skill_name) DO UPDATE SET
  skill_weight = EXCLUDED.skill_weight,
  target_level = EXCLUDED.target_level,
  description = EXCLUDED.description;
*/

-- Example mapping for VR course (REPLACE THE UUID!)
/*
INSERT INTO course_skills (course_id, skill_name, skill_weight, target_level, description)
VALUES 
  -- Replace 'COURSE-UUID-HERE' with actual UUID from courses table
  ('COURSE-UUID-HERE', 'VR Basics', 10, 2, 'Fundamentals of VR development and concepts'),
  ('COURSE-UUID-HERE', 'Unity Fundamentals', 9, 3, 'Unity game engine basics and VR SDK'),
  ('COURSE-UUID-HERE', 'Graphics Programming', 8, 3, 'Shaders, rendering, and visual effects'),
  ('COURSE-UUID-HERE', 'C#', 7, 2, 'C# programming for Unity scripting'),
  ('COURSE-UUID-HERE', '3D Math', 8, 2, 'Vector math, quaternions, transformations'),
  ('COURSE-UUID-HERE', 'XR Interaction', 9, 3, 'Hand tracking, controllers, spatial UI'),
  ('COURSE-UUID-HERE', 'Performance Optimization', 7, 3, 'VR performance optimization techniques')
ON CONFLICT (course_id, skill_name) DO UPDATE SET
  skill_weight = EXCLUDED.skill_weight,
  target_level = EXCLUDED.target_level,
  description = EXCLUDED.description;
*/

-- ============================================================================
-- STEP 3: Map existing problem categories to skills (optional)
-- ============================================================================
-- This allows old problems (standalone, not in courses) to contribute to skills
-- If problem.category is an array, we handle it properly

CREATE OR REPLACE VIEW problem_skill_mapping AS
SELECT 
  p.id as problem_id,
  p.category as original_category,
  CASE 
    -- Handle text array categories
    WHEN p.category::text ILIKE '%array%' THEN 'Arrays'
    WHEN p.category::text ILIKE '%sort%' THEN 'Sorting'
    WHEN p.category::text ILIKE '%hash%' THEN 'Hashing'
    WHEN p.category::text ILIKE '%tree%' THEN 'Trees'
    WHEN p.category::text ILIKE '%graph%' THEN 'Graphs'
    WHEN p.category::text ILIKE '%dp%' OR p.category::text ILIKE '%dynamic%' THEN 'Dynamic Programming'
    WHEN p.category::text ILIKE '%greedy%' THEN 'Greedy Algorithms'
    WHEN p.category::text ILIKE '%recurs%' THEN 'Recursion'
    ELSE 'DSA' -- Default to general DSA
  END as skill_name
FROM problem p;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- After running this:
-- 1. Skills are cataloged in skill_catalog table
-- 2. Ready to map courses to skills (update UUIDs in commented sections)
-- 3. Problem categories are mapped to skills via view
-- 4. When users complete problems, skills auto-update
-- 5. Learning dashboard aggregates progress across all courses by skill
-- ============================================================================

-- ============================================================================
-- HELPER: To map your actual courses, run these queries:
-- ============================================================================
-- 
-- Step 1: Find your course IDs
--   SELECT id, title, category FROM courses ORDER BY created_at DESC;
--
-- Step 2: Map a course to skills (example for a DSA course):
--   INSERT INTO course_skills (course_id, skill_name, skill_weight, target_level, description)
--   VALUES 
--     ('YOUR-ACTUAL-COURSE-UUID-HERE', 'DSA', 10, 3, 'Core DSA proficiency'),
--     ('YOUR-ACTUAL-COURSE-UUID-HERE', 'Arrays', 8, 2, 'Array problem solving');
--
-- Step 3: Verify the mapping:
--   SELECT c.title, cs.skill_name, cs.skill_weight, cs.target_level 
--   FROM course_skills cs 
--   JOIN courses c ON c.id = cs.course_id;
--
-- ============================================================================
