import { describe, expect, it } from "vitest";
import {
  BATCH_RETRY_ROUNDS,
  formatRetryCountdownMessage,
  runBatchWithAutoRetries,
} from "@/lib/batch-retry";

describe("Batch import automatic retry orchestration", () => {
  it("runs up to 2 automatic retry rounds with 5s and 8s countdowns and increasing delays", async () => {
    const calls: Array<{ id: string; attempt: number }> = [];
    const delays: number[] = [];
    const countdowns: Array<string | null> = [];
    const preparedRounds: Array<{ ids: string[]; attempt: number }> = [];

    const result = await runBatchWithAutoRetries(["a", "b", "c"], {
      isCancelled: () => false,
      sleep: async (ms) => {
        delays.push(ms);
      },
      onCountdownTick: (msg) => {
        countdowns.push(msg);
      },
      onPrepareRetryRound: (failedIds, round) => {
        preparedRounds.push({ ids: [...failedIds], attempt: round.attempt });
      },
      processItem: async (id, attempt) => {
        calls.push({ id, attempt });
        if (id === "a") return true; // succeeds on attempt 1
        if (id === "b") return attempt >= 2; // recovers on automatic round 1 (2/3)
        return attempt >= 3; // recovers on automatic round 2 (3/3)
      },
    });

    expect(result).toEqual({
      succeededIds: ["a", "b", "c"],
      failedIds: [],
      cancelled: false,
    });

    // Item "a" is never retried or duplicated; "b" only runs attempts 1 & 2; "c" runs 1, 2, 3
    expect(calls).toEqual([
      { id: "a", attempt: 1 },
      { id: "b", attempt: 1 },
      { id: "c", attempt: 1 },
      { id: "b", attempt: 2 },
      { id: "c", attempt: 2 },
      { id: "c", attempt: 3 },
    ]);

    expect(preparedRounds).toEqual([
      { ids: ["b", "c"], attempt: 2 },
      { ids: ["c"], attempt: 3 },
    ]);

    // Verify exact countdown messages
    expect(countdowns).toContain(
      "A IA estava ocupada em 2 foto(s). Aguardando 5s para tentar novamente automaticamente...",
    );
    expect(countdowns).toContain(
      "A IA estava ocupada em 2 foto(s). Aguardando 1s para tentar novamente automaticamente...",
    );
    expect(countdowns).toContain(
      "Aguardando 8s para última tentativa automática em 1 foto(s)...",
    );
    expect(countdowns).toContain(
      "Aguardando 1s para última tentativa automática em 1 foto(s)...",
    );
    expect(countdowns.at(-1)).toBeNull();

    // Verify 800ms (pass 1) and 1200ms (pass 2) item spacing plus 1000ms countdown ticks
    expect(delays.filter((d) => d === 800)).toHaveLength(2);
    expect(delays.filter((d) => d === 1200)).toHaveLength(1);
    expect(delays.filter((d) => d === 1000)).toHaveLength(5 + 8);
    expect(BATCH_RETRY_ROUNDS[2]?.itemDelayMs).toBe(1500);
  });

  it("stops immediately without retry waits when all items succeed on pass 1", async () => {
    const countdowns: Array<string | null> = [];
    const preparedRounds: number[] = [];

    const result = await runBatchWithAutoRetries(["x", "y"], {
      isCancelled: () => false,
      sleep: async () => {},
      onCountdownTick: (msg) => countdowns.push(msg),
      onPrepareRetryRound: (_ids, round) => preparedRounds.push(round.attempt),
      processItem: async () => true,
    });

    expect(result.succeededIds).toEqual(["x", "y"]);
    expect(result.failedIds).toEqual([]);
    expect(preparedRounds).toEqual([]);
    expect(countdowns.every((m) => m === null)).toBe(true);
  });

  it("leaves permanently failing items in failedIds after 3 attempts for manual retry", async () => {
    const result = await runBatchWithAutoRetries(["ok", "bad"], {
      isCancelled: () => false,
      sleep: async () => {},
      onCountdownTick: () => {},
      onPrepareRetryRound: () => {},
      processItem: async (id) => id === "ok",
    });

    expect(result.succeededIds).toEqual(["ok"]);
    expect(result.failedIds).toEqual(["bad"]);
    expect(formatRetryCountdownMessage(2, 5, 1)).toBe(
      "A IA estava ocupada em 1 foto(s). Aguardando 5s para tentar novamente automaticamente...",
    );
    expect(formatRetryCountdownMessage(3, 8, 1)).toBe(
      "Aguardando 8s para última tentativa automática em 1 foto(s)...",
    );
  });
});
