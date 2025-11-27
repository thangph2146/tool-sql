import { NextResponse } from 'next/server';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Create success response
 */
export function successResponse<T>(
  message: string,
  data?: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Create error response
 */
export function errorResponse(
  message: string,
  error?: string,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
      error,
    },
    { status }
  );
}

/**
 * Validate required parameters
 */
export function validateRequiredParams(
  params: Record<string, unknown>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing = required.filter((key) => !params[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

