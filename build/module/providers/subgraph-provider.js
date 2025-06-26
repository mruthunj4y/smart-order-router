import retry from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';
import { log, metric } from '../util';
const PAGE_SIZE = 1000; // 1k is max possible query size from subgraph.
export class SubgraphProvider {
    constructor(protocol, chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrl) {
        this.protocol = protocol;
        this.chainId = chainId;
        this.retries = retries;
        this.timeout = timeout;
        this.rollback = rollback;
        this.trackedEthThreshold = trackedEthThreshold;
        this.untrackedUsdThreshold = untrackedUsdThreshold;
        this.subgraphUrl = subgraphUrl;
        this.protocol = protocol;
        if (!this.subgraphUrl) {
            throw new Error(`No subgraph url for chain id: ${this.chainId}`);
        }
        this.client = new GraphQLClient(this.subgraphUrl);
    }
    async getPools(_currencyIn, _currencyOut, providerConfig) {
        const beforeAll = Date.now();
        let blockNumber = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? await providerConfig.blockNumber
            : undefined;
        const query = gql `
      ${this.subgraphQuery(blockNumber)}
    `;
        let pools = [];
        log.info(`Getting ${this.protocol} pools from the subgraph with page size ${PAGE_SIZE}${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? ` as of block ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}`
            : ''}.`);
        let retries = 0;
        await retry(async () => {
            const timeout = new Timeout();
            const getPools = async () => {
                let lastId = '';
                let pools = [];
                let poolsPage = [];
                // metrics variables
                let totalPages = 0;
                do {
                    totalPages += 1;
                    const poolsResult = await this.client.request(query, {
                        pageSize: PAGE_SIZE,
                        id: lastId,
                    });
                    poolsPage = poolsResult.pools;
                    pools = pools.concat(poolsPage);
                    lastId = pools[pools.length - 1].id;
                    metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate.pageSize`, poolsPage.length);
                } while (poolsPage.length > 0);
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate`, totalPages);
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.pools.length`, pools.length);
                return pools;
            };
            try {
                const getPoolsPromise = getPools();
                const timerPromise = timeout.set(this.timeout).then(() => {
                    throw new Error(`Timed out getting pools from subgraph: ${this.timeout}`);
                });
                pools = await Promise.race([getPoolsPromise, timerPromise]);
                return;
            }
            catch (err) {
                log.error({ err }, `Error fetching ${this.protocol} Subgraph Pools.`);
                throw err;
            }
            finally {
                timeout.clear();
            }
        }, {
            retries: this.retries,
            onRetry: (err, retry) => {
                retries += 1;
                if (this.rollback &&
                    blockNumber &&
                    typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' && _.includes(err.message, 'indexed up to')) {
                    metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.indexError`, 1);
                    blockNumber = blockNumber - 10;
                    log.info(`Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`);
                }
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.timeout`, 1);
                pools = [];
                if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
                    log.info({ err }, `Failed to get pools from subgraph. Retry attempt: ${retry}`);
                }
                else {
                    log.info(`Failed to get pools from subgraph. Retry attempt: ${retry}`);
                }
            },
        });
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.retries`, retries);
        const untrackedPools = pools.filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > this.trackedEthThreshold ||
            parseFloat(pool.totalValueLockedUSDUntracked) >
                this.untrackedUsdThreshold);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.length`, untrackedPools.length);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.percent`, (untrackedPools.length / pools.length) * 100);
        const beforeFilter = Date.now();
        const poolsSanitized = pools
            .filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > this.trackedEthThreshold)
            .map((pool) => {
            return this.mapSubgraphPool(pool);
        });
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.latency`, Date.now() - beforeFilter);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.length`, poolsSanitized.length);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.percent`, (poolsSanitized.length / pools.length) * 100);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools`, 1);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.latency`, Date.now() - beforeAll);
        log.info(`Got ${pools.length} ${this.protocol} pools from the subgraph. ${poolsSanitized.length} after filtering`);
        return poolsSanitized;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sS0FBSyxNQUFNLGFBQWEsQ0FBQztBQUNoQyxPQUFPLE9BQU8sTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxFQUFFLEdBQUcsRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRCxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFHdkIsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFZdEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsK0NBQStDO0FBaUN2RSxNQUFNLE9BQWdCLGdCQUFnQjtJQU1wQyxZQUNVLFFBQWtCLEVBQ2xCLE9BQWdCLEVBQ2hCLFVBQVUsQ0FBQyxFQUNYLFVBQVUsS0FBSyxFQUNmLFdBQVcsSUFBSSxFQUNmLHNCQUFzQixJQUFJLEVBQzFCLHdCQUF3QixNQUFNLENBQUMsU0FBUyxFQUN4QyxXQUFvQjtRQVBwQixhQUFRLEdBQVIsUUFBUSxDQUFVO1FBQ2xCLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsWUFBTyxHQUFQLE9BQU8sQ0FBSTtRQUNYLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFDZixhQUFRLEdBQVIsUUFBUSxDQUFPO1FBQ2Ysd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFPO1FBQzFCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBbUI7UUFDeEMsZ0JBQVcsR0FBWCxXQUFXLENBQVM7UUFFNUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbEU7UUFDRCxJ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