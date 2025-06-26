import { ChainId, Token } from '@surge/sdk-core';
import { IMulticallProvider } from './multicall-provider';
import { ProviderConfig } from './provider';
/**
 * Provider for getting token data.
 *
 * @export
 * @interface ITokenProvider
 */
export interface ITokenProvider {
    /**
     * Gets the token at each address. Any addresses that are not valid ERC-20 are ignored.
     *
     * @param addresses The token addresses to get.
     * @param [providerConfig] The provider config.
     * @returns A token accessor with methods for accessing the tokens.
     */
    getTokens(addresses: string[], providerConfig?: ProviderConfig): Promise<TokenAccessor>;
}
export type TokenAccessor = {
    getTokenByAddress(address: string): Token | undefined;
    getTokenBySymbol(symbol: string): Token | undefined;
    getAllTokens: () => Token[];
};
export declare const XRPL_EVM_TESTNET_WETH_ADDRESS = "0xf4ddC1c80e7E04A09b58ce15503E99CfC60B4390";
export declare const XRPL_EVM_TESTNET_BNB_ADDRESS = "0x96b97B80Ca1af8d77C593760Df968d9c43b1a7A4";
export declare const XRPL_EVM_TESTNET_USDT_ADDRESS = "0xF31ab0b1EC6a6791eb6E2B27Ab3417Fe811E7f24";
export declare const XRPL_EVM_TESTNET_AVAX_ADDRESS = "0x0FeCF7d547C33D7b186091224aC10B430D42D2bf";
export declare const XRPL_EVM_TESTNET_AXL_ADDRESS = "0x49Bdf872157b71760B119b47aFeE580d7d1F53D6";
export declare const XRPL_EVM_TESTNET_MATIC_ADDRESS = "0x681598F683d51d7AFe4bA158A47d88e9B6512CB1";
export declare const XRPL_EVM_TESTNET_RLUSD_ADDRESS = "0x83Ea87C05E240f5BdE442d64a1d2b450fB0a7841";
export declare const XRPL_EVM_TESTNET_USDC_ADDRESS = "0x13EB4F7a4079C3E9A67e4bff3245c4cFF41d85cE";
export declare const XRPL_EVM_TESTNET_SOL_ADDRESS = "0xb9D15DD97Bf3De441A774EbE80bDa98F636b06b7";
export declare const XRPL_EVM_TESTNET_TRON_ADDRESS = "0x67726D94C29b43f1A3C35221BBE3bcb6FdF85F9B";
export declare const XRPL_EVM_TESTNET_TON_ADDRESS = "0x5B8e8F1246A0a2CBDA032169c3C699Db1887B1FD";
export declare const XRPL_EVM_TESTNET_WXRP_ADDRESS = "0x81Be083099c2C65b062378E74Fa8469644347BB7";
export declare const XRPL_EVM_TESTNET_DAI_ADDRESS = "0xeBD8479f1DF837e4169D2A69663e1CeDE6A6FC1A";
export declare const XRPL_EVM_TESTNET_PERMIT2_ADDRESS = "0x3944ebE5fF76D1dB5D265B0A196CeD7d14DAeeB5";
export declare const WETH_XRPL_EVM_TESTNET: Token;
export declare const BNB_XRPL_EVM_TESTNET: Token;
export declare const USDT_XRPL_EVM_TESTNET: Token;
export declare const AVAX_XRPL_EVM_TESTNET: Token;
export declare const AXL_XRPL_EVM_TESTNET: Token;
export declare const MATIC_XRPL_EVM_TESTNET: Token;
export declare const RLUSD_XRPL_EVM_TESTNET: Token;
export declare const USDC_XRPL_EVM_TESTNET: Token;
export declare const SOL_XRPL_EVM_TESTNET: Token;
export declare const TRON_XRPL_EVM_TESTNET: Token;
export declare const TON_XRPL_EVM_TESTNET: Token;
export declare const WXRP_XRPL_EVM_TESTNET: Token;
export declare const DAI_XRPL_EVM_TESTNET: Token;
export declare const USDC_ARBITRUM_SEPOLIA: Token;
export declare const DAI_ARBITRUM_SEPOLIA: Token;
export declare class TokenProvider implements ITokenProvider {
    private chainId;
    protected multicall2Provider: IMulticallProvider;
    constructor(chainId: ChainId, multicall2Provider: IMulticallProvider);
    private getTokenSymbol;
    private getTokenDecimals;
    getTokens(_addresses: string[], providerConfig?: ProviderConfig): Promise<TokenAccessor>;
}
export declare const DAI_ON: (chainId: ChainId) => Token;
export declare const USDT_ON: (chainId: ChainId) => Token;
export declare const USDC_ON: (chainId: ChainId) => Token;
export declare const WNATIVE_ON: (chainId: ChainId) => Token;
