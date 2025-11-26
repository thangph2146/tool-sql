/**
 * Utility functions for formatting and processing table cell values
 */

/**
 * Detects image type from buffer data by checking magic bytes
 */
export function detectImageType(bufferData: number[]): string | null {
  if (bufferData.length < 4) return null;
  
  // PNG signature: 89 50 4E 47
  if (bufferData[0] === 0x89 && bufferData[1] === 0x50 && 
      bufferData[2] === 0x4E && bufferData[3] === 0x47) {
    return "image/png";
  }
  // JPEG signature: FF D8 FF
  if (bufferData[0] === 0xFF && bufferData[1] === 0xD8 && bufferData[2] === 0xFF) {
    return "image/jpeg";
  }
  // GIF signature: 47 49 46 38
  if (bufferData[0] === 0x47 && bufferData[1] === 0x49 && 
      bufferData[2] === 0x46 && bufferData[3] === 0x38) {
    return "image/gif";
  }
  
  return null;
}

/**
 * Converts Buffer data to data URL for image display
 */
export function bufferToDataUrl(value: unknown): string | null {
  let bufferData: number[] | null = null;
  
  // Check if it's a Buffer object (from database)
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    bufferData = value.data as number[];
  } else if (value instanceof Buffer) {
    bufferData = Array.from(value);
  }
  
  if (!bufferData || bufferData.length === 0) {
    return null;
  }
  
  const imageType = detectImageType(bufferData);
  if (!imageType) {
    return null;
  }
  
  // Convert array of numbers to base64 (safe for large arrays)
  const binaryString = bufferData.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const base64 = btoa(binaryString);
  return `data:${imageType};base64,${base64}`;
}

/**
 * Formats a date value to Vietnamese format (dd/MM/yyyy or dd/MM/yyyy HH:mm:ss)
 */
function formatDate(value: Date | string): string {
  let date: Date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    // Try to parse ISO date string
    date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return value; // Return original string if not a valid date
    }
  } else {
    return String(value);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Check if time is midnight (00:00:00) - likely a date-only value
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
  
  if (hasTime) {
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } else {
    return `${day}/${month}/${year}`;
  }
}

/**
 * Checks if a value is a date string (ISO format or similar)
 */
function isDateString(value: string): boolean {
  // ISO date pattern: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (isoDatePattern.test(value)) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

/**
 * Formats cell value for display as text
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Check if it's a Date object
  if (value instanceof Date) {
    return formatDate(value);
  }

  // Check if it's a date string (ISO format)
  if (typeof value === "string" && isDateString(value)) {
    return formatDate(value);
  }

  // Check if it's a Buffer object (from database)
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    const bufferData = value.data as number[];
    const size = bufferData.length;
    const imageType = detectImageType(bufferData);
    
    if (imageType) {
      return `[Image ${imageType.split('/')[1].toUpperCase()} - ${size} bytes]`;
    }
    
    return `[Binary Data - ${size} bytes]`;
  }

  // Check if it's a regular Buffer instance
  if (value instanceof Buffer || (typeof value === "object" && value !== null && "length" in value)) {
    try {
      const buffer = value as { length: number };
      return `[Binary Data - ${buffer.length} bytes]`;
    } catch {
      // Fall through
    }
  }

  // For other values, convert to string
  try {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  } catch {
    return "[Unable to display]";
  }
}

