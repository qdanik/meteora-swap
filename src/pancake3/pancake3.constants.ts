import { ChainId } from '@uniswap/sdk-core';
import { BASE_PRIVATE_KEY, BASE_RPC_URL, BSC_PRIVATE_KEY, BSC_RPC_URL } from '../config';

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  privateKey: string;
  factoryAddress: string;
  routerAddress: string;
  wrappedNativeAddress: string;
}

export const NETWORKS = {
  BNB: {
    chainId: ChainId.BNB,
    rpcUrl: BSC_RPC_URL ?? '',
    privateKey: BSC_PRIVATE_KEY ?? '',
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    routerAddress: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  },
  BASE: {
    chainId: ChainId.BASE,
    rpcUrl: BASE_RPC_URL ?? '',
    privateKey: BASE_PRIVATE_KEY ?? '',
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    routerAddress: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
  },
};
