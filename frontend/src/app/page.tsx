"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin h-10 w-10 border-4 border-brand-600 border-t-transparent rounded-full"></div>
    </main>
  );
}
