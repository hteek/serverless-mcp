import {
  GetDimensionValuesCommand,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  Dimension,
} from '@aws-sdk/client-cost-explorer';

import { getCostExplorerClient } from './aws-client.js';
import {
  GetDimensionValuesArgs,
  GetTagValuesArgs,
  GetCostAndUsageArgs,
  GetCostForecastArgs,
  GetCostAndUsageComparisonsArgs,
  GetCostComparisonDriversArgs,
} from './types.js';
import {
  getTodayDate,
  getDateDaysAgo,
  validateDateRange,
  areOneMonthPeriods,
} from './utils.js';

/**
 * Tool implementations for the Cost Explorer MCP Server.
 */

/**
 * Get the current date to help with relative date queries.
 */
export async function getTodayDateTool(): Promise<string> {
  const today = getTodayDate();
  const currentDate = new Date();
  const month = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  return JSON.stringify({
    today: today,
    current_month: month,
    current_year: year,
    note: "Use this information to calculate relative dates like 'last month' or 'this quarter'",
  });
}

/**
 * Get available values for a specific dimension.
 */
export async function getDimensionValues(
  args: GetDimensionValuesArgs
): Promise<string> {
  const client = getCostExplorerClient();

  // Set default dates if not provided
  const endDate = args.endDate || getTodayDate();
  const startDate = args.startDate || getDateDaysAgo(30);

  // Validate date range
  const dateValidation = validateDateRange(startDate, endDate);
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error);
  }

  try {
    const command = new GetDimensionValuesCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Dimension: args.dimensionKey as Dimension,
      Context: args.context || 'COST_AND_USAGE',
      SearchString: args.searchString,
      MaxResults: 1000,
    });

    const response = await client.send(command);

    return JSON.stringify({
      dimension: args.dimensionKey,
      time_period: { start: startDate, end: endDate },
      values:
        response.DimensionValues?.map((dv) => ({
          value: dv.Value,
          attributes: dv.Attributes,
        })) || [],
      total_returned: response.ReturnSize || 0,
      next_page_token: response.NextPageToken,
    });
  } catch (error) {
    console.error('Error getting dimension values:', error);
    throw new Error(
      `Failed to get dimension values: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get available values for a specific tag key.
 */
export async function getTagValues(args: GetTagValuesArgs): Promise<string> {
  const client = getCostExplorerClient();

  // Set default dates if not provided
  const endDate = args.endDate || getTodayDate();
  const startDate = args.startDate || getDateDaysAgo(30);

  // Validate date range
  const dateValidation = validateDateRange(startDate, endDate);
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error);
  }

  try {
    const command = new GetDimensionValuesCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Dimension: 'TAG' as Dimension,
      Context: 'COST_AND_USAGE',
      SearchString: args.searchString,
      MaxResults: 1000,
    });

    const response = await client.send(command);

    // Filter by the specific tag key
    const filteredValues =
      response.DimensionValues?.filter((dv) =>
        dv.Value?.startsWith(`${args.tagKey}$`)
      ) || [];

    return JSON.stringify({
      tag_key: args.tagKey,
      time_period: { start: startDate, end: endDate },
      values: filteredValues.map((dv) => ({
        value: dv.Value?.split('$')[1], // Remove the key prefix
        attributes: dv.Attributes,
      })),
      total_returned: filteredValues.length,
    });
  } catch (error) {
    console.error('Error getting tag values:', error);
    throw new Error(
      `Failed to get tag values: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get cost and usage data with filtering and grouping options.
 */
export async function getCostAndUsage(
  args: GetCostAndUsageArgs
): Promise<string> {
  const client = getCostExplorerClient();

  // Validate date range
  const dateValidation = validateDateRange(
    args.startDate,
    args.endDate,
    args.granularity
  );
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error);
  }

  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: args.startDate,
        End: args.endDate,
      },
      Granularity: args.granularity || 'MONTHLY',
      Metrics: args.metrics || ['UnblendedCost'],
      GroupBy: args.groupBy?.map((gb) => ({
        Type: gb.Type,
        Key: gb.Key,
      })),
      Filter: args.filter,
    });

    const response = await client.send(command);

    // Process the response into a more readable format
    const processedData =
      response.ResultsByTime?.map((result) => ({
        time_period: result.TimePeriod,
        total: result.Total,
        groups: result.Groups?.map((group) => ({
          keys: group.Keys,
          metrics: group.Metrics,
        })),
      })) || [];

    return JSON.stringify({
      time_period: { start: args.startDate, end: args.endDate },
      granularity: args.granularity || 'MONTHLY',
      metrics: args.metrics || ['UnblendedCost'],
      results: processedData,
      group_definitions: response.GroupDefinitions,
    });
  } catch (error) {
    console.error('Error getting cost and usage:', error);
    throw new Error(
      `Failed to get cost and usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate cost forecasts based on historical usage patterns.
 */
export async function getCostForecast(
  args: GetCostForecastArgs
): Promise<string> {
  const client = getCostExplorerClient();

  // Validate date range
  const dateValidation = validateDateRange(
    args.startDate,
    args.endDate,
    args.granularity
  );
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error);
  }

  try {
    const command = new GetCostForecastCommand({
      TimePeriod: {
        Start: args.startDate,
        End: args.endDate,
      },
      Metric: args.metric,
      Granularity: args.granularity || 'MONTHLY',
      PredictionIntervalLevel:
        args.predictionInterval === 'NINETY_FIVE' ? 95 : 80,
      Filter: args.filter,
    });

    const response = await client.send(command);

    return JSON.stringify({
      time_period: { start: args.startDate, end: args.endDate },
      metric: args.metric,
      granularity: args.granularity || 'MONTHLY',
      prediction_interval: args.predictionInterval || 'EIGHTY',
      total: {
        amount: response.Total?.Amount,
        unit: response.Total?.Unit,
      },
      forecast_results: response.ForecastResultsByTime?.map((result) => ({
        time_period: result.TimePeriod,
        mean_value: result.MeanValue,
        prediction_interval_lower_bound: result.PredictionIntervalLowerBound,
        prediction_interval_upper_bound: result.PredictionIntervalUpperBound,
      })),
    });
  } catch (error) {
    console.error('Error getting cost forecast:', error);
    throw new Error(
      `Failed to get cost forecast: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Compare costs between two time periods.
 * Note: This is a simplified implementation as the AWS SDK doesn't have direct cost comparison APIs.
 * In the Python version, this likely uses a newer API or custom implementation.
 */
export async function getCostAndUsageComparisons(
  args: GetCostAndUsageComparisonsArgs
): Promise<string> {
  // Validate that both periods are exactly one month
  const periodValidation = areOneMonthPeriods(
    args.baseStartDate,
    args.baseEndDate,
    args.comparisonStartDate,
    args.comparisonEndDate
  );

  if (!periodValidation.isValid) {
    throw new Error(periodValidation.error);
  }

  // Get cost data for both periods
  const basePeriodData = await getCostAndUsage({
    startDate: args.baseStartDate,
    endDate: args.baseEndDate,
    granularity: 'MONTHLY',
    groupBy: args.groupBy,
    filter: args.filter,
  });

  const comparisonPeriodData = await getCostAndUsage({
    startDate: args.comparisonStartDate,
    endDate: args.comparisonEndDate,
    granularity: 'MONTHLY',
    groupBy: args.groupBy,
    filter: args.filter,
  });

  // Parse the results and create a comparison
  const baseData = JSON.parse(basePeriodData);
  const comparisonData = JSON.parse(comparisonPeriodData);

  return JSON.stringify({
    base_period: {
      start: args.baseStartDate,
      end: args.baseEndDate,
      data: baseData,
    },
    comparison_period: {
      start: args.comparisonStartDate,
      end: args.comparisonEndDate,
      data: comparisonData,
    },
    note: 'This is a simplified comparison. For detailed cost change drivers, use getCostComparisonDrivers.',
  });
}

/**
 * Analyze what drove cost changes between periods.
 * Note: This is a placeholder implementation as the direct API may not be available in the current SDK version.
 */
export async function getCostComparisonDrivers(
  args: GetCostComparisonDriversArgs
): Promise<string> {
  // This would typically use GetCostComparisonDrivers API when available
  // For now, we'll provide a basic analysis by comparing the periods

  const comparison = await getCostAndUsageComparisons({
    baseStartDate: args.baseStartDate,
    baseEndDate: args.baseEndDate,
    comparisonStartDate: args.comparisonStartDate,
    comparisonEndDate: args.comparisonEndDate,
    groupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    filter: args.filter,
  });

  return JSON.stringify({
    analysis_period: {
      base: { start: args.baseStartDate, end: args.baseEndDate },
      comparison: {
        start: args.comparisonStartDate,
        end: args.comparisonEndDate,
      },
    },
    detailed_comparison: JSON.parse(comparison),
    note: "This is a simplified analysis. AWS Cost Explorer's native comparison drivers API would provide more detailed insights into the top 10 cost change drivers.",
  });
}
