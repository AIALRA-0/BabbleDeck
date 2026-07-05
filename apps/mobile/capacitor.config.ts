import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = "https://babbledeck.aialra.online";
const serverUrl =
  process.env.BABBLEDECK_MOBILE_SERVER_URL?.trim() || productionUrl;
const server = new URL(serverUrl);

const config: CapacitorConfig = {
  appId: "online.aialra.babbledeck",
  appName: "BabbleDeck",
  webDir: "www",
  loggingBehavior: "debug",
  appendUserAgent: "BabbleDeckMobile/0.1.0",
  server: {
    url: server.toString(),
    cleartext: server.protocol === "http:",
    allowNavigation: [server.hostname],
    errorPath: "index.html",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#f8fafc",
  },
};

export default config;
