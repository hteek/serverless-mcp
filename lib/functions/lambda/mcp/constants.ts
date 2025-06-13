export const VALID_DIMENSIONS = [
  'SERVICE',
  'REGION',
  'AVAILABILITY_ZONE',
  'INSTANCE_TYPE',
  'USAGE_TYPE',
  'USAGE_TYPE_GROUP',
  'PLATFORM',
  'TENANCY',
  'RECORD_TYPE',
  'LEGAL_ENTITY_NAME',
  'DEPLOYMENT_OPTION',
  'DATABASE_ENGINE',
  'CACHE_ENGINE',
  'INSTANCE_TYPE_FAMILY',
  'BILLING_ENTITY',
  'RESERVATION_ID',
  'RESOURCE_ID',
  'RIGHTSIZING_TYPE',
  'SAVINGS_PLANS_TYPE',
  'SAVINGS_PLAN_ARN',
  'PAYMENT_OPTION',
  'AGREEMENT_END_DATE_TIME_AFTER',
  'AGREEMENT_END_DATE_TIME_BEFORE',
  'INVOICING_ENTITY',
  'ANOMALY_TOTAL_IMPACT_ABSOLUTE',
  'ANOMALY_TOTAL_IMPACT_PERCENTAGE',
] as const;

export const VALID_COST_METRICS = [
  'BlendedCost',
  'UnblendedCost',
  'AmortizedCost',
  'NetAmortizedCost',
  'NetUnblendedCost',
  'NormalizedUsageAmount',
  'UsageQuantity',
] as const;

export const VALID_GRANULARITIES = ['DAILY', 'MONTHLY', 'HOURLY'] as const;

export const VALID_MATCH_OPTIONS = [
  'EQUALS',
  'ABSENT',
  'STARTS_WITH',
  'ENDS_WITH',
  'CONTAINS',
  'CASE_SENSITIVE',
  'CASE_INSENSITIVE',
  'GREATER_THAN_OR_EQUAL',
] as const;

export const VALID_OPERATORS = [
  'OR',
  'AND',
  'NOT',
  'DIMENSIONS',
  'TAGS',
  'COST_CATEGORIES',
] as const;

export const VALID_FORECAST_METRICS = [
  'BLENDED_COST',
  'UNBLENDED_COST',
  'AMORTIZED_COST',
  'NET_AMORTIZED_COST',
  'NET_UNBLENDED_COST',
  'NORMALIZED_USAGE_AMOUNT',
  'USAGE_QUANTITY',
] as const;

export const VALID_PREDICTION_INTERVALS = ['EIGHTY', 'NINETY_FIVE'] as const;

// Default configuration values
export const DEFAULT_REGION = 'us-east-1';
export const DEFAULT_LOG_LEVEL = 'WARNING';
export const COST_EXPLORER_END_DATE_OFFSET = 1;

// Server instructions for MCP clients
export const SERVER_INSTRUCTIONS = `
# AWS Cost Explorer MCP Server

## IMPORTANT: Each API call costs $0.01 - use filters and specific date ranges to minimize charges.

## Critical Rules
- Comparison periods: exactly 1 month, start on day 1 (e.g., "2025-04-01" to "2025-05-01")
- UsageQuantity: Recommended to filter by USAGE_TYPE, USAGE_TYPE_GROUP or results are meaningless
- When user says "last X months": Use complete calendar months, not partial periods
- getCostComparisonDrivers: returns only top 10 most significant drivers

## Query Pattern Mapping

| User Query Pattern | Recommended Tool | Notes |
|-------------------|-----------------|-------|
| "What were my costs for..." | getCostAndUsage | Use for historical cost analysis |
| "How much did I spend on..." | getCostAndUsage | Filter by service/region as needed |
| "Show me costs by..." | getCostAndUsage | Set groupBy parameter accordingly |
| "Compare costs between..." | getCostAndUsageComparisons | Ensure exactly 1 month periods |
| "Why did my costs change..." | getCostComparisonDrivers | Returns top 10 drivers only |
| "What caused my bill to..." | getCostComparisonDrivers | Good for root cause analysis |
| "Predict/forecast my costs..." | getCostForecast | Works best with specific services |
| "What will I spend on..." | getCostForecast | Can filter by dimension |

## Cost Optimization Tips
- Always use specific date ranges rather than broad periods
- Filter by specific services when possible to reduce data processed
- For usage metrics, always filter by USAGE_TYPE or USAGE_TYPE_GROUP to get meaningful results
- Combine related questions into a single query where possible
`;
