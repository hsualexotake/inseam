"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <Image 
        src="/images/combologo.png" 
        alt="Logo" 
        width={32} 
        height={32}
        className="object-contain flex-shrink-0"
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black whitespace-pre heading-small"
      >
        inseam
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <Image 
        src="/images/combologo.png" 
        alt="Logo" 
        width={32} 
        height={32}
        className="object-contain flex-shrink-0"
      />
    </Link>
  );
};