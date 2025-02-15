"use client";
import React from "react";
import { AuthButtons } from "./AuthButtons";

export function HomeNav() {
  return (
    <div className="p-8 md:p-12">
      <div className="flex justify-end">
        <AuthButtons />
      </div>
    </div>
  );
}
