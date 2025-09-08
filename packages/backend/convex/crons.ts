import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up old processed email IDs daily at 2 AM UTC
crons.daily(
  "cleanup old processed emails",
  { hourUTC: 2, minuteUTC: 0 },
  internal.emails.internal.cleanupOldProcessedEmails
);

export default crons;