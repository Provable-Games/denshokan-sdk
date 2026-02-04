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
    apiUrl: "https://localhost:3001",
    wsUrl: "ws://localhost:3001/ws",
    // TODO: Update with mainnet addresses when deployed
    denshokanAddress: "0x0029ffae8b0c4626e06395a947800bc89e76422107f6adff8937a6e9a1e01f28",
    registryAddress: "0x05b4a2ed39dfb28a33c2dd73cbedf02091a31dccb9ed4ed19201e3c255865851",
    viewerAddress: "0x01825fa210dc2abd02fa03d4eb37dabf1d6b69e9c4cd471ee402fa0fcc78611b",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://localhost:3001",
    wsUrl: "ws://localhost:3001/ws",
    denshokanAddress: "0x0029ffae8b0c4626e06395a947800bc89e76422107f6adff8937a6e9a1e01f28",
    registryAddress: "0x05b4a2ed39dfb28a33c2dd73cbedf02091a31dccb9ed4ed19201e3c255865851",
    viewerAddress: "0x01825fa210dc2abd02fa03d4eb37dabf1d6b69e9c4cd471ee402fa0fcc78611b",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
