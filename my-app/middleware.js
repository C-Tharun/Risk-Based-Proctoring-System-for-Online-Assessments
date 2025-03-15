import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function middleware(req) {
  const { data: session } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isCandidateRoute = req.nextUrl.pathname.startsWith("/candidate");

  if (isAdminRoute && profile.role !== "admin") {
    return NextResponse.redirect("/candidate");
  }

  if (isCandidateRoute && profile.role !== "candidate") {
    return NextResponse.redirect("/admin");
  }

  return NextResponse.next();
}