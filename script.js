/**
 * =========================================================
 * CRAZY RACES (temporary name) — shared config
 * =========================================================
 *
 * The editor is implemented in editor.js, but we keep:
 * - API endpoints
 * - shared constants
 *
 * so you can later reuse these for other pages (leaderboard, gallery, etc.)
 */

// API endpoint that receives submissions.
// You said "another API which deals with it" — keep this as your single point of change.
window.CRAZY_RACES_SUBMIT_ENDPOINT = "/api/submit-car";

// Credits rule
window.CRAZY_RACES_TOTAL_CREDITS = 100;

// Canvas sizes (kept as constants so it's easier to change later)
window.CRAZY_RACES_BODY_W = 1024;
window.CRAZY_RACES_BODY_H = 512;
window.CRAZY_RACES_WHEEL_W = 256;
window.CRAZY_RACES_WHEEL_H = 256;
