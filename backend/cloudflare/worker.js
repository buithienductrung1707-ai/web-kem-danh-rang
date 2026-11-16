import { DurableObject } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import storage from "./storage.cjs";
import runtime from "../src/runtime.cjs";
import seed from "../.cloudflare/seed.json";

export class ShopBackend extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    storage.withStorage(ctx.storage, () => {
      const sessionSecret = storage.initializeStorage(seed);
      runtime.configureRuntime({
        database: storage.database,
        sessionSecret,
        createSessionStore: name => new storage.DurableSessionStore(name),
        saveImage: storage.saveImage
      });
      const app = require("../src/app.cjs");
      this.nodeHandler = httpServerHandler(createServer(app));
    });
  }

  fetch(request) {
    return storage.withStorage(this.ctx.storage, () => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/health") {
        return Response.json({ status: "ok", storage: "durable-sqlite" }, {
          headers: { "Cache-Control": "no-store" }
        });
      }
      if (pathname.startsWith("/uploads/products/") && ["GET", "HEAD"].includes(request.method)) {
        const filename = pathname.slice("/uploads/products/".length);
        if (/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(filename)) {
          const response = storage.imageResponse(filename, request);
          if (response) return response;
        }
        return this.env.ASSETS.fetch(request);
      }
      return this.nodeHandler.fetch(request);
    });
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/products/")) {
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Proto", url.protocol.slice(0, -1));
      headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "127.0.0.1");
      const backend = env.SHOP_BACKEND.get(env.SHOP_BACKEND.idFromName("storefront"));
      return backend.fetch(new Request(request, { headers }));
    }
    return env.ASSETS.fetch(request);
  }
};
