export interface RetryRoundConfig {
  attempt: 1 | 2 | 3;
  maxAttempts: 3;
  waitSecondsBeforeRound: number;
  itemDelayMs: number;
}

export const BATCH_RETRY_ROUNDS: readonly RetryRoundConfig[] = [
  { attempt: 1, maxAttempts: 3, waitSecondsBeforeRound: 0, itemDelayMs: 800 },
  { attempt: 2, maxAttempts: 3, waitSecondsBeforeRound: 5, itemDelayMs: 1200 },
  { attempt: 3, maxAttempts: 3, waitSecondsBeforeRound: 8, itemDelayMs: 1500 },
] as const;

export function formatRetryCountdownMessage(
  attempt: 2 | 3,
  secondsLeft: number,
  failedCount: number,
): string {
  if (attempt === 2) {
    return `A IA estava ocupada em ${failedCount} foto(s). Aguardando ${secondsLeft}s para tentar novamente automaticamente...`;
  }
  return `Aguardando ${secondsLeft}s para última tentativa automática em ${failedCount} foto(s)...`;
}

export interface RunBatchWithRetriesCallbacks {
  processItem: (itemId: string, attempt: 1 | 2 | 3) => Promise<boolean>;
  onPrepareRetryRound: (
    failedIds: string[],
    round: RetryRoundConfig & { attempt: 2 | 3 },
  ) => void;
  onCountdownTick: (message: string | null) => void;
  isCancelled: () => boolean;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunBatchWithRetriesResult {
  succeededIds: string[];
  failedIds: string[];
  cancelled: boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runBatchWithAutoRetries(
  initialIds: string[],
  callbacks: RunBatchWithRetriesCallbacks,
): Promise<RunBatchWithRetriesResult> {
  const sleep = callbacks.sleep ?? defaultSleep;
  const succeededIds: string[] = [];
  let pendingIds = [...initialIds];

  for (const round of BATCH_RETRY_ROUNDS) {
    if (pendingIds.length === 0) break;
    if (callbacks.isCancelled()) {
      callbacks.onCountdownTick(null);
      return { succeededIds, failedIds: pendingIds, cancelled: true };
    }

    if (round.waitSecondsBeforeRound > 0 && (round.attempt === 2 || round.attempt === 3)) {
      const retryRound = round as RetryRoundConfig & { attempt: 2 | 3 };
      callbacks.onPrepareRetryRound(pendingIds, retryRound);

      for (let sec = retryRound.waitSecondsBeforeRound; sec >= 1; sec -= 1) {
        if (callbacks.isCancelled()) {
          callbacks.onCountdownTick(null);
          return { succeededIds, failedIds: pendingIds, cancelled: true };
        }
        callbacks.onCountdownTick(
          formatRetryCountdownMessage(retryRound.attempt, sec, pendingIds.length),
        );
        await sleep(1000);
      }

      callbacks.onCountdownTick(null);
      if (callbacks.isCancelled()) {
        return { succeededIds, failedIds: pendingIds, cancelled: true };
      }
    }

    const roundFailedIds: string[] = [];

    for (let index = 0; index < pendingIds.length; index += 1) {
      if (callbacks.isCancelled()) {
        callbacks.onCountdownTick(null);
        return {
          succeededIds,
          failedIds: [...roundFailedIds, ...pendingIds.slice(index)],
          cancelled: true,
        };
      }

      const itemId = pendingIds[index];
      if (!itemId) continue;

      const ok = await callbacks.processItem(itemId, round.attempt);
      if (ok) {
        succeededIds.push(itemId);
      } else {
        roundFailedIds.push(itemId);
      }

      if (index < pendingIds.length - 1 && !callbacks.isCancelled()) {
        await sleep(round.itemDelayMs);
      }
    }

    pendingIds = roundFailedIds;
  }

  callbacks.onCountdownTick(null);
  return {
    succeededIds,
    failedIds: pendingIds,
    cancelled: callbacks.isCancelled(),
  };
}
