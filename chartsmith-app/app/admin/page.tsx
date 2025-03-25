"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  
  // Redirect to /admin/waitlist
  useEffect(() => {
    router.replace("/admin/waitlist");
  }, [router]);

  // Return null while redirecting
  return null;
}