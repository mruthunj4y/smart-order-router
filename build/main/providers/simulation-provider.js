"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Simulator = exports.SimulationStatus = void 0;
const sdk_core_1 = require("@surge/sdk-core");
const ethers_1 = require("ethers/lib/ethers");
const routers_1 = require("../routers");
const Erc20__factory_1 = require("../types/other/factories/Erc20__factory");
const Permit2__factory_1 = require("../types/other/factories/Permit2__factory");
const util_1 = require("../util");
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
var SimulationStatus;
(function (SimulationStatus) {
    SimulationStatus[SimulationStatus["NotSupported"] = 0] = "NotSupported";
    SimulationStatus[SimulationStatus["Failed"] = 1] = "Failed";
    SimulationStatus[SimulationStatus["Succeeded"] = 2] = "Succeeded";
    SimulationStatus[SimulationStatus["InsufficientBalance"] = 3] = "InsufficientBalance";
    SimulationStatus[SimulationStatus["NotApproved"] = 4] = "NotApproved";
})(SimulationStatus = exports.SimulationStatus || (exports.SimulationStatus = {}));
/**
 * Provider for dry running transactions.
 *
 * @export
 * @class Simulator
 */
class Simulator {
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
        const neededBalance = swapRoute.trade.tradeType == sdk_core_1.TradeType.EXACT_INPUT ? amount : quote;
        if (
        // we assume we always have enough eth mainnet balance because we use beacon address later
        (neededBalance.currency.isNative && this.chainId == sdk_core_1.ChainId.XRPL_EVM_TESTNET) ||
            (await this.userHasSufficientBalance(fromAddress, swapRoute.trade.tradeType, amount, quote))) {
            util_1.log.info('User has sufficient balance to simulate. Simulating transaction.');
            try {
                return this.simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig);
            }
            catch (e) {
                util_1.log.error({ e }, 'Error simulating transaction');
                return Object.assign(Object.assign({}, swapRoute), { simulationStatus: SimulationStatus.Failed });
            }
        }
        else {
            util_1.log.error('User does not have sufficient balance to simulate.');
            return Object.assign(Object.assign({}, swapRoute), { simulationStatus: SimulationStatus.InsufficientBalance });
        }
    }
    async userHasSufficientBalance(fromAddress, tradeType, amount, quote) {
        try {
            const neededBalance = tradeType == sdk_core_1.TradeType.EXACT_INPUT ? amount : quote;
            let balance;
            if (neededBalance.currency.isNative) {
                balance = await this.provider.getBalance(fromAddress);
            }
            else {
                const tokenContract = Erc20__factory_1.Erc20__factory.connect(neededBalance.currency.address, this.provider);
                balance = await tokenContract.balanceOf(fromAddress);
            }
            const hasBalance = balance.gte(ethers_1.BigNumber.from(neededBalance.quotient.toString()));
            util_1.log.info({
                fromAddress,
                balance: balance.toString(),
                neededBalance: neededBalance.quotient.toString(),
                neededAddress: neededBalance.wrapped.currency.address,
                hasBalance,
            }, 'Result of balance check for simulation');
            return hasBalance;
        }
        catch (e) {
            util_1.log.error(e, 'Error while checking user balance');
            return false;
        }
    }
    async checkTokenApproved(fromAddress, inputAmount, swapOptions, provider) {
        // Check token has approved Permit2 more than expected amount.
        const tokenContract = Erc20__factory_1.Erc20__factory.connect(inputAmount.currency.wrapped.address, provider);
        if (swapOptions.type == routers_1.SwapType.UNIVERSAL_ROUTER) {
            const permit2Allowance = await tokenContract.allowance(fromAddress, permit2Address(this.chainId));
            // If a permit has been provided we don't need to check if UR has already been allowed.
            if (swapOptions.inputTokenPermit) {
                util_1.log.info({
                    permitAllowance: permit2Allowance.toString(),
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Permit was provided for simulation on UR, checking that Permit2 has been approved.');
                return permit2Allowance.gte(ethers_1.BigNumber.from(inputAmount.quotient.toString()));
            }
            // Check UR has been approved from Permit2.
            const permit2Contract = Permit2__factory_1.Permit2__factory.connect(permit2Address(this.chainId), provider);
            const { amount: universalRouterAllowance, expiration: tokenExpiration } = await permit2Contract.allowance(fromAddress, inputAmount.currency.wrapped.address, (0, util_1.SWAP_ROUTER_02_ADDRESSES)(this.chainId));
            const nowTimestampS = Math.round(Date.now() / 1000);
            const inputAmountBN = ethers_1.BigNumber.from(inputAmount.quotient.toString());
            const permit2Approved = permit2Allowance.gte(inputAmountBN);
            const universalRouterApproved = universalRouterAllowance.gte(inputAmountBN);
            const expirationValid = tokenExpiration > nowTimestampS;
            util_1.log.info({
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
        else if (swapOptions.type == routers_1.SwapType.SWAP_ROUTER_02) {
            if (swapOptions.inputTokenPermit) {
                util_1.log.info({
                    inputAmount: inputAmount.quotient.toString(),
                }, 'Simulating on SwapRouter02 info - Permit was provided for simulation. Not checking allowances.');
                return true;
            }
            const allowance = await tokenContract.allowance(fromAddress, (0, util_1.SWAP_ROUTER_02_ADDRESSES)(this.chainId));
            const hasAllowance = allowance.gte(ethers_1.BigNumber.from(inputAmount.quotient.toString()));
            util_1.log.info({
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
exports.Simulator = Simulator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4Q0FBcUQ7QUFDckQsOENBQThDO0FBRTlDLHdDQUtvQjtBQUNwQiw0RUFBeUU7QUFDekUsZ0ZBQTZFO0FBQzdFLGtDQUF3RTtBQUl4RSxTQUFTLGNBQWMsQ0FBQyxPQUFlO0lBQ3JDLFFBQVEsT0FBTyxFQUFFO1FBQ2YsS0FBSyxPQUFPLEVBQUUsbUJBQW1CO1lBQy9CLE9BQU8sNENBQTRDLENBQUM7UUFDdEQsS0FBSyxNQUFNLEVBQUUsbUJBQW1CO1lBQzlCLHdDQUF3QztZQUN4QyxPQUFPLDRDQUE0QyxDQUFDO1FBQ3REO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN6RTtBQUNILENBQUM7QUFZRCxJQUFZLGdCQU1YO0FBTkQsV0FBWSxnQkFBZ0I7SUFDMUIsdUVBQWdCLENBQUE7SUFDaEIsMkRBQVUsQ0FBQTtJQUNWLGlFQUFhLENBQUE7SUFDYixxRkFBdUIsQ0FBQTtJQUN2QixxRUFBZSxDQUFBO0FBQ2pCLENBQUMsRUFOVyxnQkFBZ0IsR0FBaEIsd0JBQWdCLEtBQWhCLHdCQUFnQixRQU0zQjtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBc0IsU0FBUztJQUk3Qjs7O09BR0c7SUFDSCxZQUNFLFFBQXlCLEVBQ3pCLGVBQWlDLEVBQ3ZCLE9BQWdCO1FBQWhCLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFFMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7SUFDekMsQ0FBQztJQUVNLEtBQUssQ0FBQyxRQUFRLENBQ25CLFdBQW1CLEVBQ25CLFdBQXdCLEVBQ3hCLFNBQW9CLEVBQ3BCLE1BQXNCLEVBQ3RCLEtB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