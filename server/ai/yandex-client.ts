import OpenAI from "openai";
import { getYandexConfig as getYandexEnvConfig } from "../env";

/**
 * Yandex Cloud AI Assistant client wrapper using OpenAI-compatible SDK.
 *
 * This module centralizes configuration and low-level calls to
 * `client.responses.create({ prompt: { id, variables }, input })`.
 *
 * Higher-level services (course generation, evaluation, chat, drills)
 * should build domain-specific prompts and call
 * `callYandexResponseWithPromptId` instead of talking to OpenAI directly.
 */

// ---------------------------------------------------------------------------
// Configuration (uses centralized env validation)
// ---------------------------------------------------------------------------

let cachedClient: OpenAI | null = null;

function getYandexClient(): OpenAI {
  if (!cachedClient) {
    const config = getYandexEnvConfig();
    
    if (!config) {
      console.warn(
        "[YandexClient] AI not configured. Set YANDEX_CLOUD_API_KEY and YANDEX_CLOUD_PROJECT_FOLDER_ID."
      );
      // Return a dummy client that will fail on use
      cachedClient = new OpenAI({
        apiKey: '',
        baseURL: 'https://rest-assistant.api.cloud.yandex.net/v1',
      });
    } else {
      cachedClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        project: config.projectFolderId,
      });

      console.log("[YandexClient] Initialized", {
        baseURL: config.baseUrl,
        project: "[SET]",
      });
    }
  }

  return cachedClient!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CallYandexResponseWithPromptIdArgs {
  /** Saved prompt / assistant ID in Yandex Cloud */
  promptId: string;
  /** Variables bound to the saved prompt; all values must be strings */
  variables: Record<string, string>;
  /** Instructional input text (full Russian prompt, KB context, etc.) */
  input: string;
  /** Optional timeout override (ms). Falls back to YANDEX_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface CallYandexResponseWithPromptIdResult {
  /** Extracted text output from the model (raw JSON string for our use case) */
  outputText: string;
  /** Raw SDK response object for logging / debugging */
  rawResponse: unknown;
}

/**
 * Low-level helper that calls Yandex Cloud AI Assistant via OpenAI SDK.
 *
 * NOTE: This function does NOT perform JSON parsing or schema validation.
 * Callers are responsible for validating that `outputText` conforms to
 * the expected JSON schema.
 */
export async function callYandexResponseWithPromptId(
  args: CallYandexResponseWithPromptIdArgs
): Promise<CallYandexResponseWithPromptIdResult> {
  const { promptId, variables, input } = args;
  const config = getYandexEnvConfig();
  const defaultTimeoutMs = config?.timeoutMs || 90000;
  const timeoutMs = args.timeoutMs ?? defaultTimeoutMs;

  if (!promptId) {
    throw new Error("YANDEX_PROMPT_ID is not configured or promptId is empty");
  }

  const client = getYandexClient();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[YandexClient] Calling API with promptId=${promptId}, input length=${input.length}`);
    console.log(`[YandexClient] Variables:`, JSON.stringify(variables, null, 2));
    
    const response: any = await client.responses.create({
      prompt: {
        id: promptId,
        variables,
      },
      input,
      // Yandex OpenAI-compatible client may support additional options; keep minimal here.
    } as any);

    // Log full raw response for debugging
    console.log(`[YandexClient] RAW RESPONSE:`, JSON.stringify(response, null, 2));
    
    // Log response shape analysis
    console.log(`[YandexClient] Response type:`, typeof response);
    console.log(`[YandexClient] Response keys:`, response ? Object.keys(response) : 'null');
    console.log(`[YandexClient] response.output_text type:`, typeof response?.output_text);
    console.log(`[YandexClient] response.output type:`, typeof response?.output);
    console.log(`[YandexClient] response.output?.text type:`, typeof response?.output?.text);
    
    // Yandex documentation exposes `output_text` as the primary field.
    const outputText: string =
      typeof response?.output_text === "string"
        ? response.output_text
        : // Fallbacks for other potential shapes
          typeof response?.output?.text === "string"
          ? response.output.text
          : typeof response?.output === "string"
          ? response.output
          : JSON.stringify(response);

    console.log(`[YandexClient] Extracted outputText (${outputText.length} chars):`);
    console.log(`[YandexClient] FULL OUTPUT TEXT START >>>`);
    console.log(outputText);
    console.log(`[YandexClient] <<< FULL OUTPUT TEXT END`);

    return {
      outputText,
      rawResponse: response,
    };
  } catch (error) {
    // Normalize abort/timeout errors for callers.
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `[YandexClient] Request timed out after ${timeoutMs}ms`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Lightweight configuration check for health endpoints.
 */
export function isYandexConfigured(): boolean {
  const config = getYandexEnvConfig();
  return config !== null;
}

/**
 * Expose non-sensitive configuration for diagnostics.
 */
export function getYandexConfig() {
  const config = getYandexEnvConfig();
  if (!config) {
    return {
      baseURL: 'https://rest-assistant.api.cloud.yandex.net/v1',
      projectFolderIdSet: false,
      apiKeySet: false,
      timeoutMs: 90000,
    };
  }
  return {
    baseURL: config.baseUrl,
    projectFolderIdSet: !!config.projectFolderId,
    apiKeySet: !!config.apiKey,
    timeoutMs: config.timeoutMs,
  };
}
