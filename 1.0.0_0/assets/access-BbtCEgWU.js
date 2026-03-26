const i = {
  RECIPES: "ncws_recipes",
  SETTINGS: "ncws_settings",
  LAST_SESSION: "ncws_last_session",
  ACCESS_TOKEN: "ncws_access_token",
  ACCESS_PROFILE: "ncws_access_profile",
};
const l = {
  email: "free@nocodewebscraper.local",
  status: "enabled",
  createdAt: "always-free",
};
async function c(e) {
  return (await chrome.storage.local.get(e))[e];
}
async function s(e, a) {
  await chrome.storage.local.set({ [e]: a });
}
async function r(e) {
  await chrome.storage.local.remove(e);
}
async function u() {
  (await c(i.ACCESS_PROFILE)) || (await s(i.ACCESS_PROFILE, l));
}
async function T() {
  const e = (await c(i.ACCESS_PROFILE)) || l;
  return {
    isUnlocked: !0,
    isTimed: !1,
    accessExpired: !1,
    accessRemainingMs: 0,
    accessProfile: e,
  };
}
async function d(e) {
  const a = (await c(i.ACCESS_PROFILE)) || l;
  return (
    await s(i.ACCESS_TOKEN, e || "ALWAYS-FREE"),
    await s(i.ACCESS_PROFILE, a),
    { valid: !0, access: a }
  );
}
async function f() {
  (await r(i.ACCESS_TOKEN), await s(i.ACCESS_PROFILE, l));
}
function S(e) {
  if (e <= 0) return "0:00:00";
  const a = Math.floor(e / 1e3),
    t = Math.floor(a / 3600),
    n = Math.floor((a % 3600) / 60),
    l = a % 60;
  return `${t}:${String(n).padStart(2, "0")}:${String(l).padStart(2, "0")}`;
}
export { i as S, T as a, f as d, S as f, c as g, u as i, s, d as v };
