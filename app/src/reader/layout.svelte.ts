let fullscreen = $state(false);
let header = $state(57);
export const reading = {
  get fullscreen() { return fullscreen; },
  get top() { return fullscreen ? 0 : header; },
  setHeader(height: number) { header = height; },
  async setFullscreen(on: boolean) {
    fullscreen = on;
    window.Android?.setImmersive(on);
    try {
      if (!window.Android) {
        if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
        else if (!on && document.fullscreenElement) await document.exitFullscreen();
      }
    } catch { /* App-level fullscreen also works when browser permission is unavailable. */ }
  },
};
addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) fullscreen = false; });
