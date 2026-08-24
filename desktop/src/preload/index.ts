import { contextBridge, ipcRenderer } from "electron";
import { IPC, type OpArgs, type OpName, type OpResult, type OpResponse } from "@shared/contract";

/**
 * The renderer's entire view of the outside world.
 *
 * `invoke` names an operation from the contract; main resolves it through an
 * allowlist. Failures come back as tagged data rather than as thrown errors so
 * the error code survives structured cloning — see renderer/data/invoke.ts,
 * which turns them back into real exceptions.
 */
const api = {
  invoke<K extends OpName>(op: K, args?: OpArgs<K>): Promise<OpResponse<OpResult<K>>> {
    return ipcRenderer.invoke(IPC.invoke, op, args ?? null);
  },

  presentation: {
    send(channel: string, message: unknown): void {
      ipcRenderer.send(IPC.presentationSend, channel, message);
    },
    subscribe(handler: (channel: string, message: unknown) => void): () => void {
      const listener = (_event: unknown, channel: string, message: unknown) =>
        handler(channel, message);
      ipcRenderer.on(IPC.presentationMessage, listener);
      return () => {
        ipcRenderer.off(IPC.presentationMessage, listener);
      };
    },
  },

  platform: process.platform,
  appVersion: process.env["npm_package_version"] ?? "",
};

export type SagipApi = typeof api;

contextBridge.exposeInMainWorld("sagip", api);
