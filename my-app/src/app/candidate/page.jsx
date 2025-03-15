"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function CandidateExam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!data || !data.session || !data.session.user) {
        router.push("/auth/login");
        return;
      }

      const userId = data.session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        router.push("/auth/login");
      } else {
        setUser({ id: userId, email: data.session.user.email, role: profile.role });
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/");
    } catch (error) {
      console.error("Error signing out:", error.message);
    }
  };

  const startExam = () => {
    router.push("/candidate/exam");
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
          <p className="text-white text-lg font-medium tracking-wide">Loading Exam Interface...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
      
      {/* Main Content */}
      <div className="relative min-h-screen px-6 py-12">
        {/* Header */}
        <motion.div 
          className="max-w-7xl mx-auto mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">Exam Interface</h1>
              <p className="text-blue-50/90 mt-2 font-light">
                Welcome, <span className="font-medium text-white">{user?.email}</span>
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </motion.div>

        {/* Exam Content */}
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Exam Status Card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Exam Status</h2>
                  <p className="text-blue-50/90 text-sm">Ready to begin</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">Time Remaining</p>
                <p className="text-2xl font-bold text-green-400">120:00</p>
              </div>
            </div>
          </div>

          {/* Exam Instructions */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Instructions</h3>
            <ul className="space-y-3 text-blue-50/90">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Ensure your camera and microphone are working properly</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Keep your face visible to the camera throughout the exam</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Do not switch browser tabs or windows</span>
              </li>
            </ul>
          </div>

          {/* Start Exam Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startExam}
            className="w-full bg-green-500 text-white rounded-xl py-4 font-medium text-lg hover:bg-green-600 transition-colors duration-300 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Exam
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}