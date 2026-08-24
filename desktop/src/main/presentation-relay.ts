import { BrowserWindow, ipcMain } from "electron";
import { IPC } from "@shared/contract";

/**
 * Presenter -> projector slide sync.
 *
 * Replaces the web build's BroadcastChannel. Two Electron BrowserWindows are
 * separate renderer processes and relying on BroadcastChannel to bridge them
 * is not worth the risk during a live service, so main rebroadcasts instead:
 * deterministic, and it works regardless of how the windows were created.
 *
 * The payload is opaque here — main deliberately knows nothing about slides.
 */
export function registerPresentationRelay(): void {
  ipcMain.on(IPC.presentationSend, (event, channel: string, message: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.webContents.id === event.sender.id) continue;
      if (window.webContents.isDestroyed()) continue;
      window.webContents.send(IPC.presentationMessage, channel, message);
    }
  });
}
