/**
 * Constants for tracker system
 */

export const TRACKER_LIMITS = {
  // Field length limits
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  TEXT_FIELD_MAX_LENGTH: 10000,
  SLUG_MAX_LENGTH: 50,
  
  // Structural limits
  MAX_COLUMNS: 100,
  MAX_SLUG_GENERATION_ATTEMPTS: 100,
  
  // Import/Export limits
  MAX_IMPORT_ROWS: 10000,
  MAX_CSV_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  IMPORT_BATCH_SIZE: 50,
} as const;