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

  useEffect(() => {
    if (!user) return;

    // Fetch active exam sessions
    const fetchActiveSessions = async () => {
      try {
        // First fetch exam sessions
        const { data: sessions, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("*")
          .eq("completed", false)
          .order("created_at", { ascending: false });

        if (sessionError) {
          console.error("Error fetching active sessions:", sessionError.message);
          return;
        }

        // Then fetch user details for these sessions
        if (sessions && sessions.length > 0) {
          const userIds = [...new Set(sessions.map(session => session.user_id))];
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          if (profileError) {
            console.error("Error fetching user profiles:", profileError.message);
            return;
          }

          // Combine the data
          const sessionsWithProfiles = sessions.map(session => ({
            ...session,
            profiles: profiles.find(profile => profile.id === session.user_id)
          }));

          console.log("Active sessions with profiles:", sessionsWithProfiles);
          setActiveSessions(sessionsWithProfiles);
        } else {
          setActiveSessions([]);
        }
      } catch (error) {
        console.error("Error in fetchActiveSessions:", error);
      }
    };

    // Fetch completed exam sessions
    const fetchCompletedSessions = async () => {
      try {
        // First fetch completed sessions
        const { data: sessions, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("*")
          .eq("completed", true)
          .order("created_at", { ascending: false });

        if (sessionError) {
          console.error("Error fetching completed sessions:", sessionError.message);
          return;
        }

        // Then fetch user details for these sessions
        if (sessions && sessions.length > 0) {
          const userIds = [...new Set(sessions.map(session => session.user_id))];
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          if (profileError) {
            console.error("Error fetching user profiles:", profileError.message);
            return;
          }

          // Combine the data
          const sessionsWithProfiles = sessions.map(session => ({
            ...session,
            profiles: profiles.find(profile => profile.id === session.user_id)
          }));

          console.log("Completed sessions with profiles:", sessionsWithProfiles);
          setCompletedSessions(sessionsWithProfiles);
        } else {
          setCompletedSessions([]);
        }
      } catch (error) {
        console.error("Error in fetchCompletedSessions:", error);
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
        // Get all users from profiles table who are not admins
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'candidate')
          .order('id', { ascending: false });

        if (profileError) {
          console.error("Error fetching profiles:", profileError.message);
          return;
        }

        if (!profiles || profiles.length === 0) {
          console.log("No candidate profiles found");
          setUsers([]);
          return;
        }

        // Set the profiles directly
        console.log("Found users:", profiles);
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
          )
        `)
        .eq('id', examId)
        .single();

      if (sessionError) {
        console.error('Error fetching exam session:', sessionError);
        return;
      }

      console.log('Exam session with details:', examSession);

      const examWithDetails = {
        ...examSession,
        exam_violations: examSession.exam_violations || [],
        behavior_logs: examSession.behavior_logs || []
      };

      console.log('Processed exam details:', examWithDetails);
      setExamDetails(examWithDetails);
      setSelectedExam(examWithDetails);
    } catch (error) {
      console.error('Error in fetchExamDetails:', error);
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
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight">Admin Dashboard</h1>
                <p className="text-blue-50/90 mt-2 font-light">
                  Welcome back, <span className="font-medium text-white">{user?.email}</span>
                </p>
              </div>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/");
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-6">
            {/* User List Sidebar */}
            <div className="col-span-3">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Users</h2>
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleViewUserDetails(user)}
                      className={`w-full text-left p-3 rounded-xl transition-colors ${
                        selectedCandidate?.id === user.id
                          ? 'bg-white/20 text-white'
                          : 'text-blue-50/90 hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium truncate">{user.email}</p>
                      <p className="text-sm text-blue-50/70">{user.role}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Exam List and Details */}
            <div className="col-span-9">
              {selectedCandidate ? (
                <div className="space-y-6">
                  {/* User Info Header */}
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedCandidate.email}</h2>
                        <p className="text-blue-50/70">
                          Joined: {formatDate(selectedCandidate.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-50/90">Role: {selectedCandidate.role}</p>
                        <p className="text-blue-50/70 text-sm">
                          Last Active: {formatDate(selectedCandidate.last_sign_in_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exam List */}
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Exam History</h3>
                    {userTestHistory.length === 0 ? (
                      <p className="text-blue-50/90">No exams taken yet. The user has not participated in any assessments.</p>
                    ) : (
                      <div className="space-y-4">
                        {userTestHistory.map((exam) => (
                          <div
                            key={exam.id}
                            className={`p-4 rounded-xl transition-colors cursor-pointer ${
                              selectedExam?.id === exam.id
                                ? 'bg-white/20'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                            onClick={() => fetchExamDetails(exam.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-white font-medium">
                                  {exam.exam_details?.name || `Exam ID: ${exam.exam_id}`}
                                </p>
                                <p className="text-blue-50/70 text-sm">
                                  Started: {formatDate(exam.created_at)}
                                </p>
                                <p className="text-blue-50/70 text-sm">
                                  Status: {exam.terminated ? 'Terminated' : (exam.completed ? 'Completed' : 'In Progress')}
                                </p>
                                <p className="text-blue-50/70 text-sm">
                                  Duration: {Math.floor((exam.duration || 0) / 60)} minutes
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${getRiskLevel(exam.risk_score || 0).color}`}>
                                  Risk Level: {getRiskLevel(exam.risk_score || 0).level}
                                </p>
                                <p className="text-blue-50/70 text-sm">
                                  Score: {exam.score || 'N/A'}
                                </p>
                                <p className="text-blue-50/70 text-sm">
                                  Violations: {exam.exam_violations?.length || 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Exam Details */}
                  {selectedExam && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Exam Details</h3>
                        {selectedExam.completed === false && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSendWarning(selectedExam.id, selectedExam.user_id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg transition-colors"
                            >
                              Send Warning
                            </button>
                            <button
                              onClick={() => handleForceLogout(selectedExam.user_id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                            >
                              Terminate Session
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-2">Basic Information</h4>
                          <div className="space-y-2 text-blue-50/90">
                            <p>Exam: {selectedExam.exam?.name || `ID: ${selectedExam.exam_id}`}</p>
                            <p>Duration: {Math.floor(selectedExam.duration / 60)} minutes</p>
                            <p>Status: {selectedExam.terminated ? 'Terminated' : (selectedExam.completed ? 'Completed' : 'In Progress')}</p>
                            <p>Started: {formatDate(selectedExam.created_at)}</p>
                            <p>Completed: {selectedExam.completed ? formatDate(selectedExam.completed_at) : 'Not completed'}</p>
                            <p>Score: {selectedExam.score || 'N/A'}</p>
                            <p>Warnings: {selectedExam.warnings || 0}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-2">Risk Assessment</h4>
                          <div className={`text-lg font-bold ${getRiskLevel(selectedExam.risk_score || 0).color} mb-2`}>
                            {getRiskLevel(selectedExam.risk_score || 0).level} Risk Level
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                            <div
                              className={`h-full rounded-full ${
                                selectedExam.risk_score >= 50
                                  ? 'bg-red-500'
                                  : selectedExam.risk_score >= 25
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, selectedExam.risk_score || 0)}%` }}
                            />
                          </div>
                          <div className="mt-4">
                            <p className="text-blue-50/90">Total Violations: {selectedExam.exam_violations?.length || 0}</p>
                            <p className="text-blue-50/90">Behavior Events: {selectedExam.behavior_logs?.length || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Violations */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-white mb-2">Violations</h4>
                        {selectedExam.exam_violations && selectedExam.exam_violations.length > 0 ? (
                          <div className="space-y-3">
                            {selectedExam.exam_violations.map((violation) => (
                              <div key={violation.id} className="bg-white/5 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-white font-medium">{violation.reason}</p>
                                  <p className={`font-bold ${getRiskLevel(violation.risk_score).color}`}>
                                    Risk: {violation.risk_score}
                                  </p>
                                </div>
                                <p className="text-blue-50/70 text-sm">
                                  Time: {new Date(violation.created_at).toLocaleString()}
                                </p>
                                {violation.details && (
                                  <div className="mt-2 text-sm text-blue-50/90">
                                    <pre className="whitespace-pre-wrap">{JSON.stringify(violation.details, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-blue-50/90">No violations recorded</p>
                        )}
                      </div>

                      {/* Behavior Logs */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-2">Behavior Timeline</h4>
                        {selectedExam.behavior_logs && selectedExam.behavior_logs.length > 0 ? (
                          <div className="space-y-3">
                            {selectedExam.behavior_logs.map((log) => (
                              <div key={log.id} className="bg-white/5 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-white font-medium">{log.behavior_type}</p>
                                  <p className="text-blue-50/70">
                                    Risk Contribution: {log.risk_contribution}
                                  </p>
                                </div>
                                <p className="text-blue-50/70 text-sm">
                                  Time: {new Date(log.created_at).toLocaleString()}
                                </p>
                                {log.details && (
                                  <div className="mt-2 text-sm text-blue-50/90">
                                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-blue-50/90">No behavior logs recorded</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center">
                  <p className="text-blue-50/90">Select a user to view their exam history</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}