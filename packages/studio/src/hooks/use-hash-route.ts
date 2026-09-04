import { useState, useEffect, useCallback } from "react";

export type HashRoute =
  | { page: "dashboard" }
  | { page: "chat" }
  | { page: "book"; bookId: string }
  | { page: "book-outline"; bookId: string }
  | { page: "book-chat"; bookId: string }
  | { page: "book-settings"; bookId: string }
  | { page: "book-create" }
  | { page: "services" }
  | { page: "project-settings" }
  | { page: "service-detail"; serviceId: string }
  | { page: "chapter"; bookId: string; chapterNumber: number }
  | { page: "analytics"; bookId: string }
  | { page: "truth"; bookId: string }
  | { page: "daemon" }
  | { page: "logs" }
  | { page: "genres" }
  | { page: "style" }
  | { page: "translation" }
  | { page: "import"; tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation" }
  | { page: "radar" }
  | { page: "doctor" }
  | { page: "update" }
  | { page: "play"; projectId: string }
  | { page: "film"; projectId: string }
  | { page: "flow"; projectId: string }
  | { page: "film-author"; projectId: string }
  | { page: "film-studio"; projectId: string }
  | { page: "short"; storyId: string }
  | { page: "short-settings"; storyId: string }
  | { page: "short-analytics"; storyId: string };

function parseHash(hash: string): HashRoute {
  const path = hash.replace(/^#\/?/, "");

  if (!path || path === "/") return { page: "dashboard" };
  if (path === "chat") return { page: "chat" };
  if (path === "config" || path === "services") return { page: "services" };
  if (path === "settings") return { page: "project-settings" };
  if (path === "import") return { page: "import" };
  if (path === "translation") return { page: "translation" };
  if (path === "update") return { page: "update" };
  const importMatch = path.match(/^import\/(chapters|canon|fanfic|spinoff|imitation)$/);
  if (importMatch) return { page: "import", tab: importMatch[1] as "chapters" | "canon" | "fanfic" | "spinoff" | "imitation" };
  if (path === "book/new") return { page: "book-create" };

  const serviceMatch = path.match(/^services\/([^/]+)$/);
  if (serviceMatch) return { page: "service-detail", serviceId: decodeURIComponent(serviceMatch[1]) };

  const bookSettingsMatch = path.match(/^book\/([^/]+)\/settings$/);
  if (bookSettingsMatch) return { page: "book-settings", bookId: decodeURIComponent(bookSettingsMatch[1]) };

  const bookOutlineMatch = path.match(/^book\/([^/]+)\/outline$/);
  if (bookOutlineMatch) return { page: "book-outline", bookId: decodeURIComponent(bookOutlineMatch[1]) };

  const bookChatMatch = path.match(/^book\/([^/]+)\/chat$/);
  if (bookChatMatch) return { page: "book-chat", bookId: decodeURIComponent(bookChatMatch[1]) };

  const bookMatch = path.match(/^book\/([^/]+)$/);
  if (bookMatch) return { page: "book", bookId: decodeURIComponent(bookMatch[1]) };

  const playMatch = path.match(/^play\/([^/]+)$/);
  if (playMatch) return { page: "play", projectId: decodeURIComponent(playMatch[1]) };

  const filmMatch = path.match(/^film\/([^/]+)$/);
  if (filmMatch) return { page: "film", projectId: decodeURIComponent(filmMatch[1]) };

  const flowMatch = path.match(/^flow\/([^/]+)$/);
  if (flowMatch) return { page: "flow", projectId: decodeURIComponent(flowMatch[1]) };

  const filmAuthorMatch = path.match(/^film-author\/([^/]+)$/);
  if (filmAuthorMatch) return { page: "film-author", projectId: decodeURIComponent(filmAuthorMatch[1]) };

  const studioFilmMatch = path.match(/^studio\/film\/([^/]+)$/);
  if (studioFilmMatch) return { page: "film-studio", projectId: decodeURIComponent(studioFilmMatch[1]) };

  const shortSettingsMatch = path.match(/^short\/([^/]+)\/settings$/);
  if (shortSettingsMatch) return { page: "short-settings", storyId: decodeURIComponent(shortSettingsMatch[1]) };

  const shortAnalyticsMatch = path.match(/^short\/([^/]+)\/analytics$/);
  if (shortAnalyticsMatch) return { page: "short-analytics", storyId: decodeURIComponent(shortAnalyticsMatch[1]) };

  const shortMatch = path.match(/^short\/([^/]+)$/);
  if (shortMatch) return { page: "short", storyId: decodeURIComponent(shortMatch[1]) };

  return { page: "dashboard" };
}

function routeToHash(route: HashRoute): string {
  switch (route.page) {
    case "dashboard": return "#/";
    case "chat": return "#/chat";
    case "book": return `#/book/${encodeURIComponent(route.bookId)}`;
    case "book-outline": return `#/book/${encodeURIComponent(route.bookId)}/outline`;
    case "book-chat": return `#/book/${encodeURIComponent(route.bookId)}/chat`;
    case "book-settings": return `#/book/${encodeURIComponent(route.bookId)}/settings`;
    case "book-create": return "#/book/new";
    case "services": return "#/services";
    case "project-settings": return "#/settings";
    case "translation": return "#/translation";
    case "update": return "#/update";
    case "import": return route.tab ? `#/import/${route.tab}` : "#/import";
    case "service-detail": return `#/services/${encodeURIComponent(route.serviceId)}`;
    case "play": return `#/play/${encodeURIComponent(route.projectId)}`;
    case "film": return `#/film/${encodeURIComponent(route.projectId)}`;
    case "flow": return `#/flow/${encodeURIComponent(route.projectId)}`;
    case "film-author": return `#/film-author/${encodeURIComponent(route.projectId)}`;
    case "film-studio": return `#/studio/film/${encodeURIComponent(route.projectId)}`;
    case "short": return `#/short/${encodeURIComponent(route.storyId)}`;
    case "short-settings": return `#/short/${encodeURIComponent(route.storyId)}/settings`;
    case "short-analytics": return `#/short/${encodeURIComponent(route.storyId)}/analytics`;
    default: return "";
  }
}

export { parseHash, routeToHash }; // for testing

const HASH_PAGES = new Set(["dashboard", "chat", "book", "book-outline", "book-chat", "book-settings", "book-create", "services", "project-settings", "service-detail", "translation", "import", "update", "play", "film", "flow", "film-author", "film-studio", "short", "short-settings", "short-analytics"]);

export function useHashRoute() {
  const [route, setRouteState] = useState<HashRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRouteState(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setRoute = useCallback((newRoute: HashRoute) => {
    // 先同步 React state：无论目标页面是否写 URL，保证页面立刻切换。
    // 之前只在非 hash 页面才 setRouteState，hash 页面完全靠 hashchange 事件回调触发。
    // 但当 URL 没有实际变化时（比如从 services → logs → services，中间的 logs
    // 不写 URL，URL 一直停在 #/services），再次赋值同一个 hash 不会触发 hashchange，
    // React state 就永远停留在 logs，表现为"点不动"。
    setRouteState(newRoute);
    if (HASH_PAGES.has(newRoute.page)) {
      const hash = routeToHash(newRoute);
      if (hash && window.location.hash !== hash) {
        window.location.hash = hash;
      }
    }
  }, []);

  const nav = {
    toServices: () => setRoute({ page: "services" }),
    toServiceDetail: (id: string) => setRoute({ page: "service-detail", serviceId: id }),
  };

  return { route, setRoute, nav };
}
