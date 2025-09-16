/**
 * Workflow actions for email processing
 * These actions use agents and tools within workflow steps for reliable execution
 */

import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { AgentFactory } from "../../core/factory";
import { createThread } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { internal } from "../../../_generated/api";

/**
 * Step 1: Analyze email with emailHandlerAgent
 * Uses the agent's tools to identify trackers and extract data
 */
export const analyzeEmailWithAgent = internalAction({
  args: {
    email: v.object({
      id: v.string(),
      subject: v.string(),
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      date: v.number(),
      body: v.optional(v.string()),
      snippet: v.optional(v.string()),
    }),
    trackers: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      primaryKeyColumn: v.string(),
      columns: v.array(v.object({
        id: v.string(),
        name: v.string(),
        key: v.string(),
        type: v.string(),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
        aiEnabled: v.optional(v.boolean()),
        aiAliases: v.optional(v.array(v.string())),
      })),
    })),
    userId: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { email, trackers, userId, threadId }) => {
    // Create the email handler agent
    const agent = await AgentFactory.create('emailHandler');
    
    // Use provided threadId or create a new thread
    const actualThreadId = threadId || await createThread(ctx, components.agent, {
      userId,
      title: `Email Analysis - ${email.subject.substring(0, 30)}`,
    });
    
    // Prepare the prompt for the agent to identify matching trackers
    const prompt = `Analyze this email and identify which trackers should be updated.

Email Details:
From: ${email.from.name || email.from.email} <${email.from.email}>
Subject: ${email.subject}
Content: ${email.body || email.snippet || '(No content)'}

Available Trackers:
${JSON.stringify(trackers.map(t => ({ id: t.id, name: t.name, description: t.description, columns: t.columns })), null, 2)}

Use the analyzeEmailForTrackers tool to identify which trackers match this email content.`;

    // Generate analysis using the agent with tools
    const result = await agent.generateText(
      ctx,
      { threadId: actualThreadId, userId },
      { prompt }
    );

    // Extract tool results from the agent's execution
    const toolResults: {
      trackerMatches: any[];
    } = {
      trackerMatches: [],
    };

    // Process tool results from the agent's steps
    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        if (step.toolCalls && step.toolResults) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const call = step.toolCalls[i];
            const toolResult = step.toolResults[i];

            // Skip if no tool result available
            if (!toolResult) {
              console.warn(`No result for tool call ${call.toolName}`);
              continue;
            }

            // Check if this is an error result
            if ('type' in toolResult && (toolResult as any).type === 'error-text') {
              console.error(`Tool ${call.toolName} failed:`, (toolResult as any).value);
              continue;
            }

            // Tool results have an 'output' field that contains the actual result
            const output = toolResult.output || toolResult;

            switch (call.toolName) {
              case 'analyzeEmailForTrackers':
                if (output && typeof output === 'object' && 'matches' in output && !toolResults.trackerMatches.length) {
                  toolResults.trackerMatches = (output as any).matches;
                }
                break;
            }
          }
        }
      }
    }

    // Log final results
    if (toolResults.trackerMatches.length > 0) {
      console.log(`Found ${toolResults.trackerMatches.length} matching tracker(s)`);
    } else {
      console.log('No matching trackers found for this email');
    }

    return {
      threadId: actualThreadId,
      toolResults,
      usage: result.usage,
    };
  },
});

/**
 * Step 3: Create tracker proposals from extracted data
 * Formats the extraction results into structured proposals
 */
export const createTrackerProposals = internalAction({
  args: {
    trackerMatches: v.array(v.object({
      trackerId: v.string(),
      trackerName: v.string(),
      confidence: v.number(),
      matchedKeywords: v.array(v.string()),
      relevantColumns: v.array(v.string()),
    })),
    extractedData: v.any(),
    trackers: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      primaryKeyColumn: v.string(),
      columns: v.array(v.object({
        id: v.string(),
        name: v.string(),
        key: v.string(),
        type: v.string(),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
        aiEnabled: v.optional(v.boolean()),
        aiAliases: v.optional(v.array(v.string())),
      })),
    })),
    email: v.object({
      id: v.string(),
      subject: v.string(),
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      date: v.number(),
      body: v.optional(v.string()),
      snippet: v.optional(v.string()),
    }),
  },
  handler: async (_, { trackerMatches, extractedData, trackers, email }) => {
    const proposals = [];

    // Process each matched tracker
    for (const match of trackerMatches) {
      const tracker = trackers.find(t => t.id === match.trackerId);
      if (!tracker) continue;

      const trackerExtractedData = extractedData[match.trackerId];
      if (!trackerExtractedData || !trackerExtractedData.data) continue;

      // Build column updates
      const columnUpdates = [];
      for (const [key, value] of Object.entries(trackerExtractedData.data)) {
        const column = tracker.columns.find(c => c.key === key);
        if (column && value !== undefined && value !== null) {
          columnUpdates.push({
            columnKey: key,
            columnName: column.name,
            columnType: column.type,
            currentValue: null, // Will be filled if row exists
            proposedValue: value,
            confidence: trackerExtractedData.confidence[key] || match.confidence,
          });
        }
      }

      if (columnUpdates.length > 0) {
        proposals.push({
          trackerId: tracker.id,
          trackerName: tracker.name,
          rowId: trackerExtractedData.rowIdentifier?.primaryKeyValue || 'new',
          isNewRow: trackerExtractedData.rowIdentifier?.isNewRow !== false,
          columnUpdates,
        });
      }
    }
    
    // Create email summary
    const emailSummary = {
      title: email.subject.substring(0, 50),
      summary: proposals.length > 0 
        ? `Email about ${proposals.map(p => p.trackerName).join(', ')}`
        : `Email from ${email.from.name || email.from.email}`,
      type: proposals.length > 0 ? "update" : "general",
      urgency: "medium",
      category: proposals.length > 0 ? "fashion_ops" : "general",
    };
    
    return {
      emailSummary,
      trackerMatches: trackerMatches.map(match => ({
        trackerId: match.trackerId,
        trackerName: match.trackerName,
        confidence: match.confidence
      })),
      trackerProposals: proposals,
      metadata: {
        totalProposals: proposals.length,
        averageConfidence: proposals.length > 0
          ? proposals.reduce((sum, p) => {
              const avgColumnConfidence = p.columnUpdates.reduce((colSum, col) => colSum + col.confidence, 0) / p.columnUpdates.length;
              return sum + avgColumnConfidence;
            }, 0) / proposals.length
          : 0,
        hasHighConfidenceUpdates: proposals.some(p => 
          p.columnUpdates.some(c => c.confidence >= 0.8)
        ),
      },
    };
  },
});

/**
 * Step 2b: Extract data from email using LLM
 * Uses a simple agent to extract specific values from email content
 */
export const performLLMExtraction = internalAction({
  args: {
    email: v.object({
      id: v.string(),
      subject: v.string(),
      body: v.optional(v.string()),
      snippet: v.optional(v.string()),
    }),
    matchedTrackers: v.array(v.object({
      trackerId: v.string(),
      trackerName: v.string(),
      confidence: v.number(),
      matchedKeywords: v.array(v.string()),
      relevantColumns: v.array(v.string()),
    })),
    trackers: v.array(v.object({
      id: v.string(),
      name: v.string(),
      primaryKeyColumn: v.string(),
      columns: v.array(v.object({
        id: v.string(),
        name: v.string(),
        key: v.string(),
        type: v.string(),
        required: v.boolean(),
        aiEnabled: v.optional(v.boolean()),
        aiAliases: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
      })),
      description: v.optional(v.string()),
    })),
    userId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { email, matchedTrackers, trackers, userId, threadId }) => {
    const extractedData: Record<string, any> = {};
    const emailContent = email.body || email.snippet || '';

    console.log(`Starting LLM extraction for ${matchedTrackers.length} matched trackers`);

    // Create a simple extraction agent
    const extractionAgent = await AgentFactory.createCustom({
      name: "Data Extraction Agent",
      instructions: `You are a precise data extraction agent. You extract specific values from text.

IMPORTANT RULES:
      - Extract ONLY the actual values, not descriptions
      - For "sku code 12" extract just "12"
      - For "delivery date updated to sep 13" extract just "sep 13"
      - For "quantity is 50 units" extract just "50"
      - Return extracted values in JSON format
      - If a value cannot be found, omit it from the result`,
      config: {
        callSettings: {
          temperature: 0.1, // Very low temperature for consistent extraction
          maxRetries: 2,
        },
      },
    });

    // Process each matched tracker
    for (const match of matchedTrackers) {
      const tracker = trackers.find(t => t.id === match.trackerId);
      if (!tracker) continue;

      // Build extraction prompt for this tracker
      const columnDescriptions = tracker.columns
        .filter(col => match.relevantColumns.includes(col.name) || col.required)
        .map(col => {
          const aliases = col.aiAliases?.length ? ` (also known as: ${col.aiAliases.join(', ')})` : '';
          return `- ${col.key}: ${col.name}${aliases} (type: ${col.type})`;
        }).join('\n');

      const extractionPrompt = `Extract values from this email for the "${tracker.name}" tracker.

Email content: "${emailContent}"

Fields to extract:
${columnDescriptions}

IMPORTANT: For the primary key field (${tracker.primaryKeyColumn}), extract the exact term used in the email, even if it's a descriptive name rather than a code.

Examples:
- From "sku code 12" extract: {"sku": "12"}
- From "green dress delivery updated" extract: {"sku": "green dress"}
- From "delivery date has been updated to sep 13" extract: {"delivery_date": "sep 13"}
- From "quantity ordered is 50 units" extract: {"quantity": "50"}

Now extract the values from the email above and return ONLY a JSON object with the extracted values:`;

      try {
        console.log(`Extracting data for tracker ${tracker.name}`);

        // Use the agent to extract data
        const extractionResult = await extractionAgent.generateText(
          ctx,
          { threadId, userId },
          { prompt: extractionPrompt }
        );

        console.log(`LLM response for ${tracker.name}:`, extractionResult.text);

        // Parse the extracted JSON
        if (extractionResult.text) {
          try {
            // Remove markdown code blocks if present
            let jsonText = extractionResult.text.trim();
            if (jsonText.startsWith('```')) {
              jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }
            const parsed = JSON.parse(jsonText);

            // Check if the extracted primary key value might be an alias
            const extractedPKValue = parsed[tracker.primaryKeyColumn];
            let resolvedPKValue = extractedPKValue;

            if (extractedPKValue && typeof extractedPKValue === 'string') {
              // Try to resolve as alias
              const aliasMatch = await ctx.runQuery(
                internal.trackerAliases.resolveAlias,
                {
                  trackerId: match.trackerId as any, // Type cast - trackerId comes from tool response as string
                  searchTerm: extractedPKValue
                }
              );

              if (aliasMatch) {
                console.log(`Resolved alias "${extractedPKValue}" to row ID "${aliasMatch.rowId}"`);
                resolvedPKValue = aliasMatch.rowId;
                parsed[tracker.primaryKeyColumn] = aliasMatch.rowId;
              }
            }

            // Store extracted data with metadata
            extractedData[match.trackerId] = {
              data: parsed,
              confidence: {},
              sources: {},
              rowIdentifier: {
                primaryKeyColumn: tracker.primaryKeyColumn,
                primaryKeyValue: resolvedPKValue || 'unknown',
                isNewRow: false, // Will be determined later
              },
            };

            // Add confidence scores
            for (const key of Object.keys(parsed)) {
              extractedData[match.trackerId].confidence[key] = match.confidence;
            }

            console.log(`LLM extracted data for ${tracker.name}:`, parsed);
          } catch (parseError) {
            console.error(`Failed to parse extraction result for ${tracker.name}:`, parseError);
            console.log('Raw extraction result:', extractionResult.text);
          }
        }
      } catch (error) {
        console.error(`Failed to extract data for tracker ${tracker.name}:`, error);
      }
    }

    return {
      extractedData,
      extractionCount: Object.keys(extractedData).length,
    };
  },
});

/**
 * Step 3: Store centralized update
 * Creates the update record in the database
 */
export const storeCentralizedUpdate = internalAction({
  args: {
    emailId: v.string(),
    emailSummary: v.object({
      title: v.string(),
      summary: v.string(),
      type: v.string(),
      urgency: v.string(),
      category: v.string(),
    }),
    trackerMatches: v.array(v.any()),
    trackerProposals: v.array(v.any()),
    email: v.object({
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      subject: v.string(),
      date: v.number(),
      snippet: v.optional(v.string()),
      body: v.optional(v.string()),
    }),
    userId: v.string(),
  },
  handler: async (ctx, { emailId, emailSummary, trackerMatches, trackerProposals, email, userId }): Promise<{
    success: boolean;
    updateId?: string;
    error?: string;
  }> => {
    // Create the update data
    const updateData = {
      source: 'email' as const,
      sourceId: emailId,
      trackerMatches,
      type: emailSummary.type,
      category: emailSummary.category,
      title: emailSummary.title,
      summary: emailSummary.summary,
      urgency: emailSummary.urgency,
      fromName: email.from.name || 'Unknown',
      fromId: email.from.email,
      sourceSubject: email.subject,
      sourceQuote: email.snippet || email.body?.substring(0, 500),
      sourceDate: email.date,
      trackerProposals,
    };
    
    // Store the update using the internal mutation (with userId)
    const result: { success: boolean; updateId?: string; error?: string } = await ctx.runMutation(internal.centralizedUpdates.internalCreateUpdate, {
      userId,
      ...updateData,
    });
    
    return {
      success: result.success,
      updateId: result.updateId,
      error: result.error,
    };
  },
});