# 🎓 NeoCode Learning OS - User Guide

## 📋 Table of Contents

1. [What is Learning OS?](#what-is-learning-os)
2. [How to Access](#how-to-access)
3. [Key Features](#key-features)
4. [How to Use](#how-to-use)
5. [Understanding Your Profile](#understanding-your-profile)
6. [Tips for Maximum Benefit](#tips-for-maximum-benefit)

---

## 🌟 What is Learning OS?

The **Learning OS** is an intelligent AI-powered learning companion built into NeoCode that transforms your coding practice into a personalized learning journey. It's designed to:

- 📊 Track your learning progress automatically
- 🎯 Identify your weak areas and strengths
- 🔍 Analyze your mistakes and patterns
- 📚 Provide personalized recommendations
- 🗓️ Generate custom training plans
- 🧠 Remember everything you've practiced (deterministic memory)

Unlike generic practice platforms, Learning OS adapts to YOUR unique learning style and helps you improve systematically.

---

## 🚀 How to Access

### Navigation Options:

**1. Main Navigation Menu:**

- Click on **"Learning"** in the top navigation bar (visible when logged in)

**2. User Dropdown Menu:**

- Click your username in the top-right corner
- Select **"Learning Profile"** from the dropdown

**3. Direct URL:**

- Navigate to: `http://localhost:5173/learning/profile`

---

## ✨ Key Features

### 1. **Learning Profile Dashboard**

- **Current Streak**: Days of consecutive practice
- **Total Sessions**: Number of practice sessions completed
- **Last Active**: Your most recent practice date

### 2. **Focus Areas (Weak Topics)**

- Topics where you're struggling
- Failure rates and attempt counts
- Last failed date for each topic
- Helps you know exactly what to practice next

### 3. **Your Strengths**

- Topics you've mastered
- Success rates and attempt counts
- Boost your confidence by seeing what you're good at

### 4. **Personalized Recommendations**

- AI-suggested problems based on your weak topics
- Difficulty levels matched to your skill level
- Click "Solve" to start practicing immediately

### 5. **Training Plan Generator**

- Creates 7-day structured learning plans
- Based on your weak topics and patterns
- Daily targets to keep you on track
- Adaptive to your learning style

### 6. **Common Mistakes Analysis**

- Tracks recurring mistake patterns
- Shows frequency of each mistake type
- Helps you avoid repeating the same errors

### 7. **Learning Style Insights**

- Identifies your approach (trial-and-error, methodical, etc.)
- Average hints used per problem
- Average time spent per problem
- Helps you understand how you learn best

---

## 📖 How to Use

### **Step 1: Start Solving Problems**

The Learning OS works automatically as you solve problems:

1. Go to **"Problems"** section
2. Select any problem
3. Write your code and submit
4. The system automatically:
    - Records your attempt
    - Analyzes your solution
    - Tracks mistakes and patterns
    - Updates your learning profile

**Important**: The dual system is active, so both old and new systems are being updated. You don't need to do anything special!

### **Step 2: Check Your Learning Profile**

After solving 3-5 problems:

1. Navigate to **"Learning"** in the main menu
2. Review your dashboard stats
3. Check your **Focus Areas** to see weak topics
4. Review your **Strengths** to see what you've mastered

### **Step 3: Follow Recommendations**

1. Scroll to **"Recommended for You"** section
2. Click **"Solve"** on any recommended problem
3. The system suggests problems that target your weak areas
4. As you solve them, your profile updates automatically

### **Step 4: Generate a Training Plan**

1. Click **"Generate 7-Day Training Plan"** button
2. The system creates a personalized plan with:
    - Daily problem targets (e.g., 3 problems/day)
    - Focus on your weak topics
    - Progressive difficulty
3. Follow the plan to improve systematically

### **Step 5: Track Your Progress**

1. Check your **Current Streak** to maintain consistency
2. Monitor your **Total Sessions** to see overall engagement
3. Review **Common Mistakes** to avoid repeating errors
4. Celebrate as weak topics move to your strengths!

---

## 📊 Understanding Your Profile

### **Dashboard Stats Explained:**

#### **Current Streak** (Blue Card)

- Shows consecutive days you've practiced
- Resets if you miss a day
- **Goal**: Build a streak of 7+ days for habit formation

#### **Total Sessions** (Green Card)

- Counts every practice session
- Increases each time you solve problems
- **Goal**: Aim for 100+ sessions for comprehensive learning

#### **Last Active** (Purple Card)

- Shows when you last practiced
- Helps you track consistency
- **Goal**: Practice daily or every other day

### **Topic Analysis:**

#### **Weak Topics** (Red Cards)

- Topics with failure rate > 50%
- Need focused practice
- **Action**: Prioritize these in your practice

#### **Strong Topics** (Green Cards)

- Topics with success rate > 70%
- You've mastered these
- **Action**: Review occasionally to maintain skills

### **Recommendations Logic:**

The system recommends problems by:

1. Identifying your weak topics
2. Finding problems that cover those topics
3. Matching difficulty to your current level
4. Prioritizing recent struggles

### **Training Plans:**

Generated plans include:

- **Duration**: 7 days by default
- **Daily Target**: 3 problems/day (adjustable)
- **Focus**: 60% weak topics, 40% reinforcement
- **Difficulty**: Progressive increase

---

## 💡 Tips for Maximum Benefit

### **1. Practice Consistently**

- ✅ Aim for at least 3 problems per day
- ✅ Practice at the same time daily to build habits
- ✅ Maintain your streak for motivation

### **2. Focus on Weak Topics**

- ✅ Don't avoid difficult topics
- ✅ Each attempt teaches the system about your progress
- ✅ Failed attempts are valuable learning data

### **3. Use Recommendations**

- ✅ Trust the system's suggestions
- ✅ Problems are specifically chosen for your growth
- ✅ They target your knowledge gaps efficiently

### **4. Generate Training Plans**

- ✅ Use when you feel stuck or directionless
- ✅ Follow through for at least 5 days
- ✅ Generate new plans every 1-2 weeks

### **5. Review Your Mistakes**

- ✅ Check "Common Mistakes" section weekly
- ✅ Identify patterns (e.g., "off-by-one errors")
- ✅ Consciously avoid those mistakes in future

### **6. Track Learning Style**

- ✅ Understand if you're impulsive or methodical
- ✅ Adjust your approach based on insights
- ✅ If you use many hints, try solving without first

### **7. Be Patient**

- ✅ Meaningful insights need 10+ problem attempts
- ✅ Topics move from weak to strong gradually
- ✅ Focus on improvement trends, not single attempts

---

## 🔄 How the System Works (Behind the Scenes)

### **Automatic Data Collection:**

When you submit a solution:

1. **Code Evaluation**: Runs your code against test cases
2. **Mistake Analysis**: Identifies error types (syntax, logic, runtime)
3. **Profile Update**: Updates your success/failure rates per topic
4. **Pattern Recognition**: Tracks recurring mistakes
5. **Recommendation Engine**: Recalculates suggested problems

### **Dual System (Current Setup):**

- **Old System**: Traditional submission tracking (still works)
- **New Learning OS**: Advanced learning analytics (runs in parallel)
- **Benefit**: You get both systems without any disruption!

### **Privacy & Data:**

- All learning data is stored securely in your database
- Only you can access your learning profile
- Data is used purely to improve YOUR experience
- No data is shared with others

---

## ❓ FAQ

### **Q: Do I need to do anything special to use Learning OS?**

**A:** No! Just solve problems normally. The system tracks everything automatically.

### **Q: How many problems do I need to solve to see insights?**

**A:** Minimum 5-10 problems to get initial insights. 20+ for comprehensive analysis.

### **Q: What if I don't have any recommendations?**

**A:** Solve more problems! The system needs data to understand your strengths/weaknesses.

### **Q: Can I delete my learning history?**

**A:** Currently no, but this feature can be added. Your data helps the system learn about you.

### **Q: How often should I check my Learning Profile?**

**A:** Weekly reviews are ideal. Daily checks might show too little change.

### **Q: What's the difference between "My Profile" and "Learning Profile"?**

**A:**

- **My Profile**: Points, verdicts, overall stats
- **Learning Profile**: AI-driven insights, personalized recommendations, learning analytics

### **Q: Why is my streak at 0?**

**A:** You haven't practiced yet, or you missed a day. Start solving to build your streak!

### **Q: Can I customize my training plan?**

**A:** Currently plans are auto-generated. Custom plans will be available in future updates.

---

## 🎯 Quick Start Checklist

- [ ] Navigate to "Learning" in the main menu
- [ ] Review your current dashboard (even if empty)
- [ ] Go solve 5 problems from the "Problems" section
- [ ] Return to Learning Profile to see initial data
- [ ] Click on a recommended problem (if available)
- [ ] Generate your first 7-day training plan
- [ ] Practice for 3 consecutive days to build a streak
- [ ] Review your common mistakes after 10+ problems
- [ ] Track your improvement week over week

---

## 🚀 Next Steps

1. **Access Your Learning Profile**: Click "Learning" in the navigation
2. **Solve Problems**: Go to "Problems" and start solving
3. **Check Progress**: Return to Learning Profile after 5 problems
4. **Follow Recommendations**: Solve suggested problems
5. **Generate Training Plan**: Create your first structured plan
6. **Build Consistency**: Practice daily for best results

---

## 🛠️ Technical Details (For Developers)

### **Architecture:**

- **Plugin-based evaluation system**: Extensible for multiple question types
- **Service layer**: Modular services (LearningProfile, MistakeEngine, TrainingPlanner)
- **PostgreSQL database**: 7 new tables for learning data
- **RESTful API**: 16+ endpoints for learning operations
- **Dual system**: Non-breaking integration with existing code

### **Key Endpoints:**

- `GET /api/learning/profile` - Fetch learning profile
- `GET /api/learning/recommendations` - Get personalized recommendations
- `POST /api/learning/training-plan` - Generate training plan
- `GET /api/learning/mistakes/user` - Get user mistakes log
- `GET /api/learning/health` - System health check

### **Database Tables:**

- `learning_profiles` - User learning profiles
- `evaluation_results` - Detailed evaluation results
- `normalized_questions` - Normalized question data
- `training_plans` - Generated training plans
- `mistake_catalog` - Catalog of mistake types
- `user_mistakes_log` - User-specific mistake logs
- `plugin_registry` - Registered evaluation plugins

---

## 📞 Support

If you encounter issues:

1. Check browser console for errors (F12)
2. Verify you're logged in with a valid token
3. Ensure backend server is running (`npm run dev` in bz-server)
4. Check database connection
5. Review server logs for debugging

---

**Happy Learning! 🎓**

Remember: Every problem you solve makes the system smarter about helping YOU improve!
