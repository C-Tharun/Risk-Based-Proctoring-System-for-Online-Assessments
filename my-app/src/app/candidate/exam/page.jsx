"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { riskAssessmentService } from "@/services/RiskAssessmentService";
import { interventionService } from "@/services/InterventionService";
import { aiDetectionService } from "@/services/AIDetectionService";

export default function ExamPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [examStarted, setExamStarted] = useState(false);
  const [examSessionId, setExamSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(7200); // 2 hours in seconds
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningCount, setWarningCount] = useState(0);
  const [riskLevel, setRiskLevel] = useState("LOW"); // Add risk level state
  const router = useRouter();

  // Behavior tracking state
  const [mouseMovements, setMouseMovements] = useState([]);
  const [keystrokes, setKeystrokes] = useState([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [mouseLeaveCount, setMouseLeaveCount] = useState(0);
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const examContainerRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastWarningTimeRef = useRef(Date.now());
  const MIN_WARNING_INTERVAL = 3000; // Minimum 3 seconds between warnings

  // Sample questions (replace with actual questions from database)
  const questions = [
    {
      id: 1,
      question: "What is the time complexity of binary search?",
      type: "mcq",
      options: ["O(n)", "O(log n)", "O(n log n)", "O(n²)"],
      correctAnswer: "O(log n)"
    },
    {
      id: 2,
      question: "Which data structure follows the Last In First Out (LIFO) principle?",
      type: "mcq",
      options: ["Queue", "Stack", "Linked List", "Binary Tree"],
      correctAnswer: "Stack"
    },
    {
      id: 3,
      question: `Two Sum Problem

Given an array of integers nums and an integer target, return indices of the two numbers in nums such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]
Explanation: Because nums[1] + nums[2] == 6, we return [1, 2].

Constraints:
• 2 <= nums.length <= 104
• -109 <= nums[i] <= 109
• -109 <= target <= 109
• Only one valid answer exists

Follow-up: Can you come up with an algorithm that is less than O(n²) time complexity?`,
      type: "coding",
      startingCode: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Write your solution here
    
}`,
      testCases: [
        { input: [[2,7,11,15], 9], expectedOutput: [0,1], explanation: "nums[0] + nums[1] = 2 + 7 = 9" },
        { input: [[3,2,4], 6], expectedOutput: [1,2], explanation: "nums[1] + nums[2] = 2 + 4 = 6" },
        { input: [[3,3], 6], expectedOutput: [0,1], explanation: "nums[0] + nums[1] = 3 + 3 = 6" }
      ]
    },
    {
      id: 4,
      question: `Valid Parentheses

Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Example 1:
Input: s = "()"
Output: true
Explanation: Single pair of valid parentheses.

Example 2:
Input: s = "()[]{}"
Output: true
Explanation: Each opening bracket is closed by the same type.

Example 3:
Input: s = "(]"
Output: false
Explanation: The close bracket ']' cannot match with open bracket '('.

Constraints:
• 1 <= s.length <= 104
• s consists of parentheses only '()[]{}'

Note: Empty string is considered valid.`,
      type: "coding",
      startingCode: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Write your solution here
    
}`,
      testCases: [
        { input: ["()"], expectedOutput: true, explanation: "Simple valid pair of parentheses" },
        { input: ["()[]{}"], expectedOutput: true, explanation: "Multiple valid pairs" },
        { input: ["(]"], expectedOutput: false, explanation: "Mismatched brackets" },
        { input: ["([)]"], expectedOutput: false, explanation: "Incorrectly ordered closing brackets" },
        { input: ["{[]}"], expectedOutput: true, explanation: "Nested brackets closed in correct order" }
      ]
    }
  ];

  // Add state for code editors
  const [codeAnswers, setCodeAnswers] = useState({});

  // Function to handle code change
  const handleCodeChange = (questionId, newCode) => {
    setCodeAnswers(prev => ({
      ...prev,
      [questionId]: newCode
    }));
  };

  const [aiDetectionResults, setAiDetectionResults] = useState({});
  const [showAIWarning, setShowAIWarning] = useState(false);
  const [aiWarningMessage, setAiWarningMessage] = useState("");

  const [showTypingTest, setShowTypingTest] = useState(true);
  const [typingTestCompleted, setTypingTestCompleted] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(0);
  const [userDetails, setUserDetails] = useState({
    fullName: '',
    education: '',
    typingTestText: ''
  });
  const typingStartTime = useRef(null);
  const typingEndTime = useRef(null);

  const sampleText = `Please type this paragraph exactly as shown. This typing test will help us understand your typing speed and accuracy. We use this information to ensure the integrity of the examination process. Type naturally as you would during the exam.`;

  const calculateTypingSpeed = () => {
    const timeInMinutes = (typingEndTime.current - typingStartTime.current) / 60000; // Convert to minutes
    const wordsTyped = userDetails.typingTestText.trim().split(/\s+/).length;
    const wpm = Math.round(wordsTyped / timeInMinutes);
    return wpm;
  };

  const handleTypingStart = () => {
    if (!typingStartTime.current) {
      typingStartTime.current = Date.now();
    }
  };

  const handleTypingTestSubmit = async () => {
    try {
      typingEndTime.current = Date.now();
      const wpm = calculateTypingSpeed();
      setTypingSpeed(wpm);

      // Make sure we have an exam session ID
      if (!examSessionId) {
        throw new Error('No exam session ID found');
      }

      // First check if the exam session exists
      const { data: existingSession, error: checkError } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('id', examSessionId)
        .single();

      if (checkError || !existingSession) {
        throw new Error('Could not find exam session');
      }

      // Then update the session with typing speed and user details
      const { error: updateError } = await supabase
        .from('exam_sessions')
        .update({ 
          typing_speed_wpm: wpm,
          user_details: {
            fullName: userDetails.fullName,
            education: userDetails.education,
            typingTestCompleted: true,
            typingSpeed: wpm,
            typingTestText: userDetails.typingTestText,
            testStartTime: typingStartTime.current,
            testEndTime: typingEndTime.current
          }
        })
        .eq('id', examSessionId);

      if (updateError) {
        throw new Error(`Failed to update exam session: ${updateError.message}`);
      }

      // Log the typing test completion
      const { error: logError } = await supabase
        .from('behavior_logs')
        .insert({
          exam_session_id: examSessionId,
          behavior_type: 'typing_test_completed',
          behavior_data: {
            wpm,
            textLength: userDetails.typingTestText.length,
            duration: (typingEndTime.current - typingStartTime.current) / 1000,
            timestamp: new Date().toISOString()
          },
          risk_contribution: 0,
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error('Error logging typing test completion:', logError.message);
      }

      setTypingTestCompleted(true);
      setShowTypingTest(false);
    } catch (error) {
      console.error('Error in typing test submission:', error.message);
      alert(`Failed to save typing test results: ${error.message}. Please try again or contact support if the issue persists.`);
    }
  };

  // Add state for typing test session
  const [typingTestStarted, setTypingTestStarted] = useState(false);

  // Function to start typing test and create exam session
  const startTypingTest = async () => {
    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Get count of user's previous exams to create unique exam ID
      const { data: previousExams, error: countError } = await supabase
        .from("exam_sessions")
        .select("id")
        .eq("user_id", user.id);

      if (countError) {
        throw new Error("Failed to create exam session");
      }

      const examNumber = (previousExams?.length || 0) + 1;
      const examId = `EXAM${examNumber}_${user.id}`;

      const examData = {
        user_id: user.id,
        exam_id: examId,
        risk_score: 0,
        warnings: 0,
        duration: 7200,
        completed: false,
        terminated: false,
        monitoring_level: 'STANDARD',
        created_at: new Date().toISOString()
      };

      // Create a new exam session
      const { data: session, error: sessionError } = await supabase
        .from("exam_sessions")
        .insert(examData)
        .select()
        .single();

      if (sessionError) {
        throw new Error(sessionError.message || "Failed to create exam session");
      }

      setExamSessionId(session.id);
      setTypingTestStarted(true);
      typingStartTime.current = Date.now(); // Start timing when session is created
    } catch (error) {
      console.error("Error starting typing test:", error);
      alert(`Failed to start typing test: ${error.message}. Please try again or contact support if the issue persists.`);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!data?.session?.user) {
        router.push("/auth/login");
        return;
      }
      setUser(data.session.user);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Timer effect
  useEffect(() => {
    if (!examStarted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          endExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted]);

  // Function to request full screen
  const requestFullScreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen request failed:', error);
      // Show warning to user about fullscreen requirement
      setWarningMessage("⚠️ Warning: Please keep the exam window in focus. Fullscreen mode is required.");
      setShowWarning(true);
    }
  };

  // Function to check if in full screen
  const isInFullScreen = () => {
    return !!(
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  };

  // Function to exit full screen
  const exitFullScreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (error) {
      console.log('Exiting fullscreen failed:', error);
    }
  };

  // Function to update risk level based on warning count
  const updateRiskLevel = async (warningCount) => {
    try {
      let newRiskLevel = "LOW";
      
      // Update risk level based on warning count
      if (warningCount >= 6) {
        newRiskLevel = "HIGH";
      } else if (warningCount >= 3) {
        newRiskLevel = "MEDIUM";
      }

      if (newRiskLevel !== riskLevel) {
        setRiskLevel(newRiskLevel);
        
        // Apply restrictions based on risk level
        if (newRiskLevel === "MEDIUM") {
          try {
            await requestFullScreen();
          } catch (error) {
            console.log('Failed to enter fullscreen:', error);
            setWarningMessage("⚠️ Warning: Please click 'Return to Fullscreen' button to continue the exam.");
            setShowWarning(true);
          }
          setWarningMessage("⚠️ Warning: Risk level increased to MEDIUM. Full restrictions applied.");
          setShowWarning(true);
        } else if (newRiskLevel === "LOW") {
          try {
            if (isInFullScreen()) {
              await exitFullScreen();
            }
          } catch (error) {
            console.log('Failed to exit fullscreen:', error);
          }
          setWarningMessage("Risk level returned to LOW. Restrictions removed.");
          setShowWarning(true);
        } else if (newRiskLevel === "HIGH") {
          // Terminate exam for HIGH risk level
          setWarningMessage("⚠️ Critical: Risk level HIGH. Exam will be terminated.");
          setShowWarning(true);
          
          // Verify exam session exists before updating
          const { data: sessionCheck, error: checkError } = await supabase
            .from("exam_sessions")
            .select("id")
            .eq("id", examSessionId)
            .single();

          if (checkError) {
            console.error('Error checking exam session:', checkError.message);
            return;
          }

          if (!sessionCheck) {
            console.error('Exam session not found');
            return;
          }

          // Update exam session as terminated
          const { error: updateError } = await supabase
            .from("exam_sessions")
            .update({ 
              terminated: true,
              completed: true,
              risk_score: 100, // Maximum risk score for terminated exam
              updated_at: new Date().toISOString()
            })
            .eq("id", examSessionId)
            .select();

          if (updateError) {
            console.error('Error updating exam session for termination:', updateError.message);
            return;
          }

          // Record termination details in violations table instead
          const { error: violationError } = await supabase
            .from('exam_violations')
            .insert([{
              exam_session_id: examSessionId,
              user_id: user.id,
              reason: "Exam terminated due to high risk level - 6 or more warnings",
              risk_score: 100,
              details: { 
                warningCount, 
                riskLevel: newRiskLevel,
                terminationTime: new Date().toISOString()
              },
              created_at: new Date().toISOString()
            }]);

          if (violationError) {
            console.error('Error recording termination violation:', violationError.message);
          }

          // Redirect to results page after a short delay
          setTimeout(() => {
            router.push("/candidate/results");
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error in updateRiskLevel:', error.message);
      if (error.details) {
        console.error('Error details:', error.details);
      }
    }
  };

  // Behavior monitoring effect
  useEffect(() => {
    if (!examStarted) return;

    let assessmentInterval;

    const handleMouseMove = (e) => {
      const movement = {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now()
      };
      setMouseMovements(prev => [...prev.slice(-50), movement]);
      setLastActivity(Date.now());
    };

    const handleKeyPress = (e) => {
      setKeystrokes(prev => [...prev.slice(-50), Date.now()]);
      setLastActivity(Date.now());
    };

    const handleKeyDown = async (e) => {
      // Prevent Alt+Tab
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        if (riskLevel === "MEDIUM") {
          await updateWarningCount(
            "⚠️ Warning: Keyboard shortcuts for switching tabs are not allowed during the exam.",
            "Tab switch attempt"
          );
          await assessBehavior("Tab switch attempt");
        }
        return false;
      }

      // Prevent Ctrl+Tab and Ctrl+Shift+Tab
      if (e.ctrlKey && (e.key === 'Tab' || (e.shiftKey && e.key === 'Tab'))) {
        e.preventDefault();
        if (riskLevel === "MEDIUM") {
          await updateWarningCount(
            "⚠️ Warning: Keyboard shortcuts for switching tabs are not allowed during the exam.",
            "Tab switch attempt"
          );
          await assessBehavior("Tab switch attempt");
        }
        return false;
      }

      // Prevent Windows key
      if (e.key === 'Meta' || e.key === 'OS') {
        e.preventDefault();
        if (riskLevel === "MEDIUM") {
          await updateWarningCount(
            "⚠️ Warning: Windows key is not allowed during the exam.",
            "System key attempt"
          );
          await assessBehavior("System key attempt");
        }
        return false;
      }

      // Prevent Alt+F4
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        if (riskLevel === "MEDIUM") {
          await updateWarningCount(
            "⚠️ Warning: Keyboard shortcuts for closing the window are not allowed during the exam.",
            "Window close attempt"
          );
          await assessBehavior("Window close attempt");
        }
        return false;
      }
    };

    const handleContextMenu = async (e) => {
      e.preventDefault();
      await updateWarningCount(
        "⚠️ Warning: Right-clicking is not allowed during the exam.",
        "Right-click attempt"
      );
      await assessBehavior("Right-click attempt");
      return false;
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        setTabSwitches(prev => prev + 1);
        if (riskLevel === "MEDIUM") {
          setWarningMessage("⚠️ Warning: Please return to the exam window. Fullscreen mode is required.");
          setShowWarning(true);
        }
        await updateWarningCount(
          "⚠️ Warning: Tab switching detected. This may be considered as malpractice.",
          "Tab switch detected"
        );
        await assessBehavior("Tab switch detected");
      }
    };

    const handleMouseLeave = async (e) => {
      if (e.clientY <= 0) {
        setMouseLeaveCount(prev => prev + 1);
        if (riskLevel === "MEDIUM" && !isInFullScreen()) {
          setWarningMessage("⚠️ Warning: Please keep the exam window in focus. Fullscreen mode is required.");
          setShowWarning(true);
        }
        await updateWarningCount(
          "⚠️ Warning: Mouse left exam window. Please keep your mouse within the exam window.",
          "Mouse left exam window"
        );
        await assessBehavior("Mouse left exam window");
      }
    };

    const handleFullscreenChange = () => {
      if (riskLevel === "MEDIUM" && !isInFullScreen()) {
        setWarningMessage("⚠️ Warning: Fullscreen mode is required. Please click the 'Return to Fullscreen' button.");
        setShowWarning(true);
      }
    };

    // Periodic behavior assessment
    assessmentInterval = setInterval(async () => {
      await assessBehavior("Periodic assessment");
    }, 10000); // Every 10 seconds

    // Add event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keypress", handleKeyPress);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keypress", handleKeyPress);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearInterval(assessmentInterval);
    };
  }, [examStarted, examSessionId, riskLevel]);

  const updateWarningCount = async (message, trigger) => {
    try {
      // Check if enough time has passed since the last warning
      const now = Date.now();
      if (now - lastWarningTimeRef.current < MIN_WARNING_INTERVAL) {
        console.log('Warning ignored - too soon after last warning');
        return;
      }

      // Check if we have required data
      if (!examSessionId || !user?.id) {
        console.error('Missing exam session ID or user ID');
        return;
      }

      // Update the last warning time
      lastWarningTimeRef.current = now;

      // First, get the current warning count from the database
      const { data: currentSession, error: fetchError } = await supabase
        .from("exam_sessions")
        .select("warnings")
        .eq("id", examSessionId)
        .single();

      if (fetchError) {
        console.error('Error fetching current warning count:', fetchError.message);
        return;
      }

      // Calculate new warning count
      const newWarningCount = (currentSession?.warnings || 0) + 1;

      // Update risk level
      await updateRiskLevel(newWarningCount);

      // Update local state
      setWarningCount(newWarningCount);
      setWarningMessage(message);
      setShowWarning(true);

      // Update database
      const { error: updateError } = await supabase
        .from("exam_sessions")
        .update({ 
          warnings: newWarningCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", examSessionId);

      if (updateError) {
        console.error('Error updating warning count:', updateError.message);
        return;
      }

      // Record the warning in admin_warnings table
      const warningData = {
        exam_session_id: examSessionId,
        user_id: user.id,
        message: message || 'Warning issued',
        status: "active",
        created_at: new Date().toISOString()
      };

      // Only add trigger_type if it exists in the schema
      if (trigger) {
        try {
          warningData.trigger_type = trigger;
        } catch (error) {
          console.log('trigger_type column might not exist yet:', error.message);
        }
      }

      const { error: warningError } = await supabase
        .from("admin_warnings")
        .insert([warningData]);

      if (warningError) {
        console.error('Error recording warning:', warningError.message);
        return;
      }

      // Clear any existing timeout
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }

      // Set new timeout to hide warning
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(false);
      }, 5000);

    } catch (error) {
      console.error('Error in updateWarningCount:', error.message);
    }
  };

  const assessBehavior = async (trigger) => {
    if (!examSessionId || !user?.id) {
      console.error("Missing exam session ID or user ID");
      return;
    }

    const behaviors = {
      mouseMovements,
      keystrokes,
      tabSwitches,
      mouseLeaveCount,
      copyPasteAttempts,
      timeInactive: Date.now() - lastActivity
    };

    try {
      // Calculate risk contributions
      const riskContributions = {
        tabSwitches: Math.min(1, tabSwitches / 5) * 0.3,
        mouseLeave: Math.min(1, mouseLeaveCount / 3) * 0.2,
        copyPaste: Math.min(1, copyPasteAttempts / 2) * 0.3,
        inactivity: Math.min(1, (Date.now() - lastActivity) / 30000) * 0.2
      };

      const totalRiskContribution = Object.values(riskContributions).reduce((sum, val) => sum + val, 0);

      // Show warning based on trigger
      if (trigger === "Periodic assessment" && (Date.now() - lastActivity) > 30000) {
        await updateWarningCount(
          "⚠️ Warning: Prolonged inactivity detected. Please remain active during the exam.",
          trigger
        );
      }

      // Record behavior log
      const { error: behaviorError } = await supabase
        .from('behavior_logs')
        .insert({
          exam_session_id: examSessionId,
          behavior_type: trigger,
          behavior_data: behaviors,
          risk_contribution: totalRiskContribution,
          created_at: new Date().toISOString()
        });

      if (behaviorError) {
        console.error('Error recording behavior log:', behaviorError.message);
      }

      // Record violation if risk is high
      if (totalRiskContribution > 0.5) {
        const riskScore = Math.round(totalRiskContribution * 100);
        
        // Create violation data object
        const violationData = {
          exam_session_id: examSessionId,
          user_id: user.id,
          reason: warningMessage || trigger,
          risk_score: riskScore,
          details: behaviors,
          created_at: new Date().toISOString()
        };

        // Insert violation
        const { error: violationError } = await supabase
          .from('exam_violations')
          .insert([violationData]);

        if (violationError) {
          console.error('Error recording violation:', violationError.message);
          console.error('Violation data:', violationData);
        }
      }

    } catch (error) {
      console.error('Error in assessBehavior:', error.message);
      if (error.details) {
        console.error('Error details:', error.details);
      }
    }
  };

  // Update startExam function to remove audio setup
  const startExam = async () => {
    try {
      console.log("Starting exam for user:", user.id);
      
      // Verify user is authenticated
      if (!user?.id) {
        console.error("No user ID found");
        throw new Error("User not authenticated");
      }

      // Get count of user's previous exams to create unique exam ID
      const { data: previousExams, error: countError } = await supabase
        .from("exam_sessions")
        .select("id")
        .eq("user_id", user.id);

      if (countError) {
        console.error("Error counting previous exams:", countError);
        throw new Error("Failed to create exam session");
      }

      const examNumber = (previousExams?.length || 0) + 1;
      const examId = `EXAM${examNumber}_${user.id}`;

      const examData = {
        user_id: user.id,
        exam_id: examId,
        risk_score: 0,
        warnings: 0,
        duration: 7200,
        completed: false,
        terminated: false,
        monitoring_level: 'STANDARD',
        created_at: new Date().toISOString()
      };

      console.log("Creating exam session with data:", examData);

      // Create a new exam session
      const { data: session, error: sessionError } = await supabase
        .from("exam_sessions")
        .insert(examData)
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating exam session. Error details:", sessionError);
        throw new Error(sessionError.message || "Failed to create exam session");
      }

      if (!session) {
        console.error("No session data returned after creation");
        throw new Error("Failed to create exam session - no data returned");
      }

      console.log("Created exam session:", session);
      setExamSessionId(session.id);
      setExamStarted(true);
    } catch (error) {
      console.error("Error starting exam:", error);
      alert(`Failed to start exam: ${error.message}. Please try again or contact support if the issue persists.`);
    }
  };

  // Update the exam end function to remove audio cleanup
  const endExam = async () => {
    if (!examSessionId) {
      console.error("No exam session ID found");
      return;
    }

    try {
      console.log("Starting exam end process for session:", examSessionId);
      
      // First verify the exam session exists and belongs to the user
      const { data: sessionCheck, error: sessionCheckError } = await supabase
        .from("exam_sessions")
        .select("*")
        .eq("id", examSessionId)
        .eq("user_id", user.id)
        .single();

      if (sessionCheckError) {
        console.error("Error verifying exam session:", sessionCheckError);
        throw new Error(`Failed to verify exam session: ${sessionCheckError.message}`);
      }

      if (!sessionCheck) {
        console.error("Exam session not found or doesn't belong to user");
        throw new Error("Exam session not found or doesn't belong to user");
      }

      console.log("Verified exam session:", sessionCheck);
      
      // Analyze coding answers for AI detection
      const aiDetectionPromises = Object.entries(codeAnswers).map(async ([questionId, code]) => {
        const result = await aiDetectionService.detectAIContent(code);
        return [questionId, result];
      });

      const aiResults = Object.fromEntries(await Promise.all(aiDetectionPromises));
      setAiDetectionResults(aiResults);

      // Calculate average AI confidence score
      const scores = Object.values(aiResults).map(r => r.confidenceScore);
      const avgAiScore = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;

      // Show warning if high AI confidence
      if (avgAiScore > 70) {
        setAiWarningMessage(`⚠️ Warning: High likelihood of AI-generated content detected (${Math.round(avgAiScore)}% confidence)`);
        setShowAIWarning(true);
      }

      // Calculate final risk score including AI detection
      const [violationsResult, behaviorLogsResult] = await Promise.all([
        supabase
          .from("exam_violations")
          .select("risk_score")
          .eq("exam_session_id", examSessionId),
        supabase
          .from("behavior_logs")
          .select("risk_contribution")
          .eq("exam_session_id", examSessionId)
      ]);

      if (violationsResult.error) {
        console.error("Error fetching violations:", violationsResult.error);
        throw new Error(`Failed to fetch violations: ${violationsResult.error.message}`);
      }
      if (behaviorLogsResult.error) {
        console.error("Error fetching behavior logs:", behaviorLogsResult.error);
        throw new Error(`Failed to fetch behavior logs: ${behaviorLogsResult.error.message}`);
      }

      const violationScore = violationsResult.data?.length > 0
        ? Math.max(...violationsResult.data.map(v => Math.round(v.risk_score)))
        : 0;

      const behaviorScore = behaviorLogsResult.data?.length > 0
        ? Math.round(Math.min(100, behaviorLogsResult.data.reduce((sum, log) => sum + (log.risk_contribution * 100), 0)))
        : 0;

      // Include AI detection in risk score calculation
      const aiRiskScore = Math.round(avgAiScore);
      const finalRiskScore = Math.round(Math.max(violationScore, behaviorScore, aiRiskScore));

      const updateData = {
        completed: true,
        duration: Math.round(7200 - timeRemaining),
        risk_score: finalRiskScore,
        ai_detection_results: aiResults,
        updated_at: new Date().toISOString()
      };

      console.log("Updating exam session with data:", updateData);

      // First try to update without the AI results to check for other issues
      const { error: basicUpdateError } = await supabase
        .from("exam_sessions")
        .update({
          completed: true,
          duration: Math.round(7200 - timeRemaining),
          risk_score: finalRiskScore,
          updated_at: new Date().toISOString()
        })
        .eq("id", examSessionId)
        .eq("user_id", user.id);

      if (basicUpdateError) {
        console.error("Error updating basic exam data:", basicUpdateError);
        console.error("Basic update error details:", {
          message: basicUpdateError.message,
          code: basicUpdateError.code,
          details: basicUpdateError.details,
          hint: basicUpdateError.hint
        });
        throw new Error(`Failed to update basic exam data: ${basicUpdateError.message}`);
      }

      // Then update the AI results separately
      const { data: updatedSession, error: aiUpdateError } = await supabase
        .from("exam_sessions")
        .update({ ai_detection_results: aiResults })
        .eq("id", examSessionId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (aiUpdateError) {
        console.error("Error updating AI detection results:", aiUpdateError);
        console.error("AI update error details:", {
          message: aiUpdateError.message,
          code: aiUpdateError.code,
          details: aiUpdateError.details,
          hint: aiUpdateError.hint
        });
        // Don't throw here, continue with the process
        console.warn("Failed to save AI detection results, but exam completion will continue");
      }

      console.log("Successfully completed exam session");
      
      // Redirect to results page with exam ID
      const examId = updatedSession?.exam_id || sessionCheck.exam_id;
      await router.push(`/candidate/results?exam_id=${examId}`);
    } catch (error) {
      console.error("Error ending exam:", error);
      console.error("Full error details:", {
        name: error.name,
        message: error.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error.stack
      });
      alert(`Failed to end exam: ${error.message}. Please try again or contact support.`);
    }
  };

  // Add a submit exam function
  const submitExam = async () => {
    try {
      console.log("Submitting exam...");
      await endExam();
    } catch (error) {
      console.error("Error submitting exam:", error);
      alert("Failed to submit exam. Please try again.");
    }
  };

  // Update the question navigation to handle exam completion
  const handleNextQuestion = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // This is the last question, show confirmation dialog
      if (window.confirm("Are you sure you want to submit your exam?")) {
        await submitExam();
      }
    }
  };

  // Update the MCQ option click handler
  const handleOptionClick = async (option) => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // This is the last question, show confirmation dialog
      if (window.confirm("Are you sure you want to submit your exam?")) {
        await submitExam();
      }
    }
  };

  // Add code submission handler
  const handleCodeSubmit = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      if (window.confirm("Are you sure you want to submit your exam?")) {
        await submitExam();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium tracking-wide">Loading Exam...</p>
        </motion.div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="relative min-h-screen px-6 py-12">
          {!typingTestStarted ? (
            <motion.div
              className="max-w-4xl mx-auto text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl font-black text-white mb-6">Welcome to the Exam</h1>
              <p className="text-blue-50/90 mb-8">
                Before starting the exam, you'll need to complete a quick typing test to help us understand your typing patterns.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startTypingTest}
                className="bg-green-500 text-white rounded-xl py-4 px-8 font-medium text-lg hover:bg-green-600 transition-colors duration-300"
              >
                Start Typing Test
              </motion.button>
            </motion.div>
          ) : showTypingTest ? (
            <motion.div
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl font-black text-white mb-6 text-center">Typing Test</h1>
              <p className="text-blue-50/90 mb-8 text-center">
                Please complete this short typing test. Type naturally - you don't need to match the sample text exactly.
              </p>

              <div className="space-y-6 bg-white/10 backdrop-blur-lg rounded-xl p-8">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={userDetails.fullName}
                    onChange={(e) => setUserDetails(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-white/5 text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">Education</label>
                  <input
                    type="text"
                    value={userDetails.education}
                    onChange={(e) => setUserDetails(prev => ({ ...prev, education: e.target.value }))}
                    className="w-full bg-white/5 text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your education details"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">Typing Test</label>
                  <div className="bg-white/5 rounded-lg p-4 mb-4">
                    <p className="text-white/90 font-mono">{sampleText}</p>
                  </div>
                  <textarea
                    value={userDetails.typingTestText}
                    onChange={(e) => setUserDetails(prev => ({ ...prev, typingTestText: e.target.value }))}
                    onKeyDown={handleTypingStart}
                    className="w-full h-32 bg-white/5 text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Start typing anything here to demonstrate your typing speed..."
                  />
                </div>

                <button
                  onClick={handleTypingTestSubmit}
                  disabled={!userDetails.fullName || !userDetails.education || userDetails.typingTestText.length < 20}
                  className="w-full bg-green-500 text-white rounded-xl py-4 px-8 font-medium text-lg hover:bg-green-600 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Typing Test
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="max-w-4xl mx-auto text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl font-black text-white mb-6">Ready to Begin?</h1>
              <p className="text-blue-50/90 mb-8">
                The exam will begin when you click the button below. Please ensure you have read all instructions carefully.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startExam}
                className="bg-green-500 text-white rounded-xl py-4 px-8 font-medium text-lg hover:bg-green-600 transition-colors duration-300"
              >
                Begin Exam
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">Exam in Progress</h1>
            <p className="text-blue-50/90">Question {currentQuestion + 1} of {questions.length}</p>
            <p className="text-yellow-400">Warnings: {warningCount}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/80">Time Remaining</span>
            <span className="text-green-400 font-mono text-xl">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* Warning Messages */}
      {showWarning && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 z-50"
        >
          <div className="bg-red-500 backdrop-blur-lg rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3 text-white">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium">{warningMessage}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Warning Message */}
      {showAIWarning && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 right-4 z-50"
        >
          <div className="bg-orange-500 backdrop-blur-lg rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3 text-white">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm font-medium">{aiWarningMessage}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Exam Content */}
      <div ref={examContainerRef} className="h-[calc(100vh-64px)] px-6">
        <div className="h-full">
          {questions[currentQuestion].type === "mcq" ? (
            <div className="max-w-4xl mx-auto p-6">
              <h2 className="text-xl font-bold text-white mb-6">
                {questions[currentQuestion].question}
              </h2>
              <div className="space-y-4">
                {questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors duration-300"
                    onClick={() => handleOptionClick(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : questions[currentQuestion].type === "coding" ? (
            <div className="flex h-full gap-6">
              {/* Left side - Question Details */}
              <div className="w-[45%] overflow-hidden rounded-xl bg-[#1e1e1e]/50">
                <div className="h-full overflow-y-auto">
                  <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-6">
                      Question {currentQuestion + 1}
                    </h2>
                    <div className="prose prose-invert max-w-none">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        {questions[currentQuestion].question.split('\n')[0]}
                      </h3>
                      <div className="text-white/90 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {questions[currentQuestion].question.split('\n').slice(1).join('\n')}
                      </div>
                    </div>
                    <div className="mt-8">
                      <h4 className="text-white font-medium mb-4">Example Test Cases:</h4>
                      {questions[currentQuestion].testCases.map((testCase, index) => (
                        <div key={index} className="mb-4 last:mb-0 bg-white/5 rounded-lg p-4">
                          <div className="text-sm text-white/90 space-y-1">
                            <p className="font-medium text-white">Test Case {index + 1}:</p>
                            <p>Input: {JSON.stringify(testCase.input)}</p>
                            <p>Expected Output: {JSON.stringify(testCase.expectedOutput)}</p>
                            {testCase.explanation && (
                              <p className="text-blue-300">Explanation: {testCase.explanation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Code Editor */}
              <div className="w-[55%] flex flex-col bg-[#1e1e1e] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="text-white/80">Solution</div>
                  <div className="flex items-center gap-3">
                    <button
                      className="px-4 py-1.5 text-sm font-medium text-white/90 hover:text-white bg-white/5 rounded-md hover:bg-white/10 transition-colors"
                      onClick={() => {
                        // Reset code to starting code
                        handleCodeChange(questions[currentQuestion].id, questions[currentQuestion].startingCode);
                      }}
                    >
                      Reset
                    </button>
                    <button
                      className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
                      onClick={() => {
                        // Add run code functionality here
                        console.log("Running code...");
                      }}
                    >
                      Run Code
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <textarea
                    value={codeAnswers[questions[currentQuestion].id] || questions[currentQuestion].startingCode}
                    onChange={(e) => handleCodeChange(questions[currentQuestion].id, e.target.value)}
                    className="w-full h-full bg-transparent text-white font-mono text-sm leading-relaxed focus:outline-none resize-none p-6"
                    spellCheck="false"
                  />
                </div>
                <div className="p-4 border-t border-white/10">
                  <button
                    className="w-full bg-green-500 text-white rounded-md py-2.5 font-medium hover:bg-green-600 transition-colors"
                    onClick={handleCodeSubmit}
                  >
                    {currentQuestion < questions.length - 1 ? "Next Question" : "Submit Exam"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
} 