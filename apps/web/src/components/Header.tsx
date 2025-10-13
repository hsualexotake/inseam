"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Logo from "./common/Logo";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { UserNav } from "./common/UserNav";

interface HeaderProps {
  onOpenWaitlist?: () => void;
}

export default function Header({ onOpenWaitlist }: HeaderProps) {
  const { user } = useUser();

  return (
    <Disclosure as="nav" className=" ">
      {({ open }) => (
        <>
          <div className="flex items-center bg-white h-16 sm:h-20">
            <div className="container px-2 sm:px-0">
              <div className="relative flex h-16 items-center justify-between">
                <div className="flex sm:hidden shrink-0 items-center">
                  <Logo isMobile={true} />
                </div>
                <div className="sm:flex hidden shrink-0 items-center">
                  <Logo />
                </div>
                <div className="flex-1"></div>
                {user ? (
                  <div className="hidden sm:flex absolute inset-y-0 right-0 gap-4 items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                    <Link href="/dashboard">
                      <button
                        type="button"
                        className="px-6 py-2.5 text-white text-base font-medium rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
                      >
                        Dashboard
                      </button>
                    </Link>
                    <UserNav
                      image={user?.imageUrl}
                      name={user?.fullName ?? 'User'}
                      email={user?.primaryEmailAddress?.emailAddress ?? ''}
                    />
                  </div>
                ) : (
                  <div className="hidden sm:flex absolute inset-y-0 right-0 gap-4 items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                    {onOpenWaitlist ? (
                      <button
                        onClick={onOpenWaitlist}
                        className="px-6 py-2.5 text-white text-base font-medium rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
                      >
                        Join Waitlist
                      </button>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="px-6 py-2.5 text-white text-base font-medium rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
                      >
                        Get Started
                      </Link>
                    )}
                  </div>
                )}
                <div className="block sm:hidden">
                  {/* Mobile menu button*/}
                  <DisclosureButton className="relative inline-flex  items-center justify-center rounded-md p-2 text-gray-400 focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-white">
                    <span className="absolute -inset-0.5" />
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </DisclosureButton>
                </div>
              </div>
            </div>
          </div>

          <DisclosurePanel className="sm:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 flex flex-col gap-3 items-start">
              <div className="flex gap-6 items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="px-5 py-2 text-white text-base font-medium rounded-lg bg-gray-900"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    {onOpenWaitlist ? (
                      <button
                        onClick={onOpenWaitlist}
                        className="px-5 py-2 text-white text-base font-medium rounded-lg bg-gray-900"
                      >
                        Join Waitlist
                      </button>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="px-5 py-2 text-white text-base font-medium rounded-lg bg-gray-900"
                      >
                        Get Started
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}
