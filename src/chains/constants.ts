export interface ChainConfig {
  chainId: string;
  rpcUrl: string;
  apiUrl: string;
  wsUrl: string;
  denshokanAddress: string;
  registryAddress: string;
  viewerAddress: string;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  mainnet: {
    chainId: "SN_MAIN",
    rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet",
    apiUrl: "https://denshokan-api-production.up.railway.app",
    wsUrl: "wss://denshokan-api-production.up.railway.app/ws",
    denshokanAddress:
      "0x04a8ca498b599a626756545c657f918905eb877f331801a02067d280d0312888",
    registryAddress:
      "0x03a7585714a5c2be8fd4333ff2ce7ef2a00d344fd319aa625693cf9af4449d9c",
    viewerAddress:
      "0x079d33700028250eb89ad937fc3b633818e22fac3b6f5f6388448ea256737ac7",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://denshokan-api-sepolia.up.railway.app",
    wsUrl: "wss://denshokan-api-sepolia.up.railway.app/ws",
    denshokanAddress:
      "0x05178014ac8150207c795a9e426cfcbb0546ba1e033e869b04e0b6d8c2791e64",
    registryAddress:
      "0x02d6dfa06df59948cd5b967ef9644d071525ddc5226bf21e0578d7265e22113d",
    viewerAddress:
      "0x0658d5f90ddeaa20ccc22cdb25bda7a42594c3745ba500999fb966bfc40f8a55",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
