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
          .from("exam_sessions")
          .select("*")
          .eq("completed", true)
          .order("created_at", { ascending: false });

        console.log('Completed sessions response:', { sessions, error: sessionError });

        if (sessionError) {
          console.error("Error fetching completed sessions:", sessionError.message);
          setCompletedSessions([]);
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

          console.log('Processed completed sessions:', sessionsWithProfiles);
          setCompletedSessions(sessionsWithProfiles);
        } else {
          setCompletedSessions([]);
        }
      } catch (error) {
        console.error("Error in fetchCompletedSessions:", error);
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
    if (score >= 50) return { level: "High", color: "text-red-500" };
    if (score >= 25) return { level: "Medium", color: "text-yellow-500" };
    return { level: "Low", color: "text-green-500" };
  };

  const fetchExamDetails = async (examId) => {
    try {
      console.log('Fetching exam details for:', examId);
      
      // Fetch exam session with all related data
      const { data: examSession, error: sessionError } = await supabase
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
          ),
          admin_warnings (
            id,
            message,
            status,
            created_at
          )
        `)
        .eq('id', examId)
        .single();

      if (sessionError) {
        console.error('Error fetching exam session:', sessionError);
        return;
      }

      // Fetch user profile information with email
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('id', examSession.user_id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      }

      const examWithDetails = {
        ...examSession,
        exam_violations: examSession.exam_violations || [],
        behavior_logs: examSession.behavior_logs || [],
        admin_warnings: examSession.admin_warnings || [],
        user_profile: userProfile || null
      };

      console.log('Processed exam details:', examWithDetails);
      setExamDetails(examWithDetails);
      setSelectedExam(examWithDetails);
    } catch (error) {
      console.error('Error in fetchExamDetails:', error);
    }
  };

  const renderExamDetails = () => {
    if (!examDetails) return null;

    const riskLevel = getRiskLevel(examDetails.risk_score);
    const duration = Math.floor(examDetails.duration / 60);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-lg p-6 mb-6 space-y-8"
      >
        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Exam Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Exam ID</p>
                <p className="font-medium text-gray-900">{examDetails.exam_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Candidate Email</p>
                <p className="font-medium text-gray-900">
                  {examDetails.user_profile?.email || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium text-gray-900">{duration} minutes</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium text-gray-900">
                  {examDetails.completed ? (
                    <span className="text-green-600">Completed</span>
                  ) : (
                    <span className="text-blue-600">In Progress</span>
                  )}
                  {examDetails.terminated && (
                    <span className="ml-2 text-red-600">(Terminated)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Risk Assessment</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full ${
                        riskLevel.level === "High"
                          ? "bg-red-500"
                          : riskLevel.level === "Medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${examDetails.risk_score}%` }}
                    ></div>
                  </div>
                  <span className={`ml-3 font-medium ${riskLevel.color}`}>
                    {examDetails.risk_score}%
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-600">
                  Risk Level: {riskLevel.level}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="font-medium text-gray-900">{examDetails.warnings} warnings issued</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monitoring Level</p>
                <p className="font-medium text-gray-900">{examDetails.monitoring_level}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Session Timeline</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 text-sm text-gray-500">Start</div>
              <div className="flex-shrink-0 w-32 text-sm font-medium">{formatDate(examDetails.created_at)}</div>
              <div className="ml-4 text-sm text-gray-600">Exam session started</div>
            </div>
            {examDetails.exam_violations?.map((violation, index) => (
              <div key={violation.id} className="flex items-center">
                <div className="flex-shrink-0 w-12 text-sm text-gray-500">
                  +{Math.floor((new Date(violation.created_at) - new Date(examDetails.created_at)) / 60000)}m
                </div>
                <div className="flex-shrink-0 w-32 text-sm font-medium">{formatDate(violation.created_at)}</div>
                <div className="ml-4 text-sm text-red-600">{violation.reason}</div>
              </div>
            ))}
            {examDetails.behavior_logs?.map((log, index) => (
              <div key={log.id} className="flex items-center">
                <div className="flex-shrink-0 w-12 text-sm text-gray-500">
                  +{Math.floor((new Date(log.created_at) - new Date(examDetails.created_at)) / 60000)}m
                </div>
                <div className="flex-shrink-0 w-32 text-sm font-medium">{formatDate(log.created_at)}</div>
                <div className="ml-4 text-sm text-blue-600">
                  {log.behavior_type} (Risk: {(log.risk_contribution * 100).toFixed(1)}%)
                </div>
              </div>
            ))}
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 text-sm text-gray-500">End</div>
              <div className="flex-shrink-0 w-32 text-sm font-medium">{formatDate(examDetails.updated_at)}</div>
              <div className="ml-4 text-sm text-gray-600">Exam session ended</div>
            </div>
          </div>
        </div>

        {/* AI Detection Results */}
        {examDetails.ai_detection_results && Object.keys(examDetails.ai_detection_results).length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">AI Detection Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(examDetails.ai_detection_results).map(([key, result]) => (
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
                      <p className="text-sm text-gray-600">Confidence Score</p>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              result.isAIGenerated ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${result.confidenceScore}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          {result.confidenceScore}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{result.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Violations Section */}
        {examDetails.exam_violations && examDetails.exam_violations.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Violations</h3>
            <div className="space-y-4">
              {examDetails.exam_violations.map((violation) => (
                <div key={violation.id} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-red-800">{violation.reason}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Risk Score Impact: +{violation.risk_score}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(violation.created_at)}</span>
                  </div>
                  {violation.details && (
                    <pre className="mt-2 text-sm bg-red-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(violation.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Behavior Logs Section */}
        {examDetails.behavior_logs && examDetails.behavior_logs.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Behavior Analysis</h3>
            <div className="space-y-4">
              {examDetails.behavior_logs.map((log) => (
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
      </motion.div>
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
                onClick={() => router.push("/")}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Back to Home
              </button>
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
                      <td colSpan="6" className="py-4 text-center text-white/70">
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
                  {renderExamDetails()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}