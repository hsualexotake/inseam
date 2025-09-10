"use client";

import { ChevronDown } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type DropdownMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  children: React.ReactNode;
  activeFiltersCount?: number;
};

const DropdownMenu = ({ options, children, activeFiltersCount }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[#11111198] hover:bg-[#111111d1] text-white shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none rounded-md backdrop-blur-sm transition-colors"
      >
        {children ?? "Menu"}
        {activeFiltersCount !== undefined && activeFiltersCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-white text-xs">
            {activeFiltersCount}
          </span>
        )}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
        >
          <ChevronDown className="h-3 w-3" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, filter: "blur(10px)" }}
            animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "circInOut", type: "spring" }}
            className="absolute z-50 w-48 mt-2 p-1 bg-[#11111198] rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.2)] backdrop-blur-sm flex flex-col gap-2 right-0"
          >
            {options && options.length > 0 ? (
              options.map((option) => {
                // Skip section headers (they have no onClick logic)
                const isHeader = option.label.startsWith("—");
                if (isHeader) {
                  return (
                    <div
                      key={option.label}
                      className="px-2 py-1 text-white/50 text-xs uppercase tracking-wider"
                    >
                      {option.label.replace(/—/g, '').trim()}
                    </div>
                  );
                }
                
                return (
                  <motion.button
                    initial={{
                      opacity: 0,
                      x: 10,
                      scale: 0.95,
                      filter: "blur(10px)",
                    }}
                    animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{
                      opacity: 0,
                      x: 10,
                      scale: 0.95,
                      filter: "blur(10px)",
                    }}
                    transition={{
                      duration: 0.4,
                      ease: "easeInOut",
                      type: "spring",
                    }}
                    whileHover={{
                      backgroundColor: "#11111140",
                      transition: {
                        duration: 0.4,
                        ease: "easeInOut",
                      },
                    }}
                    whileTap={{
                      scale: 0.95,
                      transition: {
                        duration: 0.2,
                        ease: "easeInOut",
                      },
                    }}
                    key={option.label}
                    onClick={() => {
                      option.onClick();
                      setIsOpen(false);
                    }}
                    className="px-2 py-3 cursor-pointer text-white text-sm rounded-lg w-full text-left flex items-center gap-x-2"
                  >
                    {option.Icon}
                    {option.label}
                  </motion.button>
                );
              })
            ) : (
              <div className="px-4 py-2 text-white text-xs">No options</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { DropdownMenu };