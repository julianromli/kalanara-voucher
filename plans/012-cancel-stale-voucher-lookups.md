# 012 — Cancel stale voucher verification requests

- **Status**: DONE
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: react-doctor/no-set-state-after-await-in-effect
- **Estimated scope**: 1–2 files, small async-control refactor plus focused tests

## Problem

`verifyCode` can be started by the `initialCode` effect, manual form submission, and QR scans. Calls overlap without cancellation or request identity. Any older response can therefore overwrite a newer lookup, and an older `finally` can clear the newer request's loading state.

```tsx
// app/verify/verify-page-client.tsx:34-88 — current
  const verifyCode = async (voucherCode: string) => {
    setIsSearching(true);
    setSearchResult(null);
    setCode(voucherCode.toUpperCase());

    try {
      const response = await fetch(
        `/api/vouchers/public-lookup?code=${encodeURIComponent(
          voucherCode.trim().toUpperCase()
        )}`,
        { cache: "no-store" }
      );

      if (response.status === 404) {
        setSearchResult({ found: false });
        return;
      }

      if (!response.ok) {
        throw new Error("Gagal memeriksa voucher.");
      }

      const result = (await response.json()) as {
        found: boolean;
        voucher?: PublicVoucherLookup;
      };

      if (result.found && result.voucher) {
        setSearchResult({ found: true, voucher: result.voucher });
      } else {
        setSearchResult({ found: false });
      }
    } catch (error) {
      console.error("Voucher verification failed:", error);
      setSearchResult({ found: false });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      void verifyCode(initialCode);
    }
  }, [initialCode]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    await verifyCode(code);
  };

  const handleQRScan = (scannedCode: string) => {
    void verifyCode(scannedCode);
  };
```

Concrete failure sequence:

1. The initial URL code starts request A.
2. The user submits a different code or scans a QR code, starting request B.
3. B resolves first and displays the correct voucher.
4. A resolves later and replaces B with A's voucher/not-found state; A's `finally` may also hide B's loading state if B is still active.

An abort caused by replacement/unmount currently enters the generic catch path if a signal is added naively, which would incorrectly show not-found. Abort must be silent.

## Target

Canonical `react-doctor/no-set-state-after-await-in-effect` rule recipe (verbatim):

> In effects with changing dependencies, ignore or cancel stale async work before any post-await state update.

Canonical reference transformation (verbatim):

```ts
useEffect(() => {
  const controller = new AbortController();
  void loadUser(id, { signal: controller.signal })
    .then((user) => {
      if (!controller.signal.aborted) setUser(user);
    })
    .catch((error) => {
      if (!controller.signal.aborted) reportError(error);
    });
  return () => controller.abort();
}, [id, reportError]);
```

Adapt that recipe to all three voucher-lookup entry points. Maintain one active controller, pass its `AbortSignal` to `fetch`, guard every post-await state write with both aborted state and monotonically increasing request identity, and abort on effect cleanup/unmount.

```tsx
// app/verify/verify-page-client.tsx — target
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function VerifyPageClient({ initialCode }: VerifyPageClientProps) {
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<"scanner" | "manual">("manual");
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    voucher?: PublicVoucherLookup;
  } | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const verifyCode = useCallback(async (voucherCode: string) => {
    activeRequestRef.current?.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    activeRequestRef.current = controller;
    requestIdRef.current = requestId;

    const isStale = () =>
      controller.signal.aborted || requestId !== requestIdRef.current;

    setIsSearching(true);
    setSearchResult(null);
    setCode(voucherCode.toUpperCase());

    try {
      const response = await fetch(
        `/api/vouchers/public-lookup?code=${encodeURIComponent(
          voucherCode.trim().toUpperCase()
        )}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (isStale()) return;

      if (response.status === 404) {
        setSearchResult({ found: false });
        return;
      }

      if (!response.ok) {
        throw new Error("Gagal memeriksa voucher.");
      }

      const result = (await response.json()) as {
        found: boolean;
        voucher?: PublicVoucherLookup;
      };

      if (isStale()) return;

      if (result.found && result.voucher) {
        setSearchResult({ found: true, voucher: result.voucher });
      } else {
        setSearchResult({ found: false });
      }
    } catch (error) {
      if (isStale() || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }

      console.error("Voucher verification failed:", error);
      setSearchResult({ found: false });
    } finally {
      if (!isStale()) {
        setIsSearching(false);
        activeRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      void verifyCode(initialCode);
    }

    return () => {
      activeRequestRef.current?.abort();
    };
  }, [initialCode, verifyCode]);

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    void verifyCode(code);
  };

  const handleQRScan = (scannedCode: string) => {
    void verifyCode(scannedCode);
  };
}
```

The identity guard is required in addition to `AbortController`: a fetch mock/provider or a response body parse may resolve despite a late abort, and only the latest request may own `searchResult`, `isSearching`, and `activeRequestRef`.

## Repo conventions to follow

- Preserve the existing client component, Indonesian request error message, fetch URL, `cache: "no-store"`, result shape, and QR/manual entry points.
- Use React refs for mutable request ownership that must not itself trigger rendering.
- Imitate the current cleanup style used for async work in `app/checkout/[id]/checkout-page-client.tsx:281-334`, but use real cancellation plus identity because this request can be restarted from multiple sources.
- Keep aborts silent; they are control flow, not voucher-not-found outcomes.

## Steps

1. In `app/verify/verify-page-client.tsx`, import `useCallback` and `useRef`.
2. Add `activeRequestRef` and monotonic `requestIdRef`.
3. Wrap `verifyCode` in `useCallback`. Abort the previous controller before starting a request, create a new controller/request ID, and pass `signal` to `fetch`.
4. After each `await` and before every asynchronous state update, return when the signal is aborted or the request ID no longer owns the active request.
5. In `catch`, return silently for stale/aborted requests. Preserve the existing log and `{ found: false }` behavior for genuine non-abort failures.
6. In `finally`, clear loading and the controller ref only when this request is still current.
7. Return cleanup from the `initialCode` effect that aborts active work. Include `verifyCode` in the dependency array.
8. Keep form and QR handlers routed through the same function so starting either source cancels any prior source.
9. Add focused tests using deferred fetch promises for A-then-B ordering, B-then-A ordering, 404, network failure, replacement abort, and unmount cleanup.
10. Re-read the diff and remove unrelated churn.

## Boundaries

- Do NOT debounce or deduplicate codes; every explicit submit/scan remains a fresh `no-store` lookup.
- Do NOT change the API route, lookup response contract, voucher status rendering, QR scanner behavior, or input mode.
- Do NOT map `AbortError` to `{ found: false }`, log it as a failure, or show a not-found result.
- Do NOT let an old request clear a newer request's loading state or controller.
- Do NOT add dependencies.
- Do NOT suppress/disable the React Doctor rule.
- STOP if the code has drifted from commit `b94c4ae`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - Run focused tests with controllable promises and assert the first request receives `signal.aborted === true` when the second starts.
  - Assert only the latest request can call result/loading state transitions; an aborted request produces neither a console error nor a not-found render.
  - Run `npx react-doctor@latest --scope changed` and confirm `react-doctor/no-set-state-after-await-in-effect` clears without lowering the score; then run an unfiltered scan of the affected scope.
  - Run `bunx tsc --noEmit`, `bun run lint`, focused verify tests, and the full test suite if available.
- **Behavior check**:
  - Open `/verify` with an initial code, immediately submit a different valid code, and confirm only the submitted code's result remains even if the initial request is artificially delayed.
  - While a manual lookup is pending, scan two different QR codes quickly; confirm each new lookup aborts the prior one and the final scan owns the result.
  - Abort a lookup by starting another and by navigating away. Confirm no not-found card, stale voucher, console error, or post-unmount state warning appears because of cancellation.
  - Simulate a genuine 404 and a genuine network/server failure; confirm the existing not-found behavior remains.
  - Record the overlap scenarios in React DevTools Profiler and use “Highlight updates”. Confirm stale requests cause no late result/loading commits and the verify result subtree flashes only for the latest request.
- **Done when**: exactly one lookup is active, `fetch` receives an abort signal, request identity guards all post-await writes, aborts are silent, stale results cannot win, and all checks pass.
