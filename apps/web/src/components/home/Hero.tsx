"use client";

import { useState, FormEvent } from "react";
import { useClerk } from "@clerk/nextjs";

interface HeroProps {
  onOpenWaitlist: () => void;
}

const Hero = ({}: HeroProps) => {
  const clerk = useClerk();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await clerk.joinWaitlist({ emailAddress: email });
      setIsSuccess(true);
      setEmail("");
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "errors" in err && Array.isArray(err.errors)
          ? err.errors[0]?.message || "Failed to join waitlist. Please try again."
          : "Failed to join waitlist. Please try again.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-white">
      <div className="container px-6 py-20 sm:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Hero Headline - All Caps Sans-serif */}
          <h1 className="text-hero-headline flex flex-col items-center">
            <span>Stay Creative,</span>
            <span className="whitespace-nowrap">We&apos;ll Handle the Chaos.</span>
          </h1>

          {/* Hero Subheadline - Serif font */}
          <p className="text-hero-subheadline max-w-2xl mx-auto">
            Inseam is your brand&apos;s production coordinator co-pilot. We manage the tracking, follow-ups, and timelines so you can focus on your creativity.
          </p>

          {/* Email Form */}
          {isSuccess ? (
            <div className="pt-4">
              <p className="text-lg text-gray-900 font-medium">
                Thanks for signing up! We&apos;ll be in touch soon.
              </p>
            </div>
          ) : (
            <div className="pt-4">
              <p className="text-base font-medium text-gray-900 mb-4">
                Sign Up For Early Access
              </p>
              <form onSubmit={handleSubmit} className="max-w-md mx-auto">
                <div className="flex gap-2 items-end">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="flex-1 px-2 py-3 text-base text-gray-900 placeholder-gray-400 bg-white border-0 border-b-2 border-gray-900 focus:outline-none focus:border-gray-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3 text-base font-medium text-white bg-gray-900 border-2 border-gray-900 hover:bg-white hover:text-gray-900 transition-colors disabled:opacity-50"
                    style={{ fontFamily: 'var(--font-times)' }}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
                {error && (
                  <p className="text-sm text-red-600 mt-2">
                    {error}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
