"use client";

import { BrowserProvider, Contract, EventLog, isAddress } from "ethers";
import roleManagerAbi from "@/abi/RoleManager.abi.json";
import gridManagerAbi from "@/abi/GridManager.abi.json";
import workflowManagerAbi from "@/abi/WorkflowManager.abi.json";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

type ProviderRpcError = Error & { code?: number };

type WalletConnection = {
  provider: BrowserProvider;
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>;
  address: string;
};

type WalletDisconnectInfo = {
  code?: number;
  message?: string;
};

export type WalletEventHandlers = {
  onAccountsChanged?: (accounts: string[]) => void;
  onChainChanged?: (chainId: number | null) => void;
  onConnect?: (chainId: number | null) => void;
  onDisconnect?: (info: WalletDisconnectInfo) => void;
};

let pendingConnectWallet: Promise<WalletConnection> | null = null;

export type ChainLeaveRequest = {
  id: number;
  engineer: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  processedBy: string;
};

export type ChainFault = {
  id: number;
  substation: string;
  description: string;
  resolved: boolean;
  rectificationReport: string;
};

export type ChainSubstation = {
  address: string;
  name: string;
  threshold: number;
  active: boolean;
};

export type LeaveTxResult = {
  txHash: string;
  leaveId: number | null;
};

export type FaultTxResult = {
  txHash: string;
  faultId: number | null;
};

function getAddresses() {
  const roleManager = process.env.NEXT_PUBLIC_ROLE_MANAGER_ADDRESS || "";
  const gridManager = process.env.NEXT_PUBLIC_GRID_MANAGER_ADDRESS || "";
  const workflowManager = process.env.NEXT_PUBLIC_WORKFLOW_MANAGER_ADDRESS || "";

  if (!isAddress(roleManager) || !isAddress(gridManager) || !isAddress(workflowManager)) {
    throw new Error(
      "Missing or invalid contract address env vars. Set NEXT_PUBLIC_ROLE_MANAGER_ADDRESS, NEXT_PUBLIC_GRID_MANAGER_ADDRESS, and NEXT_PUBLIC_WORKFLOW_MANAGER_ADDRESS."
    );
  }

  return { roleManager, gridManager, workflowManager };
}

async function ensureContractsDeployed(provider: BrowserProvider) {
  const { roleManager, gridManager, workflowManager } = getAddresses();

  const [roleCode, gridCode, workflowCode] = await Promise.all([
    provider.getCode(roleManager),
    provider.getCode(gridManager),
    provider.getCode(workflowManager),
  ]);

  const missing: string[] = [];
  if (!roleCode || roleCode === "0x") missing.push("ROLE_MANAGER");
  if (!gridCode || gridCode === "0x") missing.push("GRID_MANAGER");
  if (!workflowCode || workflowCode === "0x") missing.push("WORKFLOW_MANAGER");

  if (missing.length > 0) {
    throw new Error(
      `Contracts not deployed on active chain for: ${missing.join(", ")}. Deploy contracts and update NEXT_PUBLIC_*_ADDRESS values in .env.local.`
    );
  }
}

function getEventFromBlock() {
  const raw = process.env.NEXT_PUBLIC_EVENT_FROM_BLOCK;
  if (!raw) return 0;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function ensureMetaMask() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is required. Install MetaMask and open this page in a browser wallet context.");
  }
}

function parseChainIdValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = value.startsWith("0x") ? parseInt(value, 16) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getExpectedChainId() {
  const expectedChainIdRaw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!expectedChainIdRaw) return null;

  const expectedChainId = Number(expectedChainIdRaw);
  return Number.isFinite(expectedChainId) ? expectedChainId : null;
}

export function isExpectedChainId(chainId: number | null) {
  const expectedChainId = getExpectedChainId();
  if (expectedChainId === null || chainId === null) return true;
  return chainId === expectedChainId;
}

export async function getConnectedChainId() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const currentValue = await window.ethereum.request({ method: "eth_chainId" });
  return parseChainIdValue(currentValue);
}

export function subscribeWalletEvents(handlers: WalletEventHandlers) {
  if (typeof window === "undefined" || !window.ethereum) {
    return () => {};
  }

  const provider = window.ethereum;

  const handleAccountsChanged = (...args: unknown[]) => {
    const firstArg = args[0];
    const accounts = Array.isArray(firstArg) ? firstArg.map((account) => String(account)) : [];
    handlers.onAccountsChanged?.(accounts);
  };

  const handleChainChanged = (...args: unknown[]) => {
    handlers.onChainChanged?.(parseChainIdValue(args[0]));
  };

  const handleConnect = (...args: unknown[]) => {
    const firstArg = args[0];
    const chainIdRaw =
      firstArg && typeof firstArg === "object" && "chainId" in firstArg
        ? (firstArg as { chainId?: unknown }).chainId
        : null;

    handlers.onConnect?.(parseChainIdValue(chainIdRaw));
  };

  const handleDisconnect = (...args: unknown[]) => {
    const firstArg = args[0];
    const info: WalletDisconnectInfo = {};

    if (firstArg && typeof firstArg === "object") {
      const disconnectPayload = firstArg as { code?: unknown; message?: unknown };
      if (typeof disconnectPayload.code === "number") {
        info.code = disconnectPayload.code;
      }

      if (typeof disconnectPayload.message === "string") {
        info.message = disconnectPayload.message;
      }
    }

    handlers.onDisconnect?.(info);
  };

  provider.on?.("accountsChanged", handleAccountsChanged);
  provider.on?.("chainChanged", handleChainChanged);
  provider.on?.("connect", handleConnect);
  provider.on?.("disconnect", handleDisconnect);

  return () => {
    provider.removeListener?.("accountsChanged", handleAccountsChanged);
    provider.removeListener?.("chainChanged", handleChainChanged);
    provider.removeListener?.("connect", handleConnect);
    provider.removeListener?.("disconnect", handleDisconnect);
  };
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

async function ensureExpectedChain() {
  const expectedChainId = getExpectedChainId();
  if (expectedChainId === null) return;

  const currentChainId = await getConnectedChainId();
  if (currentChainId === expectedChainId) return;

  const expectedHex = toHexChainId(expectedChainId);

  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedHex }],
    });
  } catch (error) {
    const providerError = error as ProviderRpcError;
    const missingChain = providerError.code === 4902;

    if (!missingChain) {
      throw new Error(`Wrong network connected. Please switch MetaMask to chain id ${expectedChainId}.`);
    }

    const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "http://127.0.0.1:8545";
    const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || `Local Chain ${expectedChainId}`;
    const currencySymbol = process.env.NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL || "ETH";

    await window.ethereum!.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: expectedHex,
          chainName,
          rpcUrls: [rpcUrl],
          nativeCurrency: {
            name: currencySymbol,
            symbol: currencySymbol,
            decimals: 18,
          },
        },
      ],
    });
  }

  const newChainId = await getConnectedChainId();
  if (newChainId !== expectedChainId) {
    throw new Error(`Wrong network connected. Expected chain id ${expectedChainId}, got ${newChainId}.`);
  }
}

export async function connectWallet() {
  if (pendingConnectWallet) {
    return pendingConnectWallet;
  }

  pendingConnectWallet = (async () => {
  ensureMetaMask();

  await window.ethereum!.request({ method: "eth_requestAccounts" });

  await ensureExpectedChain();

  const provider = new BrowserProvider(window.ethereum!);

  await ensureContractsDeployed(provider);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
  })();

  try {
    return await pendingConnectWallet;
  } finally {
    pendingConnectWallet = null;
  }
}

export async function connectWalletAccountOnly() {
  ensureMetaMask();

  await window.ethereum!.request({ method: "eth_requestAccounts" });
  await ensureExpectedChain();

  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

export async function getConnectedWalletAddress() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  if (!Array.isArray(accounts) || !accounts.length) {
    return null;
  }

  return String(accounts[0]);
}

async function getReadProvider() {
  ensureMetaMask();

  const expectedChainId = getExpectedChainId();
  if (expectedChainId !== null) {
    const currentChainId = await getConnectedChainId();
    if (currentChainId !== expectedChainId) {
      throw new Error(`Wrong network connected. Expected chain id ${expectedChainId}, got ${currentChainId}.`);
    }
  }

  const provider = new BrowserProvider(window.ethereum!);
  await ensureContractsDeployed(provider);
  return provider;
}

function getContracts(signerOrProvider: BrowserProvider | Awaited<ReturnType<BrowserProvider["getSigner"]>>) {
  const { roleManager, gridManager, workflowManager } = getAddresses();

  return {
    role: new Contract(roleManager, roleManagerAbi, signerOrProvider),
    grid: new Contract(gridManager, gridManagerAbi, signerOrProvider),
    workflow: new Contract(workflowManager, workflowManagerAbi, signerOrProvider),
  };
}

function parseIndexedIdFromReceipt(input: {
  contract: Contract;
  receipt: any;
  eventName: string;
  argName: string;
}) {
  const { contract, receipt, eventName, argName } = input;

  const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name !== eventName) continue;

      const value = parsed.args?.[argName];
      if (typeof value === "bigint") {
        return Number(value);
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }

  return null;
}

export function toUiError(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      shortMessage?: string;
      reason?: string;
      info?: { error?: { message?: string } };
      error?: { message?: string; data?: { message?: string } };
      data?: { message?: string };
      code?: string | number;
    };

    const msg =
      candidate.reason ||
      candidate.shortMessage ||
      candidate.info?.error?.message ||
      candidate.error?.data?.message ||
      candidate.error?.message ||
      candidate.data?.message ||
      candidate.message ||
      "Transaction failed";

    if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
      return "Transaction rejected in wallet.";
    }

    if (msg.toLowerCase().includes("insufficient funds") || msg.includes("INSUFFICIENT_FUNDS")) {
      return "Insufficient Sepolia ETH for gas. Please add some Sepolia ETH to your wallet and try again.";
    }

    const pendingRequest =
      msg.includes("wallet_requestPermissions") ||
      msg.includes("Already processing eth_requestAccounts") ||
      msg.includes("already pending");

    if (pendingRequest || candidate.code === -32002) {
      return "MetaMask already has a pending connection request. Open MetaMask and approve or reject it, then try again.";
    }

    if (msg.toLowerCase().includes("could not coalesce error") || msg.toLowerCase().includes("network error")) {
      return "Wallet RPC communication failed. Verify MetaMask is on Sepolia, you have internet, and retry.";
    }

    if (msg.includes("Not admin")) {
      return "Connected wallet is not the Admin of the Role Manager contract.";
    }

    if (msg.includes("Not engineer")) {
      return "Connected wallet is not assigned Engineer role on chain.";
    }

    if (msg.includes("Not substation")) {
      return "Connected wallet is not assigned Substation role on chain.";
    }

    if (msg.includes("Address not substation role")) {
      return "Target wallet is not assigned Substation role on chain.";
    }

    if (msg.includes("Not control")) {
      return "Connected wallet is not assigned Control role on chain.";
    }

    return msg;
  }

  return "Transaction failed";
}


export async function getConnectedRole() {
  const { signer, address } = await connectWallet();
  const { role } = getContracts(signer);
  const roleValue = await role.getRole(address);
  return Number(roleValue);
}

export async function getLeaveRequestsFromChain(): Promise<ChainLeaveRequest[]> {
  const provider = await getReadProvider();
  const { workflow } = getContracts(provider);

  const fromBlock = getEventFromBlock();
  const logs = await workflow.queryFilter(workflow.filters.LeaveApplied(), fromBlock, "latest");
  const eventLogs = logs.filter((log): log is EventLog => 'args' in log);

  const uniqueIds = Array.from(
    new Set(
      eventLogs
        .map((log) => {
          const id = log.args?.id;
          return typeof id === "bigint" ? Number(id) : -1;
        })
        .filter((id: number) => id >= 0)
    )
  );

  const rows = await Promise.all(
    uniqueIds.map(async (id) => {
      const leave = await workflow.leaves(id);
      const processed = Boolean(leave.processed);
      const approved = Boolean(leave.approved);
      const status: ChainLeaveRequest["status"] = !processed ? "pending" : approved ? "approved" : "rejected";

      return {
        id,
        engineer: String(leave.engineer),
        reason: String(leave.reason),
        status,
        processedBy: String(leave.processedBy),
      };
    })
  );

  return rows.sort((a, b) => b.id - a.id);
}

export async function getFaultsFromChain(): Promise<ChainFault[]> {
  const provider = await getReadProvider();
  const { workflow } = getContracts(provider);

  const fromBlock = getEventFromBlock();
  const logs = await workflow.queryFilter(workflow.filters.FaultReported(), fromBlock, "latest");
  const eventLogs = logs.filter((log): log is EventLog => 'args' in log);

  const uniqueIds = Array.from(
    new Set(
      eventLogs
        .map((log) => {
          const id = log.args?.id;
          return typeof id === "bigint" ? Number(id) : -1;
        })
        .filter((id: number) => id >= 0)
    )
  );

  const rows = await Promise.all(
    uniqueIds.map(async (id) => {
      const fault = await workflow.faults(id);
      return {
        id,
        substation: String(fault.substation),
        description: String(fault.description),
        resolved: Boolean(fault.resolved),
        rectificationReport: String(fault.rectificationReport),
      };
    })
  );

  return rows.sort((a, b) => b.id - a.id);
}

export async function getSubstationsFromChain(): Promise<ChainSubstation[]> {
  const provider = await getReadProvider();
  const { grid } = getContracts(provider);

  const fromBlock = getEventFromBlock();
  const logs = await grid.queryFilter(grid.filters.SubstationAdded(), fromBlock, "latest");
  const eventLogs = logs.filter((log): log is EventLog => 'args' in log);

  const uniqueAddresses = Array.from(
    new Set(
      eventLogs
        .map((log) => (String(log.args?.substation || "")).toLowerCase())
        .filter(Boolean)
    )
  );

  const rows = await Promise.all(
    uniqueAddresses.map(async (lowerAddress) => {
      const [name, threshold, active] = await grid.substations(lowerAddress);
      return {
        address: lowerAddress,
        name: String(name),
        threshold: Number(threshold),
        active: Boolean(active),
      };
    })
  );

  return rows.filter((s) => s.active);
}

export async function applyLeaveTx(reason: string): Promise<LeaveTxResult> {
  const { signer } = await connectWallet();
  const { workflow } = getContracts(signer);

  const tx = await workflow.applyLeave(reason);
  const receipt = await tx.wait();
  const leaveId = parseIndexedIdFromReceipt({
    contract: workflow,
    receipt,
    eventName: "LeaveApplied",
    argName: "id",
  });

  return {
    txHash: (receipt?.hash as string) || String(tx?.hash || ""),
    leaveId,
  };
}

export async function processLeaveTx(id: number, approve: boolean) {
  const { signer } = await connectWallet();
  const { workflow } = getContracts(signer);

  const tx = await workflow.processLeave(id, approve);
  const receipt = await tx.wait();
  return receipt?.hash as string;
}

export async function reportFaultTx(description: string): Promise<FaultTxResult> {
  const { signer } = await connectWallet();
  const { workflow } = getContracts(signer);

  const tx = await workflow.reportFault(description);
  const receipt = await tx.wait();
  const faultId = parseIndexedIdFromReceipt({
    contract: workflow,
    receipt,
    eventName: "FaultReported",
    argName: "id",
  });

  return {
    txHash: (receipt?.hash as string) || String(tx?.hash || ""),
    faultId,
  };
}

export async function submitFaultRectificationTx(id: number, report: string) {
  const { signer } = await connectWallet();
  const { workflow } = getContracts(signer);

  const tx = await workflow.submitFaultRectification(id, report);
  const receipt = await tx.wait();
  return receipt?.hash as string;
}

export async function resolveFaultTx(id: number) {
  const { signer } = await connectWallet();
  const { workflow } = getContracts(signer);

  const tx = await workflow.resolveFault(id);
  const receipt = await tx.wait();
  return receipt?.hash as string;
}

export async function hasSubstationRole(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid substation wallet address.");
  }

  const provider = await getReadProvider();
  const { role } = getContracts(provider);
  const isAssigned = await role.isSubstation(address);
  return Boolean(isAssigned);
}

export async function addSubstationTx(input: {
  substationAddress: string;
  name: string;
  threshold: number;
  assignRoleFirst?: boolean;
}) {
  const { substationAddress, name, threshold, assignRoleFirst = true } = input;

  if (!isAddress(substationAddress)) {
    throw new Error("Invalid substation wallet address.");
  }

  const { signer } = await connectWallet();
  const { role, grid } = getContracts(signer);

  if (assignRoleFirst) {
    try {
      const tx1 = await role.assignSubstation(substationAddress);
      await tx1.wait();
    } catch (error) {
      throw new Error(`Failed while assigning substation role: ${toUiError(error)}`);
    }
  }

  try {
    const tx2 = await grid.addSubstation(substationAddress, name, threshold);
    const receipt = await tx2.wait();
    return receipt?.hash as string;
  } catch (error) {
    throw new Error(`Failed while creating substation in GridManager: ${toUiError(error)}`);
  }
}

export async function updateSubstationThresholdTx(substationAddress: string, threshold: number) {
  if (!isAddress(substationAddress)) {
    throw new Error("Invalid substation wallet address.");
  }

  const { signer } = await connectWallet();
  const { grid } = getContracts(signer);

  const tx = await grid.updateSubstationThreshold(substationAddress, threshold);
  const receipt = await tx.wait();
  return receipt?.hash as string;
}

export async function assignEngineerTx(engineerAddress: string) {
  if (!isAddress(engineerAddress)) {
    throw new Error("Invalid engineer wallet address.");
  }

  const { signer } = await connectWallet();
  const { role } = getContracts(signer);

  const tx = await role.assignEngineer(engineerAddress);
  const receipt = await tx.wait();
  return receipt?.hash as string;
}
