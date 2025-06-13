import { z } from 'zod';
import {
  VALID_DIMENSIONS,
  VALID_COST_METRICS,
  VALID_GRANULARITIES,
  VALID_MATCH_OPTIONS,
  VALID_OPERATORS,
  VALID_FORECAST_METRICS,
  VALID_PREDICTION_INTERVALS,
} from './constants.js';

/**
 * Type definitions and Zod schemas for the Cost Explorer MCP Server.
 */

// Create Zod enums from constants
export const DimensionSchema = z.enum(VALID_DIMENSIONS);
export const CostMetricSchema = z.enum(VALID_COST_METRICS);
export const GranularitySchema = z.enum(VALID_GRANULARITIES);
export const MatchOptionSchema = z.enum(VALID_MATCH_OPTIONS);
export const OperatorSchema = z.enum(VALID_OPERATORS);
export const ForecastMetricSchema = z.enum(VALID_FORECAST_METRICS);
export const PredictionIntervalSchema = z.enum(VALID_PREDICTION_INTERVALS);

// Date validation
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Date range schema
export const DateRangeSchema = z
  .object({
    startDate: DateStringSchema.describe('The start date in YYYY-MM-DD format'),
    endDate: DateStringSchema.describe('The end date in YYYY-MM-DD format'),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'Start date must be before end date',
  });

// Filter expression schemas
export const DimensionKeySchema = z.object({
  Key: DimensionSchema,
  Values: z.array(z.string()).min(1).max(50),
  MatchOptions: z.array(MatchOptionSchema).optional(),
});

export const TagKeySchema = z.object({
  Key: z.string(),
  Values: z.array(z.string()).min(1).max(50),
  MatchOptions: z.array(MatchOptionSchema).optional(),
});

export const CostCategorySchema = z.object({
  Key: z.string(),
  Values: z.array(z.string()).min(1).max(50),
  MatchOptions: z.array(MatchOptionSchema).optional(),
});

export const ExpressionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    Or: z.array(ExpressionSchema).optional(),
    And: z.array(ExpressionSchema).optional(),
    Not: ExpressionSchema.optional(),
    Dimensions: DimensionKeySchema.optional(),
    Tags: TagKeySchema.optional(),
    CostCategories: CostCategorySchema.optional(),
  })
);

// Group by schema
export const GroupDefinitionSchema = z.object({
  Type: z.enum(['DIMENSION', 'TAG', 'COST_CATEGORY']),
  Key: z.string().optional(),
});

// Tool parameter schemas
export const GetDimensionValuesSchema = z.object({
  dimensionKey: DimensionSchema.describe(
    `The name of the dimension to retrieve values for. Valid values are: ${VALID_DIMENSIONS.join(', ')}`
  ),
  startDate: DateStringSchema.optional().describe(
    'The start date for the search period in YYYY-MM-DD format. Defaults to 30 days ago if not provided.'
  ),
  endDate: DateStringSchema.optional().describe(
    'The end date for the search period in YYYY-MM-DD format. Defaults to today if not provided.'
  ),
  searchString: z
    .string()
    .optional()
    .describe('The value that you want to search the filter values for'),
  context: z
    .enum(['COST_AND_USAGE', 'RESERVATIONS', 'SAVINGS_PLANS'])
    .optional()
    .describe('The context for the call. Default is COST_AND_USAGE'),
});

export const GetTagValuesSchema = z.object({
  tagKey: z.string().describe('The tag key to retrieve values for'),
  startDate: DateStringSchema.optional().describe(
    'The start date for the search period in YYYY-MM-DD format. Defaults to 30 days ago if not provided.'
  ),
  endDate: DateStringSchema.optional().describe(
    'The end date for the search period in YYYY-MM-DD format. Defaults to today if not provided.'
  ),
  searchString: z
    .string()
    .optional()
    .describe('The value that you want to search the filter values for'),
});

export const GetCostAndUsageSchema = z.object({
  startDate: DateStringSchema.describe('The start date in YYYY-MM-DD format'),
  endDate: DateStringSchema.describe('The end date in YYYY-MM-DD format'),
  granularity: GranularitySchema.optional().describe(
    'The granularity of the data (DAILY, MONTHLY, HOURLY). Default is MONTHLY'
  ),
  metrics: z
    .array(CostMetricSchema)
    .optional()
    .describe(
      `The cost metrics to retrieve. Valid values: ${VALID_COST_METRICS.join(', ')}. Default is UnblendedCost`
    ),
  groupBy: z
    .array(GroupDefinitionSchema)
    .optional()
    .describe('How to group the results (e.g., by SERVICE, REGION, etc.)'),
  filter: ExpressionSchema.optional().describe(
    'Filter expression to limit results'
  ),
});

export const GetCostForecastSchema = z.object({
  startDate: DateStringSchema.describe(
    'The forecast start date in YYYY-MM-DD format'
  ),
  endDate: DateStringSchema.describe(
    'The forecast end date in YYYY-MM-DD format'
  ),
  metric: ForecastMetricSchema.describe(
    `The forecast metric. Valid values: ${VALID_FORECAST_METRICS.join(', ')}`
  ),
  granularity: GranularitySchema.optional().describe(
    'The granularity of the forecast (DAILY, MONTHLY). Default is MONTHLY'
  ),
  predictionInterval: PredictionIntervalSchema.optional().describe(
    'The prediction interval (EIGHTY for 80%, NINETY_FIVE for 95%). Default is EIGHTY'
  ),
  filter: ExpressionSchema.optional().describe(
    'Filter expression to limit the forecast scope'
  ),
});

export const GetCostAndUsageComparisonsSchema = z.object({
  baseStartDate: DateStringSchema.describe(
    'The start date of the base period in YYYY-MM-DD format (must be exactly 1 month period)'
  ),
  baseEndDate: DateStringSchema.describe(
    'The end date of the base period in YYYY-MM-DD format'
  ),
  comparisonStartDate: DateStringSchema.describe(
    'The start date of the comparison period in YYYY-MM-DD format (must be exactly 1 month period)'
  ),
  comparisonEndDate: DateStringSchema.describe(
    'The end date of the comparison period in YYYY-MM-DD format'
  ),
  groupBy: z
    .array(GroupDefinitionSchema)
    .optional()
    .describe('How to group the comparison results'),
  filter: ExpressionSchema.optional().describe(
    'Filter expression to limit the comparison scope'
  ),
});

export const GetCostComparisonDriversSchema = z.object({
  baseStartDate: DateStringSchema.describe(
    'The start date of the base period in YYYY-MM-DD format'
  ),
  baseEndDate: DateStringSchema.describe(
    'The end date of the base period in YYYY-MM-DD format'
  ),
  comparisonStartDate: DateStringSchema.describe(
    'The start date of the comparison period in YYYY-MM-DD format'
  ),
  comparisonEndDate: DateStringSchema.describe(
    'The end date of the comparison period in YYYY-MM-DD format'
  ),
  filter: ExpressionSchema.optional().describe(
    'Filter expression to limit the analysis scope'
  ),
});

// Type exports
export type Dimension = z.infer<typeof DimensionSchema>;
export type CostMetric = z.infer<typeof CostMetricSchema>;
export type Granularity = z.infer<typeof GranularitySchema>;
export type MatchOption = z.infer<typeof MatchOptionSchema>;
export type ForecastMetric = z.infer<typeof ForecastMetricSchema>;
export type PredictionInterval = z.infer<typeof PredictionIntervalSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Expression = z.infer<typeof ExpressionSchema>;
export type GroupDefinition = z.infer<typeof GroupDefinitionSchema>;

export type GetDimensionValuesArgs = z.infer<typeof GetDimensionValuesSchema>;
export type GetTagValuesArgs = z.infer<typeof GetTagValuesSchema>;
export type GetCostAndUsageArgs = z.infer<typeof GetCostAndUsageSchema>;
export type GetCostForecastArgs = z.infer<typeof GetCostForecastSchema>;
export type GetCostAndUsageComparisonsArgs = z.infer<
  typeof GetCostAndUsageComparisonsSchema
>;
export type GetCostComparisonDriversArgs = z.infer<
  typeof GetCostComparisonDriversSchema
>;
