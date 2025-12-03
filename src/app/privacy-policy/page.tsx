"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="z-10 w-full max-w-4xl">
        <GlassCard className="w-full">
          <div className="mb-6">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 mb-2">
              Privacy Policy
            </h1>
            <p className="text-white/70 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/90">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">1. Introduction</h2>
              <p className="text-white/80 leading-relaxed">
                Review Manager ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application for managing code reviews.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">2. Information We Collect</h2>
              <div className="space-y-3 text-white/80">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">2.1 Authentication Information</h3>
                  <p className="leading-relaxed">
                    When you sign in with Google OAuth, we collect:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                    <li>Your email address</li>
                    <li>Your display name</li>
                    <li>Your profile picture (if available)</li>
                    <li>Google account ID</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">2.2 Review Data</h3>
                  <p className="leading-relaxed">
                    We store information related to your code reviews, including:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                    <li>Review room names and identifiers</li>
                    <li>Review items (pending, reviewed, done)</li>
                    <li>User assignments and permissions</li>
                    <li>Room settings and configurations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">2.3 Google Chat Integration (Optional)</h3>
                  <p className="leading-relaxed">
                    If you use Google Workspace and enable Google Chat integration, we may access:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                    <li>Google Chat space members (with read-only access)</li>
                    <li>Webhook URLs for notifications</li>
                  </ul>
                  <p className="leading-relaxed mt-2">
                    This integration requires explicit permission and is only available for Google Workspace accounts.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
              <p className="text-white/80 leading-relaxed mb-3">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 text-white/80">
                <li>To provide and maintain our service</li>
                <li>To authenticate and authorize your access to review rooms</li>
                <li>To manage review assignments and track review status</li>
                <li>To send notifications via Google Chat (if enabled)</li>
                <li>To improve and optimize our application</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">4. Data Storage and Security</h2>
              <div className="space-y-3 text-white/80">
                <p className="leading-relaxed">
                  Your data is stored securely using Firebase (Google Cloud Platform), which provides:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                  <li>Encryption in transit and at rest</li>
                  <li>Access controls and authentication</li>
                  <li>Regular security audits and compliance certifications</li>
                </ul>
                <p className="leading-relaxed mt-3">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">5. Data Sharing and Disclosure</h2>
              <p className="text-white/80 leading-relaxed mb-3">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 text-white/80">
                <li><strong>With your consent:</strong> When you explicitly authorize sharing (e.g., adding users to a review room)</li>
                <li><strong>Service providers:</strong> With trusted third-party services (Firebase, Google Cloud) that help us operate our application</li>
                <li><strong>Legal requirements:</strong> When required by law or to protect our rights and safety</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">6. Your Rights and Choices</h2>
              <p className="text-white/80 leading-relaxed mb-3">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 text-white/80">
                <li><strong>Access:</strong> You can view your data through the application interface</li>
                <li><strong>Deletion:</strong> You can request deletion of your account and associated data</li>
                <li><strong>Correction:</strong> You can update your information through your Google account settings</li>
                <li><strong>Opt-out:</strong> You can revoke Google OAuth permissions at any time through your Google account settings</li>
              </ul>
              <p className="leading-relaxed mt-3">
                To exercise these rights, please contact us or use the account management features in the application.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">7. Third-Party Services</h2>
              <div className="space-y-3 text-white/80">
                <p className="leading-relaxed">
                  Our application integrates with the following third-party services:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
                  <li><strong>Google OAuth:</strong> For authentication. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google's Privacy Policy</a></li>
                  <li><strong>Firebase:</strong> For data storage and hosting. See <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Firebase Privacy Policy</a></li>
                  <li><strong>Google Chat API:</strong> For notifications (optional, Workspace only). See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google's Privacy Policy</a></li>
                </ul>
                <p className="leading-relaxed mt-3">
                  These services have their own privacy policies, and we encourage you to review them.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">8. Data Retention</h2>
              <p className="text-white/80 leading-relaxed">
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy. When you delete your account or request data deletion, we will remove your personal information from our systems, except where we are required to retain it for legal or regulatory purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">9. Children's Privacy</h2>
              <p className="text-white/80 leading-relaxed">
                Our service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">10. Changes to This Privacy Policy</h2>
              <p className="text-white/80 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">11. Contact Us</h2>
              <p className="text-white/80 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us through the application or via the project repository.
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <Link href="/">
              <GlassButton className="w-full">
                Back to Home
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}


