import { BrowserWindow } from "electron";

export function getBrowserWindow() {
    return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}
