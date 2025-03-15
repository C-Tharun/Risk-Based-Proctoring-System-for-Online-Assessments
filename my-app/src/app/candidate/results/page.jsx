"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function ExamResults() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [examSession, setExamSession] = useState(null);
  const [violations, setViolations] = useState([]);
  const [behaviorLogs, setBehaviorLogs] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("http://localhost:3000");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth error:", error);
          router.push("/auth/login");
          return;
        }
        
        if (!data?.session?.user) {
          console.log("No authenticated user found");
          router.push("/auth/login");
          return;
        }

        console.log("Authenticated user:", data.session.user);
        setUser(data.session.user);
        setLoading(false);
      } catch (error) {
        console.error("Error in checkAuth:", error);
        router.push("/auth/login");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchExamData = async () => {
      if (!user) {
        console.log("No user available for fetching exam data");
        return;
      }

      try {
        console.log("Fetching exam data for user:", user.id);
        
        // Fetch all completed exams for this user
        const { data: completedExams, error: examsError } = await supabase
          .from("exam_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("completed", true)
          .order("created_at", { ascending: false });

        if (examsError) {
          console.error("Error fetching completed exams:", examsError);
          return;
        }

        console.log("Completed exams:", completedExams);
        setAllExams(completedExams || []);

        // Get exam_id from URL
        const urlParams = new URLSearchParams(window.location.search);
        const targetExamId = urlParams.get("exam_id");
        
        console.log("Target exam ID from URL:", targetExamId);
        
        let currentSession;
        if (targetExamId) {
          // Find the exam with matching exam_id
          currentSession = completedExams?.find(exam => exam.exam_id === targetExamId);
          console.log("Found session for target exam:", currentSession);
        }
        
        // If no specific exam found or no target exam_id, use the latest exam
        if (!currentSession && completedExams?.length > 0) {
          currentSession = completedExams[0];
          console.log("Using latest exam session:", currentSession);
        }

        if (!currentSession) {
          console.log("No completed exams found for user:", user.id);
          setExamSession(null);
          setViolations([]);
          setBehaviorLogs([]);
          return;
        }

        console.log("Setting current session:", currentSession);
        setExamSession(currentSession);

        // Fetch violations for this session
        const { data: violationsData, error: violationsError } = await supabase
          .from("exam_violations")
          .select("*")
          .eq("exam_session_id", currentSession.id)
          .order("created_at", { ascending: true });

        if (violationsError) {
          console.error("Error fetching violations:", violationsError);
        } else {
          console.log("Violations data:", violationsData);
          setViolations(violationsData || []);
        }

        // Fetch behavior logs for this session
        const { data: behaviorData, error: behaviorError } = await supabase
          .from("behavior_logs")
          .select("*")
          .eq("exam_session_id", currentSession.id)
          .order("created_at", { ascending: true });

        if (behaviorError) {
          console.error("Error fetching behavior logs:", behaviorError);
        } else {
          console.log("Behavior logs:", behaviorData);
          setBehaviorLogs(behaviorData || []);
        }

      } catch (error) {
        console.error("Error in fetchExamData:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchExamData();
    }
  }, [user, router]);

  const getRiskLevel = (score) => {
    if (score >= 50) return { level: "High", color: "text-red-500" };
    if (score >= 25) return { level: "Medium", color: "text-yellow-500" };
    return { level: "Low", color: "text-green-500" };
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
          <p className="text-white text-lg font-medium tracking-wide">Loading Results...</p>
        </motion.div>
      </div>
    );
  }

  if (!examSession) {
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
            <h1 className="text-4xl font-black text-white mb-6">No Exam Results Found</h1>
            <p className="text-blue-50/90 mb-4">
              You haven't completed any exams yet. To see your results:
            </p>
            <ol className="text-blue-50/90 mb-8 list-decimal list-inside">
              <li className="mb-2">Start a new exam</li>
              <li className="mb-2">Complete all questions</li>
              <li>Submit your exam</li>
            </ol>
            <div className="flex gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/candidate")}
                className="bg-blue-500 text-white rounded-xl py-4 px-8 font-medium text-lg hover:bg-blue-600 transition-colors duration-300"
              >
                Go to Dashboard
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="bg-red-500 text-white rounded-xl py-4 px-8 font-medium text-lg hover:bg-red-600 transition-colors duration-300"
              >
                Logout
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const riskLevel = getRiskLevel(examSession.risk_score);
  const duration = Math.floor(examSession.duration / 60);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
      <div className="relative min-h-screen px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-white">Exam Results</h1>
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push("/candidate")}
                  className="bg-blue-500 text-white rounded-xl py-2 px-6 font-medium hover:bg-blue-600 transition-colors duration-300"
                >
                  Back to Dashboard
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="bg-red-500 text-white rounded-xl py-2 px-6 font-medium hover:bg-red-600 transition-colors duration-300"
                >
                  Logout
                </motion.button>
              </div>
            </div>
            
            {/* Exam Identifier */}
            <div className="bg-white/5 rounded-xl p-4 mb-8">
              <p className="text-blue-50/90">
                Exam ID: <span className="font-semibold">{examSession.exam_id}</span>
              </p>
              <p className="text-blue-50/70 text-sm">
                Taken on: {new Date(examSession.created_at).toLocaleString()}
              </p>
            </div>

            {/* Previous Exams Selector */}
            <div className="mb-8 bg-white/5 rounded-xl p-6">
              <label className="block text-lg font-semibold text-white mb-3">View Other Exams</label>
              <div className="relative">
                <select
                  className="w-full bg-white/5 text-white border border-white/20 rounded-xl p-4 pr-10 appearance-none hover:bg-white/10 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-lg font-medium"
                  onChange={(e) => {
                    if (e.target.value) {
                      const newUrl = `/candidate/results?exam_id=${e.target.value}`;
                      router.push(newUrl);
                      window.location.href = newUrl;
                    }
                  }}
                  value={examSession.exam_id || ""}
                >
                  {allExams?.map((exam) => (
                    <option 
                      key={exam.id} 
                      value={exam.exam_id}
                      className="bg-gray-800 text-white py-2"
                    >
                      {exam.exam_id} - {new Date(exam.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-white/70">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-50/70 text-sm mt-2">Select an exam from the list to view its results</p>
            </div>

            {/* Exam Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/5 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-blue-50/90 mb-2">Risk Level</h2>
                <p className={`text-3xl font-bold ${riskLevel.color}`}>{riskLevel.level}</p>
                <p className="text-blue-50/70 mt-1">Final Score: {examSession.risk_score}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-blue-50/90">
                    Total Warnings: <span className="font-semibold">{examSession.warnings || 0}</span>
                  </p>
                  {violations.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-blue-50/80 mb-1">Warning Details:</p>
                      <ul className="list-disc list-inside text-sm text-blue-50/70">
                        {violations.map((violation, index) => (
                          <li key={index} className="mb-1">
                            {violation.reason} <span className="text-blue-50/50">({new Date(violation.created_at).toLocaleTimeString()})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-blue-50/90 mb-2">Warnings Summary</h2>
                <p className="text-3xl font-bold text-white">{examSession.warnings || 0}</p>
                <p className="text-blue-50/70 mt-1">Total warnings issued</p>
                {examSession.warnings > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-yellow-400 font-medium">Multiple violations detected</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-blue-50/90 mb-2">Duration</h2>
                <p className="text-3xl font-bold text-white">{duration} minutes</p>
                <p className="text-blue-50/70 mt-1">Time taken</p>
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-blue-50/90 mb-2">Status</h2>
                <p className="text-3xl font-bold text-green-400">Completed</p>
                <p className="text-blue-50/70 mt-1">Exam finished</p>
              </div>
            </div>

            {/* Violations List */}
            {violations.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-white mb-4">Detected Violations</h2>
                <div className="space-y-4">
                  {violations.map((violation, index) => (
                    <motion.div
                      key={violation.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-red-500/10 backdrop-blur-lg rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-red-200 font-medium">{violation.reason}</p>
                          <p className="text-red-200/70 text-sm mt-1">
                            Risk Score: {violation.risk_score}
                          </p>
                        </div>
                        <p className="text-red-200/70 text-sm">
                          {new Date(violation.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Behavior Analysis */}
            {behaviorLogs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-white mb-4">Behavior Analysis</h2>
                <div className="space-y-4">
                  {behaviorLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-200 font-medium">{log.behavior_type}</p>
                          <p className="text-blue-200/70 text-sm mt-1">
                            Risk Contribution: {(log.risk_contribution * 100).toFixed(1)}%
                          </p>
                        </div>
                        <p className="text-blue-200/70 text-sm">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {log.behavior_data && (
                        <div className="mt-2 text-sm text-blue-200/70">
                          <pre className="overflow-x-auto">
                            {JSON.stringify(log.behavior_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
} 