"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { riskAssessmentService } from "@/services/RiskAssessmentService";
import { interventionService } from "@/services/InterventionService";

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
      question: "What is the capital of France?",
      type: "mcq",
      options: ["London", "Paris", "Berlin", "Madrid"],
      correctAnswer: "Paris"
    },
    {
      id: 2,
      question: "What is 2 + 2?",
      type: "text",
      answer: "4"
    },
    {
      id: 3,
      question: "Which planet is known as the Red Planet?",
      type: "mcq",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctAnswer: "Mars"
    }
  ];

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
      
      // Calculate final risk score from violations and behavior logs
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

      console.log("Fetched violations and behavior logs:", {
        violations: violationsResult,
        behaviorLogs: behaviorLogsResult
      });

      if (violationsResult.error) {
        console.error("Error fetching violations:", violationsResult.error);
        throw new Error(`Failed to fetch violations: ${violationsResult.error.message}`);
      }
      if (behaviorLogsResult.error) {
        console.error("Error fetching behavior logs:", behaviorLogsResult.error);
        throw new Error(`Failed to fetch behavior logs: ${behaviorLogsResult.error.message}`);
      }

      // Calculate risk score from violations (max of all violation scores)
      const violationScore = violationsResult.data?.length > 0
        ? Math.max(...violationsResult.data.map(v => Math.round(v.risk_score)))
        : 0;

      // Calculate risk score from behavior (sum of all risk contributions, scaled to 0-100)
      const behaviorScore = behaviorLogsResult.data?.length > 0
        ? Math.round(Math.min(100, behaviorLogsResult.data.reduce((sum, log) => sum + (log.risk_contribution * 100), 0)))
        : 0;

      // Final risk score is the maximum of violation and behavior scores
      const finalRiskScore = Math.round(Math.max(violationScore, behaviorScore));

      console.log("Calculated risk scores:", {
        violationScore,
        behaviorScore,
        finalRiskScore,
        violations: violationsResult.data,
        behaviorLogs: behaviorLogsResult.data
      });

      const updateData = {
        completed: true,
        duration: Math.round(7200 - timeRemaining),
        risk_score: finalRiskScore,
        updated_at: new Date().toISOString()
      };

      console.log("Updating exam session with data:", updateData);

      // Update exam session with final data
      const { data: updatedSession, error: updateError } = await supabase
        .from("exam_sessions")
        .update(updateData)
        .eq("id", examSessionId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating exam session:", updateError);
        console.error("Update error details:", {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint
        });
        throw new Error(`Failed to update exam session: ${updateError.message}`);
      }

      if (!updatedSession) {
        console.error("No session data returned after update");
        throw new Error("Failed to update exam session - no data returned");
      }

      console.log("Successfully updated exam session:", updatedSession);
      
      // Redirect to results page
      await router.push("/candidate/results");
    } catch (error) {
      console.error("Error ending exam:", error);
      console.error("Full error details:", {
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
          <motion.div
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl font-black text-white mb-6">Ready to Begin?</h1>
            <p className="text-blue-50/90 mb-8">
              The exam will begin when you click the button below. Make sure you are in a quiet environment
              .
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
      <div className="relative min-h-screen px-6 py-12">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Exam in Progress</h1>
              <p className="text-blue-50/90">Question {currentQuestion + 1} of {questions.length}</p>
              <p className="text-yellow-400 mt-1">Warnings: {warningCount}</p>
              <p className={`mt-1 ${
                riskLevel === "LOW" ? "text-green-400" :
                riskLevel === "MEDIUM" ? "text-yellow-400" :
                "text-red-400"
              }`}>
                Risk Level: {riskLevel}
              </p>
              {riskLevel === "MEDIUM" && !isInFullScreen() && (
                <button
                  onClick={requestFullScreen}
                  className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  Return to Fullscreen
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-white font-medium">Time Remaining</p>
              <p className="text-2xl font-bold text-green-400">
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="max-w-md mx-auto bg-red-500 backdrop-blur-lg rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 text-white">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium text-lg">{warningMessage}</p>
                  <p className="text-sm mt-1 text-white/80">Warning count: {warningCount}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Exam Content */}
        <div ref={examContainerRef} className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">
              {questions[currentQuestion].question}
            </h2>

            {questions[currentQuestion].type === "mcq" ? (
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
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Type your answer here..."
                />
                <button
                  className="w-full bg-green-500 text-white rounded-xl py-4 font-medium hover:bg-green-600 transition-colors duration-300"
                  onClick={handleNextQuestion}
                >
                  {currentQuestion < questions.length - 1 ? "Next Question" : "Submit Exam"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 