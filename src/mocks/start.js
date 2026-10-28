/**
 * Starts the mock API in the page. Only loaded when
 * NEXT_PUBLIC_API_MOCKING=enabled, e.g. via `pnpm dev:mock`.
 *
 * Same-origin API calls are answered by the MSW handlers straight from a
 * patched `fetch`, and /me/stream is a fake EventSource fed by the mock's
 * events. No service worker, so it works in any browser: a hard refresh, an
 * editor's preview pane, or a phone on the LAN address (http://192.168.…).
 */
import { getResponse } from "msw";
import { openStream } from "./events.js";
import { handlers, isApiPath, readSession } from "./handlers.js";
import { mountPanel } from "./panel.js";

const STREAM_PATH = "/me/stream";

function patchFetch() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href,
    );
    if (url.origin !== location.origin || !isApiPath(url.pathname)) {
      return realFetch(input, init);
    }
    const request =
      input instanceof Request
        ? new Request(input.clone(), init)
        : new Request(url, init);
    // Always answered here (501 for an API path the mock doesn't know), so an
    // API call never reaches the network in mock mode.
    return (await getResponse(handlers, request)) ?? realFetch(input, init);
  };
}

function patchEventSource() {
  const RealEventSource = window.EventSource;

  class MockEventSource extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    constructor(url, init) {
      const target = new URL(String(url), location.href);
      if (
        target.origin !== location.origin ||
        target.pathname !== STREAM_PATH
      ) {
        // Anything else is a real stream (e.g. not ours).
        return new RealEventSource(url, init);
      }
      super();
      this.url = target.href;
      this.withCredentials = !!init?.withCredentials;
      this.readyState = MockEventSource.CONNECTING;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      setTimeout(() => this.#connect(), 0);
    }

    #fire(event) {
      this.dispatchEvent(event);
      const handler = this[`on${event.type}`];
      if (typeof handler === "function") handler.call(this, event);
    }

    #connect() {
      if (this.readyState === MockEventSource.CLOSED) return;
      const accountId = readSession();
      if (!accountId) {
        this.readyState = MockEventSource.CLOSED;
        this.#fire(new Event("error"));
        return;
      }
      this.readyState = MockEventSource.OPEN;
      this.#fire(new Event("open"));
      openStream(accountId, {
        send: ({ id, event, data }) => {
          if (this.readyState === MockEventSource.CLOSED)
            throw new Error("closed");
          this.#fire(
            new MessageEvent(event ?? "message", {
              data: typeof data === "string" ? data : JSON.stringify(data),
              lastEventId: id ?? "",
            }),
          );
        },
      });
    }

    close() {
      this.readyState = MockEventSource.CLOSED;
    }
  }

  window.EventSource = MockEventSource;
}

/** @param {{ roles: string[] }} options the roles whose test logins the panel lists */
export async function startMocking(options) {
  // An earlier version of this mock used a service worker; remove it if the
  // browser still has it registered.
  navigator.serviceWorker
    ?.getRegistrations()
    .then((registrations) =>
      registrations
        .filter((r) => r.active?.scriptURL.endsWith("/mockServiceWorker.js"))
        .forEach((r) => r.unregister()),
    )
    .catch(() => {});
  patchFetch();
  patchEventSource();
  mountPanel(options);
  console.info(
    "%c[mock api] On: every API call is answered in the browser with fake data.",
    "color:#b45309;font-weight:bold",
  );
}
