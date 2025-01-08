"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { exchangeReplicatedAuth } from "@/lib/auth/actions/exchange-replicated-nonce";
import { useSession } from "@/app/hooks/useSession";

function ReplicatedCallback() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const exchangeComplete = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!session) {
      return;
    }

    const nonce = searchParams.get("nonce");
    const exchange = searchParams.get("exchange");

    if (!nonce || !exchange) {
      console.error("Missing required auth parameters");
      setStatus('error');
      return;
    }

    if (!exchangeComplete.current) {
      exchangeComplete.current = true;
      exchangeReplicatedAuth(session, nonce, exchange).then((success) => {
        setStatus(success ? 'success' : 'error');
      });
    }
  }, [searchParams, session]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          {status === 'loading' && (
            <>
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <h2 className="text-2xl font-bold">Connecting to Replicated</h2>
              </div>
              <p className="text-sm text-muted-foreground">Please wait while we complete connecting your Replicated account...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <h2 className="text-2xl font-bold">Account Linked</h2>
              </div>
              <p className="text-sm text-muted-foreground">Your Replicated account has been successfully connected.</p>
              <Link
                href="/"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                Continue to Dashboard
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="flex items-center space-x-2">
                <XCircle className="h-6 w-6 text-red-500" />
                <h2 className="text-2xl font-bold">Connection Failed</h2>
              </div>
              <p className="text-sm text-muted-foreground">There was an error connecting your Replicated account. Please try again.</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ReplicatedCallbackPage() {
  return <ReplicatedCallback />;
}
