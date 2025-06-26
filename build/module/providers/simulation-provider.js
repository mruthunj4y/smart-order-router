import { ChainId, TradeType } from '@surge/sdk-core';
import { BigNumber } from 'ethers/lib/ethers';
import { SwapType, } from '../routers';
import { Erc20__factory } from '../types/other/factories/Erc20__factory';
import { Permit2__factory } from '../types/other/factories/Permit2__factory';
import { log, SWAP_ROUTER_02_ADDRESSES } from '../util';
function permit2Address(chainId) {
    switch (chainId) {
        case 1449000: // XRPL_EVM_TESTNET
            return '0x3944ebE5fF76D1dB5D265B0A196CeD7d14DAeeB5';
        case 421614: // ARBITRUM_SEPOLIA
            // Replace with actual address if needed
            return '0x0000000000000000000000000000000000000000';
        default:
            throw new Error(`Unsupported chainId for permit2Address: ${chainId}`);
    }
}
export var SimulationStatus;
(function (SimulationStatus) {
    SimulationStatus[SimulationStatus["NotSupported"] = 0] = "NotSupported";
    SimulationStatus[SimulationStatus["Failed"] = 1] = "Failed";
    SimulationStatus[SimulationStatus["Succeeded"] = 2] = "Succeeded";
    SimulationStatus[SimulationStatus["InsufficientBalance"] = 3] = "InsufficientBalance";
    SimulationStatus[SimulationStatus["NotApproved"] = 4] = "NotApproved";
})(SimulationStatus || (SimulationStatus = {}));
/**
 * Provider for dry running transactions.
 *
 * @export
 * @class Simulator
 */
export class Simulator {
    /**
     * Returns a new SwapRoute with simulated gas estimates
     * @returns SwapRoute
     */
    constructor(provider, portionProvider, chainId) {
        this.chainId = chainId;
        this.provider = provider;
        this.portionProvider = portionProvider;
    }
    async simulate(fromAddress, swapOptions, swapRoute, amount, quote, providerConfig) {
        const neededBalance = swapRoute.trade.tradeType == TradeType.EXACT_INPUT ? amount : quote;
        if (
        // we assume we always have enough eth mainnet balance because we use beacon address later
        (neededBalance.currency.isNative && this.chainId == ChainId.XRPL_EVM_TESTNET) ||
            (await this.userHasSufficientBalance(fromAddress, swapRoute.trade.tradeType, amount, quote))) {
            log.info('User has sufficient balance to simulate. Simulating transaction.');
            try {
                return this.simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig);
            }
            catch (e) {
                log.error({ e }, 'Error simulating transaction');
                return {
                    ...swapRoute,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else {
            log.error('User does not have sufficient balance to simulate.');
            return {
                ...swapRoute,
                simulationStatus: SimulationStatus.InsufficientBalance,
            };
        }
    }
    async userHasSufficientBalance(fromAddress, tradeType, amount, quote) {
        try {
            const neededBalance = tradeType == TradeType.EXACT_INPUT ? amount : quote;
            let balance;
            if (neededBalance.currency.isNative) {
                balance = await this.provider.getBalance(fromAddress);
            }
            else {
                const tokenContract = Erc20__factory.connect(neededBalance.currency.address, this.provider);
                balance = await tokenContract.balanceOf(fromAddress);
            }
            const hasBalance = balance.gte(BigNumber.from(neededBalance.quotient.toString()));
            log.info({
                fromAddress,
                balance: balance.toString(),
                neededBalance: neededBalance.quotient.toString(),
                neededAddress: neededBalance.wrapped.currency.address,
                hasBalance,
            }, 'Result of balance check for simulation');
            return hasBalance;
        }
        catch (e) {
            log.error(e, 'Error while checking user balance');
            return false;
        }
    }
    async checkTokenApproved(fromAddress, inputAmount, swapOptions, provider) {
        // Check token has approved Permit2 more than expected amount.
        const tokenContract = Erc20__factory.connect(inputAmount.currency.wrapped.address, provider);
        if (swapOptions.type == SwapType.UNIVERSAL_ROUTER) {
            const permit2Allowance = await tokenContract.allowance(fromAddress, permit2Address(this.chainId));
            // If a permit has been provided we don't need to check if UR has already been allowed.
            if (swapOptions.inputTokenPermit) {
                log.info({
                    permitAllowance: permit2Allowance.toString(),
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Permit was provided for simulation on UR, checking that Permit2 has been approved.');
                return permit2Allowance.gte(BigNumber.from(inputAmount.quotient.toString()));
            }
            // Check UR has been approved from Permit2.
            const permit2Contract = Permit2__factory.connect(permit2Address(this.chainId), provider);
            const { amount: universalRouterAllowance, expiration: tokenExpiration } = await permit2Contract.allowance(fromAddress, inputAmount.currency.wrapped.address, SWAP_ROUTER_02_ADDRESSES(this.chainId));
            const nowTimestampS = Math.round(Date.now() / 1000);
            const inputAmountBN = BigNumber.from(inputAmount.quotient.toString());
            const permit2Approved = permit2Allowance.gte(inputAmountBN);
            const universalRouterApproved = universalRouterAllowance.gte(inputAmountBN);
            const expirationValid = tokenExpiration > nowTimestampS;
            log.info({
                permitAllowance: permit2Allowance.toString(),
                tokenAllowance: universalRouterAllowance.toString(),
                tokenExpirationS: tokenExpiration,
                nowTimestampS,
                inputAmount: inputAmount.quotient.toString(),
                permit2Approved,
                universalRouterApproved,
                expirationValid,
            }, `Simulating on UR, Permit2 approved: ${permit2Approved}, UR approved: ${universalRouterApproved}, Expiraton valid: ${expirationValid}.`);
            return permit2Approved && universalRouterApproved && expirationValid;
        }
        else if (swapOptions.type == SwapType.SWAP_ROUTER_02) {
            if (swapOptions.inputTokenPermit) {
                log.info({
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Simulating on SwapRouter02 info - Permit was provided for simulation. Not checking allowances.');
                return true;
            }
            const allowance = await tokenContract.allowance(fromAddress, SWAP_ROUTER_02_ADDRESSES(this.chainId));
            const hasAllowance = allowance.gte(BigNumber.from(inputAmount.quotient.toString()));
            log.info({
                hasAllowance,
                allowance: allowance.toString(),
                inputAmount: inputAmount.quotient.toString(),
            }, `Simulating on SwapRouter02 - Has allowance: ${hasAllowance}`);
            // Return true if token allowance is greater than input amount
            return hasAllowance;
        }
        throw new Error(`Unsupported swap type ${swapOptions}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU5QyxPQUFPLEVBSUwsUUFBUSxHQUNULE1BQU0sWUFBWSxDQUFDO0FBQ3BCLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM3RSxPQUFPLEVBQWtCLEdBQUcsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUl4RSxTQUFTLGNBQWMsQ0FBQyxPQUFlO0lBQ3JDLFFBQVEsT0FBTyxFQUFFO1FBQ2YsS0FBSyxPQUFPLEVBQUUsbUJBQW1CO1lBQy9CLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxNQUFNLEVBQUUsbUJBQW1CO1lBQzlCLHdDQUF3QztZQUN4QyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3REO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN6RTtBQUNILENBQUM7QUFZRCxNQUFNLENBQU4sSUFBWSxnQkFNWDtBQU5ELFdBQVksZ0JBQWdCO0lBQzFCLHVFQUFnQixDQUFBO0lBQ2hCLDJEQUFVLENBQUE7SUFDVixpRUFBYSxDQUFBO0lBQ2IscUZBQXVCLENBQUE7SUFDdkIscUVBQWUsQ0FBQTtBQUNqQixDQUFDLEVBTlcsZ0JBQWdCLEtBQWhCLGdCQUFnQixRQU0zQjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFnQixTQUFTO0lBSTdCOzs7T0FHRztJQUNILFlBQ0UsUUFBeUIsRUFDekIsZUFB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