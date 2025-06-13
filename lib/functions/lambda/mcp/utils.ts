import { Granularity } from './types.js';

/**
 * Utility functions for the Cost Explorer MCP Server.
 */

/**
 * Validate that a date string is in YYYY-MM-DD format and represents a valid date.
 */
export function validateDateFormat(dateString: string): {
  isValid: boolean;
  error?: string;
} {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(dateString)) {
    return {
      isValid: false,
      error: `Invalid date format: ${dateString}. Expected YYYY-MM-DD format.`,
    };
  }

  const date = new Date(dateString);
  const [year, month, day] = dateString.split('-').map(Number);

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return {
      isValid: false,
      error: `Invalid date: ${dateString}. The date does not exist.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate that a date range is valid and meets AWS Cost Explorer constraints.
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
  granularity?: Granularity
): { isValid: boolean; error?: string } {
  // First validate individual dates
  const startValidation = validateDateFormat(startDate);
  if (!startValidation.isValid) {
    return startValidation;
  }

  const endValidation = validateDateFormat(endDate);
  if (!endValidation.isValid) {
    return endValidation;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check that start is before end
  if (start >= end) {
    return {
      isValid: false,
      error: 'Start date must be before end date.',
    };
  }

  // Check AWS Cost Explorer specific constraints
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start date cannot be more than 12 months ago
  const twelveMonthsAgo = new Date(today);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  if (start < twelveMonthsAgo) {
    return {
      isValid: false,
      error: 'Start date cannot be more than 12 months ago.',
    };
  }

  // End date cannot be in the future
  if (end > today) {
    return {
      isValid: false,
      error: 'End date cannot be in the future.',
    };
  }

  // Granularity-specific validations
  if (granularity === 'HOURLY') {
    // Hourly data is only available for the last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (start < sevenDaysAgo) {
      return {
        isValid: false,
        error: 'Hourly granularity is only available for the last 7 days.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Format a date for AWS API calls (YYYY-MM-DD format).
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the current date in YYYY-MM-DD format.
 */
export function getTodayDate(): string {
  return formatDateForApi(new Date());
}

/**
 * Get a date N days ago in YYYY-MM-DD format.
 */
export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateForApi(date);
}

/**
 * Get the first day of the current month in YYYY-MM-DD format.
 */
export function getFirstDayOfCurrentMonth(): string {
  const date = new Date();
  date.setDate(1);
  return formatDateForApi(date);
}

/**
 * Get the first day of the previous month in YYYY-MM-DD format.
 */
export function getFirstDayOfPreviousMonth(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  return formatDateForApi(date);
}

/**
 * Check if two date ranges represent exactly one month periods.
 * Used for cost comparison validation.
 */
export function areOneMonthPeriods(
  baseStart: string,
  baseEnd: string,
  comparisonStart: string,
  comparisonEnd: string
): { isValid: boolean; error?: string } {
  const baseStartDate = new Date(baseStart);
  const baseEndDate = new Date(baseEnd);
  const comparisonStartDate = new Date(comparisonStart);
  const comparisonEndDate = new Date(comparisonEnd);

  // Check if both periods start on the first day of the month
  if (baseStartDate.getDate() !== 1 || comparisonStartDate.getDate() !== 1) {
    return {
      isValid: false,
      error:
        'Both comparison periods must start on the first day of the month.',
    };
  }

  // Check if both periods are exactly one month
  const baseExpectedEnd = new Date(baseStartDate);
  baseExpectedEnd.setMonth(baseExpectedEnd.getMonth() + 1);

  const comparisonExpectedEnd = new Date(comparisonStartDate);
  comparisonExpectedEnd.setMonth(comparisonExpectedEnd.getMonth() + 1);

  if (baseEndDate.getTime() !== baseExpectedEnd.getTime()) {
    return {
      isValid: false,
      error: 'Base period must be exactly one month.',
    };
  }

  if (comparisonEndDate.getTime() !== comparisonExpectedEnd.getTime()) {
    return {
      isValid: false,
      error: 'Comparison period must be exactly one month.',
    };
  }

  return { isValid: true };
}

/**
 * Convert a pandas-like DataFrame to a formatted string for display.
 * This is a simplified version for the TypeScript port.
 */
export function formatDataForDisplay(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data available.';
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('Error formatting data for display:', error);
    return 'Error formatting data for display.';
  }
}
