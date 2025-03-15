"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();

      if (data?.session?.user) {
        const userId = data.session.user.id;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();

        if (profile && !profileError) {
          router.replace(profile.role === "admin" ? "/admin" : "/candidate");
          return;
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

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
          <p className="text-white text-lg font-medium tracking-wide">Redirecting...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
      
      {/* Main Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center max-w-4xl mx-auto mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-7xl font-black mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white tracking-tight">
            Risk-Based Proctoring
          </h1>
          <div className="space-y-4">
            <p className="text-2xl text-blue-50 font-light max-w-2xl mx-auto leading-relaxed">
              Ensure academic integrity with our intelligent proctoring system
            </p>
            <p className="text-lg text-blue-100/80 max-w-xl mx-auto font-light">
              Advanced AI-powered monitoring for secure online assessments
            </p>
          </div>
        </motion.div>

        {/* Login Options */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Admin Login */}
          <motion.div 
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg p-8 hover:bg-white/20 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/auth/login?role=admin")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="w-14 h-14 bg-blue-500 rounded-xl mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Admin Login</h2>
              <p className="text-blue-50/90 mb-6 text-sm font-light leading-relaxed">For exam supervisors & administrators</p>
              <button className="w-full px-6 py-3.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors duration-300 flex items-center justify-center gap-2 font-medium tracking-wide">
                <span>Admin Login</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Candidate Login */}
          <motion.div 
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg p-8 hover:bg-white/20 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/auth/login?role=candidate")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="w-14 h-14 bg-purple-500 rounded-xl mb-6 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Candidate Login</h2>
              <p className="text-blue-50/90 mb-6 text-sm font-light leading-relaxed">For students taking online assessments</p>
              <button className="w-full px-6 py-3.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors duration-300 flex items-center justify-center gap-2 font-medium tracking-wide">
                <span>Candidate Login</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Sign Up Option */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="text-blue-50/90 text-lg font-light">
            New user?{" "}
            <button
              onClick={() => router.push("/auth/signup")}
              className="text-yellow-300 font-medium hover:text-yellow-200 transition-colors duration-300 inline-flex items-center gap-1.5 group"
            >
              Sign Up
              <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}