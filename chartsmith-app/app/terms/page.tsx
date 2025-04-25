"use client";

import React from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { HomeNav } from "@/components/HomeNav";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/Card";

export default function TermsOfServicePage() {
  const { theme } = useTheme();
  
  // Local styles to override the global .prose li styling
  const customStyles = `
    /* Ensure list items match paragraph text size at all breakpoints */
    .terms-content .prose li {
      /* Match exactly the Tailwind text-base class */
      font-size: 0.875rem !important; /* Start with smaller size for very narrow screens */
    }
    
    /* Match Tailwind's responsive breakpoints */
    @media (min-width: 375px) {
      .terms-content .prose li {
        font-size: 0.9375rem !important; /* Slightly larger */
      }
    }
    
    @media (min-width: 640px) {
      .terms-content .prose li {
        font-size: 1rem !important; /* Match text-base at sm breakpoint */
      }
    }
    
    @media (min-width: 768px) {
      .terms-content .prose li {
        font-size: 1.125rem !important; /* Match text-lg at md breakpoint */
      }
    }
    
    /* Remove any other font size rules from the list markers */
    .terms-content .prose li::marker {
      font-size: 1em !important;
    }
  `;

  return (
    <div className="min-h-screen bg-[var(--background)] terms-content">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
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
          Terms of Service
        </h1>
        
        <Card className="p-6 md:p-8 prose dark:prose-invert max-w-none text-base sm:text-lg [&_li]:mb-2">
          <p className="text-base text-gray-500 mb-8">Last Updated: April 1, 2025</p>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you and Replicated ChartSmith 
              (&ldquo;ChartSmith,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) governing your access to and use of the ChartSmith website and services 
              (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the 
              Terms, you may not access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Accounts and Registration</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current information. You are responsible 
              for safeguarding the password and for all activities that occur under your account.
            </p>
            <p>
              You agree to notify us immediately of any unauthorized access to or use of your account. We reserve the right to 
              terminate accounts, remove or edit content, or cancel services at our sole discretion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Use of the Service</h2>
            <h3 className="text-xl font-medium mb-3">3.1 Permitted Use</h3>
            <p>
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree to use the Service 
              in compliance with all applicable laws, rules, and regulations.
            </p>
            
            <h3 className="text-xl font-medium mb-3">3.2 Prohibited Activities</h3>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 text-lg sm:text-xl">
              <li className="mb-2">Use the Service in any way that violates any applicable law or regulation</li>
              <li className="mb-2">Use the Service to transmit or upload harmful code or malware</li>
              <li>Attempt to gain unauthorized access to the Service or related systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Engage in any activity that could disable, overburden, or impair the Service</li>
              <li>Use any data mining, robots, or similar data gathering methods</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are and will remain the exclusive property of 
              ChartSmith and its licensors. The Service is protected by copyright, trademark, and other laws.
            </p>
            <p>
              Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. User Content</h2>
            <p>
              When you upload, submit, store, send, or receive content through our Service, you give ChartSmith a worldwide license 
              to use, host, store, reproduce, modify, create derivative works, communicate, publish, publicly perform, publicly display, 
              and distribute such content.
            </p>
            <p>
              You retain ownership of any intellectual property rights that you hold in that content. You are responsible for any 
              content you submit, and you represent and warrant that you have all necessary rights to do so.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services that are not owned or controlled by ChartSmith. 
              We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party 
              websites or services.
            </p>
            <p>
              You further acknowledge and agree that ChartSmith shall not be responsible or liable, directly or indirectly, for any 
              damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods, 
              or services available on or through any such websites or services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for 
              any reason whatsoever, including without limitation if you breach the Terms.
            </p>
            <p>
              All provisions of the Terms which by their nature should survive termination shall survive termination, including, without 
              limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Disclaimer</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, 
              BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE 
              OF PERFORMANCE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p>
              IN NO EVENT SHALL CHARTSMITH, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES, BE LIABLE FOR ANY 
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, 
              USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE 
              SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; AND 
              (IV) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT 
              (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of changes 
              by posting the updated terms on this page. Your continued use of the Service after any such changes constitutes your acceptance 
              of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of the United States and the State of Washington, 
              without regard to its conflict of law provisions.
            </p>
            <p>
              Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision 
              of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p>
              <a href="mailto:legal@replicated.com" className="text-primary">legal@replicated.com</a>
            </p>
          </section>
        </Card>
      </main>

      <Footer />
    </div>
  );
}