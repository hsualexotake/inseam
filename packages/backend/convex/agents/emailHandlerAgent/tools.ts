import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

/**
 * Tool to analyze email content and match it to relevant trackers
 */
export const analyzeEmailForTrackers = createTool({
  description: "Analyze email content to identify which trackers should be updated",
  args: z.object({
    emailContent: z.string().describe("The email body content"),
    emailSubject: z.string().describe("The email subject line"),
    trackers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      color: z.string().optional(),
      columns: z.array(z.object({
        name: z.string().optional(), // Made optional to handle missing names
        key: z.string(),
        aiAliases: z.array(z.string()).optional(),
        // Accept extra fields that might be passed
        id: z.string().optional(),
        type: z.string().optional(),
        required: z.boolean().optional(),
        aiEnabled: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })),
    })).describe("Available trackers to match against"),
  }),
  handler: async (ctx: ToolCtx, { emailContent, emailSubject, trackers }): Promise<{
    matches: Array<{
      trackerId: string;
      trackerName: string;
      confidence: number;
      matchedKeywords: string[];
      relevantColumns: string[];
    }>;
    summary: string;
  }> => {
    const matches: Array<{
      trackerId: string;
      trackerName: string;
      confidence: number;
      matchedKeywords: string[];
      relevantColumns: string[];
    }> = [];
    
    const fullContent = `${emailSubject} ${emailContent}`.toLowerCase();
    
    for (const tracker of trackers) {
      const matchedKeywords: string[] = [];
      const relevantColumns: string[] = [];
      let score = 0;
      
      // Check tracker name
      if (fullContent.includes(tracker.name.toLowerCase())) {
        score += 0.3;
        matchedKeywords.push(tracker.name);
      }
      
      // Check tracker description
      if (tracker.description && fullContent.includes(tracker.description.toLowerCase())) {
        score += 0.2;
      }
      
      // Check column names and aliases
      for (const column of tracker.columns) {
        const columnNameLower = column.name?.toLowerCase() || '';
        const columnKeyLower = column.key.toLowerCase();
        
        // Check if column or its aliases are mentioned
        const columnMentioned =
          (columnNameLower && fullContent.includes(columnNameLower)) ||
          fullContent.includes(columnKeyLower) ||
          column.aiAliases?.some(alias => fullContent.includes(alias.toLowerCase()));

        if (columnMentioned) {
          score += 0.2;
          if (column.name) {
            relevantColumns.push(column.name);
            matchedKeywords.push(column.name);
          }
        }
        
        // Check for common update patterns
        const updatePatterns = ['updated', 'changed', 'modified', 'set to', 'is now'];
        if (columnMentioned && updatePatterns.some(p => fullContent.includes(p))) {
          score += 0.1;  // Bonus for update language
        }
      }
      
      // Only include if confidence is above threshold
      const confidence = Math.min(score, 1.0);
      if (confidence >= 0.15) {  // Lower threshold to catch more matches
        matches.push({
          trackerId: tracker.id,
          trackerName: tracker.name,
          confidence,
          matchedKeywords: [...new Set(matchedKeywords)],
          relevantColumns: [...new Set(relevantColumns)],
        });
      }
    }
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return {
      matches,
      summary: matches.length > 0 
        ? `Found ${matches.length} matching tracker(s): ${matches.map(m => m.trackerName).join(', ')}`
        : "No matching trackers found for this email",
    };
  },
});

// Export actively used tools
export const emailHandlerTools = {
  analyzeEmailForTrackers,
};