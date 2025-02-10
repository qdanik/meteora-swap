import { BASE_PRIVATE_KEY, BASE_RPC_URL, BSC_PRIVATE_KEY, BSC_RPC_URL, ETH_PRIVATE_KEY, ETH_RPC_URL } from '../config';

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
    chainId: 56,
    rpcUrl: BSC_RPC_URL ?? '',
    privateKey: BSC_PRIVATE_KEY ?? '',
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    routerAddress: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  },
  BASE: {
    chainId: 8453,
    rpcUrl: BASE_RPC_URL ?? '',
    privateKey: BASE_PRIVATE_KEY ?? '',
    factoryAddress: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
    routerAddress: "0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
  },
};
