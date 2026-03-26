import { j as e, r as n, R as m, a as p } from "./common-BL-bmJAm.js";
function x({ url: s }) {
  const c = s.length > 45 ? s.substring(0, 45) + "..." : s;
  return e.jsxs("div", {
    className: "popup-header",
    children: [
      e.jsx("div", {
        className: "popup-header-top",
        children: e.jsxs("div", {
          className: "popup-logo",
          children: [
            e.jsxs("svg", {
              width: "24",
              height: "24",
              viewBox: "0 0 24 24",
              fill: "none",
              xmlns: "http://www.w3.org/2000/svg",
              children: [
                e.jsx("rect", {
                  width: "24",
                  height: "24",
                  rx: "6",
                  fill: "#4F46E5",
                }),
                e.jsx("path", {
                  d: "M7 8h10M7 12h7M7 16h10",
                  stroke: "white",
                  strokeWidth: "2",
                  strokeLinecap: "round",
                }),
              ],
            }),
            e.jsx("span", {
              className: "popup-title",
              children: "No Code Web Scraper",
            }),
          ],
        }),
      }),
      s && e.jsx("div", { className: "popup-url", title: s, children: c }),
    ],
  });
}
function j({ tabId: s }) {
  const c = () => {
      s &&
        (chrome.runtime.sendMessage({
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: s },
        }),
        window.close());
    },
    t = () => {
      s &&
        (chrome.runtime.sendMessage({
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: s },
        }),
        window.close());
    };
  return e.jsxs("div", {
    className: "quick-actions",
    children: [
      e.jsxs("button", {
        className: "btn btn-primary btn-block",
        onClick: c,
        children: [
          e.jsxs("svg", {
            width: "16",
            height: "16",
            viewBox: "0 0 16 16",
            fill: "none",
            children: [
              e.jsx("circle", {
                cx: "8",
                cy: "8",
                r: "3",
                stroke: "currentColor",
                strokeWidth: "2",
              }),
              e.jsx("path", {
                d: "M8 1v3M8 12v3M1 8h3M12 8h3",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
              }),
            ],
          }),
          "Start Scraping",
        ],
      }),
      e.jsx("button", {
        className: "btn btn-secondary btn-block",
        onClick: t,
        children: "Open Side Panel",
      }),
    ],
  });
}
function v({ recipe: s, onRun: c, onDelete: t }) {
  return e.jsxs("div", {
    className: "recipe-card",
    children: [
      e.jsxs("div", {
        className: "recipe-card-info",
        children: [
          e.jsx("div", { className: "recipe-card-name", children: s.name }),
          e.jsxs("div", {
            className: "recipe-card-meta",
            children: [
              s.fields.length,
              " field",
              s.fields.length !== 1 ? "s" : "",
              e.jsx("span", { className: "recipe-card-dot", children: "·" }),
              s.urlPattern || "Any page",
            ],
          }),
        ],
      }),
      e.jsxs("div", {
        className: "recipe-card-actions",
        children: [
          e.jsx("button", {
            className: "btn btn-primary btn-sm",
            onClick: c,
            children: "Run",
          }),
          e.jsx("button", {
            className: "btn btn-ghost btn-sm",
            onClick: t,
            children: e.jsx("svg", {
              width: "14",
              height: "14",
              viewBox: "0 0 14 14",
              fill: "none",
              children: e.jsx("path", {
                d: "M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
              }),
            }),
          }),
        ],
      }),
    ],
  });
}
function N({ url: s, tabId: c }) {
  const [t, a] = n.useState([]),
    [r, d] = n.useState(!0);
  n.useEffect(() => {
    chrome.runtime.sendMessage({ action: "GET_RECIPES" }, (i) => {
      (i != null && i.recipes && a(i.recipes), d(!1));
    });
  }, []);
  const l = (i) => {
      chrome.runtime.sendMessage(
        { action: "DELETE_RECIPE", payload: { id: i } },
        () => {
          a((h) => h.filter((u) => u.id !== i));
        },
      );
    },
    o = (i) => {
      c &&
        (chrome.runtime.sendMessage({
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: c, recipeId: i.id },
        }),
        window.close());
    };
  return r
    ? e.jsxs("div", {
        className: "recipe-list-section",
        children: [
          e.jsx("div", {
            className: "section-title",
            children: "Saved Recipes",
          }),
          e.jsx("div", {
            className: "flex items-center justify-center",
            style: { padding: "var(--space-xl)" },
            children: e.jsx("div", { className: "spinner" }),
          }),
        ],
      })
    : e.jsxs("div", {
        className: "recipe-list-section",
        children: [
          e.jsx("div", {
            className: "section-title",
            children: "Saved Recipes",
          }),
          t.length === 0
            ? e.jsx("div", {
                className: "empty-state",
                children: e.jsx("div", {
                  className: "empty-state-text",
                  children: "No saved recipes yet",
                }),
              })
            : e.jsx("div", {
                className: "recipe-list",
                children: t.map((i) =>
                  e.jsx(
                    v,
                    { recipe: i, onRun: () => o(i), onDelete: () => l(i.id) },
                    i.id,
                  ),
                ),
              }),
        ],
      });
}
function f({ url: s, tabId: c }) {
  const [t, a] = n.useState(null);
  if (
    (n.useEffect(() => {
      s &&
        chrome.runtime.sendMessage(
          { action: "DETECT_PREBUILT", payload: { url: s } },
          (d) => {
            d != null && d.recipe && a(d.recipe);
          },
        );
    }, [s]),
    !t)
  )
    return null;
  const r = () => {
    c &&
      (chrome.runtime.sendMessage({
        action: "OPEN_SIDE_PANEL",
        payload: { tabId: c, prebuiltId: t.id },
      }),
      window.close());
  };
  return e.jsx("div", {
    className: "site-detector",
    children: e.jsxs("div", {
      className: "site-detector-card",
      onClick: r,
      children: [
        e.jsx("div", { className: "site-detector-icon", children: t.icon }),
        e.jsxs("div", {
          className: "site-detector-info",
          children: [
            e.jsx("div", { className: "site-detector-name", children: t.name }),
            e.jsx("div", {
              className: "site-detector-desc",
              children: "1-click scrape available",
            }),
          ],
        }),
        e.jsx("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 16 16",
          fill: "none",
          className: "site-detector-arrow",
          children: e.jsx("path", {
            d: "M6 4l4 4-4 4",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
        }),
      ],
    }),
  });
}
function g() {
  const [s, c] = n.useState(""),
    [t, a] = n.useState(null);
  return (
    n.useEffect(() => {
      chrome.tabs.query({ active: !0, currentWindow: !0 }, (r) => {
        r[0] && (c(r[0].url || ""), a(r[0].id || null));
      });
    }, []),
    e.jsxs("div", {
      className: "popup",
      children: [
        e.jsx(x, { url: s }),
        e.jsx(f, { url: s, tabId: t }),
        e.jsx(j, { tabId: t }),
        e.jsx(N, { url: s, tabId: t }),
      ],
    })
  );
}
m.createRoot(document.getElementById("root")).render(
  e.jsx(p.StrictMode, { children: e.jsx(g, {}) }),
);
