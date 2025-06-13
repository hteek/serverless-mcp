import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';

/**
 * AWS Cost Explorer client configuration and initialization.
 */

let costExplorerClient: CostExplorerClient | null = null;

/**
 * Get or create the Cost Explorer client.
 */
export function getCostExplorerClient(): CostExplorerClient {
  if (!costExplorerClient) {
    costExplorerClient = new CostExplorerClient();
  }

  return costExplorerClient;
}
