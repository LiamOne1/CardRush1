// Load env for this standalone Node process
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { createServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "@clerk/backend";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:3000" },
});

// Auth middleware: require a valid Clerk token before joining
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.clerkToken as string | undefined;
    if (!token) return next(new Error("no token"));

    const payload = await verifyToken(token, {
      // uses CLERK_SECRET_KEY from .env.local
      secretKey: process.env.CLERK_SECRET_KEY!,
      // issuer is auto-detected in most setups; you can add { issuer: process.env.CLERK_ISSUER }
      // if you customized domains. Not needed for default dev.
    });

    // minimal identity we’ll use later
    (socket as any).auth = {
      userId: payload.sub,        // Clerk user id
      sessionId: (payload as any).sid, // Clerk session id (if present)
    };
    return next();
  } catch (err) {
    return next(new Error("invalid token"));
  }
});

io.on("connection", (socket) => {
  const auth = (socket as any).auth;
  console.log("client connected", socket.id, "userId:", auth?.userId);

  socket.on("ping", (msg) => {
    socket.emit("pong", { ok: true, echo: msg, at: Date.now(), userId: auth?.userId });
  });

  socket.on("disconnect", (reason) => {
    console.log("client disconnected:", socket.id, reason);
  });
});

httpServer.listen(3001, () => {
  console.log("WS server listening on http://localhost:3001");
});
