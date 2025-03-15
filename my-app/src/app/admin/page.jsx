"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTestHistory, setUserTestHistory] = useState([]);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDetails, setExamDetails] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('Checking authentication...');
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        console.log('Auth session:', session);
        
        if (authError) {
          console.error('Auth error:', authError);
          router.push("/auth/login");
          return;
        }

        if (!session?.user) {
          console.log('No authenticated user found, redirecting to login...');
          router.push("/auth/login");
          return;
        }

        // Check if user has admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        console.log('User profile:', profile);

        if (profileError) {
          console.error('Profile error:', profileError);
          router.push("/auth/login");
          return;
        }

        if (profile?.role !== 'admin') {
          console.log('User is not an admin, redirecting...');
          router.push("/");
          return;
        }

        console.log('Admin user authenticated:', session.user);
        setUser(session.user);
        setLoading(false);
      } catch (error) {
        console.error('Error in checkAuth:', error);
        router.push("/auth/login");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!user) {
      console.log('No user, skipping data fetch');
      return;
    }

    // Fetch active exam sessions
    //Hello
    const fetchActiveSessions = async () => {
      try {
        console.log('Fetching active sessions...');
        // First get the exam sessions
        const { data: sessions, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("*")
          .eq("completed", false)
          .order("created_at", { ascending: false });

        console.log('Active sessions response:', { sessions, error: sessionError });

        if (sessionError) {
          console.error("Error fetching active sessions:", sessionError.message);
          setActiveSessions([]);
          return;
        }

        // If we have sessions, get the corresponding user emails
        if (sessions && sessions.length > 0) {
          const userIds = [...new Set(sessions.map(session => session.user_id))];
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", userIds);

          console.log('Profiles response:', { profiles, error: profileError });

          if (profileError) {
            console.error("Error fetching profiles:", profileError.message);
            return;
          }

          // Combine sessions with profile data
          const sessionsWithProfiles = sessions.map(session => ({
            ...session,
            profiles: profiles.find(profile => profile.id === session.user_id)
          }));

          console.log('Processed active sessions:', sessionsWithProfiles);
          setActiveSessions(sessionsWithProfiles);
        } else {
          setActiveSessions([]);
        }
      } catch (error) {
        console.error("Error in fetchActiveSessions:", error);
        setActiveSessions([]);
      }
    };

    // Fetch completed exam sessions
    const fetchCompletedSessions = async () => {
      try {
        console.log('Fetching completed sessions...');
        
        // First get the completed exam sessions
        const { data: sessions, error: sessionError } = await supabase
          .from('exam_sessions')
          .select('*')
          .eq('completed', true)
          .order('created_at', { ascending: false });

        if (sessionError) {
          console.error('Error fetching completed sessions:', sessionError);
          setCompletedSessions([]);
          return;
        }

        // If we have sessions, get the corresponding user emails
        if (sessions && sessions.length > 0) {
          const userIds = [...new Set(sessions.map(session => session.user_id))];
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, role')
            .in('id', userIds);

          if (profileError) {
            console.error('Error fetching profiles:', profileError);
            return;
          }

          // Combine sessions with profile data
          const sessionsWithProfiles = sessions.map(session => ({
            ...session,
            profiles: profiles.find(profile => profile.id === session.user_id)
          }));

          console.log('Processed completed sessions:', sessionsWithProfiles);
          setCompletedSessions(sessionsWithProfiles);
        } else {
          setCompletedSessions([]);
        }
      } catch (error) {
        console.error('Error in fetchCompletedSessions:', error);
        setCompletedSessions([]);
      }
    };

    // Initial fetch
    fetchActiveSessions();
    fetchCompletedSessions();

    // Set up real-time subscriptions
    const activeSubscription = supabase
      .channel("active_sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exam_sessions",
          filter: "completed=eq.false"
        },
        (payload) => {
          fetchActiveSessions();
        }
      )
      .subscribe();

    const completedSubscription = supabase
      .channel("completed_sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exam_sessions",
          filter: "completed=eq.true"
        },
        (payload) => {
          fetchCompletedSessions();
        }
      )
      .subscribe();

    return () => {
      activeSubscription.unsubscribe();
      completedSubscription.unsubscribe();
    };
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        console.log("Fetching candidate profiles...");
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'candidate')
          .order('email', { ascending: true });

        console.log("Profiles query response:", { profiles, error: profileError });

        if (profileError) {
          console.error("Error fetching profiles:", profileError.message);
          setUsers([]);
          return;
        }

        if (!profiles || profiles.length === 0) {
          console.log("No candidate profiles found");
          setUsers([]);
          return;
        }

        console.log("Found candidates:", profiles);
        setUsers(profiles);

      } catch (error) {
        console.error("Error in fetchUsers:", error.message);
        setUsers([]);
      }
    };

    fetchUsers();
  }, [user]);

  const fetchUserTestHistory = async (userId) => {
    try {
      console.log('Fetching test history for user:', userId);
      
      // First fetch exam sessions for this user
      const { data: sessions, error: sessionError } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          exam_violations (
            id,
            reason,
            risk_score,
            details,
            created_at,
            timestamp
          ),
          behavior_logs (
            id,
            behavior_type,
            behavior_data,
            risk_contribution,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionError) {
        console.error('Error fetching exam sessions:', sessionError);
        setUserTestHistory([]);
        return;
      }

      console.log('Found exam sessions:', sessions);

      if (!sessions || sessions.length === 0) {
        console.log('No exam history found for user');
        setUserTestHistory([]);
        return;
      }

      // Set the sessions with their related data
      const processedSessions = sessions.map(session => ({
        ...session,
        exam_violations: session.exam_violations || [],
        behavior_logs: session.behavior_logs || []
      }));

      console.log('Processed sessions:', processedSessions);
      setUserTestHistory(processedSessions);

    } catch (error) {
      console.error('Error in fetchUserTestHistory:', error);
      setUserTestHistory([]);
    }
  };

  const handleViewUserDetails = async (selectedUser) => {
    // Simply set the selected user and fetch their test history
    setSelectedCandidate(selectedUser);
    await fetchUserTestHistory(selectedUser.id);
    setShowUserDetails(true);
  };

  const handleSendWarning = async (sessionId, userId) => {
    try {
      const { error } = await supabase.from("admin_warnings").insert({
        exam_session_id: sessionId,
        user_id: userId,
        message: "Warning: Suspicious activity detected. Please maintain exam integrity.",
        status: "active"
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error sending warning:", error);
    }
  };

  const handleForceLogout = async (userId) => {
    try {
      // Update the exam session to mark it as terminated
      const { error: sessionError } = await supabase
        .from("exam_sessions")
        .update({ completed: true, terminated: true })
        .eq("user_id", userId)
        .eq("completed", false);

      if (sessionError) throw sessionError;

      // Force sign out the user
      const { error: signOutError } = await supabase.auth.admin.signOut(userId);
      if (signOutError) throw signOutError;
    } catch (error) {
      console.error("Error forcing logout:", error);
    }
  };

  const getRiskLevel = (score) => {
    if (score >= 80) return { level: "High", color: "text-red-500" };
    if (score >= 51) return { level: "Medium", color: "text-yellow-500" };
    return { level: "Low", color: "text-green-500" };
  };

  // Add cooldown check function
  const checkRiskCooldown = async (examId, currentScore) => {
    try {
      // Get violations from the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentViolations, error } = await supabase
        .from('exam_violations')
        .select('created_at')
        .eq('exam_session_id', examId)
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error checking violations:', error);
        return currentScore;
      }

      // If no violations in last 5 minutes, reduce score by 10
      if (!recentViolations || recentViolations.length === 0) {
        const newScore = Math.max(0, currentScore - 10); // Don't go below 0
        
        // Update exam session with new score
        const { error: updateError } = await supabase
          .from('exam_sessions')
          .update({ risk_score: newScore })
          .eq('id', examId);

        if (updateError) {
          console.error('Error updating risk score:', updateError);
          return currentScore;
        }

        return newScore;
      }

      return currentScore;
    } catch (error) {
      console.error('Error in checkRiskCooldown:', error);
      return currentScore;
    }
  };

  // Add violation handler function
  const handleViolation = async (examId, currentScore) => {
    try {
      const newScore = currentScore + 10;
      
      // Update exam session with new score
      const { error: updateError } = await supabase
        .from('exam_sessions')
        .update({ risk_score: newScore })
        .eq('id', examId);

      if (updateError) {
        console.error('Error updating risk score:', updateError);
        return currentScore;
      }

      return newScore;
    } catch (error) {
      console.error('Error in handleViolation:', error);
      return currentScore;
    }
  };

  // Set up cooldown interval for active sessions
  useEffect(() => {
    if (!activeSessions.length) return;

    const cooldownInterval = setInterval(async () => {
      for (const session of activeSessions) {
        if (!session.completed) {
          const newScore = await checkRiskCooldown(session.id, session.risk_score);
          if (newScore !== session.risk_score) {
            // Update local state if score changed
            setActiveSessions(prev => prev.map(s => 
              s.id === session.id ? { ...s, risk_score: newScore } : s
            ));
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(cooldownInterval);
  }, [activeSessions]);

  const fetchExamDetails = async (examId) => {
    try {
      console.log('Fetching exam details for:', examId);
      
      if (!examId) {
        console.error('No exam ID provided');
        return;
      }

      // First fetch the basic exam session data
      const { data: examSession, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('*, typing_speed_wpm, user_details')
        .eq('id', examId)
        .single();

      if (sessionError) {
        console.error('Error fetching exam session:', sessionError.message);
        return;
      }

      if (!examSession) {
        console.error('No exam session found with ID:', examId);
        return;
      }

      // Get the user profile data
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', examSession.user_id);

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
      }

      // Get the first profile if exists
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // Then fetch violations and logs
      const [violationsResponse, behaviorLogsResponse, warningsResponse] = await Promise.all([
        // Fetch violations
        supabase
          .from('exam_violations')
          .select('*')
          .eq('exam_session_id', examId)
          .order('created_at', { ascending: true }),

        // Fetch behavior logs
        supabase
          .from('behavior_logs')
          .select('*')
          .eq('exam_session_id', examId)
          .order('created_at', { ascending: true }),

        // Fetch admin warnings
        supabase
          .from('admin_warnings')
          .select('*')
          .eq('exam_session_id', examId)
          .order('created_at', { ascending: true })
      ]);

      // Check for errors in related data fetching
      if (violationsResponse.error) {
        console.error('Error fetching violations:', violationsResponse.error.message);
      }
      if (behaviorLogsResponse.error) {
        console.error('Error fetching behavior logs:', behaviorLogsResponse.error.message);
      }
      if (warningsResponse.error) {
        console.error('Error fetching warnings:', warningsResponse.error.message);
      }

      // Combine all the data
      const examWithDetails = {
        ...examSession,
        profiles: profile,
        exam_violations: violationsResponse.data || [],
        behavior_logs: behaviorLogsResponse.data || [],
        admin_warnings: warningsResponse.data || []
      };

      console.log('Processed exam details:', examWithDetails);
      setExamDetails(examWithDetails);
      setSelectedExam(examWithDetails);
    } catch (error) {
      console.error('Error in fetchExamDetails:', error.message);
      if (error.details) {
        console.error('Error details:', error.details);
      }
    }
  };

  const renderExamDetails = (exam) => {
    const typingSpeed = exam.typing_speed_wpm || exam.user_details?.typingSpeed || 0;
    const typingTestText = exam.user_details?.typingTestText || '';
    const testDuration = exam.user_details?.testStartTime && exam.user_details?.testEndTime
      ? Math.round((exam.user_details.testEndTime - exam.user_details.testStartTime) / 1000)
      : 0;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Exam Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Candidate</p>
                <p className="mt-1 text-sm text-gray-900">{exam.profiles?.email || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Exam ID</p>
                <p className="mt-1 text-sm text-gray-900">{exam.exam_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Duration</p>
                <p className="mt-1 text-sm text-gray-900">{Math.round(exam.duration / 60)} minutes</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Risk Score</p>
                <p className="mt-1 text-sm text-gray-900">{exam.risk_score || 0}%</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Typing Speed</p>
                <p className="mt-1 text-sm text-gray-900">{typingSpeed} WPM</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="mt-1 text-sm text-gray-900">
                  {exam.completed ? (
                    <span className="text-green-600">Completed</span>
                  ) : (
                    <span className="text-blue-600">In Progress</span>
                  )}
                  {exam.terminated && (
                    <span className="ml-2 text-red-600">(Terminated)</span>
                  )}
                </p>
              </div>
            </div>

            {exam.user_details && (
              <div className="mt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3">User Details</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Full Name</p>
                      <p className="mt-1 text-sm text-gray-900">{exam.user_details.fullName || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Education</p>
                      <p className="mt-1 text-sm text-gray-900">{exam.user_details.education || "Not provided"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-500">Typing Test Details</p>
                      <div className="mt-1 text-sm text-gray-900 space-y-2">
                        <p>Speed: {typingSpeed} WPM</p>
                        <p>Text Length: {typingTestText.length} characters</p>
                        <p>Test Duration: {testDuration} seconds</p>
                        {typingTestText && (
                          <div>
                            <p className="font-medium mt-2 mb-1">Sample Text:</p>
                            <p className="bg-gray-100 p-2 rounded text-gray-700 font-mono text-sm">
                              {typingTestText}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Exam Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full ${
                        getRiskLevel(exam.risk_score).level === "High"
                          ? "bg-red-500"
                          : getRiskLevel(exam.risk_score).level === "Medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${exam.risk_score}%` }}
                    ></div>
                  </div>
                  <span className={`ml-3 font-medium ${getRiskLevel(exam.risk_score).color}`}>
                    {exam.risk_score}%
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-600">
                  Risk Level: {getRiskLevel(exam.risk_score).level}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="font-medium text-gray-900">{exam.warnings} warnings issued</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monitoring Level</p>
                <p className="font-medium text-gray-900">{exam.monitoring_level}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Session Statistics</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Duration</p>
                <p className="font-medium text-gray-900">{Math.round(exam.duration / 60)} minutes</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Typing Speed</p>
                <p className="font-medium text-gray-900">{exam.typing_speed_wpm || exam.user_details?.typingSpeed || 0} WPM</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium text-gray-900">
                  {exam.completed ? (
                    <span className="text-green-600">Completed</span>
                  ) : (
                    <span className="text-blue-600">In Progress</span>
                  )}
                  {exam.terminated && (
                    <span className="ml-2 text-red-600">(Terminated)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Session Timeline</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 text-sm text-gray-700">Start</div>
              <div className="flex-shrink-0 w-32 text-sm font-medium text-gray-900">{formatDate(exam.created_at)}</div>
              <div className="ml-4 text-sm text-gray-700">Exam session started</div>
            </div>
            {exam.exam_violations?.map((violation, index) => (
              <div key={violation.id} className="flex items-center">
                <div className="flex-shrink-0 w-12 text-sm text-gray-700">
                  +{Math.floor((new Date(violation.created_at) - new Date(exam.created_at)) / 60000)}m
                </div>
                <div className="flex-shrink-0 w-32 text-sm font-medium text-gray-900">{formatDate(violation.created_at)}</div>
                <div className="ml-4 text-sm text-red-600">{violation.reason}</div>
              </div>
            ))}
            {exam.behavior_logs?.map((log, index) => (
              <div key={log.id} className="flex items-center">
                <div className="flex-shrink-0 w-12 text-sm text-gray-700">
                  +{Math.floor((new Date(log.created_at) - new Date(exam.created_at)) / 60000)}m
                </div>
                <div className="flex-shrink-0 w-32 text-sm font-medium text-gray-900">{formatDate(log.created_at)}</div>
                <div className="ml-4 text-sm text-blue-600">
                  {log.behavior_type} (Risk: {(log.risk_contribution * 100).toFixed(1)}%)
                </div>
              </div>
            ))}
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 text-sm text-gray-700">End</div>
              <div className="flex-shrink-0 w-32 text-sm font-medium text-gray-900">{formatDate(exam.updated_at)}</div>
              <div className="ml-4 text-sm text-gray-700">Exam session ended</div>
            </div>
          </div>
        </div>

        {/* Violations Section */}
        {exam.exam_violations && exam.exam_violations.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Violations</h3>
            <div className="space-y-4">
              {exam.exam_violations.map((violation) => (
                <div key={violation.id} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-red-800">{violation.reason}</h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Risk Score Impact: +{violation.risk_score}
                      </p>
                    </div>
                    <span className="text-sm text-gray-700">{formatDate(violation.created_at)}</span>
                  </div>
                  {violation.details && (
                    <pre className="mt-2 text-sm bg-red-50 p-3 rounded overflow-x-auto text-gray-900 font-mono">
                      {JSON.stringify(violation.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Detection Results */}
        {exam.ai_detection_results && Object.keys(exam.ai_detection_results).length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">AI Detection Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(exam.ai_detection_results).map(([key, result]) => (
                <div key={key} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">Analysis #{key}</h4>
                    <span className={`px-2 py-1 rounded text-sm ${
                      result.isAIGenerated 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {result.isAIGenerated ? 'AI Generated' : 'Human Generated'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-700">Confidence Score</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              result.isAIGenerated ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${result.confidenceScore}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {result.confidenceScore}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{result.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Behavior Logs Section */}
        {exam.behavior_logs && exam.behavior_logs.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Behavior Analysis</h3>
            <div className="space-y-4">
              {exam.behavior_logs.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-blue-800">{log.behavior_type}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Risk Contribution: {(log.risk_contribution * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(log.created_at)}</span>
                  </div>
                  {log.behavior_data && (
                    <pre className="mt-2 text-sm bg-blue-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(log.behavior_data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
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
          <p className="text-white text-lg font-medium tracking-wide">Loading Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
      <div className="relative min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <div className="flex gap-4">
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>

          {/* Completed Sessions Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Completed Sessions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-white/90">
                <thead className="text-white/70 border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Exam ID</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Risk Score</th>
                    <th className="py-3 px-4">Typing Speed</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Completed</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSessions.map((session) => (
                    <tr key={session.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-3 px-4">{session.exam_id}</td>
                      <td className="py-3 px-4">{session.profiles?.email || 'Unknown'}</td>
                      <td className={`py-3 px-4 ${getRiskLevel(session.risk_score).color}`}>
                        {session.risk_score}% ({getRiskLevel(session.risk_score).level})
                      </td>
                      <td className="py-3 px-4">
                        {session.typing_speed_wpm ? `${session.typing_speed_wpm} WPM` : (session.user_details?.typingSpeed ? `${session.user_details.typingSpeed} WPM` : 'N/A')}
                      </td>
                      <td className="py-3 px-4">{Math.floor(session.duration / 60)} minutes</td>
                      <td className="py-3 px-4">{formatDate(session.updated_at)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => fetchExamDetails(session.id)}
                          className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-600"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {completedSessions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-4 text-center text-white/70">
                        No completed sessions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exam Details Modal */}
          {examDetails && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-xl font-semibold">
                    Exam Details - {examDetails.exam_id}
                  </h3>
                  <button
                    onClick={() => setExamDetails(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  {renderExamDetails(examDetails)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}