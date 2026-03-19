/**
 * seedOsCourse.js
 * 
 * Seeds a complete Operating Systems course with hierarchical structure:
 * - Course: Operating Systems Fundamentals
 * - Modules: Foundations, Concurrency, Interviews, Past Interviews
 * - Topics: Comprehensive coverage of OS concepts
 * - Content: Markdown explanations, code examples, problems, videos
 * 
 * Run: node seedOsCourse.js
 */

import { pool } from "../database/connect.db.js";
import CourseManagementService from "../services/courseManagement.service.js";

const courseService = new CourseManagementService();

/**
 * Main seed function
 */
async function seedOsCourse() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        console.log("\n=== Starting OS Course Seed ===\n");

        // Fetch an admin user from database (or first user if no admin)
        const userResult = await client.query(
            `SELECT id FROM public.users WHERE role = 'admin' LIMIT 1`
        );

        let ADMIN_USER_ID;
        if (userResult.rows.length === 0) {
            console.warn("⚠ No admin user found, using first available user");
            const anyUserResult = await client.query(
                `SELECT id FROM public.users LIMIT 1`
            );
            
            if (anyUserResult.rows.length === 0) {
                throw new Error("No users found in database. Please create a user first.");
            }
            
            ADMIN_USER_ID = anyUserResult.rows[0].id;
        } else {
            ADMIN_USER_ID = userResult.rows[0].id;
        }

        console.log(`✓ Using user ID: ${ADMIN_USER_ID} for seeding\n`);

        // Step 1: Check if OS course already exists
        const existingCourse = await client.query(
            `SELECT id FROM public.courses WHERE title = 'Operating Systems Fundamentals'`
        );

        let courseId;

        if (existingCourse.rows.length > 0) {
            courseId = existingCourse.rows[0].id;
            console.log(`✓ OS Course already exists (ID: ${courseId})`);
        } else {
            // Create OS course
            const courseResult = await client.query(
                `
                INSERT INTO public.courses (title, category, description)
                VALUES ($1, $2, $3)
                RETURNING id
                `,
                [
                    "Operating Systems Fundamentals",
                    "Computer Science",
                    "Master Operating Systems from basics to advanced concepts. Covers processes, threads, memory management, file systems, concurrency, and interview preparation.",
                ]
            );
            courseId = courseResult.rows[0].id;
            console.log(`✓ Created OS Course (ID: ${courseId})`);
        }

        // Step 2: Create Modules
        console.log("\n--- Creating Modules ---");

        const foundationsModule = await courseService.createModule(
            courseId,
            {
                title: "Foundations",
                description:
                    "Core OS concepts: processes, memory, file systems, I/O",
                displayOrder: 1,
                isDefault: true,
                isCustom: false,
                rolePermission: "admin",
                createdBy: ADMIN_USER_ID,
            },
            client
        );
        console.log(`✓ Created module: Foundations`);

        const concurrencyModule = await courseService.createModule(
            courseId,
            {
                title: "Concurrency & Synchronization",
                description:
                    "Threads, locks, deadlocks, semaphores, and synchronization patterns",
                displayOrder: 2,
                isDefault: true,
                isCustom: false,
                rolePermission: "admin",
                createdBy: ADMIN_USER_ID,
            },
            client
        );
        console.log(`✓ Created module: Concurrency & Synchronization`);

        const interviewModule = await courseService.createModule(
            courseId,
            {
                title: "Interview Preparation",
                description:
                    "Common OS interview questions and problem-solving strategies",
                displayOrder: 3,
                isDefault: true,
                isCustom: false,
                rolePermission: "admin",
                createdBy: ADMIN_USER_ID,
            },
            client
        );
        console.log(`✓ Created module: Interview Preparation`);

        const pastInterviewModule = await courseService.createModule(
            courseId,
            {
                title: "Past Interviews Archive",
                description:
                    "Real interview questions from top companies (FAANG, Microsoft, etc.)",
                displayOrder: 4,
                isDefault: true,
                isCustom: false,
                rolePermission: "user",
                createdBy: ADMIN_USER_ID,
            },
            client
        );
        console.log(`✓ Created module: Past Interviews Archive`);

        // Step 3: Create Topics and Content
        console.log("\n--- Creating Topics and Content ---");

        // === FOUNDATIONS MODULE ===
        await createFoundationsContent(foundationsModule.id, ADMIN_USER_ID, client);

        // === CONCURRENCY MODULE ===
        await createConcurrencyContent(concurrencyModule.id, ADMIN_USER_ID, client);

        // === INTERVIEW MODULE ===
        await createInterviewContent(interviewModule.id, ADMIN_USER_ID, client);

        // === PAST INTERVIEW MODULE ===
        await createPastInterviewContent(pastInterviewModule.id, ADMIN_USER_ID, client);

        // Step 4: Map course skills
        console.log("\n--- Mapping Course Skills ---");
        await mapCourseSkills(courseId, client);

        await client.query("COMMIT");
        console.log("\n=== OS Course Seed Complete! ===\n");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("\n=== Seed Failed ===");
        console.error(error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Create Foundations module content
 */
async function createFoundationsContent(moduleId, adminUserId, client) {
    // Topic 1: Introduction to OS
    const introTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Introduction to Operating Systems",
            description: "What is an OS? Roles, types, and architecture",
            displayOrder: 1,
            estimatedDurationMinutes: 45,
            difficultyLevel: 1,
            isPrerequisite: true,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        introTopic.id,
        {
            contentType: "markdown",
            title: "What is an Operating System?",
            description: "Fundamental concepts and definitions",
            displayOrder: 1,
            markdownContent: `# What is an Operating System?

An **Operating System (OS)** is system software that manages computer hardware and software resources and provides common services for computer programs.

## Key Roles:
1. **Resource Manager**: Allocates CPU, memory, I/O devices
2. **Abstraction Layer**: Hides hardware complexity
3. **Security & Protection**: Controls access to resources
4. **User Interface**: Provides CLI/GUI for interaction

## Types of OS:
- **Batch OS**: Executes jobs in batches
- **Time-Sharing OS**: Multiple users share CPU time
- **Real-Time OS**: Guarantees response times (embedded systems)
- **Distributed OS**: Coordinates multiple machines
- **Mobile OS**: Optimized for power & touch (Android, iOS)`,
            points: 10,
            isMandatory: true,
            estimatedDurationMinutes: 20,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        introTopic.id,
        {
            contentType: "video",
            title: "OS Architecture Overview",
            description: "Visual explanation of kernel, system calls, and user space",
            displayOrder: 2,
            videoUrl: "https://www.youtube.com/watch?v=vBURTt97EkA",
            metadata: { platform: "youtube", duration_seconds: 900 },
            points: 5,
            isMandatory: false,
            estimatedDurationMinutes: 15,
            createdBy: adminUserId,
        },
        client
    );

    // Topic 2: Processes
    const processesTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Processes & Process Management",
            description: "Process lifecycle, PCB, context switching",
            displayOrder: 2,
            estimatedDurationMinutes: 60,
            difficultyLevel: 2,
            prerequisiteTopics: [introTopic.id],
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        processesTopic.id,
        {
            contentType: "markdown",
            title: "Understanding Processes",
            description: "Deep dive into process concepts",
            displayOrder: 1,
            markdownContent: `# Processes

## What is a Process?
A **process** is a program in execution. It represents the unit of work in an OS.

### Process Components:
1. **Text Section**: Program code
2. **Data Section**: Global variables
3. **Heap**: Dynamically allocated memory
4. **Stack**: Function calls, local variables
5. **PCB (Process Control Block)**: Metadata (PID, state, registers, priority)

### Process States:
\`\`\`
NEW → READY → RUNNING → WAITING → TERMINATED
\`\`\`

- **NEW**: Being created
- **READY**: Waiting for CPU
- **RUNNING**: Executing on CPU
- **WAITING**: Blocked on I/O or event
- **TERMINATED**: Finished execution

### Context Switching:
When CPU switches from one process to another:
1. Save current process state (registers, PC) to PCB
2. Load new process state from PCB
3. Resume execution

**Cost**: Context switches are expensive (1-10 microseconds)`,
            points: 15,
            isMandatory: true,
            estimatedDurationMinutes: 25,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        processesTopic.id,
        {
            contentType: "code",
            title: "Process Creation in C (fork)",
            description: "Example of creating child processes using fork()",
            displayOrder: 2,
            codeSnippet: `#include <stdio.h>
#include <unistd.h>
#include <sys/types.h>

int main() {
    pid_t pid;
    
    printf("Parent process (PID: %d)\\n", getpid());
    
    pid = fork();  // Create child process
    
    if (pid < 0) {
        // Fork failed
        fprintf(stderr, "Fork failed\\n");
        return 1;
    }
    else if (pid == 0) {
        // Child process
        printf("Child process (PID: %d, Parent PID: %d)\\n", 
               getpid(), getppid());
    }
    else {
        // Parent process
        printf("Parent created child with PID: %d\\n", pid);
    }
    
    return 0;
}`,
            metadata: { language: "c", topic: "process_creation" },
            points: 10,
            isMandatory: false,
            estimatedDurationMinutes: 10,
            createdBy: adminUserId,
        },
        client
    );

    // Topic 3: Memory Management
    const memoryTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Memory Management",
            description: "Paging, segmentation, virtual memory, page replacement",
            displayOrder: 3,
            estimatedDurationMinutes: 90,
            difficultyLevel: 3,
            prerequisiteTopics: [processesTopic.id],
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        memoryTopic.id,
        {
            contentType: "markdown",
            title: "Memory Management Basics",
            description: "Physical vs virtual memory, address translation",
            displayOrder: 1,
            markdownContent: `# Memory Management

## Objectives:
1. Keep multiple processes in memory
2. Provide isolation and protection
3. Maximize memory utilization
4. Provide illusion of large address space

## Key Concepts:

### 1. Logical vs Physical Address
- **Logical Address**: Generated by CPU (program's view)
- **Physical Address**: Actual location in RAM
- **MMU (Memory Management Unit)**: Translates logical → physical

### 2. Paging
- Divide memory into fixed-size **pages** (usually 4KB)
- Page Table maps virtual pages to physical frames
- Supports **virtual memory** (disk as extended RAM)

### 3. Page Replacement Algorithms:
When memory is full, which page to evict?

| Algorithm | Strategy | Advantage | Disadvantage |
|-----------|----------|-----------|--------------|
| FIFO | First-In-First-Out | Simple | Belady's Anomaly |
| LRU | Least Recently Used | Good performance | Expensive to implement |
| LFU | Least Frequently Used | Considers frequency | Doesn't adapt well |
| Clock | Approximates LRU | Efficient | Less accurate |

### 4. Thrashing
When system spends more time swapping pages than executing:
- **Cause**: Too many processes, insufficient RAM
- **Solution**: Reduce multiprogramming level, add RAM`,
            points: 20,
            isMandatory: true,
            estimatedDurationMinutes: 40,
            createdBy: adminUserId,
        },
        client
    );

    console.log("  ✓ Foundations topics created");
}

/**
 * Create Concurrency module content
 */
async function createConcurrencyContent(moduleId, adminUserId, client) {
    // Topic 1: Threads
    const threadsTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Threads & Multithreading",
            description: "Thread creation, user vs kernel threads, thread models",
            displayOrder: 1,
            estimatedDurationMinutes: 60,
            difficultyLevel: 3,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        threadsTopic.id,
        {
            contentType: "markdown",
            title: "Understanding Threads",
            description: "Threads vs processes, multithreading benefits",
            displayOrder: 1,
            markdownContent: `# Threads

## What is a Thread?
A **thread** is a lightweight process. Multiple threads share the same:
- Code section
- Data section
- OS resources (files, signals)

But each thread has its own:
- Program counter
- Registers
- Stack

## Threads vs Processes:

| Feature | Process | Thread |
|---------|---------|--------|
| Creation cost | High | Low |
| Context switch | Expensive | Cheap |
| Memory | Separate | Shared |
| Communication | IPC (slow) | Direct (fast) |

## Benefits of Multithreading:
1. **Responsiveness**: UI remains responsive during long operations
2. **Resource Sharing**: Easier communication between threads
3. **Economy**: Cheaper than process creation
4. **Scalability**: Utilize multi-core CPUs

## Thread Models:
- **Many-to-One**: Many user threads → 1 kernel thread (poor concurrency)
- **One-to-One**: Each user thread → 1 kernel thread (Linux, Windows)
- **Many-to-Many**: M user threads → N kernel threads (most flexible)`,
            points: 15,
            isMandatory: true,
            estimatedDurationMinutes: 25,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        threadsTopic.id,
        {
            contentType: "code",
            title: "POSIX Threads Example",
            description: "Creating threads in C using pthread library",
            displayOrder: 2,
            codeSnippet: `#include <stdio.h>
#include <pthread.h>

void* thread_function(void* arg) {
    int thread_id = *(int*)arg;
    printf("Thread %d: Running\\n", thread_id);
    return NULL;
}

int main() {
    pthread_t threads[5];
    int thread_ids[5];
    
    // Create 5 threads
    for (int i = 0; i < 5; i++) {
        thread_ids[i] = i;
        if (pthread_create(&threads[i], NULL, thread_function, &thread_ids[i]) != 0) {
            fprintf(stderr, "Error creating thread %d\\n", i);
            return 1;
        }
    }
    
    // Wait for all threads to finish
    for (int i = 0; i < 5; i++) {
        pthread_join(threads[i], NULL);
    }
    
    printf("All threads completed\\n");
    return 0;
}`,
            metadata: { language: "c", topic: "threads" },
            points: 10,
            isMandatory: false,
            estimatedDurationMinutes: 15,
            createdBy: adminUserId,
        },
        client
    );

    // Topic 2: Synchronization
    const syncTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Synchronization Primitives",
            description: "Mutex, semaphores, monitors, condition variables",
            displayOrder: 2,
            estimatedDurationMinutes: 75,
            difficultyLevel: 4,
            prerequisiteTopics: [threadsTopic.id],
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        syncTopic.id,
        {
            contentType: "markdown",
            title: "Synchronization Mechanisms",
            description: "Mutex, semaphores, and monitors explained",
            displayOrder: 1,
            markdownContent: `# Synchronization

## The Problem: Race Conditions
When multiple threads access shared data concurrently without synchronization, inconsistent results occur.

### Critical Section:
Code segment that accesses shared resources. Requirements:
1. **Mutual Exclusion**: Only one thread at a time
2. **Progress**: If no thread in CS, one waiting thread should enter
3. **Bounded Waiting**: Limit on how long a thread waits

## Synchronization Primitives:

### 1. Mutex (Mutual Exclusion Lock)
\`\`\`c
pthread_mutex_t lock;
pthread_mutex_lock(&lock);
// Critical section
pthread_mutex_unlock(&lock);
\`\`\`

### 2. Semaphore
Counter that controls access to shared resource:
- **Binary Semaphore**: 0 or 1 (like mutex)
- **Counting Semaphore**: Allows N threads

\`\`\`c
sem_wait(&sem);   // Decrement, block if 0
// Critical section
sem_post(&sem);   // Increment
\`\`\`

### 3. Condition Variables
Wait for specific conditions:
\`\`\`c
pthread_cond_wait(&cond, &mutex);  // Wait
pthread_cond_signal(&cond);        // Wake one thread
pthread_cond_broadcast(&cond);     // Wake all threads
\`\`\`

## Classic Problems:
1. **Producer-Consumer**: Bounded buffer
2. **Readers-Writers**: Multiple readers OR one writer
3. **Dining Philosophers**: Deadlock prevention`,
            points: 25,
            isMandatory: true,
            estimatedDurationMinutes: 35,
            createdBy: adminUserId,
        },
        client
    );

    // Topic 3: Deadlocks
    const deadlockTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Deadlocks",
            description: "Detection, prevention, avoidance, and recovery",
            displayOrder: 3,
            estimatedDurationMinutes: 60,
            difficultyLevel: 4,
            prerequisiteTopics: [syncTopic.id],
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        deadlockTopic.id,
        {
            contentType: "markdown",
            title: "Deadlock Concepts",
            description: "Understanding and handling deadlocks",
            displayOrder: 1,
            markdownContent: `# Deadlocks

## What is a Deadlock?
Situation where processes wait for each other indefinitely, unable to proceed.

### Necessary Conditions (all must hold):
1. **Mutual Exclusion**: Resources are non-shareable
2. **Hold and Wait**: Process holds resources while waiting for others
3. **No Preemption**: Resources cannot be forcibly taken
4. **Circular Wait**: P1 waits for P2, P2 waits for P3, ..., Pn waits for P1

## Handling Strategies:

### 1. Prevention
Break one of the necessary conditions:
- Mutual Exclusion: Make resources shareable (not always possible)
- Hold and Wait: Request all resources at once
- No Preemption: Allow resource preemption
- Circular Wait: Impose resource ordering

### 2. Avoidance (Banker's Algorithm)
Before granting resource, check if system remains in **safe state**.

\`\`\`
Safe State: Sequence exists where all processes can complete
Unsafe State: May lead to deadlock (not guaranteed)
\`\`\`

### 3. Detection & Recovery
- Periodically check for deadlocks using wait-for graph
- Recovery: Kill processes or preempt resources

### 4. Ignore (Ostrich Algorithm)
Most OSes do this! Deadlocks are rare, and prevention/detection is expensive.`,
            points: 20,
            isMandatory: true,
            estimatedDurationMinutes: 30,
            createdBy: adminUserId,
        },
        client
    );

    console.log("  ✓ Concurrency topics created");
}

/**
 * Create Interview Preparation module content
 */
async function createInterviewContent(moduleId, adminUserId, client) {
    const interviewTopic = await courseService.createTopic(
        moduleId,
        {
            title: "Common OS Interview Questions",
            description: "Frequently asked OS concepts in technical interviews",
            displayOrder: 1,
            estimatedDurationMinutes: 120,
            difficultyLevel: 3,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        interviewTopic.id,
        {
            contentType: "markdown",
            title: "Top 50 OS Interview Questions",
            description: "Curated list with concise answers",
            displayOrder: 1,
            markdownContent: `# OS Interview Questions

## Processes & Threads
1. **What is the difference between process and thread?**
   - Process: Independent execution unit with separate memory
   - Thread: Lightweight, shares memory with other threads

2. **What is context switching?**
   - Saving current process state and loading another process state
   - Involves saving registers, PC to PCB

3. **What is a zombie process?**
   - Process that has finished but parent hasn't reaped exit status
   - Fix: Parent calls wait() or waitpid()

## Memory Management
4. **Explain paging vs segmentation.**
   - Paging: Fixed-size blocks (no external fragmentation)
   - Segmentation: Variable-size logical units (external fragmentation)

5. **What is virtual memory?**
   - Technique to use disk as extended RAM
   - Allows running programs larger than physical memory

6. **Explain TLB (Translation Lookaside Buffer).**
   - Hardware cache for page table entries
   - Speeds up address translation (avoids memory access)

## Synchronization
7. **What is a mutex vs semaphore?**
   - Mutex: Binary lock (owner unlocks)
   - Semaphore: Counter (any thread can signal)

8. **What are the four conditions for deadlock?**
   - Mutual exclusion, hold and wait, no preemption, circular wait

9. **Explain the Producer-Consumer problem.**
   - Bounded buffer shared between producers and consumers
   - Use semaphores: empty, full, mutex

## Scheduling
10. **What is CPU scheduling? Name algorithms.**
    - Allocating CPU to processes
    - FCFS, SJF, Round Robin, Priority, Multilevel Queue

## File Systems
11. **What is an inode?**
    - Data structure storing file metadata (permissions, size, pointers)
    - Does NOT store filename (stored in directory)

12. **Explain hard link vs soft link.**
    - Hard link: Multiple directory entries pointing to same inode
    - Soft link (symlink): File containing path to another file`,
            points: 30,
            isMandatory: true,
            estimatedDurationMinutes: 60,
            createdBy: adminUserId,
        },
        client
    );

    console.log("  ✓ Interview topics created");
}

/**
 * Create Past Interviews module content
 */
async function createPastInterviewContent(moduleId, adminUserId, client) {
    const faangTopic = await courseService.createTopic(
        moduleId,
        {
            title: "FAANG Interview Questions",
            description: "Real questions from Google, Meta, Amazon, etc.",
            displayOrder: 1,
            estimatedDurationMinutes: 90,
            difficultyLevel: 5,
            createdBy: adminUserId,
        },
        client
    );

    await courseService.addContent(
        faangTopic.id,
        {
            contentType: "markdown",
            title: "Google OS Interview (2023)",
            description: "System design and concurrency questions",
            displayOrder: 1,
            markdownContent: `# Google OS Interview Questions (2023)

## Question 1: Thread-Safe Queue
**Asked by**: Google SWE Interview

**Problem**: Implement a thread-safe queue that supports:
- \`enqueue(item)\`: Add item to queue
- \`dequeue()\`: Remove and return item (block if empty)
- \`size()\`: Return current size

**Follow-ups**:
- How would you handle timeouts on dequeue?
- What if multiple threads call dequeue simultaneously?
- How to optimize for high contention?

## Question 2: Memory Allocator
**Asked by**: Google Systems Interview

**Problem**: Design a memory allocator with:
- \`malloc(size)\`: Allocate memory
- \`free(ptr)\`: Free memory
- Minimize fragmentation
- O(1) allocation/deallocation

**Key Concepts**:
- Free list management
- Buddy allocation system
- Memory pooling
- Coalescing adjacent free blocks

## Question 3: Scheduler Design
**Asked by**: Google Infrastructure

**Problem**: Design a CPU scheduler for:
- Interactive tasks (low latency)
- Batch jobs (high throughput)
- Real-time tasks (guaranteed deadlines)

**Considerations**:
- Priority levels
- Starvation prevention
- Context switch overhead`,
            points: 50,
            isMandatory: false,
            estimatedDurationMinutes: 45,
            createdBy: adminUserId,
        },
        client
    );

    console.log("  ✓ Past interview topics created");
}

/**
 * Map skills to course
 */
async function mapCourseSkills(courseId, client) {
    const skills = [
        { name: "Operating Systems", weight: 10, level: 4 },
        { name: "Concurrency", weight: 9, level: 4 },
        { name: "Memory Management", weight: 8, level: 3 },
        { name: "Process Management", weight: 8, level: 3 },
        { name: "System Design", weight: 7, level: 3 },
    ];

    for (const skill of skills) {
        await client.query(
            `
            INSERT INTO public.course_skills (course_id, skill_name, skill_weight, target_level, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            `,
            [
                courseId,
                skill.name,
                skill.weight,
                skill.level,
                `Master ${skill.name} concepts`,
            ]
        );
    }

    console.log("  ✓ Mapped course skills");
}

// Run seed
seedOsCourse()
    .then(() => {
        console.log("Seed successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    });
