"use client"

import { useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/toast/use-toast"
import { Card } from "@/components/ui/Card"
import { exchangeGoogleCodeForSession } from "@/lib/auth/actions/exchange-google-code"

function GoogleCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const exchangeComplete = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')

    if (!code) {
      router.push('/auth/error')
      return
    }

    if (!exchangeComplete.current) {
      exchangeComplete.current = true

      exchangeGoogleCodeForSession(code)
      .then(jwt => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        document.cookie = `session=${jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
        
        window.location.href = '/';
      })
      .catch(error => {
        console.error('Auth Error:', error)
        router.push('/auth/error')
      })
    }
  }, [searchParams, router, toast])

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <h2 className="text-2xl font-bold">Logging you in</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Please wait while we complete your Google log in...
          </p>
        </div>
      </Card>
    </div>
  )
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Loading...</p>
          </div>
        </Card>
      </div>
    }>
      <GoogleCallback />
    </Suspense>
  )
}
