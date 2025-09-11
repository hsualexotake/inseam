import { 
  ColumnDefinition, 
  ValidationError, 
  ValidationResult 
} from "../types/tracker";
import { TRACKER_LIMITS } from "./trackerConstants";

/**
 * Validate row data against column definitions
 */
export function validateRowData(
  columns: ColumnDefinition[],
  data: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];
  const validated: Record<string, any> = {};

  for (const column of columns) {
    const value = data[column.key];

    // Check required fields
    if (column.required && (value === undefined || value === null || value === "")) {
      errors.push({
        field: column.key,
        message: `${column.name} is required`,
      });
      continue;
    }

    // Skip validation if value is undefined or empty string and not required
    // But preserve null values
    if (!column.required && (value === undefined || value === "")) {
      continue;
    }
    
    // Handle null values for optional fields
    if (!column.required && value === null) {
      validated[column.key] = null;
      continue;
    }

    // Validate by type
    switch (column.type) {
      case "number":
        if (value !== undefined && value !== null) {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push({
              field: column.key,
              message: `${column.name} must be a number`,
            });
          } else {
            validated[column.key] = num;
          }
        } else if (value === null) {
          // Explicitly preserve null values
          validated[column.key] = null;
        }
        break;

      case "date":
        if (value) {
          // Accept various date formats
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({
              field: column.key,
              message: `${column.name} must be a valid date`,
            });
          } else {
            // Store as ISO string for consistency
            validated[column.key] = date.toISOString();
          }
        } else if (value === null) {
          validated[column.key] = null;
        }
        break;

      case "select":
        if (value && column.options && !column.options.includes(value)) {
          errors.push({
            field: column.key,
            message: `${column.name} must be one of: ${column.options.join(", ")}`,
          });
        } else if (value !== undefined) {
          validated[column.key] = value;
        }
        break;

      case "boolean":
        if (value !== undefined && value !== null) {
          // Accept various boolean representations
          const boolValue = 
            value === true || 
            value === "true" || 
            value === 1 || 
            value === "1" || 
            value === "yes";
          validated[column.key] = boolValue;
        } else if (value === null) {
          validated[column.key] = null;
        }
        break;

      case "text":
      default:
        if (value !== undefined) {
          const textValue = value === null ? null : String(value || "");
          // Add length validation for text fields
          if (textValue && textValue.length > TRACKER_LIMITS.TEXT_FIELD_MAX_LENGTH) {
            errors.push({
              field: column.key,
              message: `${column.name} must be ${TRACKER_LIMITS.TEXT_FIELD_MAX_LENGTH} characters or less`,
            });
          } else {
            validated[column.key] = textValue;
          }
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: validated,
  };
}

/**
 * Generate a unique slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, TRACKER_LIMITS.SLUG_MAX_LENGTH);
}

/**
 * Validate column definitions
 */
export function validateColumns(columns: ColumnDefinition[]): ValidationResult {
  const errors: ValidationError[] = [];
  const columnIds = new Set<string>();
  const columnKeys = new Set<string>();

  for (const column of columns) {
    // Check for duplicate IDs
    if (columnIds.has(column.id)) {
      errors.push({
        field: "columns",
        message: `Duplicate column ID: ${column.id}`,
      });
    }
    columnIds.add(column.id);

    // Check for duplicate keys
    if (columnKeys.has(column.key)) {
      errors.push({
        field: "columns",
        message: `Duplicate column key: ${column.key}`,
      });
    }
    columnKeys.add(column.key);

    // Validate select options
    if (column.type === "select" && (!column.options || column.options.length === 0)) {
      errors.push({
        field: column.key,
        message: `Select column "${column.name}" must have options`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {},
  };
}

/**
 * Sanitize CSV cell to prevent formula injection
 */
function sanitizeCSVCell(value: string): string {
  if (!value) return value;
  
  // Check if the cell starts with a formula trigger character
  const firstChar = value.charAt(0);
  if ('=+-@'.includes(firstChar)) {
    // Prefix with single quote to escape formula
    return `'${value}`;
  }
  
  return value;
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Parse CSV data with security sanitization
 */
export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  // Handle empty CSV
  if (!csvText.trim()) {
    return { headers: [], rows: [] };
  }
  
  const lines = csvText.trim().split("\n");
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse and sanitize headers
  const headers = parseCSVLine(lines[0]).map(h => sanitizeCSVCell(h));
  
  // Parse and sanitize all cell values to prevent CSV injection
  const rows = lines.slice(1)
    .filter(line => line.trim()) // Skip empty lines
    .map(line => parseCSVLine(line).map(cell => sanitizeCSVCell(cell)));

  return { headers, rows };
}

/**
 * Map CSV data to tracker columns
 */
export function mapCSVToTrackerData(
  headers: string[],
  rows: string[][],
  columns: ColumnDefinition[]
): Record<string, any>[] {
  const mappedData: Record<string, any>[] = [];

  for (const row of rows) {
    const rowData: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      // Try to find matching column by name or key
      const column = columns.find(
        col => col.name.toLowerCase() === header.toLowerCase() ||
               col.key.toLowerCase() === header.toLowerCase()
      );
      
      if (column) {
        rowData[column.key] = row[index];
      }
    });
    
    mappedData.push(rowData);
  }

  return mappedData;
}