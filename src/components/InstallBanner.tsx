import { useEffect, useState } from "react";

const DISMISSED_KEY = "nextclass_install_dismissed";

type Platform = "ios" | "android" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallBanner() {
  const [platform] = useState<Platform>(detectPlatform);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function handleInstallClick() {
    if (platform === "ios") {
      setShowIosSteps(true);
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") dismiss();
    }
  }

  if (dismissed || isStandalone() || platform === "other") return null;
  if (platform === "android" && !deferredPrompt) return null; // wait for Chrome to actually offer it

  return (
    <div
      className="panel"
      style={{
        position: "fixed",
        bottom: 84,
        left: 12,
        right: 12,
        zIndex: 90,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {!showIosSteps ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📲</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Install NextClass</div>
            <div className="muted">Add it to your home screen for the full app experience.</div>
          </div>
          <button className="btn-primary" style={{ width: "auto", padding: "8px 14px" }} onClick={handleInstallClick}>
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Add to Home Screen</div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              Tap the <strong>Share</strong> button 📤 in Safari's toolbar
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong> ➕
            </li>
            <li>
              Tap <strong>Add</strong> in the top right
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
