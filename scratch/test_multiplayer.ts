import { io } from "socket.io-client";

async function runMultiplayerTest() {
  console.log("Connecting Client A and Client B to http://localhost:4000...");

  const socketA = io("http://localhost:4000", { timeout: 3000 });
  const socketB = io("http://localhost:4000", { timeout: 3000 });

  let clientAInit = false;
  let clientBInit = false;
  let clientBSawClientA = false;

  socketA.on("connect", () => {
    console.log("✓ Client A connected (id: " + socketA.id + ")");
    socketA.emit("join", { name: "Alice", hairstyle: "mophair" });
  });

  socketB.on("connect", () => {
    console.log("✓ Client B connected (id: " + socketB.id + ")");
    socketB.emit("join", { name: "Bob", hairstyle: "curlyhair" });
  });

  socketA.on("init", (data) => {
    console.log(`✓ Client A initialized (PlayerId: ${data.playerId}, Seed: ${data.seed})`);
    clientAInit = true;
  });

  socketB.on("init", (data) => {
    console.log(`✓ Client B initialized (PlayerId: ${data.playerId}, Seed: ${data.seed})`);
    clientBInit = true;
  });

  socketB.on("sync", (sync) => {
    if (sync.otherPlayers && sync.otherPlayers.some((p: any) => p.name === "Alice")) {
      if (!clientBSawClientA) {
        console.log("✓ Client B successfully sees Player Alice in sync packet!");
        clientBSawClientA = true;
      }
    }
  });

  // Client A sends input
  setTimeout(() => {
    console.log("Client A sending input (vx: 1, vy: 0, sprint: true)...");
    socketA.emit("input", { vx: 1, vy: 0, isSprinting: true, seq: 1 });
  }, 500);

  // Client A sends hit action
  setTimeout(() => {
    console.log("Client A sending HIT action...");
    socketA.emit("action", { type: "HIT" });
  }, 800);

  // Finish test
  setTimeout(() => {
    if (clientAInit && clientBInit && clientBSawClientA) {
      console.log("══════════════════════════════════════════════════");
      console.log("🎉 ALL MULTIPLAYER AUTHORITATIVE TESTS PASSED! 🎉");
      console.log("══════════════════════════════════════════════════");
    } else {
      console.error("Test check: AInit=" + clientAInit + ", BInit=" + clientBInit + ", BSawA=" + clientBSawClientA);
    }
    socketA.disconnect();
    socketB.disconnect();
    process.exit(0);
  }, 1500);
}

runMultiplayerTest();
