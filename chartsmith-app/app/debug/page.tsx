"use client";

import React from "react";

// Constants for deployment time and version (these will be written during the build process)

// BEGIN AUTOMATED REPLACE
const DEPLOY_TIME = "UNKNOWN";
const VERSION = "0.0.0";
// END AUTOMATED REPLACE

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[80%] min-w-[600px] w-full bg-card shadow-lg rounded-lg p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-foreground">Debug Information</h2>
        </div>
        <div className="border-t border-border pt-4">
          <table className="table-auto w-full text-left border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 border-b border-border">Name</th>
                <th className="px-4 py-2 border-b border-border">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 border-b border-border">DEPLOY_TIME (UTC)</td>
                <td className="px-4 py-2 border-b border-border">{DEPLOY_TIME}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b border-border">DEPLOY_TIME (Local)</td>
                <td className="px-4 py-2 border-b border-border">
                  {DEPLOY_TIME !== "UNKNOWN" ? (
                    new Date(DEPLOY_TIME).toLocaleString()
                  ) : (
                    <span className="text-gray-500">
                      {new Date().toLocaleString()} (current time - deploy time unknown)
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">VERSION</td>
                <td className="px-4 py-2 border-b">{VERSION}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">Public Environment Variables</td>
                <td className="px-4 py-2 border-b">
                  <table className="table-auto w-full text-left border-collapse">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 border-b">Name</th>
                        <th className="px-4 py-2 border-b">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-2 border-b">NEXT_PUBLIC_CENTRIFUGO_ADDRESS</td>
                        <td className="px-4 py-2 border-b">{process.env.NEXT_PUBLIC_CENTRIFUGO_ADDRESS}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 border-b">NEXT_PUBLIC_GOOGLE_CLIENT_ID</td>
                        <td className="px-4 py-2 border-b">{process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 border-b">NEXT_PUBLIC_GOOGLE_REDIRECT_URI</td>
                        <td className="px-4 py-2 border-b">{process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
