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
        const { data, error } = await supabase
          .from("exam_sessions")
          .select(`
            *,
            user:user_id (
              id,
              email
            )
          `)
          .eq("completed", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching active sessions:", error.message);
          return;
        }
        setActiveSessions(data || []);
      } catch (error) {
        console.error("Error in fetchActiveSessions:", error);
      }
    };

    // Fetch completed exam sessions
    const fetchCompletedSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("exam_sessions")
          .select(`
            *,
            user:user_id (
              id,
              email
            )
          `)
          .eq("completed", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching completed sessions:", error.message);
          return;
        }
        setCompletedSessions(data || []);
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
                  router.push("/auth/login");
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

          {/* Active Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Active Exam Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSessions.length === 0 ? (
                <div className="col-span-full bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center">
                  <p className="text-blue-50/90">No active exam sessions at the moment.</p>
                </div>
              ) : (
                activeSessions.map((session) => {
                  const riskLevel = getRiskLevel(session.risk_score);
                  return (
                    <div
                      key={session.id}
                      className="bg-white/10 backdrop-blur-lg rounded-2xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {session.user.email}
                          </h3>
                          <p className="text-blue-50/70 text-sm">
                            Started: {new Date(session.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${riskLevel.color}`}>
                            {riskLevel.level}
                          </p>
                          <p className="text-blue-50/70 text-sm">
                            Score: {session.risk_score}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <p className="text-blue-50/90 text-sm">
                          Warnings: {session.warnings}
                        </p>
                        <p className="text-blue-50/90 text-sm">
                          Time Remaining: {Math.floor(session.duration / 60)} minutes
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendWarning(session.id, session.user_id)}
                          className="flex-1 bg-yellow-500 text-white rounded-xl py-2 font-medium hover:bg-yellow-600 transition-colors duration-300"
                        >
                          Send Warning
                        </button>
                        <button
                          onClick={() => handleForceLogout(session.user_id)}
                          className="flex-1 bg-red-500 text-white rounded-xl py-2 font-medium hover:bg-red-600 transition-colors duration-300"
                        >
                          Force Logout
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Completed Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Completed Exam Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedSessions.length === 0 ? (
                <div className="col-span-full bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center">
                  <p className="text-blue-50/90">No completed exam sessions yet.</p>
                </div>
              ) : (
                completedSessions.map((session) => {
                  const riskLevel = getRiskLevel(session.risk_score);
                  return (
                    <div
                      key={session.id}
                      className="bg-white/10 backdrop-blur-lg rounded-2xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {session.user.email}
                          </h3>
                          <p className="text-blue-50/70 text-sm">
                            Completed: {new Date(session.updated_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${riskLevel.color}`}>
                            {riskLevel.level}
                          </p>
                          <p className="text-blue-50/70 text-sm">
                            Score: {session.risk_score}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-blue-50/90 text-sm">
                          Warnings: {session.warnings}
                        </p>
                        <p className="text-blue-50/90 text-sm">
                          Duration: {Math.floor(session.duration / 60)} minutes
                        </p>
                        <p className="text-blue-50/90 text-sm">
                          Status: {session.terminated ? "Terminated" : "Completed"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}