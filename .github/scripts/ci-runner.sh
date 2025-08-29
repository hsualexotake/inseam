#!/bin/bash

# CI Runner - Main orchestrator for all CI checks
# This script runs all checks in the .github/checks directory

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CHECKS_DIR="${SCRIPT_DIR}/../checks"
ROOT_DIR="${SCRIPT_DIR}/../.."

# Track overall status
OVERALL_STATUS=0

echo "========================================="
echo "       Running CI Quality Checks         "
echo "========================================="
echo ""

# Change to root directory
cd "${ROOT_DIR}"

# Find and run all check scripts
if [ -d "${CHECKS_DIR}" ]; then
    for check_script in ${CHECKS_DIR}/*.sh; do
        if [ -f "$check_script" ]; then
            # Get the check name without path and extension
            check_name=$(basename "$check_script" .sh)
            
            echo -e "${YELLOW}Running check: ${check_name}${NC}"
            echo "----------------------------------------"
            
            # Run the check and capture its exit code
            if bash "$check_script"; then
                echo -e "${GREEN}✅ ${check_name} passed${NC}"
            else
                echo -e "${RED}❌ ${check_name} failed${NC}"
                OVERALL_STATUS=1
            fi
            
            echo ""
        fi
    done
else
    echo -e "${RED}Error: Checks directory not found at ${CHECKS_DIR}${NC}"
    exit 1
fi

# Summary
echo "========================================="
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ All CI checks passed successfully!${NC}"
else
    echo -e "${RED}❌ Some CI checks failed. Please fix the issues above.${NC}"
fi
echo "========================================="

exit $OVERALL_STATUS