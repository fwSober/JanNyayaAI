// Anonymous per-browser session id (Phase 1 has no auth).
const KEY = "jannyaya_session_id";

export function getSessionId() {
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid =
      "s_" +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);
    localStorage.setItem(KEY, sid);
  }
  return sid;
}
