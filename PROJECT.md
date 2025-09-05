## Inspiration

The Model Context Protocol (MCP) enables AI agents to access external tools and data sources, but deploying MCP servers traditionally requires managing infrastructure, authentication, and scaling. Additionally, there was a lack of real streaming HTTP implementations publicly available on the internet, limiting MCP's potential for real-time applications. I wanted to eliminate these barriers by creating a truly serverless MCP implementation with proper streaming support that leverages AWS's managed services to provide enterprise-grade reliability with zero operational overhead.

## What it does

Serverless MCP transforms AWS Lambda into a powerful MCP server platform with complete OAuth 2.0 authentication, real-time streaming via Server-Sent Events with JSON-RPC 2.0 messaging, and seamless AWS service integration. The implementation includes 7 AWS Cost Explorer tools as an example showcase, demonstrating how AI agents can access complex AWS services for tasks like analyzing cloud spending and generating forecasts - all without managing any servers.

## How I built it

Built with AWS CDK and TypeScript, the architecture consists of two main stacks: ServerlessMcpStack (core infrastructure) and GitHubOidcStack (CI/CD). I created a custom HTTP transport that bridges the MCP SDK to AWS Lambda Function URLs, enabling SSE streaming for real-time communication. The system uses CloudFront for global distribution, Cognito for OAuth authentication, and DynamoDB for data persistence. All Lambda functions use middleware composition with @middy/core for clean separation of concerns.

## Challenges I ran into

The biggest challenge was implementing MCP's streaming protocol over Lambda's stateless architecture. I had to design a custom transport layer that works within serverless constraints while maintaining protocol compliance. Another major hurdle was integrating Server-Sent Events with Lambda Function URLs, requiring careful handling of HTTP response streams and connection management. The OAuth 2.0 flow also needed extensive customization to work seamlessly with the serverless architecture, specifically implementing OAuth 2.0 Authorization Server Metadata (RFC 8414), OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591), and OAuth 2.0 Protected Resource Metadata (RFC 9728) to support the MCP authorization specification. Additionally, Cognito service limitations made it difficult to support these necessary OAuth components of the MCP specifications, requiring creative workarounds to maintain protocol compliance.

## Accomplishments that I am proud of

Successfully created the first production-ready serverless MCP server that maintains full protocol compliance while adding enterprise features like OAuth authentication and real-time streaming. The custom transport implementation elegantly works within serverless constraints, and the AWS Cost Explorer toolkit serves as a compelling example demonstrating the feasibility and power of the serverless MCP approach for accessing complex AWS services. The entire infrastructure deploys with a single command and scales automatically.

## What I learned

Serverless architectures require fundamentally different approaches to protocol implementation - you can't simply port traditional server patterns. I gained deep expertise in MCP protocol internals, AWS Lambda streaming capabilities, and the intricacies of OAuth 2.0 flows in serverless environments.

## What's next for Serverless MCP with Streamable HTTP and OAuth 2 support

I plan to open source the streamable HTTP Lambda transport as a standalone package, making it available for the broader MCP community to build upon. Additionally, I'll create custom CDK constructs that abstract away the complexity of building serverless MCP servers, allowing developers to deploy production-ready MCP implementations with just a few lines of code. This will democratize serverless MCP development and accelerate adoption across the ecosystem.
