"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle } from "lucide-react";

function AuthErrorPageContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");

    setError(errorParam);
    setMessage(messageParam);

    console.log("Auth Error:", errorParam);
    console.log("Error Message:", messageParam);
  }, [searchParams]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2 text-red-500">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-2xl font-bold">Authentication Error</h2>
          </div>

          <div className="bg-red-50 p-4 rounded-md border border-red-200 w-full text-left">
            <p className="font-semibold">Error Type:</p>
            <p className="text-sm text-red-700 mb-2">{error || "Unknown error"}</p>

            {message && (
              <>
                <p className="font-semibold">Error Details:</p>
                <p className="text-sm text-red-700 break-words">{message}</p>
              </>
            )}
          </div>

          <div className="flex flex-col space-y-2 w-full">
            <p className="text-sm text-muted-foreground">
              There was a problem with the authentication process. Please try again or contact support if the issue persists.
            </p>

            <Link href="/" className="w-full">
              <Button className="w-full">Return to Home</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorPageContent />
    </Suspense>
  );
}
