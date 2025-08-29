#!/bin/bash

# Package Manager Consistency Check
# Ensures only yarn is used throughout the project

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any issues are found
ISSUES_FOUND=0

echo "Checking package manager consistency..."

# 1. Check for unwanted lock files
echo -n "Checking for non-yarn lock files... "

if [ -f "package-lock.json" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}  ❌ Found package-lock.json${NC}"
    echo "     This project uses yarn exclusively. Please remove package-lock.json"
    echo "     Run: rm package-lock.json"
    ISSUES_FOUND=1
elif [ -f "pnpm-lock.yaml" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}  ❌ Found pnpm-lock.yaml${NC}"
    echo "     This project uses yarn exclusively. Please remove pnpm-lock.yaml"
    ISSUES_FOUND=1
elif [ -f "bun.lockb" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}  ❌ Found bun.lockb${NC}"
    echo "     This project uses yarn exclusively. Please remove bun.lockb"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}PASS${NC}"
fi

# 2. Check that yarn.lock exists
echo -n "Checking for yarn.lock... "
if [ ! -f "yarn.lock" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}  ❌ yarn.lock not found${NC}"
    echo "     Please run: yarn install"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}PASS${NC}"
fi

# 3. Check for npm/npx references in documentation
echo -n "Checking documentation for npm/npx references... "

# Find all markdown files, excluding node_modules and other directories
npm_refs=$(find . -type f -name "*.md" \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/.turbo/*" \
    -not -path "*/dist/*" \
    -not -name "CONTRIBUTING.md" \
    -exec grep -l "npm install\|npm run\|npm ci\|npx " {} \; 2>/dev/null || true)

if [ ! -z "$npm_refs" ]; then
    echo -e "${RED}FAIL${NC}"
    echo -e "${RED}  ❌ Found npm/npx commands in documentation:${NC}"
    
    # Show which files contain npm references
    for file in $npm_refs; do
        echo "     - $file"
        # Show the actual lines with npm references
        grep -n "npm install\|npm run\|npm ci\|npx " "$file" | head -3 | while read -r line; do
            echo "       Line $line"
        done
    done
    
    echo ""
    echo "     Please use yarn commands instead:"
    echo "     • npm install → yarn or yarn install"
    echo "     • npm run dev → yarn dev"
    echo "     • npx convex → yarn convex"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}PASS${NC}"
fi

# 4. Check for npm scripts in package.json files
echo -n "Checking package.json files for npm references... "

npm_in_scripts=$(find . -name "package.json" \
    -not -path "*/node_modules/*" \
    -exec grep -l '"npm ' {} \; 2>/dev/null || true)

if [ ! -z "$npm_in_scripts" ]; then
    echo -e "${YELLOW}WARNING${NC}"
    echo -e "${YELLOW}  ⚠️  Found npm in package.json scripts:${NC}"
    for file in $npm_in_scripts; do
        echo "     - $file"
    done
    echo "     Consider updating scripts to use yarn"
    # This is a warning, not a failure
else
    echo -e "${GREEN}PASS${NC}"
fi

# Summary
echo ""
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ Package manager consistency check passed!${NC}"
    echo "   Only yarn is being used throughout the project."
else
    echo -e "${RED}❌ Package manager consistency check failed!${NC}"
    echo "   Please fix the issues above to ensure only yarn is used."
    exit 1
fi

exit 0