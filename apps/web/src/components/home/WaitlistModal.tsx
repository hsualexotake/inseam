"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useClerk } from "@clerk/nextjs";
import { useState, FormEvent } from "react";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
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

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    setEmail("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 z-10 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          {/* Custom Waitlist Form */}
          <div className="p-8">
            {isSuccess ? (
              <div className="text-center py-4">
                <h2 className="font-baskerville text-2xl font-normal text-gray-900 mb-3">
                  Thanks for joining!
                </h2>
                <p className="text-base text-gray-600 leading-relaxed mb-6">
                  We&apos;ll be in touch when your spot is ready.
                </p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-white text-base font-medium rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-baskerville text-2xl font-normal text-gray-900 mb-3 text-center">
                  Join the Waitlist
                </h2>
                <p className="text-base text-gray-600 leading-relaxed mb-6 text-center">
                  Enter your email address and we&apos;ll let you know when your spot is ready
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      required
                      className="w-full rounded-lg border border-gray-300 focus:border-[#0d87e1] focus:ring-2 focus:ring-[#0d87e1] text-base px-4 py-3 outline-none transition-colors"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium text-base py-3 px-6 shadow-lg transition-colors"
                  >
                    {isSubmitting ? "Joining..." : "Join the Waitlist"}
                  </button>
                </form>

                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600">
                    Already have access?{" "}
                    <a href="/dashboard" className="text-gray-900 hover:text-[#0d87e1] font-medium transition-colors">
                      Sign in
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
