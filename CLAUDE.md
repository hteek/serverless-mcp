# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a serverless MCP (Model Context Protocol) server implementation built with AWS CDK and TypeScript. The project creates a complete serverless infrastructure for hosting MCP servers on AWS Lambda with authentication, streaming HTTP support, and CloudFront distribution.

## Architecture

The codebase follows a serverless microservices pattern with clear separation of concerns:

### Infrastructure (CDK)

- **Main Stack** (`lib/index.ts`): ServerlessMcpStack creates the complete AWS infrastructure
  - Two CDK stacks: `ServerlessMcpStack` (main infrastructure) and `GitHubOidcStack` (CI/CD roles)
  - Uses `constructs` pattern with dedicated classes for each AWS service grouping
- **Certificate** (`lib/certificate.ts`): DNS-validated SSL certificates for custom domains
- **Distribution** (`lib/distribution.ts`): CloudFront distribution with MCP endpoints
- **User Pool** (`lib/userPool.ts`): Cognito authentication for OAuth flows
- **Table** (`lib/table.ts`): DynamoDB table for MCP data persistence
- **Functions** (`lib/functions/`): Lambda function definitions and configurations

### Lambda Functions

- **MCP Server** (`lib/functions/lambda/mcp/server.ts`): Core MCP server implementation with tools and resources
- **Streamable HTTP Lambda** (`lib/functions/lambda/mcp/streamableHttpLambda.ts`): Custom HTTP transport for MCP over Lambda with SSE support
  - Implements stateful/stateless session management
  - Handles Server-Sent Events (SSE) streaming for real-time communication
  - Custom transport bridging MCP SDK to AWS Lambda Function URLs
- **Handlers**: Various Lambda handlers for OAuth, client management, and MCP operations
- **Middleware**: Shared middleware for authentication, DynamoDB, and AWS services
  - Uses `@middy/core` for Lambda middleware composition
  - Includes authentication, error handling, and AWS service integration
- **Models**: Data models and schemas using Zod for validation
  - DynamoDB data models using `dynamodb-onetable`
  - Zod schemas for type-safe API validation

### Import System

The project uses custom import maps defined in package.json for clean internal imports:

```typescript
// Instead of relative imports like ../../../functions/lambda/mcp
import { something } from '#mcp';        // Maps to ./lib/functions/lambda/mcp/index.js
import { middleware } from '#middleware'; // Maps to ./lib/functions/lambda/middleware/index.js
import { Model } from '#model';          // Maps to ./lib/functions/lambda/model/index.js
import { powertools } from '#powertools'; // Maps to ./lib/functions/lambda/powertools/index.js
import { utils } from '#utils';          // Maps to ./lib/functions/lambda/utils/index.js
```

### Key Features

- **MCP Protocol**: Implements Model Context Protocol with tools and resources
- **Streaming HTTP**: Custom streamable HTTP transport for Lambda with Server-Sent Events
- **OAuth Authentication**: Complete OAuth 2.0 flow with Cognito integration
- **Session Management**: Stateful and stateless session handling
- **GitHub OIDC**: GitHub Actions deployment with OIDC authentication

## Development Commands

### Build and Development

```bash
pnpm build                 # Compile TypeScript to JavaScript
pnpm watch                 # Watch for changes and compile
pnpm test                  # Run Vitest tests
pnpm test:watch           # Run tests in watch mode
pnpm test:ui              # Run tests with UI

# Running specific tests
vitest run test/index.test.ts    # Run a specific test file
vitest related --coverage=false --reporter=verbose --passWithNoTests  # Used by lint-staged
```

### Code Quality

```bash
pnpm lint                 # Run ESLint
pnpm lint:fix            # Run ESLint with auto-fix
pnpm format              # Format code with Prettier
pnpm format:check        # Check code formatting
```

### CDK Operations

```bash
pnpm cdk deploy          # Deploy infrastructure to AWS
pnpm cdk diff            # Show differences between local and deployed
pnpm cdk synth           # Synthesize CloudFormation templates
pnpm cdk destroy         # Tear down infrastructure
```

## Configuration

- **Config**: Environment-specific configuration in `config/default.ts`
- **CDK Context**: Feature flags and settings in `cdk.json`
- **Package Manager**: Uses pnpm with Node.js 22
- **Import Maps**: Custom import paths defined in package.json (`#mcp`, `#middleware`, etc.)

## Testing

- **Framework**: Vitest for unit testing
- **Snapshots**: Test snapshots in `test/__snapshots__/`
- **Coverage**: Test coverage reporting available via Vitest

## Code Conventions

- **TypeScript**: Strict TypeScript configuration with ES modules
- **ESLint**: TypeScript ESLint with Prettier integration
- **Commitizen**: Conventional commit messages with `serverless-mcp` scope
- **Husky**: Git hooks for code quality
- **Lint-staged**: Pre-commit linting and formatting with the following workflow:
  - Non-test files: prettier → eslint --fix → vitest related
  - Test files: prettier → eslint --fix (no test execution)
  - JSON/Markdown: prettier only

## Deployment

The project uses GitHub Actions with OIDC for AWS deployment. The GitHubOidcStack creates the necessary IAM roles and policies for secure deployment without long-lived credentials.

## MCP Implementation Details

The MCP server (`lib/functions/lambda/mcp/server.ts`) implements a complete AWS Cost Explorer toolkit:

- **Tools**: 7 AWS Cost Explorer tools for comprehensive cost analysis:
  - `get_today_date` - Current date helper for relative queries
  - `get_dimension_values` - Discover available AWS dimension values (SERVICE, REGION, etc.)
  - `get_tag_values` - Discover available tag values for filtering
  - `get_cost_and_usage` - Main cost and usage data retrieval with filtering/grouping
  - `get_cost_forecast` - Generate cost forecasts based on historical patterns
  - `get_cost_and_usage_comparisons` - Compare costs between time periods
  - `get_cost_comparison_drivers` - Analyze what drove cost changes
- **Resources**: A dynamic greeting resource template
- **Protocol**: Full MCP protocol compliance with JSON-RPC messaging

The streamable HTTP transport (`lib/functions/lambda/mcp/streamableHttpLambda.ts`) provides:

- **SSE Streaming**: Server-Sent Events for real-time communication
- **Session Management**: Stateful session handling with validation
- **Protocol Versioning**: Support for multiple MCP protocol versions
- **Error Handling**: Comprehensive error responses with proper HTTP status codes

