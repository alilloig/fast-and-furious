import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_NETWORK } from "./constants";

function makeDAppKit() {
  return createDAppKit({
    networks: ["testnet", "mainnet"],
    defaultNetwork: SUI_NETWORK,
    createClient(network) {
      return new SuiGrpcClient({
        network,
        baseUrl:
          network === "mainnet"
            ? "https://fullnode.mainnet.sui.io:443"
            : "https://fullnode.testnet.sui.io:443",
      });
    },
  });
}

type AppDAppKit = ReturnType<typeof makeDAppKit>;

let _instance: AppDAppKit | null = null;

export function getDAppKit(): AppDAppKit {
  if (!_instance) {
    _instance = makeDAppKit();
  }
  return _instance;
}
