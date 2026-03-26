import { j as e, r as c, R as pe, a as xe } from "./common-BL-bmJAm.js";
function _() {
  return crypto.randomUUID();
}
function fe({
  recipeName: t,
  onNameChange: i,
  onSave: d,
  saveStatus: m,
  canSave: p,
  onOpenRecipes: x,
  isUnlocked: o,
  accessExpired: r,
  accessRemainingMs: f,
  onOpenAccess: v,
  urlPattern: E,
  onUrlChange: A,
}) {
  return e.jsxs("div", {
    className: "sidepanel-header-wrap",
    children: [
      e.jsxs("div", {
        className: "sidepanel-header",
        children: [
          e.jsx("div", {
            className: "sidepanel-header-left",
            children: e.jsx("input", {
              className: "header-name-input",
              type: "text",
              placeholder: "Recipe name",
              value: t,
              onChange: (j) => i(j.target.value),
            }),
          }),
          e.jsxs("div", {
            className: "header-actions",
            children: [
              e.jsx("button", {
                className: "save-icon-btn",
                onClick: x,
                title: "Saved recipes",
                children: e.jsx("svg", {
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  children: e.jsx("path", {
                    d: "M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z",
                    stroke: "currentColor",
                    strokeWidth: "1.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  }),
                }),
              }),
              e.jsx("button", {
                className: "save-icon-btn",
                onClick: d,
                disabled: !p || m === "saving",
                title:
                  m === "saved"
                    ? "Saved!"
                    : m === "error"
                      ? "Save failed"
                      : "Save recipe",
                children:
                  m === "saved"
                    ? e.jsx("svg", {
                        width: "16",
                        height: "16",
                        viewBox: "0 0 16 16",
                        fill: "none",
                        children: e.jsx("path", {
                          d: "M3 8.5l3.5 3.5 6.5-7",
                          stroke: "#16A34A",
                          strokeWidth: "2",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                        }),
                      })
                    : m === "saving"
                      ? e.jsx("div", {
                          className: "spinner",
                          style: { width: 14, height: 14 },
                        })
                      : m === "error"
                        ? e.jsx("svg", {
                            width: "16",
                            height: "16",
                            viewBox: "0 0 16 16",
                            fill: "none",
                            children: e.jsx("path", {
                              d: "M4 4l8 8M12 4l-8 8",
                              stroke: "#DC2626",
                              strokeWidth: "2",
                              strokeLinecap: "round",
                            }),
                          })
                        : e.jsxs("svg", {
                            width: "16",
                            height: "16",
                            viewBox: "0 0 16 16",
                            fill: "none",
                            children: [
                              e.jsx("path", {
                                d: "M12.67 2H3.33C2.6 2 2 2.6 2 3.33v9.34C2 13.4 2.6 14 3.33 14h9.34c.73 0 1.33-.6 1.33-1.33V5.33L12.67 2z",
                                stroke: "currentColor",
                                strokeWidth: "1.5",
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                              }),
                              e.jsx("path", {
                                d: "M11.33 14V9.33H4.67V14",
                                stroke: "currentColor",
                                strokeWidth: "1.5",
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                              }),
                              e.jsx("path", {
                                d: "M4.67 2v3.33h5.33",
                                stroke: "currentColor",
                                strokeWidth: "1.5",
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                              }),
                            ],
                          }),
              }),
            ],
          }),
        ],
      }),
      e.jsx("div", {
        className: "header-sub-row",
        children: e.jsx("input", {
          className: "header-url-input",
          type: "text",
          placeholder: "URL pattern (e.g. amazon.com)",
          value: E,
          onChange: (j) => A(j.target.value),
        }),
      }),
    ],
  });
}
const R = {
  text: { bg: "#eff6ff", border: "#bfdbfe" },
  link: { bg: "#faf5ff", border: "#e9d5ff" },
  image: { bg: "#ecfdf5", border: "#a7f3d0" },
  video: { bg: "#fff7ed", border: "#fed7aa" },
  number: { bg: "#fef9ec", border: "#fde68a" },
  html: { bg: "#fdf2f8", border: "#fbcfe8" },
};
function je({
  field: t,
  index: i,
  isActive: d,
  onUpdate: m,
  onRemove: p,
  onPick: x,
  onSelect: o,
  availableSelectors: r,
  onDragStart: f,
  onDragOver: v,
  onDrop: E,
  onDragEnd: A,
  isDragging: k,
}) {
  const j = (h) => {
      const M = h.target.value,
        S = r.find((I) => I.selector === M);
      S && m({ selector: S.selector, attribute: S.attribute, type: S.type });
    },
    u = (h) => {
      (h.stopPropagation(), d || o(), x());
    };
  return e.jsxs("div", {
    className: `field-row ${d ? "field-row-active" : ""} ${k ? "field-row-dragging" : ""}`,
    style: d
      ? void 0
      : {
          background: (R[t.type] || R.text).bg,
          borderColor: (R[t.type] || R.text).border,
        },
    onClick: o,
    draggable: !0,
    onDragStart: f,
    onDragOver: v,
    onDrop: E,
    onDragEnd: A,
    children: [
      e.jsxs("div", {
        className: "field-row-header",
        children: [
          e.jsx("div", {
            className: "field-row-drag",
            onMouseDown: (h) => h.stopPropagation(),
            children: e.jsxs("svg", {
              width: "12",
              height: "12",
              viewBox: "0 0 12 12",
              fill: "none",
              children: [
                e.jsx("circle", {
                  cx: "4",
                  cy: "2.5",
                  r: "1",
                  fill: "currentColor",
                }),
                e.jsx("circle", {
                  cx: "8",
                  cy: "2.5",
                  r: "1",
                  fill: "currentColor",
                }),
                e.jsx("circle", {
                  cx: "4",
                  cy: "6",
                  r: "1",
                  fill: "currentColor",
                }),
                e.jsx("circle", {
                  cx: "8",
                  cy: "6",
                  r: "1",
                  fill: "currentColor",
                }),
                e.jsx("circle", {
                  cx: "4",
                  cy: "9.5",
                  r: "1",
                  fill: "currentColor",
                }),
                e.jsx("circle", {
                  cx: "8",
                  cy: "9.5",
                  r: "1",
                  fill: "currentColor",
                }),
              ],
            }),
          }),
          e.jsx("span", {
            className: `field-row-index ${d ? "field-row-index-active" : ""}`,
            children: i + 1,
          }),
          e.jsx("input", {
            className: "input input-sm field-name-input",
            type: "text",
            value: t.name,
            onChange: (h) => m({ name: h.target.value }),
            onClick: (h) => h.stopPropagation(),
            placeholder: "Field name",
          }),
          e.jsxs("select", {
            className: "select field-type-select",
            value: t.type,
            onClick: (h) => h.stopPropagation(),
            onChange: (h) => {
              const M = h.target.value;
              m({
                type: M,
                attribute: {
                  text: "textContent",
                  link: "href",
                  image: "src",
                  video: "src",
                  number: "textContent",
                  html: "innerHTML",
                }[M],
              });
            },
            children: [
              e.jsx("option", { value: "text", children: "Text" }),
              e.jsx("option", { value: "link", children: "Link" }),
              e.jsx("option", { value: "image", children: "Image" }),
              e.jsx("option", { value: "video", children: "Video" }),
              e.jsx("option", { value: "number", children: "Number" }),
              e.jsx("option", { value: "html", children: "HTML" }),
            ],
          }),
          e.jsx("button", {
            className: "btn btn-ghost btn-sm",
            onClick: (h) => {
              (h.stopPropagation(), p());
            },
            title: "Remove field",
            children: e.jsx("svg", {
              width: "14",
              height: "14",
              viewBox: "0 0 14 14",
              fill: "none",
              children: e.jsx("path", {
                d: "M3 3l8 8M11 3l-8 8",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
              }),
            }),
          }),
        ],
      }),
      e.jsxs("div", {
        className: "field-row-selector",
        children: [
          r.length > 0
            ? e.jsxs("select", {
                className: "select input-sm field-selector-select",
                value: t.selector,
                onClick: (h) => h.stopPropagation(),
                onChange: j,
                children: [
                  !t.selector &&
                    e.jsx("option", {
                      value: "",
                      children: "Select a data field...",
                    }),
                  r.map((h, M) =>
                    e.jsxs(
                      "option",
                      {
                        value: h.selector,
                        children: [
                          h.name,
                          " — ",
                          h.sampleValue
                            ? h.sampleValue.substring(0, 50)
                            : "(empty)",
                        ],
                      },
                      M,
                    ),
                  ),
                ],
              })
            : e.jsx("div", {
                className: "selector-display",
                children: t.selector
                  ? e.jsx("code", {
                      className: "selector-text",
                      children: t.selector,
                    })
                  : e.jsx("span", {
                      className: "selector-placeholder",
                      children: "No selector — click Pick to select an element",
                    }),
              }),
          e.jsx("button", {
            className: "btn btn-primary btn-sm",
            onClick: u,
            title: "Pick element",
            children: e.jsx("svg", {
              width: "16",
              height: "16",
              viewBox: "0 0 24 24",
              fill: "none",
              children: e.jsx("path", {
                d: "M2 12h4m12 0h4M12 22v-4m0-12V2m8 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0m-5 0a3 3 0 1 1-6 0a3 3 0 0 1 6 0",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }),
            }),
          }),
        ],
      }),
    ],
  });
}
function ve({
  fields: t,
  activeFieldId: i,
  onUpdateField: d,
  onRemoveField: m,
  onPickField: p,
  onSelectField: x,
  onReorderFields: o,
  availableSelectors: r,
}) {
  const [f, v] = c.useState(null);
  if (t.length === 0)
    return e.jsx("div", {
      className: "empty-state",
      style: { padding: "var(--space-lg)" },
      children: e.jsx("div", {
        className: "empty-state-text",
        children: 'Click "+ Add" to start defining what data to scrape',
      }),
    });
  const E = (u) => (h) => {
      (v(u), (h.dataTransfer.effectAllowed = "move"));
    },
    A = (u) => {
      (u.preventDefault(), (u.dataTransfer.dropEffect = "move"));
    },
    k = (u) => (h) => {
      (h.preventDefault(), f !== null && f !== u && o(f, u), v(null));
    },
    j = () => {
      v(null);
    };
  return e.jsx("div", {
    className: "field-list",
    children: t.map((u, h) =>
      e.jsx(
        je,
        {
          field: u,
          index: h,
          isActive: i === u.id,
          onUpdate: (M) => d(u.id, M),
          onRemove: () => m(u.id),
          onPick: () => p(u.id, u.name, u.type),
          onSelect: () => x(i === u.id ? null : u.id),
          availableSelectors: r,
          onDragStart: E(h),
          onDragOver: A,
          onDrop: k(h),
          onDragEnd: j,
          isDragging: f === h,
        },
        u.id,
      ),
    ),
  });
}
function X({ pagination: t, onChange: i }) {
  const d = t !== null,
    m = () => {
      i(
        d
          ? null
          : {
              type: "click-next",
              nextButtonSelector: "",
              maxPages: 5,
              delayMs: 2e3,
            },
      );
    },
    p = async () => {
      const [o] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      o != null &&
        o.id &&
        chrome.tabs.sendMessage(o.id, { action: "DETECT_PAGINATION" }, (r) => {
          r != null && r.pagination && i(r.pagination);
        });
    },
    x = async () => {
      const [o] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!(o != null && o.id)) return;
      chrome.tabs.sendMessage(o.id, {
        action: "START_PICKER",
        payload: {
          fieldId: "__pagination_next__",
          fieldName: "Next Page Button",
        },
      });
      const r = (f) => {
        if (f.action === "ELEMENT_PICKED") {
          const v = f.payload;
          if (v.fieldId !== "__pagination_next__") return;
          (t && i({ ...t, nextButtonSelector: v.selector }),
            chrome.runtime.onMessage.removeListener(r));
        }
      };
      chrome.runtime.onMessage.addListener(r);
    };
  return e.jsxs("div", {
    className: "pagination-section",
    children: [
      e.jsxs("div", {
        className: "fields-header",
        style: { padding: 0 },
        children: [
          e.jsx("label", {
            className: "label",
            style: { marginBottom: 0 },
            children: "Multi-page Scraping",
          }),
          e.jsxs("label", {
            className: "toggle-label",
            children: [
              e.jsx("input", {
                type: "checkbox",
                checked: d,
                onChange: m,
                className: "toggle-input",
              }),
              e.jsx("span", { className: "toggle-switch" }),
            ],
          }),
        ],
      }),
      d &&
        t &&
        e.jsxs("div", {
          className: "pagination-config",
          children: [
            e.jsxs("div", {
              className: "pagination-row",
              children: [
                e.jsx("label", {
                  className: "label",
                  children: "Pagination Type",
                }),
                e.jsxs("select", {
                  className: "select",
                  value: t.type,
                  onChange: (o) => i({ ...t, type: o.target.value }),
                  children: [
                    e.jsx("option", {
                      value: "click-next",
                      children: "Click Next Button",
                    }),
                    e.jsx("option", {
                      value: "infinite-scroll",
                      children: "Scroll & Scrape",
                    }),
                    e.jsx("option", {
                      value: "url-pattern",
                      children: "URL Pattern",
                    }),
                  ],
                }),
              ],
            }),
            t.type === "click-next" &&
              e.jsxs("div", {
                className: "pagination-row",
                children: [
                  e.jsx("label", {
                    className: "label",
                    children: "Next Button Selector",
                  }),
                  e.jsxs("div", {
                    className: "flex gap-sm",
                    children: [
                      e.jsx("input", {
                        className: "input input-sm",
                        type: "text",
                        placeholder: "CSS selector for next button",
                        value: t.nextButtonSelector || "",
                        onChange: (o) =>
                          i({ ...t, nextButtonSelector: o.target.value }),
                      }),
                      e.jsx("button", {
                        className: "btn btn-secondary btn-sm",
                        onClick: x,
                        children: "Pick",
                      }),
                      e.jsx("button", {
                        className: "btn btn-ghost btn-sm",
                        onClick: p,
                        children: "Auto",
                      }),
                    ],
                  }),
                ],
              }),
            t.type === "infinite-scroll" &&
              e.jsx("div", {
                className: "pagination-row",
                children: e.jsx("div", {
                  className: "text-xs text-muted",
                  children:
                    "Automatically scrolls the page to load more content (like Twitter, Reddit, etc.)",
                }),
              }),
            t.type === "url-pattern" &&
              e.jsxs("div", {
                className: "pagination-row",
                children: [
                  e.jsx("label", {
                    className: "label",
                    children: "URL Template",
                  }),
                  e.jsx("input", {
                    className: "input input-sm",
                    type: "text",
                    placeholder: "e.g. https://example.com/page/{page}",
                    value: t.urlTemplate || "",
                    onChange: (o) => i({ ...t, urlTemplate: o.target.value }),
                  }),
                  e.jsxs("div", {
                    className: "text-xs text-muted",
                    style: { marginTop: "var(--space-xs)" },
                    children: [
                      "Use ",
                      "{page}",
                      " as placeholder for page number",
                    ],
                  }),
                ],
              }),
            e.jsxs("div", {
              className: "pagination-row-inline",
              children: [
                e.jsxs("div", {
                  children: [
                    e.jsx("label", {
                      className: "label",
                      children:
                        t.type === "infinite-scroll"
                          ? "Max Scrolls"
                          : "Max Pages",
                    }),
                    e.jsx("input", {
                      className: "input input-sm",
                      type: "number",
                      min: 1,
                      max: 50,
                      value: t.maxPages,
                      onChange: (o) =>
                        i({
                          ...t,
                          maxPages: Math.min(
                            50,
                            Math.max(1, parseInt(o.target.value) || 1),
                          ),
                        }),
                      style: { width: "80px" },
                    }),
                  ],
                }),
                e.jsxs("div", {
                  children: [
                    e.jsx("label", {
                      className: "label",
                      children:
                        t.type === "infinite-scroll"
                          ? "Scroll Delay (ms)"
                          : "Delay (ms)",
                    }),
                    e.jsx("input", {
                      className: "input input-sm",
                      type: "number",
                      min: 500,
                      max: 1e4,
                      step: 500,
                      value: t.delayMs,
                      onChange: (o) =>
                        i({
                          ...t,
                          delayMs: Math.min(
                            1e4,
                            Math.max(500, parseInt(o.target.value) || 2e3),
                          ),
                        }),
                      style: { width: "100px" },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    ],
  });
}
function K(t) {
  return t
    .split(/[\r\n]+/)
    .map((i) => (i.includes(",") ? i.split(",")[0] : i).trim())
    .filter(
      (i) =>
        i.length > 0 && (i.startsWith("http://") || i.startsWith("https://")),
    );
}
function be({ urls: t, onChange: i }) {
  const d = c.useRef(null),
    m = (x) => {
      i(K(x.target.value));
    },
    p = (x) => {
      var f;
      const o = (f = x.target.files) == null ? void 0 : f[0];
      if (!o) return;
      const r = new FileReader();
      ((r.onload = () => {
        const v = r.result;
        i(K(v));
      }),
        r.readAsText(o),
        (x.target.value = ""));
    };
  return e.jsxs("div", {
    className: "bulk-config",
    children: [
      e.jsx("textarea", {
        className: "input bulk-textarea",
        rows: 5,
        placeholder: "Paste URLs, one per line...",
        defaultValue: t.join(`
`),
        onChange: m,
      }),
      e.jsxs("div", {
        className: "bulk-footer",
        children: [
          e.jsxs("div", {
            className: "bulk-footer-left",
            children: [
              e.jsx("input", {
                ref: d,
                type: "file",
                accept: ".csv,.txt",
                onChange: p,
                style: { display: "none" },
              }),
              e.jsx("button", {
                className: "btn btn-secondary btn-sm",
                onClick: () => {
                  var x;
                  return (x = d.current) == null ? void 0 : x.click();
                },
                children: "Import CSV",
              }),
              t.length > 0 &&
                e.jsx("button", {
                  className: "btn btn-ghost btn-sm",
                  onClick: () => i([]),
                  children: "Clear",
                }),
            ],
          }),
          t.length > 0 &&
            e.jsxs("span", {
              className: "bulk-count",
              children: [
                t.length,
                " URL",
                t.length !== 1 ? "s" : "",
                " loaded",
              ],
            }),
        ],
      }),
    ],
  });
}
function ke({
  onViewData: t,
  onScrape: i,
  hasData: d,
  dataCount: m,
  canScrape: p,
}) {
  return e.jsxs("div", {
    className: "action-bar",
    children: [
      e.jsx("button", {
        className: "btn btn-secondary action-btn",
        onClick: t,
        disabled: !d,
        children: d ? `View Data (${m})` : "View Data",
      }),
      e.jsx("button", {
        className: "btn btn-primary action-btn",
        onClick: i,
        disabled: !p,
        children: "Scrape",
      }),
    ],
  });
}
function ye({ status: t, currentPage: i, totalPages: d, onStop: m }) {
  if (t === "idle" || t === "complete") return null;
  const p =
      t === "scraping" ||
      t === "paginating" ||
      t === "scrolling" ||
      t === "page-detail",
    x = () => {
      switch (t) {
        case "picking":
          return "Click an element on the page...";
        case "scraping":
          return "Scraping data...";
        case "paginating":
          return `Scraping page ${i} of ${d}...`;
        case "scrolling":
          return `Scrolling & scraping — scroll ${i} of ${d}...`;
        case "page-detail":
          return `Scraping URL ${i} of ${d}...`;
        case "error":
          return "An error occurred";
        default:
          return "";
      }
    },
    o = d > 0 ? (i / d) * 100 : 0;
  return e.jsxs("div", {
    className: `status-bar ${t === "error" ? "status-bar-error" : ""}`,
    children: [
      e.jsxs("div", {
        className: "status-bar-content",
        children: [
          p
            ? e.jsx("div", {
                className: "spinner",
                style: { width: 14, height: 14 },
              })
            : null,
          e.jsx("span", { className: "status-bar-text", children: x() }),
          p &&
            e.jsx("button", {
              className: "btn btn-ghost btn-sm",
              onClick: m,
              children: "Stop",
            }),
        ],
      }),
      (t === "paginating" || t === "scrolling" || t === "page-detail") &&
        d > 0 &&
        e.jsx("div", {
          className: "status-bar-progress",
          children: e.jsx("div", {
            className: "status-bar-progress-fill",
            style: { width: `${o}%` },
          }),
        }),
    ],
  });
}
function Ne({ onLoad: t, onClose: i }) {
  const [d, m] = c.useState([]),
    [p, x] = c.useState(!0);
  c.useEffect(() => {
    chrome.runtime.sendMessage({ action: "GET_RECIPES" }, (r) => {
      (r != null && r.recipes && m(r.recipes), x(!1));
    });
  }, []);
  const o = (r) => {
    chrome.runtime.sendMessage(
      { action: "DELETE_RECIPE", payload: { id: r } },
      () => {
        m((f) => f.filter((v) => v.id !== r));
      },
    );
  };
  return e.jsx("div", {
    className: "saved-recipes-overlay",
    onClick: i,
    children: e.jsxs("div", {
      className: "saved-recipes-panel",
      onClick: (r) => r.stopPropagation(),
      children: [
        e.jsxs("div", {
          className: "saved-recipes-header",
          children: [
            e.jsx("span", {
              className: "saved-recipes-title",
              children: "Saved Recipes",
            }),
            e.jsx("button", {
              className: "save-icon-btn",
              onClick: i,
              title: "Close",
              children: e.jsx("svg", {
                width: "16",
                height: "16",
                viewBox: "0 0 16 16",
                fill: "none",
                children: e.jsx("path", {
                  d: "M4 4l8 8M12 4l-8 8",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  strokeLinecap: "round",
                }),
              }),
            }),
          ],
        }),
        e.jsx("div", {
          className: "saved-recipes-body",
          children: p
            ? e.jsx("div", {
                className: "saved-recipes-empty",
                children: e.jsx("div", { className: "spinner" }),
              })
            : d.length === 0
              ? e.jsxs("div", {
                  className: "saved-recipes-empty",
                  children: [
                    e.jsx("svg", {
                      width: "32",
                      height: "32",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      style: { opacity: 0.3, marginBottom: 8 },
                      children: e.jsx("path", {
                        d: "M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                      }),
                    }),
                    e.jsx("span", { children: "No saved recipes yet" }),
                  ],
                })
              : d.map((r) =>
                  e.jsxs(
                    "div",
                    {
                      className: "saved-recipe-item",
                      children: [
                        e.jsxs("div", {
                          className: "saved-recipe-info",
                          onClick: () => {
                            (t(r), i());
                          },
                          children: [
                            e.jsx("div", {
                              className: "saved-recipe-name",
                              children: r.name || "Untitled",
                            }),
                            e.jsxs("div", {
                              className: "saved-recipe-meta",
                              children: [
                                r.fields.length,
                                " field",
                                r.fields.length !== 1 ? "s" : "",
                                r.urlPattern &&
                                  e.jsxs(e.Fragment, {
                                    children: [" · ", r.urlPattern],
                                  }),
                              ],
                            }),
                          ],
                        }),
                        e.jsx("button", {
                          className: "save-icon-btn",
                          onClick: () => o(r.id),
                          title: "Delete",
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
                    },
                    r.id,
                  ),
                ),
        }),
      ],
    }),
  });
}
function Ce({ onBack: t, accessProfile: i }) {
  return e.jsx("div", {
    className: "access-page",
    children: e.jsxs("div", {
      className: "access-page-content",
      children: [
        e.jsx("div", {
          className: "access-icon access-icon-active",
          children: e.jsxs("svg", {
            width: "40",
            height: "40",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "#16A34A",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: [
              e.jsx("path", { d: "M22 11.08V12a10 10 0 11-5.93-9.14" }),
              e.jsx("path", { d: "M22 4L12 14.01l-3-3" }),
            ],
          }),
        }),
        e.jsx("h2", { className: "access-title", children: "Workspace Ready" }),
        e.jsx("p", {
          className: "access-subtitle",
          children: "Unlimited mode is enabled. All scraping features are available.",
        }),
        i &&
          e.jsxs("div", {
            className: "access-info-card",
            children: [
              e.jsxs("div", {
                className: "access-info-row",
                children: [
                  e.jsx("span", {
                    className: "access-info-label",
                    children: "Email",
                  }),
                  e.jsx("span", {
                    className: "access-info-value",
                    children: i.email,
                  }),
                ],
              }),
              e.jsxs("div", {
                className: "access-info-row",
                children: [
                  e.jsx("span", {
                    className: "access-info-label",
                    children: "Mode",
                  }),
                  e.jsx("span", {
                    className: "access-info-value access-status-active",
                    children: "Unlimited",
                  }),
                ],
              }),
            ],
          }),
        e.jsx("button", {
          className: "btn btn-secondary access-back-btn",
          onClick: t,
          children: "Back to Scraper",
        }),
      ],
    }),
  });
}
const we = () => ({
  id: _(),
  name: "",
  urlPattern: "",
  fields: [],
  pagination: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isPrebuilt: !1,
});
function Ae() {
  const [t, i] = c.useState(we()),
    [d, m] = c.useState("list"),
    [p, x] = c.useState(null),
    [o, r] = c.useState([]),
    [f, v] = c.useState(null),
    [E, A] = c.useState([]),
    [k, j] = c.useState(null),
    [u, h] = c.useState(null),
    [M, S] = c.useState("idle"),
    [I, B] = c.useState(!1),
    F = c.useRef(t);
  F.current = t;
  const [P, w] = c.useState({
      id: _(),
      recipeId: t.id,
      status: "idle",
      data: [],
      currentPage: 0,
      totalPages: 0,
      errors: [],
      startedAt: null,
      completedAt: null,
    }),
    [L, W] = c.useState({
      isUnlocked: !0,
      isTimed: !1,
      accessExpired: !1,
      accessRemainingMs: 0,
      accessProfile: {
        email: "free@nocodewebscraper.local",
        status: "active",
        createdAt: "free-mode",
      },
    }),
    [q, T] = c.useState(!1),
    [z, Y] = c.useState(!1);
  (c.useEffect(() => {
    chrome.runtime.sendMessage({ action: "GET_ACCESS_STATE" }, (a) => {
      (a && W(a), Y(!0));
    });
  }, []),
    c.useEffect(() => {
      if (L.isUnlocked || L.accessExpired) return;
      const a = setInterval(() => {
        W((n) => {
          if (n.accessRemainingMs <= 0) return n;
          const s = Math.max(0, n.accessRemainingMs - 1e3);
          return s <= 0
            ? (T(!0),
              { ...n, accessRemainingMs: 0, accessExpired: !0, isTimed: !1 })
            : { ...n, accessRemainingMs: s };
        });
      }, 1e3);
      return () => clearInterval(a);
    }, [L.isUnlocked, L.accessExpired]));
  const U = c.useCallback(() => {
    chrome.runtime.sendMessage({ action: "GET_ACCESS_STATE" }, (a) => {
      a && W(a);
    });
  }, []);
  (c.useEffect(() => {
    t.urlPattern ||
      chrome.tabs.query({ active: !0, currentWindow: !0 }, (a) => {
        var n;
        if ((n = a[0]) != null && n.url)
          try {
            const s = new URL(a[0].url);
            i((l) => ({ ...l, urlPattern: s.hostname }));
          } catch {}
      });
  }, []),
    c.useEffect(() => {
      const a = (n) => {
        if (n.action === "ELEMENT_PICKED") {
          const s = n.payload;
          if (s.fieldId.startsWith("__")) return;
          i((l) => {
            const b = l.fields.find((C) => C.id === s.fieldId),
              g = (b == null ? void 0 : b.name) || "Field",
              y = (b == null ? void 0 : b.type) || "text",
              N =
                s.attribute ||
                (y === "image" || y === "video"
                  ? "src"
                  : y === "link"
                    ? "href"
                    : "textContent");
            return (
              A((C) =>
                C.some((D) => D.selector === s.selector)
                  ? C
                  : [
                      ...C,
                      {
                        selector: s.selector,
                        name: g,
                        attribute: N,
                        type: y,
                        sampleValue: s.sampleText || "",
                      },
                    ],
              ),
              {
                ...l,
                fields: l.fields.map((C) => {
                  if (C.id !== s.fieldId) return C;
                  const D = { selector: s.selector };
                  return (
                    s.attribute && (D.attribute = s.attribute),
                    { ...C, ...D }
                  );
                }),
                updatedAt: Date.now(),
              }
            );
          });
        } else if (n.action === "ELEMENT_PICKED_HAS_LINK") {
          const s = n.payload;
          if (s.fieldId.startsWith("__")) return;
          j({
            fieldName: s.fieldName,
            linkSelector: s.linkSelector,
            linkHref: s.linkHref,
          });
        } else if (n.action === "VIDEO_HAS_POSTER") {
          const s = n.payload;
          if (s.fieldId.startsWith("__")) return;
          h({
            fieldName: s.fieldName,
            posterSelector: s.posterSelector,
            posterUrl: s.posterUrl,
            posterAttribute: s.posterAttribute,
          });
        } else if (n.action === "SCRAPE_RESULT") {
          const s = n.payload;
          w((l) => {
            const b = [...l.data, ...s.data],
              g = F.current.fields,
              y = s.isImageScrape
                ? G
                : g.map((N) => ({ id: N.id, name: N.name, type: N.type }));
            return (
              chrome.tabs.query({ active: !0, currentWindow: !0 }, (N) => {
                var C;
                (C = N[0]) != null &&
                  C.id &&
                  chrome.tabs.sendMessage(N[0].id, {
                    action: "SHOW_DATA_TABLE",
                    payload: { data: b, fields: y },
                  });
              }),
              { ...l, data: b, status: "complete", completedAt: Date.now() }
            );
          });
        } else if (n.action === "DT_FIELDS_CHANGED") {
          const s = n.payload;
          if (
            (i((l) => {
              const b = s.fields
                .map((g) => {
                  const y = l.fields.find((N) => N.id === g.id);
                  return y ? { ...y, name: g.name, type: g.type } : null;
                })
                .filter((g) => g !== null);
              return { ...l, fields: b, updatedAt: Date.now() };
            }),
            s.renamedKeys)
          ) {
            const l = s.renamedKeys;
            w((b) => ({
              ...b,
              data: b.data.map((g) => {
                const y = { ...g };
                for (const [N, C] of Object.entries(l))
                  N in y && ((y[C] = y[N]), delete y[N]);
                return y;
              }),
            }));
          }
        } else if (n.action === "SCRAPE_PROGRESS") {
          const s = n.payload;
          w((l) => ({
            ...l,
            currentPage: s.currentPage,
            totalPages: s.totalPages,
            status:
              s.mode === "page-detail"
                ? "page-detail"
                : s.mode === "scroll"
                  ? "scrolling"
                  : "paginating",
          }));
        } else if (n.action === "AUTO_DETECT_RESULT") {
          const l = n.payload.structure,
            b = l.fields.map((g) => ({
              id: _(),
              name: g.name,
              selector: g.selector,
              attribute: g.attribute,
              type: g.type,
            }));
          (A(
            l.fields.map((g) => ({
              selector: g.selector,
              name: g.name,
              attribute: g.attribute,
              type: g.type,
              sampleValue: g.sampleValue,
            })),
          ),
            i((g) => ({
              ...g,
              name: g.name || `${l.type} (${l.itemCount} items)`,
              fields: b,
              updatedAt: Date.now(),
            })));
        } else if (n.action === "LOAD_RECIPE") {
          const s = n.payload;
          i(s.recipe);
        }
      };
      return (
        chrome.runtime.onMessage.addListener(a),
        () => chrome.runtime.onMessage.removeListener(a)
      );
    }, []));
  const J = c.useCallback(() => {
      (S("saving"),
        chrome.runtime.sendMessage(
          { action: "SAVE_RECIPE", payload: { recipe: t } },
          (a) => {
            a != null && a.success
              ? (S("saved"), setTimeout(() => S("idle"), 2e3))
              : (S("error"), setTimeout(() => S("idle"), 3e3));
          },
        ));
    }, [t]),
    Q = c.useCallback(() => {
      const a = {
        id: _(),
        name: `Field ${t.fields.length + 1}`,
        selector: "",
        attribute: "textContent",
        type: "text",
      };
      i((n) => ({ ...n, fields: [...n.fields, a], updatedAt: Date.now() }));
    }, [t.fields.length]),
    Z = c.useCallback((a, n) => {
      i((s) => ({
        ...s,
        fields: s.fields.map((l) => (l.id === a ? { ...l, ...n } : l)),
        updatedAt: Date.now(),
      }));
    }, []),
    ee = c.useCallback((a) => {
      i((n) => ({
        ...n,
        fields: n.fields.filter((s) => s.id !== a),
        updatedAt: Date.now(),
      }));
    }, []),
    te = c.useCallback(async (a, n, s) => {
      const [l] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      l != null &&
        l.id &&
        chrome.tabs.sendMessage(l.id, {
          action: "START_PICKER",
          payload: { fieldId: a, fieldName: n, fieldType: s },
        });
    }, []),
    H = c.useCallback(async () => {
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!(a != null && a.id)) return;
      w((s) => ({ ...s, status: "scraping", data: [] }));
      const n = a.id;
      chrome.tabs.sendMessage(
        n,
        { action: "SCRAPE_PAGE", payload: { fields: t.fields } },
        (s) => {
          s != null && s.data && s.data.length > 0
            ? (w((l) => ({
                ...l,
                data: s.data,
                status: "complete",
                completedAt: Date.now(),
              })),
              chrome.tabs.sendMessage(n, {
                action: "SHOW_DATA_TABLE",
                payload: {
                  data: s.data,
                  fields: t.fields.map((l) => ({
                    id: l.id,
                    name: l.name,
                    type: l.type,
                  })),
                },
              }))
            : w((l) => ({
                ...l,
                status: "error",
                errors: [
                  ...l.errors,
                  {
                    page: 0,
                    message: "No data returned",
                    timestamp: Date.now(),
                  },
                ],
              }));
        },
      );
    }, [t.fields]),
    V = c.useCallback(async () => {
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      !(a != null && a.id) ||
        o.length === 0 ||
        (w((n) => ({
          ...n,
          status: "page-detail",
          data: [],
          currentPage: 0,
          totalPages: o.length,
          errors: [],
          startedAt: Date.now(),
          completedAt: null,
        })),
        chrome.runtime.sendMessage({
          action: "START_PAGE_DETAILS_SCRAPE",
          payload: { fields: t.fields, urls: o, tabId: a.id },
        }));
    }, [t.fields, o]),
    G = [
      { id: "__img_url", name: "Image URL", type: "link" },
      { id: "__img_alt", name: "Alt Text", type: "text" },
      { id: "__img_w", name: "Width", type: "text" },
      { id: "__img_h", name: "Height", type: "text" },
    ],
    O = c.useCallback(async () => {
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!(a != null && a.id)) return;
      if (p) {
        (w((s) => ({
          ...s,
          status: p.type === "infinite-scroll" ? "scrolling" : "paginating",
          data: [],
          currentPage: 0,
          totalPages: p.maxPages,
          errors: [],
          startedAt: Date.now(),
          completedAt: null,
        })),
          p.type === "infinite-scroll"
            ? chrome.runtime.sendMessage({
                action: "START_SCROLL_IMAGE_SCRAPE",
                payload: {
                  maxScrolls: p.maxPages,
                  delayMs: p.delayMs,
                  tabId: a.id,
                },
              })
            : chrome.runtime.sendMessage({
                action: "START_PAGINATED_IMAGE_SCRAPE",
                payload: { pagination: p, tabId: a.id },
              }));
        return;
      }
      w((s) => ({
        ...s,
        status: "scraping",
        data: [],
        errors: [],
        startedAt: Date.now(),
        completedAt: null,
      }));
      const n = a.id;
      chrome.tabs.sendMessage(n, { action: "EXTRACT_IMAGES" }, (s) => {
        s != null && s.data && s.data.length > 0
          ? (w((l) => ({
              ...l,
              data: s.data,
              status: "complete",
              completedAt: Date.now(),
            })),
            chrome.tabs.sendMessage(n, {
              action: "SHOW_DATA_TABLE",
              payload: { data: s.data, fields: G },
            }))
          : w((l) => ({
              ...l,
              status: "error",
              errors: [
                ...l.errors,
                {
                  page: 0,
                  message: "No images found on page",
                  timestamp: Date.now(),
                },
              ],
            }));
      });
    }, [p]),
    ae = c.useCallback(async () => {
      if (d === "images") {
        O();
        return;
      }
      if (d === "page") {
        V();
        return;
      }
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (a != null && a.id) {
        if (!t.pagination) {
          H();
          return;
        }
        (w((n) => {
          var s;
          return {
            ...n,
            status: "scraping",
            data: [],
            currentPage: 0,
            totalPages: ((s = t.pagination) == null ? void 0 : s.maxPages) || 0,
            errors: [],
            startedAt: Date.now(),
            completedAt: null,
          };
        }),
          t.pagination.type === "infinite-scroll"
            ? chrome.runtime.sendMessage({
                action: "START_SCROLL_SCRAPE",
                payload: { recipe: t, tabId: a.id },
              })
            : chrome.runtime.sendMessage({
                action: "START_MULTI_SCRAPE",
                payload: { recipe: t, tabId: a.id },
              }));
      }
    }, [t, H, d, V, O]),
    se = c.useCallback(async () => {
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      a != null &&
        a.id &&
        chrome.runtime.sendMessage({
          action: "START_AUTO_DETECT_PICKER",
          payload: { tabId: a.id },
        });
    }, []),
    ne = c.useCallback(
      async (a) => {
        v(a);
        const [n] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!(n != null && n.id)) return;
        if (!a) {
          chrome.tabs.sendMessage(n.id, { action: "CLEAR_HIGHLIGHTS" });
          return;
        }
        const s = t.fields.find((l) => l.id === a);
        if (!(s != null && s.selector)) {
          chrome.tabs.sendMessage(n.id, { action: "CLEAR_HIGHLIGHTS" });
          return;
        }
        chrome.tabs.sendMessage(n.id, {
          action: "HIGHLIGHT_SELECTOR",
          payload: { selector: s.selector, color: "#000000" },
        });
      },
      [t.fields],
    ),
    ie = c.useCallback(async () => {
      (i((n) => ({ ...n, fields: [], updatedAt: Date.now() })), v(null));
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      a != null &&
        a.id &&
        chrome.tabs.sendMessage(a.id, { action: "CLEAR_HIGHLIGHTS" });
    }, []),
    le = c.useCallback(() => {
      (chrome.runtime.sendMessage({ action: "STOP_SCRAPE" }),
        w((a) => ({ ...a, status: "idle" })));
    }, []),
    re = c.useCallback(async () => {
      if (P.data.length === 0) return;
      const [a] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      a != null &&
        a.id &&
        chrome.tabs.sendMessage(a.id, {
          action: "SHOW_DATA_TABLE",
          payload: {
            data: P.data,
            fields: t.fields.map((n) => ({
              id: n.id,
              name: n.name,
              type: n.type,
            })),
          },
        });
    }, [P.data, t.fields]),
    ce = c.useCallback(() => {
      if (!k) return;
      const a = {
        id: _(),
        name: `${k.fieldName} URL`,
        selector: k.linkSelector,
        attribute: "href",
        type: "link",
      };
      (i((n) => ({ ...n, fields: [...n.fields, a], updatedAt: Date.now() })),
        j(null));
    }, [k]),
    oe = c.useCallback(() => {
      j(null);
    }, []),
    de = c.useCallback(() => {
      if (!u) return;
      const a = {
        id: _(),
        name: `${u.fieldName} Poster`,
        selector: u.posterSelector,
        attribute: u.posterAttribute,
        type: "image",
      };
      (i((n) => ({ ...n, fields: [...n.fields, a], updatedAt: Date.now() })),
        h(null));
    }, [u]),
    ue = c.useCallback(() => {
      h(null);
    }, []),
    he = c.useCallback((a, n) => {
      i((s) => {
        const l = [...s.fields],
          [b] = l.splice(a, 1);
        return (l.splice(n, 0, b), { ...s, fields: l, updatedAt: Date.now() });
      });
    }, []),
    $ = t.fields.length > 0 && t.fields.some((a) => a.selector),
    me = d === "images" ? !0 : d === "page" ? $ && o.length > 0 : $;
  return z
    ? e.jsxs("div", {
          className: "sidepanel",
          children: [
            e.jsx(fe, {
              recipeName: t.name,
              onNameChange: (a) =>
                i((n) => ({ ...n, name: a, updatedAt: Date.now() })),
              onSave: J,
              saveStatus: M,
              canSave: !!t.name && t.fields.length > 0,
              onOpenRecipes: () => B(!0),
              isUnlocked: L.isUnlocked,
              accessExpired: L.accessExpired,
              accessRemainingMs: L.accessRemainingMs,
              onOpenAccess: () => {},
              urlPattern: t.urlPattern,
              onUrlChange: (a) =>
                i((n) => ({ ...n, urlPattern: a, updatedAt: Date.now() })),
            }),
            I && e.jsx(Ne, { onLoad: (a) => i(a), onClose: () => B(!1) }),
            e.jsxs("div", {
              className: "panel-body",
              children: [
                L.isUnlocked &&
                  e.jsx("div", {
                    className: "url-section",
                    children: e.jsx("input", {
                      className: "input input-sm url-input",
                      type: "text",
                      placeholder: "URL pattern (e.g. amazon.com)",
                      value: t.urlPattern,
                      onChange: (a) =>
                        i((n) => ({
                          ...n,
                          urlPattern: a.target.value,
                          updatedAt: Date.now(),
                        })),
                    }),
                  }),
                e.jsxs("div", {
                  className: "mode-toggle",
                  children: [
                    e.jsxs("button", {
                      className: `mode-toggle-btn ${d === "list" ? "mode-toggle-btn-active" : ""}`,
                      onClick: () => m("list"),
                      children: [
                        e.jsx("svg", {
                          width: "14",
                          height: "14",
                          viewBox: "0 0 14 14",
                          fill: "none",
                          children: e.jsx("path", {
                            d: "M2 3h2M6 3h6M2 7h2M6 7h6M2 11h2M6 11h6",
                            stroke: "currentColor",
                            strokeWidth: "1.5",
                            strokeLinecap: "round",
                          }),
                        }),
                        "List",
                      ],
                    }),
                    e.jsxs("button", {
                      className: `mode-toggle-btn ${d === "page" ? "mode-toggle-btn-active" : ""}`,
                      onClick: () => m("page"),
                      children: [
                        e.jsxs("svg", {
                          width: "14",
                          height: "14",
                          viewBox: "0 0 14 14",
                          fill: "none",
                          children: [
                            e.jsx("path", {
                              d: "M4 1h4l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z",
                              stroke: "currentColor",
                              strokeWidth: "1.3",
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                            }),
                            e.jsx("path", {
                              d: "M8 1v3h3",
                              stroke: "currentColor",
                              strokeWidth: "1.3",
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                            }),
                          ],
                        }),
                        "Page Details",
                      ],
                    }),
                    e.jsxs("button", {
                      className: `mode-toggle-btn ${d === "images" ? "mode-toggle-btn-active" : ""}`,
                      onClick: () => m("images"),
                      children: [
                        e.jsxs("svg", {
                          width: "14",
                          height: "14",
                          viewBox: "0 0 14 14",
                          fill: "none",
                          children: [
                            e.jsx("rect", {
                              x: "1.5",
                              y: "1.5",
                              width: "11",
                              height: "11",
                              rx: "2",
                              stroke: "currentColor",
                              strokeWidth: "1.3",
                            }),
                            e.jsx("circle", {
                              cx: "5",
                              cy: "5.5",
                              r: "1.5",
                              stroke: "currentColor",
                              strokeWidth: "1.2",
                            }),
                            e.jsx("path", {
                              d: "M1.5 10l3-3 2 2 2.5-3L12.5 10",
                              stroke: "currentColor",
                              strokeWidth: "1.2",
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                            }),
                          ],
                        }),
                        "Images",
                      ],
                    }),
                  ],
                }),
                d === "images"
                  ? e.jsxs(e.Fragment, {
                      children: [
                        e.jsxs("div", {
                          className: "images-mode-info",
                          children: [
                            e.jsx("div", {
                              className: "images-mode-icon",
                              children: e.jsxs("svg", {
                                width: "32",
                                height: "32",
                                viewBox: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: "1.5",
                                strokeLinecap: "round",
                                strokeLinejoin: "round",
                                children: [
                                  e.jsx("rect", {
                                    x: "3",
                                    y: "3",
                                    width: "18",
                                    height: "18",
                                    rx: "2",
                                  }),
                                  e.jsx("circle", {
                                    cx: "8.5",
                                    cy: "8.5",
                                    r: "1.5",
                                  }),
                                  e.jsx("path", { d: "M21 15l-5-5L5 21" }),
                                ],
                              }),
                            }),
                            e.jsx("p", {
                              className: "images-mode-title",
                              children: "Extract All Images",
                            }),
                            e.jsx("p", {
                              className: "images-mode-desc",
                              children:
                                "Finds all images including img tags, picture sources, and CSS background images.",
                            }),
                          ],
                        }),
                        e.jsx(X, { pagination: p, onChange: x }),
                      ],
                    })
                  : e.jsxs(e.Fragment, {
                      children: [
                        e.jsxs("div", {
                          className: "fields-header",
                          children: [
                            e.jsx("span", {
                              className: "fields-label",
                              children: "Fields",
                            }),
                            e.jsxs("div", {
                              className: "fields-actions",
                              children: [
                                d === "list" &&
                                  e.jsx("button", {
                                    className: "btn btn-primary btn-sm",
                                    onClick: se,
                                    children: "Auto Detect",
                                  }),
                                e.jsx("button", {
                                  className: "btn btn-secondary btn-sm",
                                  onClick: Q,
                                  children: "+ Add",
                                }),
                                t.fields.length > 0 &&
                                  e.jsx("button", {
                                    className: "btn btn-ghost btn-sm",
                                    onClick: ie,
                                    children: "Clear",
                                  }),
                              ],
                            }),
                          ],
                        }),
                        e.jsx("div", {
                          className: "fields-scroll",
                          children: e.jsx(ve, {
                            fields: t.fields,
                            activeFieldId: f,
                            onUpdateField: Z,
                            onRemoveField: ee,
                            onPickField: te,
                            onSelectField: ne,
                            onReorderFields: he,
                            availableSelectors: E,
                          }),
                        }),
                        d === "list"
                          ? e.jsx(X, {
                              pagination: t.pagination,
                              onChange: (a) =>
                                i((n) => ({
                                  ...n,
                                  pagination: a,
                                  updatedAt: Date.now(),
                                })),
                            })
                          : e.jsx(be, { urls: o, onChange: r }),
                      ],
                    }),
              ],
            }),
            e.jsx(ke, {
              onViewData: re,
              onScrape: ae,
              hasData: P.data.length > 0,
              dataCount: P.data.length,
              canScrape: me,
            }),
            k &&
              e.jsxs("div", {
                className: "link-prompt",
                children: [
                  e.jsxs("div", {
                    className: "link-prompt-text",
                    children: [
                      "This element has a link. Add a ",
                      e.jsxs("strong", { children: [k.fieldName, " URL"] }),
                      " field?",
                    ],
                  }),
                  e.jsx("div", {
                    className: "link-prompt-preview",
                    children: k.linkHref,
                  }),
                  e.jsxs("div", {
                    className: "link-prompt-actions",
                    children: [
                      e.jsx("button", {
                        className: "btn btn-primary btn-sm",
                        onClick: ce,
                        children: "Yes, Add Link",
                      }),
                      e.jsx("button", {
                        className: "btn btn-ghost btn-sm",
                        onClick: oe,
                        children: "No",
                      }),
                    ],
                  }),
                ],
              }),
            u &&
              e.jsxs("div", {
                className: "link-prompt",
                children: [
                  e.jsxs("div", {
                    className: "link-prompt-text",
                    children: [
                      "This video has a poster image. Add a ",
                      e.jsxs("strong", { children: [u.fieldName, " Poster"] }),
                      " field?",
                    ],
                  }),
                  e.jsx("div", {
                    className: "link-prompt-preview",
                    children: u.posterUrl,
                  }),
                  e.jsxs("div", {
                    className: "link-prompt-actions",
                    children: [
                      e.jsx("button", {
                        className: "btn btn-primary btn-sm",
                        onClick: de,
                        children: "Yes, Add Poster",
                      }),
                      e.jsx("button", {
                        className: "btn btn-ghost btn-sm",
                        onClick: ue,
                        children: "No",
                      }),
                    ],
                  }),
                ],
              }),
            e.jsx(ye, {
              status: P.status,
              currentPage: P.currentPage,
              totalPages: P.totalPages,
              onStop: le,
            }),
          ],
        })
    : e.jsx("div", {
        className: "sidepanel",
        children: e.jsx("div", {
          className: "access-loading",
          children: e.jsx("div", {
            className: "spinner",
            style: { width: 24, height: 24 },
          }),
        }),
      });
}
pe.createRoot(document.getElementById("root")).render(
  e.jsx(xe.StrictMode, { children: e.jsx(Ae, {}) }),
);
