import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { XCircle } from "lucide-react"
import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            <XCircle className="h-8 w-8 text-red-500" />
            <h2 className="text-2xl font-bold">Authentication Failed</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            We were unable to sign you in with GitHub. Please try again or contact support if the problem persists.
          </p>

          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="outline">Back to Log In</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
