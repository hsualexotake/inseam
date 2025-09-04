// SKU extraction utilities - no Convex values needed for this utility file

/**
 * SKU Extraction Utilities
 * Patterns and functions for extracting SKU data from email content
 */

// SKU pattern variations for fashion industry
// Format examples: SS26-DRS-001-BLK-S, FW25-JKT-002, sku 56, SKU 767, etc.
export const SKU_PATTERNS = {
  // Standard format: SEASON-CATEGORY-NUMBER(-COLOR-SIZE)?
  standard: /\b([A-Z]{2}\d{2})-([A-Z]{3})-(\d{3})(?:-([A-Z]{3,4})-([A-Z]{1,2}))?\b/gi,
  // Alternative formats
  withSlash: /\b([A-Z]{2}\d{2})\/([A-Z]{3})\/(\d{3})\b/gi,
  compact: /\b([A-Z]{2}\d{2})([A-Z]{3})(\d{3})\b/gi,
  // Simple numeric SKU format: sku 56, SKU 767, sku #123
  simple: /\b(?:sku|SKU)\s*#?\s*(\d+)\b/gi,
  // PO number format
  poNumber: /\b(PO|P\.O\.|po)[\s#-]?(\d{4,10})\b/gi,
};

// Tracking number patterns for major carriers
export const TRACKING_PATTERNS = {
  ups: /\b(1Z[0-9A-Z]{16})\b/gi,
  fedex: /\b(\d{12,14})\b/gi,
  dhl: /\b(\d{10,11})\b/gi,
  usps: /\b(9[2-5]\d{19,21})\b/gi,
  generic: /\b([A-Z0-9]{10,30})\b/gi, // Fallback for unknown carriers
};

// Status keyword mappings
export const STATUS_KEYWORDS = {
  shipped: ['shipped', 'dispatched', 'sent', 'on its way', 'has left'],
  in_transit: ['in transit', 'on the way', 'being delivered', 'en route'],
  delivered: ['delivered', 'received', 'arrived', 'completed delivery'],
  delayed: ['delayed', 'postponed', 'held up', 'customs hold', 'weather delay'],
  pending: ['pending', 'preparing', 'processing', 'awaiting'],
};

// Date extraction patterns
export const DATE_PATTERNS = {
  // Sept 14, 2025 or September 14, 2025
  monthDayYear: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  // 9/14/2025 or 09-14-2025
  numeric: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/gi,
  // Monday, September 1st
  dayMonthOrdinal: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(st|nd|rd|th)?\b/gi,
  // ISO format: 2025-09-14
  iso: /\b(\d{4})-(\d{2})-(\d{2})\b/gi,
};

export interface ExtractedSKUData {
  skuCode: string;
  trackingNumber?: string;
  status?: string;
  deliveryDate?: string;
  quantity?: number;
  supplier?: string;
  confidence: number;
  sourceQuote: string;
}

/**
 * Extract SKU codes from text
 */
export function extractSKUCodes(text: string): string[] {
  const skus = new Set<string>();
  
  // Try standard patterns
  const standardPatterns = [SKU_PATTERNS.standard, SKU_PATTERNS.withSlash, SKU_PATTERNS.compact];
  for (const pattern of standardPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => skus.add(match.toUpperCase()));
    }
  }
  
  // Handle simple numeric SKUs differently
  const simpleMatches = text.matchAll(SKU_PATTERNS.simple);
  for (const match of simpleMatches) {
    // Format as "SKU-" followed by the number for consistency
    const skuNumber = match[1];
    skus.add(`SKU-${skuNumber}`);
  }
  
  // PO numbers (if needed)
  const poMatches = text.matchAll(SKU_PATTERNS.poNumber);
  for (const match of poMatches) {
    skus.add(`PO-${match[2]}`);
  }
  
  return Array.from(skus);
}

/**
 * Extract tracking numbers from text
 */
export function extractTrackingNumbers(text: string): { number: string; carrier: string }[] {
  const trackingNumbers: { number: string; carrier: string }[] = [];
  
  // Check for UPS
  const upsMatches = text.match(TRACKING_PATTERNS.ups);
  if (upsMatches) {
    upsMatches.forEach(num => trackingNumbers.push({ number: num, carrier: 'UPS' }));
  }
  
  // Check for FedEx (be careful with generic number patterns)
  const fedexContext = /(fedex|FedEx|FEDEX)/i.test(text);
  if (fedexContext) {
    const fedexMatches = text.match(TRACKING_PATTERNS.fedex);
    if (fedexMatches) {
      fedexMatches.forEach(num => trackingNumbers.push({ number: num, carrier: 'FedEx' }));
    }
  }
  
  // Check for DHL
  const dhlContext = /(dhl|DHL)/i.test(text);
  if (dhlContext) {
    const dhlMatches = text.match(TRACKING_PATTERNS.dhl);
    if (dhlMatches) {
      dhlMatches.forEach(num => trackingNumbers.push({ number: num, carrier: 'DHL' }));
    }
  }
  
  // Check for USPS
  const uspsMatches = text.match(TRACKING_PATTERNS.usps);
  if (uspsMatches) {
    uspsMatches.forEach(num => trackingNumbers.push({ number: num, carrier: 'USPS' }));
  }
  
  return trackingNumbers;
}

/**
 * Extract status from text
 */
export function extractStatus(text: string): { status: string; confidence: number } | null {
  const lowerText = text.toLowerCase();
  
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        // Higher confidence if multiple keywords match
        const matchCount = keywords.filter(k => lowerText.includes(k)).length;
        const confidence = Math.min(0.6 + (matchCount * 0.2), 1.0);
        return { status: status as any, confidence };
      }
    }
  }
  
  return null;
}

/**
 * Extract dates from text
 */
export function extractDates(text: string): Date[] {
  const dates: Date[] = [];
  
  // Month day year format
  const monthDayMatches = text.match(DATE_PATTERNS.monthDayYear);
  if (monthDayMatches) {
    monthDayMatches.forEach(match => {
      const parsed = new Date(match);
      if (!isNaN(parsed.getTime())) {
        dates.push(parsed);
      }
    });
  }
  
  // Numeric format (MM/DD/YYYY or MM-DD-YYYY)
  const numericMatches = [...text.matchAll(DATE_PATTERNS.numeric)];
  numericMatches.forEach(match => {
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    let year = parseInt(match[3]);
    
    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  });
  
  // ISO format
  const isoMatches = text.match(DATE_PATTERNS.iso);
  if (isoMatches) {
    isoMatches.forEach(match => {
      const parsed = new Date(match);
      if (!isNaN(parsed.getTime())) {
        dates.push(parsed);
      }
    });
  }
  
  return dates;
}

/**
 * Extract quantity from text near SKU mention
 */
export function extractQuantity(text: string, skuCode: string): number | null {
  // Look for quantity mentions near the SKU
  const skuIndex = text.toLowerCase().indexOf(skuCode.toLowerCase());
  if (skuIndex === -1) return null;
  
  // Get surrounding context (200 chars before and after)
  const contextStart = Math.max(0, skuIndex - 200);
  const contextEnd = Math.min(text.length, skuIndex + skuCode.length + 200);
  const context = text.substring(contextStart, contextEnd);
  
  // Look for quantity patterns
  const quantityPatterns = [
    /(\d+)\s*(units?|pieces?|items?|pcs?)/i,
    /quantity[:\s]+(\d+)/i,
    /qty[:\s]+(\d+)/i,
    /(\d+)\s*x\s*/i, // "50x SKU..."
  ];
  
  for (const pattern of quantityPatterns) {
    const match = context.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

/**
 * Extract supplier from text
 */
export function extractSupplier(text: string): string | null {
  // Common supplier keywords
  const supplierPatterns = [
    /from\s+(?:supplier\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /supplier[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /vendor[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /factory[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  
  for (const pattern of supplierPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Check for known supplier names (could be configured)
  const knownSuppliers = ['Innnox', 'SupplierCo', 'FashionFactory'];
  for (const supplier of knownSuppliers) {
    if (text.includes(supplier)) {
      return supplier;
    }
  }
  
  return null;
}

/**
 * Main function to extract all SKU-related data from email content
 */
export function extractSKUDataFromEmail(emailContent: string, emailSubject: string): ExtractedSKUData[] {
  const fullText = `${emailSubject}\n${emailContent}`;
  const results: ExtractedSKUData[] = [];
  
  // Extract all SKU codes
  const skuCodes = extractSKUCodes(fullText);
  
  for (const skuCode of skuCodes) {
    // Find the context around this SKU mention
    const skuIndex = fullText.toLowerCase().indexOf(skuCode.toLowerCase());
    const contextStart = Math.max(0, skuIndex - 300);
    const contextEnd = Math.min(fullText.length, skuIndex + skuCode.length + 300);
    const context = fullText.substring(contextStart, contextEnd);
    
    // Extract data for this SKU
    const trackingNumbers = extractTrackingNumbers(context);
    const statusData = extractStatus(context);
    const dates = extractDates(context);
    const quantity = extractQuantity(fullText, skuCode);
    const supplier = extractSupplier(context);
    
    // Calculate confidence based on how much data we found
    let confidence = 0.5; // Base confidence for finding a SKU
    if (trackingNumbers.length > 0) confidence += 0.2;
    if (statusData) confidence += statusData.confidence * 0.15;
    if (dates.length > 0) confidence += 0.1;
    if (quantity) confidence += 0.05;
    if (supplier) confidence += 0.05;
    
    // Get the most relevant quote
    const quoteStart = Math.max(0, skuIndex - 100);
    const quoteEnd = Math.min(fullText.length, skuIndex + skuCode.length + 100);
    const sourceQuote = fullText.substring(quoteStart, quoteEnd).trim();
    
    results.push({
      skuCode,
      trackingNumber: trackingNumbers[0]?.number,
      status: statusData?.status,
      deliveryDate: dates[0]?.toISOString(),
      quantity: quantity ?? undefined,
      supplier: supplier ?? undefined,
      confidence: Math.min(confidence, 1.0),
      sourceQuote,
    });
  }
  
  return results;
}