"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const roleFromParams = searchParams.get("role");
    if (roleFromParams) {
      setRole(roleFromParams);
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!role) {
      setMessage({ text: "Role is missing from the URL. Please go back and select a role.", type: "error" });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: error.message, type: "error" });
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setMessage({ text: "User not found.", type: "error" });
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile || profileError) {
      setMessage({ text: "User role not found. Please sign up again.", type: "error" });
      setLoading(false);
      return;
    }

    if (profile.role !== role) {
      setMessage({ text: `Invalid login. You are registered as an ${profile.role}.`, type: "error" });
      setLoading(false);
      return;
    }

    // ✅ Instant Redirect
    router.replace(profile.role === "admin" ? "/admin" : "/candidate");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 text-white px-6">
      <motion.div
        className="bg-white text-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-3xl font-bold text-center text-blue-600">
          {role === "admin" ? "Admin Login" : "Candidate Login"}
        </h2>
        <p className="text-center text-gray-600 mt-2">Access your account</p>

        {/* Display Error Messages */}
        {message.text && (
          <motion.p
            className={`mt-4 text-center px-4 py-2 rounded-lg ${
              message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {message.text}
          </motion.p>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-6">
          <div>
            <label className="block text-gray-700 font-medium">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Styled Login Button */}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Don't have an account?  
          <button
            onClick={() => router.push("/auth/signup")}
            className="text-blue-600 font-semibold hover:underline ml-1"
          >
            Sign Up
          </button>
        </p>
      </motion.div>
    </div>
  );
}