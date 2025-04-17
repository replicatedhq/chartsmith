"use client";

import React from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { HomeNav } from "@/components/HomeNav";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/Card";

export default function PrivacyPolicyPage() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <HomeNav />

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center mb-4">
          <Link href="/" className="text-primary hover:underline flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Return Home
          </Link>
        </div>
        
        <h1 className={`text-2xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          Privacy Policy
        </h1>
        
        <Card className="p-6 md:p-8 prose dark:prose-invert max-w-none text-base sm:text-lg prose-li:text-base sm:prose-li:text-lg [&_li]:mb-2">
          <p className="text-base text-gray-500 mb-8">Last Updated: April 1, 2025</p>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
            <p>
              Replicated ChartSmith (&ldquo;ChartSmith,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
              visit our website or use our services.
            </p>
            <p>
              We collect information to provide, maintain, and improve our services, and to comply with legal obligations. 
              By accessing or using ChartSmith, you consent to this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
            
            <h3 className="text-xl font-medium mb-3">Personal Information</h3>
            <p>We may collect personal information, including but not limited to:</p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li>Name and contact information</li>
              <li>Account credentials</li>
              <li>Usage information</li>
              <li>Communication information</li>
            </ul>
            
            <h3 className="text-xl font-medium mb-3">Technical Information</h3>
            <p>We may also collect certain technical information, including:</p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li>IP address</li>
              <li>Device information</li>
              <li>Browser type and settings</li>
              <li>System and performance information</li>
              <li>Usage patterns and interaction with our services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
            <p>We may use your information for various purposes, including:</p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li>Providing and maintaining our services</li>
              <li>Responding to your requests and inquiries</li>
              <li>Improving our services and user experience</li>
              <li>Complying with legal obligations</li>
              <li>Protecting our rights and preventing fraud</li>
              <li>Communicating with you about updates and offerings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Information Sharing and Disclosure</h2>
            <p>
              We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li>With service providers who perform services on our behalf</li>
              <li>For legal compliance or to protect rights</li>
              <li>In connection with a merger, sale, or acquisition</li>
              <li>With your consent or at your direction</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Rights and Choices</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction or objection to certain processing</li>
              <li>Data portability</li>
            </ul>
            <p>
              To exercise these rights, please contact us at <a href="mailto:privacy@replicated.com" className="text-primary">privacy@replicated.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information. 
              However, no method of transmission over the Internet or electronic storage is 100% secure, 
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Third-Party Links</h2>
            <p>
              Our services may contain links to third-party websites or services. We are not responsible for 
              the content or privacy practices of these third parties. We encourage you to review the privacy 
              policies of any third-party sites you visit.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Changes to this Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the &ldquo;Last Updated&rdquo; date. You are advised to review 
              this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p>
              <a href="mailto:privacy@replicated.com" className="text-primary">privacy@replicated.com</a>
            </p>
          </section>
        </Card>
      </main>

      <Footer />
    </div>
  );
}