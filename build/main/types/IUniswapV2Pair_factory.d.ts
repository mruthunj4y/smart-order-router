import { Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type { IUniswapV2Pair } from "./IUniswapV2Pair";
export declare class IUniswapV2Pair__factory {
    static readonly abi: {
        constant: boolean;
        inputs: never[];
        name: string;
        outputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        stateMutability: string;
        type: string;
    }[];
    static createInterface(): utils.Interface;
    static connect(address: string, signerOrProvider: Signer | Provider): IUniswapV2Pair;
}
