// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite ships its web implementation as WebAssembly, which Metro only
// resolves once wasm is a known asset extension.
config.resolver.assetExts.push('wasm');

// wa-sqlite needs SharedArrayBuffer, which browsers only expose to
// cross-origin isolated documents.
config.server.enhanceMiddleware = (middleware) => (request, response, next) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(request, response, next);
};

module.exports = config;
