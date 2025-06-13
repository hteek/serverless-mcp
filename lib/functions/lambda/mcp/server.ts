import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import packageInfo from '../../../../package.json' with { type: 'json' };

import {
  getCostAndUsage,
  getCostAndUsageComparisons,
  getCostComparisonDrivers,
  getCostForecast,
  getDimensionValues,
  getTagValues,
  getTodayDateTool,
} from './tools.js';
import {
  GetCostAndUsageComparisonsSchema,
  GetCostAndUsageSchema,
  GetCostComparisonDriversSchema,
  GetCostForecastSchema,
  GetDimensionValuesSchema,
  GetTagValuesSchema,
} from './types.js';

// Create an MCP server
export const getServer = () => {
  const server = new McpServer(
    {
      name: packageInfo.name,
      version: packageInfo.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_today_date',
        description:
          'Get the current date and month to determine relevant data when answering queries about "last month", etc.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_dimension_values',
        description:
          'Get available values for a specific dimension (e.g., SERVICE, REGION, INSTANCE_TYPE). Use this to discover what values are available for filtering.',
        inputSchema: {
          type: 'object',
          properties: {
            dimensionKey: {
              type: 'string',
              description:
                'The name of the dimension to retrieve values for. Valid values are: SERVICE, REGION, AVAILABILITY_ZONE, INSTANCE_TYPE, USAGE_TYPE, USAGE_TYPE_GROUP, PLATFORM, TENANCY, RECORD_TYPE, LEGAL_ENTITY_NAME, DEPLOYMENT_OPTION, DATABASE_ENGINE, CACHE_ENGINE, INSTANCE_TYPE_FAMILY, BILLING_ENTITY, RESERVATION_ID, RESOURCE_ID, RIGHTSIZING_TYPE, SAVINGS_PLANS_TYPE, SAVINGS_PLAN_ARN, PAYMENT_OPTION, AGREEMENT_END_DATE_TIME_AFTER, AGREEMENT_END_DATE_TIME_BEFORE, INVOICING_ENTITY, ANOMALY_TOTAL_IMPACT_ABSOLUTE, ANOMALY_TOTAL_IMPACT_PERCENTAGE',
            },
            startDate: {
              type: 'string',
              description:
                'The start date for the search period in YYYY-MM-DD format. Defaults to 30 days ago if not provided.',
            },
            endDate: {
              type: 'string',
              description:
                'The end date for the search period in YYYY-MM-DD format. Defaults to today if not provided.',
            },
            searchString: {
              type: 'string',
              description:
                'The value that you want to search the filter values for',
            },
            context: {
              type: 'string',
              enum: ['COST_AND_USAGE', 'RESERVATIONS', 'SAVINGS_PLANS'],
              description:
                'The context for the call. Default is COST_AND_USAGE',
            },
          },
          required: ['dimensionKey'],
        },
      },
      {
        name: 'get_tag_values',
        description:
          'Get available values for a specific tag key. Use this to discover what tag values are available for filtering.',
        inputSchema: {
          type: 'object',
          properties: {
            tagKey: {
              type: 'string',
              description: 'The tag key to retrieve values for',
            },
            startDate: {
              type: 'string',
              description:
                'The start date for the search period in YYYY-MM-DD format. Defaults to 30 days ago if not provided.',
            },
            endDate: {
              type: 'string',
              description:
                'The end date for the search period in YYYY-MM-DD format. Defaults to today if not provided.',
            },
            searchString: {
              type: 'string',
              description:
                'The value that you want to search the filter values for',
            },
          },
          required: ['tagKey'],
        },
      },
      {
        name: 'get_cost_and_usage',
        description:
          'Retrieve AWS cost and usage data with filtering and grouping options. This is the main tool for cost analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'The start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'The end date in YYYY-MM-DD format',
            },
            granularity: {
              type: 'string',
              enum: ['DAILY', 'MONTHLY', 'HOURLY'],
              description: 'The granularity of the data. Default is MONTHLY',
            },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'BlendedCost',
                  'UnblendedCost',
                  'AmortizedCost',
                  'NetAmortizedCost',
                  'NetUnblendedCost',
                  'NormalizedUsageAmount',
                  'UsageQuantity',
                ],
              },
              description:
                'The cost metrics to retrieve. Default is UnblendedCost',
            },
            groupBy: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  Type: {
                    type: 'string',
                    enum: ['DIMENSION', 'TAG', 'COST_CATEGORY'],
                  },
                  Key: {
                    type: 'string',
                  },
                },
                required: ['Type'],
              },
              description:
                'How to group the results (e.g., by SERVICE, REGION, etc.)',
            },
            filter: {
              type: 'object',
              description: 'Filter expression to limit results',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'get_cost_forecast',
        description:
          'Generate cost forecasts based on historical usage patterns. Useful for budget planning.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'The forecast start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'The forecast end date in YYYY-MM-DD format',
            },
            metric: {
              type: 'string',
              enum: [
                'BLENDED_COST',
                'UNBLENDED_COST',
                'AMORTIZED_COST',
                'NET_AMORTIZED_COST',
                'NET_UNBLENDED_COST',
                'NORMALIZED_USAGE_AMOUNT',
                'USAGE_QUANTITY',
              ],
              description: 'The forecast metric',
            },
            granularity: {
              type: 'string',
              enum: ['DAILY', 'MONTHLY'],
              description:
                'The granularity of the forecast. Default is MONTHLY',
            },
            predictionInterval: {
              type: 'string',
              enum: ['EIGHTY', 'NINETY_FIVE'],
              description:
                'The prediction interval (EIGHTY for 80%, NINETY_FIVE for 95%). Default is EIGHTY',
            },
            filter: {
              type: 'object',
              description: 'Filter expression to limit the forecast scope',
            },
          },
          required: ['startDate', 'endDate', 'metric'],
        },
      },
      {
        name: 'get_cost_and_usage_comparisons',
        description:
          'Compare costs between two time periods to identify changes and trends. Both periods must be exactly 1 month and start on day 1.',
        inputSchema: {
          type: 'object',
          properties: {
            baseStartDate: {
              type: 'string',
              description:
                'The start date of the base period in YYYY-MM-DD format (must be exactly 1 month period)',
            },
            baseEndDate: {
              type: 'string',
              description:
                'The end date of the base period in YYYY-MM-DD format',
            },
            comparisonStartDate: {
              type: 'string',
              description:
                'The start date of the comparison period in YYYY-MM-DD format (must be exactly 1 month period)',
            },
            comparisonEndDate: {
              type: 'string',
              description:
                'The end date of the comparison period in YYYY-MM-DD format',
            },
            groupBy: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  Type: {
                    type: 'string',
                    enum: ['DIMENSION', 'TAG', 'COST_CATEGORY'],
                  },
                  Key: {
                    type: 'string',
                  },
                },
                required: ['Type'],
              },
              description: 'How to group the comparison results',
            },
            filter: {
              type: 'object',
              description: 'Filter expression to limit the comparison scope',
            },
          },
          required: [
            'baseStartDate',
            'baseEndDate',
            'comparisonStartDate',
            'comparisonEndDate',
          ],
        },
      },
      {
        name: 'get_cost_comparison_drivers',
        description:
          'Analyze what drove cost changes between periods (returns top 10 most significant drivers). Good for root cause analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            baseStartDate: {
              type: 'string',
              description:
                'The start date of the base period in YYYY-MM-DD format',
            },
            baseEndDate: {
              type: 'string',
              description:
                'The end date of the base period in YYYY-MM-DD format',
            },
            comparisonStartDate: {
              type: 'string',
              description:
                'The start date of the comparison period in YYYY-MM-DD format',
            },
            comparisonEndDate: {
              type: 'string',
              description:
                'The end date of the comparison period in YYYY-MM-DD format',
            },
            filter: {
              type: 'object',
              description: 'Filter expression to limit the analysis scope',
            },
          },
          required: [
            'baseStartDate',
            'baseEndDate',
            'comparisonStartDate',
            'comparisonEndDate',
          ],
        },
      },
    ],
  }));

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { arguments: args, name } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'get_today_date':
          result = await getTodayDateTool();
          break;

        case 'get_dimension_values':
          const dimensionArgs = GetDimensionValuesSchema.parse(args);
          result = await getDimensionValues(dimensionArgs);
          break;

        case 'get_tag_values':
          const tagArgs = GetTagValuesSchema.parse(args);
          result = await getTagValues(tagArgs);
          break;

        case 'get_cost_and_usage':
          const costUsageArgs = GetCostAndUsageSchema.parse(args);
          result = await getCostAndUsage(costUsageArgs);
          break;

        case 'get_cost_forecast':
          const forecastArgs = GetCostForecastSchema.parse(args);
          result = await getCostForecast(forecastArgs);
          break;

        case 'get_cost_and_usage_comparisons':
          const comparisonArgs = GetCostAndUsageComparisonsSchema.parse(args);
          result = await getCostAndUsageComparisons(comparisonArgs);
          break;

        case 'get_cost_comparison_drivers':
          const driversArgs = GetCostComparisonDriversSchema.parse(args);
          result = await getCostComparisonDrivers(driversArgs);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
};
