import { definePluginEntry } from "./api.js";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { loadConfig, type InstacartConfig } from "./src/config.js";
import { createMemoryStore } from "./src/memory/index.js";

import { ResolveLoginCodeInput, runResolveLoginCode } from "./src/tools/resolve_login_code.js";
import { ReadMemoryInput, runReadMemory } from "./src/tools/read_memory.js";
import { WriteMemoryInput, runWriteMemory } from "./src/tools/write_memory.js";
import { RecordCartInput, runRecordCart } from "./src/tools/record_cart.js";
import { RankStoresInput, runRankStores } from "./src/tools/rank_stores.js";
import { DetectStaplesInput, runDetectStaples } from "./src/tools/detect_staples.js";
import { UpdatePreferenceInput, runUpdatePreference } from "./src/tools/update_preference.js";
import { OpenListSourceInput, runOpenListSource } from "./src/tools/open_list_source.js";
import { StartSessionInput, runStartSession } from "./src/tools/start_session.js";
import { UpdateSessionInput, runUpdateSession } from "./src/tools/update_session.js";
import { EndSessionInput, runEndSession } from "./src/tools/end_session.js";

/**
 * Adapter from whatever shape the host's `resend` skill exposes to our internal
 * `ResendClient`. If the host only ships MCP-style tool calls, we route through those.
 * Keep this narrow on purpose — swap impl without touching auth/login-code.ts.
 */
async function loadResendClient(api: unknown) {
  const anyApi = api as any;
  if (typeof anyApi.callSkill === "function") {
    return {
      list: async () => (await anyApi.callSkill("resend", "emails.receiving.list", {})) as Array<{
        id: string; from: string; receivedAt: string;
      }>,
      get: async (id: string) => (await anyApi.callSkill("resend", "emails.receiving.get", { id })) as {
        id: string; from: string; receivedAt: string; text: string;
      },
    };
  }
  throw new Error("instacart-browser: host does not expose a way to call the resend skill");
}

export default definePluginEntry({
  id: "instacart-browser",
  name: "Instacart Browser",
  description: "Build Instacart carts conversationally. Stops at review — humans place orders.",
  configSchema: emptyPluginConfigSchema(),
  register(api: any) {
    const config: InstacartConfig = loadConfig(api.pluginConfig ?? {});
    const store = createMemoryStore({ dataDir: config.dataDir });
    const getResend = () => loadResendClient(api);

    const tool = (name: string, description: string, parameters: unknown, fn: (input: any) => Promise<unknown>) => {
      api.registerTool({
        name,
        label: name,
        description,
        parameters,
        async execute(_id: string, params: any) { return fn(params); },
      });
    };

    tool("instacart.resolve_login_code",
      "Poll resend inbound for an Instacart passwordless login code received after requested_after. Never logs the code.",
      ResolveLoginCodeInput,
      async (input) => runResolveLoginCode({ resend: await getResend(), config }, input));

    tool("instacart.read_memory",
      "Read one of the plugin's persistent JSON files (carts, staples, preferences, sessions).",
      ReadMemoryInput,
      async (input) => runReadMemory({ store }, input));

    tool("instacart.write_memory",
      "Atomically write a persistent JSON file. Preferences support merge=true.",
      WriteMemoryInput,
      async (input) => runWriteMemory({ store }, input));

    tool("instacart.record_cart",
      "Append a finalized Cart to carts.json and recompute staples.json.",
      RecordCartInput,
      async (input) => runRecordCart({ store, config }, input));

    tool("instacart.rank_stores",
      "Rank candidate stores by proximity, history, list match, and window fit (weights from config).",
      RankStoresInput,
      async (input) => runRankStores({ store, config }, input));

    tool("instacart.detect_staples",
      "Recompute staples.json from carts.json using thresholds from config.",
      DetectStaplesInput,
      async (input) => runDetectStaples({ store, config }, input));

    tool("instacart.update_preference",
      "Record a preference override (pending) or promote one (one_shot_confirm / manual).",
      UpdatePreferenceInput,
      async (input) => runUpdatePreference({ store }, input));

    tool("instacart.open_list_source",
      "Open a list source (adhoc | staples | repeat | recipes-stub) and return normalized items.",
      OpenListSourceInput,
      async (input) => runOpenListSource({ store }, input));

    tool("instacart.start_session",
      "Create sessions.json.current, rotating a stale current into recent[] if needed.",
      StartSessionInput,
      async (input) => runStartSession({ store }, input));

    tool("instacart.update_session",
      "Merge a patch into sessions.json.current and bump last_updated.",
      UpdateSessionInput,
      async (input) => runUpdateSession({ store }, input));

    tool("instacart.end_session",
      "Rotate current into recent[] with the given terminal status (handed_off | abandoned).",
      EndSessionInput,
      async (input) => runEndSession({ store }, input));
  },
});
