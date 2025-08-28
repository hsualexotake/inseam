import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../_generated/api";
import type { ToolCtx } from "@convex-dev/agent";

/**
 * Tool to search through notes
 */
export const searchNotes = createTool({
  description: "Search through user's notes by content or title",
  args: z.object({
    query: z.string().describe("The search query to find relevant notes"),
    limit: z.number().optional().describe("Maximum number of results to return (default: 5)"),
  }),
  handler: async (ctx: ToolCtx, { query, limit = 5 }): Promise<{
    results: Array<{ id: string; title: string; excerpt: string; hasSummary: boolean }>;
    totalFound: number;
    message: string;
  }> => {
    // Get all user's notes
    const notes = await ctx.runQuery(api.notes.getNotes, {});
    
    if (!notes || notes.length === 0) {
      return { results: [], totalFound: 0, message: "No notes found" };
    }
    
    // Simple text search (can be enhanced with vector search later)
    const searchResults = notes
      .filter((note: any) => 
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.content.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map((note: any) => ({
        id: note._id,
        title: note.title,
        excerpt: note.content.substring(0, 200) + "...",
        hasSummary: !!note.summary,
      }));
    
    return {
      results: searchResults,
      totalFound: searchResults.length,
      message: searchResults.length > 0 
        ? `Found ${searchResults.length} matching notes`
        : "No matching notes found",
    };
  },
});

/**
 * Tool to create a new note
 */
export const createNote = createTool({
  description: "Create a new note for the user",
  args: z.object({
    title: z.string().describe("The title of the note"),
    content: z.string().describe("The content of the note"),
    generateSummary: z.boolean().optional().describe("Whether to generate an AI summary (default: false)"),
  }),
  handler: async (ctx: ToolCtx, { title, content, generateSummary = false }): Promise<{
    success: boolean;
    noteId: string;
    message: string;
  }> => {
    const noteId: string = await ctx.runMutation(api.notes.createNote, {
      title,
      content,
      isSummary: generateSummary,
    });
    
    return {
      success: true,
      noteId,
      message: `Note "${title}" created successfully${generateSummary ? " with summary generation scheduled" : ""}`,
    };
  },
});

/**
 * Tool to get a specific note by ID
 */
export const getNote = createTool({
  description: "Retrieve a specific note by its ID",
  args: z.object({
    noteId: z.string().describe("The ID of the note to retrieve"),
  }),
  handler: async (ctx: ToolCtx, { noteId }): Promise<{
    found: boolean;
    note?: { id: string; title: string; content: string; summary?: string };
    message: string;
  }> => {
    const note: any = await ctx.runQuery(api.notes.getNote, { 
      id: noteId as any // Type casting for ID
    });
    
    if (!note) {
      return {
        found: false,
        message: "Note not found",
      };
    }
    
    return {
      found: true,
      note: {
        id: note._id,
        title: note.title,
        content: note.content,
        summary: note.summary,
      },
      message: "Note retrieved successfully",
    };
  },
});

/**
 * Tool to delete a note
 */
export const deleteNote = createTool({
  description: "Delete a specific note",
  args: z.object({
    noteId: z.string().describe("The ID of the note to delete"),
  }),
  handler: async (ctx: ToolCtx, { noteId }) => {
    try {
      await ctx.runMutation(api.notes.deleteNote, {
        noteId: noteId as any,
      });
      
      return {
        success: true,
        message: "Note deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete note: ${error}`,
      };
    }
  },
});

/**
 * Tool to analyze notes and provide insights
 */
export const analyzeNotes = createTool({
  description: "Analyze user's notes to provide insights and patterns",
  args: z.object({
    analysisType: z.enum(["summary", "topics", "trends"]).describe("Type of analysis to perform"),
    limit: z.number().optional().describe("Number of notes to analyze (default: 10)"),
  }),
  handler: async (ctx: ToolCtx, { analysisType, limit = 10 }): Promise<{ analysis: any; message: string }> => {
    const notes = await ctx.runQuery(api.notes.getNotes, {});
    
    if (!notes || notes.length === 0) {
      return {
        analysis: null,
        message: "No notes available for analysis",
      };
    }
    
    const recentNotes = (notes || []).slice(0, limit);
    
    switch (analysisType) {
      case "summary":
        return {
          analysis: {
            type: "summary",
            totalNotes: notes.length,
            analyzed: recentNotes.length,
            averageLength: Math.round(
              recentNotes.reduce((acc: number, note: any) => acc + note.content.length, 0) / recentNotes.length
            ),
            withSummaries: recentNotes.filter((n: any) => n.summary).length,
          },
          message: `Analyzed ${recentNotes.length} notes`,
        };
      
      case "topics":
        // Simple topic extraction (can be enhanced with NLP)
        const commonWords = extractCommonWords(recentNotes);
        return {
          analysis: {
            type: "topics",
            topTopics: commonWords.slice(0, 5),
            notesAnalyzed: recentNotes.length,
          },
          message: "Topic analysis completed",
        };
      
      case "trends":
        return {
          analysis: {
            type: "trends",
            recentActivity: recentNotes.length,
            message: "Trend analysis requires temporal data",
          },
          message: "Basic trend analysis completed",
        };
      
      default:
        return {
          analysis: null,
          message: "Unknown analysis type",
        };
    }
  },
});

// Helper function for topic extraction
function extractCommonWords(notes: any[]): string[] {
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'if', 'as'
  ]);
  
  notes.forEach(note => {
    const words = (note.title + ' ' + note.content)
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
  });
  
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Export all tools as a collection
export const noteTools = {
  searchNotes,
  createNote,
  getNote,
  deleteNote,
  analyzeNotes,
};

// Export a function to get all tools for an agent
export function getAllTools() {
  return noteTools;
}