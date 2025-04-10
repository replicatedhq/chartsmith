"use client";

import React, { useState, useEffect } from "react";

// Constants for deployment time and version (these will be written during the build process)
// BEGIN AUTOMATED REPLACE
const DEPLOY_TIME: string = "UNKNOWN";
const VERSION: string = "0.0.0";
// END AUTOMATED REPLACE

export default function DebugPage() {
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setPublicEnv(data);
      } catch (err) {
        console.error("Failed to load public env config:", err);
      }
    };

    fetchConfig();
  }, []);

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
                <td className="px-4 py-2 border-b">VERSION</td>
                <td className="px-4 py-2 border-b">{VERSION}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b align-top">Public Environment Variables</td>
                <td className="px-4 py-2 border-b">
                  <table className="table-auto w-full text-left border-collapse">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 border-b">Name</th>
                        <th className="px-4 py-2 border-b">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(publicEnv).map(([key, value]) => (
                        <tr key={key}>
                          <td className="px-4 py-2 border-b">{key}</td>
                          <td className="px-4 py-2 border-b">{value}</td>
                        </tr>
                      ))}
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