/// <reference types="vite/client" />

// Import all Convex modules for testing, excluding test files and problematic modules
// Using the recommended pattern from Convex documentation
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");