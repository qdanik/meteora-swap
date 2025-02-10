import { BASE_PRIVATE_KEY, BASE_RPC_URL, BSC_PRIVATE_KEY, BSC_RPC_URL } from '../config';

export const FEE_POOLS = [100, 200, 300, 400, 500, 3000, 10000];

export interface NetworkConfig {
  chainId: number;
  name: string;
  wrappedName: string;
  rpcUrl: string;
  privateKey: string;
  factoryAddress: string;
  routerAddress: string;
  wrappedNativeAddress: string;
}

export const NETWORKS = {
  BNB: {
    chainId: 56,
    name: 'BNB',
    wrappedName: 'WBNB',
    rpcUrl: BSC_RPC_URL ?? '',
    privateKey: BSC_PRIVATE_KEY ?? '',
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    routerAddress: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  },
  BASE: {
    chainId: 8453,
    name: 'ETH',
    wrappedName: 'WETH',
    rpcUrl: BASE_RPC_URL ?? '',
    privateKey: BASE_PRIVATE_KEY ?? '',
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    routerAddress: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
  },
};
