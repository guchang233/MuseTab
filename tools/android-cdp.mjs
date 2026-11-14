import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const run = (file, args, options={}) => execute(file,args,{timeout:15000,...options});
const adb = process.env.MUSETAB_ADB || "D:/MuseTabSDK/Android/Sdk/platform-tools/adb.exe";
const serial = process.env.MUSETAB_DEVICE || "emulator-5556";
export class AndroidCDP {
  static async connect(port = 9223) {
    const { stdout } = await run(adb, [
      "-s",
      serial,
      "shell",
      "pidof",
      "org.musetab.app",
    ]);
    await run(adb, [
      "-s",
      serial,
      "forward",
      `tcp:${port}`,
      `localabstract:webview_devtools_remote_${stdout.trim()}`,
    ]);
    const pages = await fetch(`http://127.0.0.1:${port}/json`, {signal:AbortSignal.timeout(5000)}).then((r) =>
      r.json(),
    );
    const page = pages.find(
      (p) => p.url.startsWith("https://musetab.local/index.html"),
    );
    if (!page) throw Error("Muse Tab WebView not found");
    const c = new AndroidCDP();
    c.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      const timer=setTimeout(()=>{c.ws.close();rej(Error('WebView socket timed out'));},5000);
      c.ws.onopen = ()=>{clearTimeout(timer);res();};
      c.ws.onerror = e=>{clearTimeout(timer);rej(e);};
    });
    c.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id) {
        const pending = c.pending.get(msg.id);
        if (pending) {
          c.pending.delete(msg.id);
          msg.error
            ? pending.reject(Error(msg.error.message))
            : pending.resolve(msg.result);
        }
      } else if (msg.method === "Runtime.executionContextCreated")
        c.contexts.push(msg.params.context);
      else if (msg.method === "Runtime.exceptionThrown")
        c.errors.push(msg.params.exceptionDetails.text);
      else if(msg.method === 'Runtime.executionContextsCleared')c.contexts=[];
      else if(msg.method === 'Runtime.executionContextDestroyed')c.contexts=c.contexts.filter(ctx=>ctx.id!==msg.params.executionContextId);
    };
    c.ws.onclose=()=>{for(const p of c.pending.values())p.reject(Error('WebView connection closed; check the USB device'));c.pending.clear();};
    await c.call("Runtime.enable");
    return c;
  }
  id = 0;
  pending = new Map();
  contexts = [];
  errors = [];
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, core = false) {
    const frames = await this.call("Page.getFrameTree");
    const frameId = core
      ? frames.frameTree.childFrames?.find((f) =>
          f.frame.url.includes("/engine/host.html"),
        )?.frame.id
      : frames.frameTree.frame.id;
    const ctx = this.contexts.findLast(
      (c) => c.auxData?.frameId === frameId && c.auxData?.isDefault,
    );
    if (!ctx) throw Error("JavaScript context missing");
    const r = await this.call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      contextId: ctx.id,
      userGesture: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }

  async screenshot(file) {
    // WebView CDP screenshots omit the native Qt WebGL layer on some GPUs.
    const r=await run(adb,['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:20*1024*1024});
    await fs.writeFile(file,r.stdout);
  }
  close() {
    this.ws.close();
  }
}
