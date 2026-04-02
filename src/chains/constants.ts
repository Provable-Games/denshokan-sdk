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
      "0x03b54a422e241957e105f41e992bdd5af349d68a87358e5f470a5c2880bc6253",
    registryAddress:
      "0x01b529f24758f5862d4c614440aa0188a9e86d5adcfc55b39d28cd42e31daae1",
    viewerAddress:
      "0x011e6c8ae5550ea53fa49c6badaf17cc3732795ecb0389275183362e1078392d",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://denshokan-api-sepolia.up.railway.app",
    wsUrl: "wss://denshokan-api-sepolia.up.railway.app/ws",
    denshokanAddress:
      "0x017eae504f5716423d423c3fe5640b4dcf830a9634c243d86f6fe0cc01b688c3",
    registryAddress:
      "0x04e2b728f2b0209ede6f3fd01ec190c33d1d73aa628ad5e9f80549ba62d0e331",
    viewerAddress:
      "0x036d3cab94a44a63ecd063d1c26e1f37915c75a2e0ae419e2f8f56421c2278b6",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
