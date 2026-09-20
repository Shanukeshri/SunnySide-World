import { MenuBackgroundRenderer } from "./MenuBackgroundRenderer";

export class MainMenuUI {
  private bgRenderer: MenuBackgroundRenderer | null = null;
  private onStartGameCallback:
    | ((mode: "single" | "multi", inviteCode?: string) => void)
    | null = null;

  constructor() {
    this.initDOM();
  }

  private initDOM() {
    const btnSinglePlayer = document.getElementById("btn-menu-singleplayer");
    const btnMultiplayer = document.getElementById("btn-menu-multiplayer");
    const btnFriends = document.getElementById("btn-menu-friends");
    const btnSettings = document.getElementById("btn-menu-settings");

    const modalMultiplayer = document.getElementById("modal-multiplayer");
    const btnCloseMultiplayer = document.getElementById(
      "btn-close-multiplayer",
    );
    const btnHostGame = document.getElementById("btn-host-game");
    const btnJoinGame = document.getElementById("btn-join-game");
    const inviteCodeInput = document.getElementById(
      "invite-code-input",
    ) as HTMLInputElement;

    const modalFriends = document.getElementById("modal-friends");
    const btnCloseFriends = document.getElementById("btn-close-friends");
    const btnAddFriend = document.getElementById("btn-add-friend");
    const addFriendInput = document.getElementById(
      "add-friend-input",
    ) as HTMLInputElement;
    const friendsListContainer = document.getElementById(
      "friends-list-container",
    );

    // Single Player
    btnSinglePlayer?.addEventListener("click", () => {
      this.hideMenu();
      if (this.onStartGameCallback) this.onStartGameCallback("single");
    });

    // Multiplayer Modal
    btnMultiplayer?.addEventListener("click", () => {
      modalMultiplayer?.classList.remove("hidden");
    });
    btnCloseMultiplayer?.addEventListener("click", () => {
      modalMultiplayer?.classList.add("hidden");
    });

    btnHostGame?.addEventListener("click", () => {
      this.hideMenu();
      if (this.onStartGameCallback) this.onStartGameCallback("multi");
    });

    btnJoinGame?.addEventListener("click", () => {
      const code = inviteCodeInput.value.trim();
      if (code) {
        this.hideMenu();
        if (this.onStartGameCallback) this.onStartGameCallback("multi", code);
      } else {
        const err = document.getElementById("join-error-text");
        if (err) {
          err.style.display = "block";
          err.innerText = "Please enter an Invite Code.";
        }
      }
    });

    // Friends Modal
    btnFriends?.addEventListener("click", () => {
      modalFriends?.classList.remove("hidden");
      this.renderFriendsList();
    });
    btnCloseFriends?.addEventListener("click", () => {
      modalFriends?.classList.add("hidden");
    });

    // Mock Add Friend
    btnAddFriend?.addEventListener("click", () => {
      const name = addFriendInput.value.trim();
      if (name) {
        this.addMockFriend(name);
        addFriendInput.value = "";
        this.renderFriendsList();
      }
    });
  }

  public showMenu() {
    const menuEl = document.getElementById("main-menu");
    menuEl?.classList.remove("hidden");

    // Start Background
    if (!this.bgRenderer) {
      this.bgRenderer = new MenuBackgroundRenderer("main-menu-bg-container");
    }

    // Hide loading screen if it's there
    setTimeout(() => {
      document.getElementById("loading-screen")?.classList.add("hidden");
    }, 500); // give it a moment
  }

  public hideMenu() {
    const menuEl = document.getElementById("main-menu");
    menuEl?.classList.add("hidden");

    if (this.bgRenderer) {
      this.bgRenderer.destroy();
      this.bgRenderer = null;
    }
  }

  public setOnStartGame(
    callback: (mode: "single" | "multi", inviteCode?: string) => void,
  ) {
    this.onStartGameCallback = callback;
  }

  // --- MOCK FRIENDS SYSTEM ---
  private getFriends(): any[] {
    try {
      const stored = localStorage.getItem("sunnyside_friends");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private addMockFriend(name: string) {
    const friends = this.getFriends();
    if (!friends.find((f: any) => f.name === name)) {
      friends.push({ name, online: true });
      localStorage.setItem("sunnyside_friends", JSON.stringify(friends));
    }
  }

  private renderFriendsList() {
    const container = document.getElementById("friends-list-container");
    if (!container) return;

    container.innerHTML = "";
    const friends = this.getFriends();

    if (friends.length === 0) {
      container.innerHTML = `<p style="color:#94a3b8; text-align:center; font-size:14px; margin-top:20px;">No friends added yet.</p>`;
      return;
    }

    friends.forEach((f: any) => {
      const row = document.createElement("div");
      row.className = "friend-row";

      const info = document.createElement("div");
      info.className = "friend-info";
      info.innerHTML = `
        <span class="friend-name">${f.name}</span>
        <span class="friend-status">
          <span class="${f.online ? "status-dot-online" : "status-dot-offline"}"></span>
          ${f.online ? "Online" : "Offline"}
        </span>
      `;

      const action = document.createElement("button");
      action.className = "btn-invite";
      action.innerText = "Invite";
      action.onclick = () => {
        action.innerText = "Sent!";
        action.disabled = true;
        // In a real game, this would send an event to the server
        this.simulateIncomingInvite(f.name);
      };

      row.appendChild(info);
      row.appendChild(action);
      container.appendChild(row);
    });
  }

  // Simulates someone sending you an invite
  public simulateIncomingInvite(fromName: string) {
    setTimeout(() => {
      this.showToastInvite(fromName, "SUNNY-9999");
    }, 2000);
  }

  public showToastInvite(fromName: string, inviteCode: string) {
    const container = document.getElementById("invite-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "invite-toast";

    toast.innerHTML = `
      <div class="toast-header">
        <img src="/assets/ui/expression_love.png" class="toast-icon" />
        <h4 class="toast-title">Game Invite</h4>
      </div>
      <p class="toast-body"><strong>${fromName}</strong> has invited you to join their world.</p>
      <div class="toast-actions">
        <button class="btn-toast-decline">Decline</button>
        <button class="btn-toast-accept">Accept</button>
      </div>
    `;

    const btnAccept = toast.querySelector(".btn-toast-accept");
    const btnDecline = toast.querySelector(".btn-toast-decline");

    const removeToast = () => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    };

    btnAccept?.addEventListener("click", () => {
      removeToast();
      this.hideMenu();
      if (this.onStartGameCallback)
        this.onStartGameCallback("multi", inviteCode);
    });

    btnDecline?.addEventListener("click", removeToast);

    container.appendChild(toast);

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (toast.parentElement) removeToast();
    }, 15000);
  }
}
