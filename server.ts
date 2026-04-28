import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // IN-MEMORY STORE for demo purposes
  // In a real app, this should be Firestore or another DB
  const userBalances: Record<string, number> = {};

  // Monetag Callback Endpoint (Server-to-Server)
  // Pattern: /api/monetag-callback?user_id=123&zone_id=456
  app.get("/api/monetag-callback", (req, res) => {
    // Monetag passes the subid/var value based on your postback settings
    // Recommend setting postback URL as: [your-url]/api/monetag-callback?user_id=${var}
    const { user_id, var: userVar, zone_id } = req.query;
    const uid = String(user_id || userVar);

    if (!uid || uid === "undefined") {
      console.error("[MONETAG ERROR] Received callback without valid user identification", req.query);
      return res.status(400).send("Missing user identification");
    }

    const rewardAmount = 20;
    userBalances[uid] = (userBalances[uid] || 0) + rewardAmount;

    console.log(`[MONETAG SUCCESS] User ${uid} rewarded ${rewardAmount} Pts. Zone: ${zone_id || 'N/A'}`);
    
    // Return 200 OK to Monetag so they know we received it
    res.status(200).send("OK");
  });

  // Get Balance for UI (Polling/Refresh)
  app.get("/api/user-data/:userId", (req, res) => {
    const { userId } = req.params;
    res.json({
      balance: userBalances[userId] || 0
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
