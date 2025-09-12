/**
 * WorkflowManager setup for the agent system
 * Provides the core workflow execution infrastructure
 */

import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../../_generated/api";

/**
 * Initialize the WorkflowManager with the workflow component
 * This is the main entry point for all workflow operations
 */
export const workflow = new WorkflowManager(components.workflow);

/**
 * Export for convenience
 */
export { WorkflowManager };