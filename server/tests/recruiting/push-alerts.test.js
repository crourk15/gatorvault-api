const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { pickStaffNoteText } = require("../../lib/staff-note-picker");
const {
  buildScheduledPayload,
  buildCancelledPayload,
  buildCommitPayload,
  buildScorePayload,
  pushEnabled,
  normalizePrefs,
} = require("../../lib/push-alert-service");
const { subscriberMatchesPayload } = require("../../lib/push-alert-filters");
const { isUfGameLiveWindow, extractFloridaGame } = require("../../lib/gators-score-alerts");

describe("staff-note-picker", () => {
  it("prefers scouting summary for Easton Royal", () => {
    const note = pickStaffNoteText({
      playerName: "Easton Royal",
      insiderNotes:
        "Reports View All Reports -> Easton Royal Scouting Summary CP Charles Power 10/20/25 The most dynamic pass-catcher early in the 2027 cycle.",
    });
    assert.match(note, /Easton Royal/i);
    assert.match(note, /dynamic pass-catcher/i);
  });

  it("rejects beat bleed for Raheem Floyd", () => {
    const note = pickStaffNoteText({
      playerName: "Raheem Floyd",
      insiderNotes:
        "Kicker Aaron McWilliams of Sharpsburg (Ga.) East Coweta announced his commitment to Florida on Monday, giving the Gators another addition in the 2027",
    });
    assert.equal(note, "");
  });

  it("rejects generic visit blurb without player name", () => {
    const note = pickStaffNoteText({
      playerName: "Marquis Evans",
      insiderNotes:
        "Florida gave itself a chance with several top targets during official visit season, but that does not mean every recruitment suddenly became",
    });
    assert.equal(note, "");
  });
});

describe("push-alert-service payloads", () => {
  it("builds scheduled payload with verified language", () => {
    const payload = buildScheduledPayload({
      playerSlug: "test-player",
      playerName: "Test Player",
      source: "on3",
      visitType: "official_visit",
      school: "Florida",
      date: "2026-07-04",
      fingerprint: "fp1",
    });
    assert.match(payload.title, /scheduled/i);
    assert.match(payload.body, /Test Player/i);
    assert.match(payload.body, /verified/i);
    assert.equal(payload.type, "visit_scheduled");
  });

  it("builds cancelled payload", () => {
    const payload = buildCancelledPayload({
      playerSlug: "test-player",
      playerName: "Test Player",
      nextVisitSchool: "South Carolina",
      fingerprint: "fp2",
    });
    assert.match(payload.title, /cancelled/i);
    assert.match(payload.body, /South Carolina/);
    assert.equal(payload.type, "visit_cancelled");
  });

  it("pushEnabled is false without VAPID keys", () => {
    const prevPub = process.env.VAPID_PUBLIC_KEY;
    const prevPriv = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    assert.equal(pushEnabled(), false);
    process.env.VAPID_PUBLIC_KEY = prevPub;
    process.env.VAPID_PRIVATE_KEY = prevPriv;
  });
});

describe("push-alert filters", () => {
  it("allows all visits when followPlayers is empty", () => {
    assert.equal(
      subscriberMatchesPayload({ prefs: { followPlayers: [] } }, { playerSlug: "easton-royal" }),
      true
    );
  });

  it("matches tracked player by slug or name", () => {
    const sub = { prefs: { followPlayers: ["Easton Royal"] } };
    assert.equal(subscriberMatchesPayload(sub, { playerSlug: "easton-royal", playerName: "Easton Royal" }), true);
    assert.equal(subscriberMatchesPayload(sub, { playerSlug: "jalen-brewster", playerName: "Jalen Brewster" }), false);
  });

  it("normalizes followPlayers on subscribe prefs", () => {
    const prefs = normalizePrefs({
      visit: true,
      commit: true,
      score: false,
      followPlayers: [" Easton Royal ", "Easton Royal", ""],
    });
    assert.deepEqual(prefs.followPlayers, ["Easton Royal"]);
    assert.equal(prefs.visit, true);
    assert.equal(prefs.commit, true);
    assert.equal(prefs.score, false);
  });

  it("does not filter score alerts by followPlayers", () => {
    const sub = { prefs: { followPlayers: ["Easton Royal"] } };
    assert.equal(
      subscriberMatchesPayload(sub, { type: "score_kickoff", playerSlug: null }),
      true
    );
  });
});

describe("commit and score payloads", () => {
  it("builds commit payload with recruiting deep link", () => {
    const payload = buildCommitPayload({
      eventType: "commit",
      player: { slug: "test-player", name: "Test Player", stars: 4, pos: "WR", classYear: 2027 },
      skinny: "Test Player locks in with the Gators.",
    });
    assert.match(payload.title, /commit/i);
    assert.match(payload.url, /test-player/);
    assert.equal(payload.type, "commit");
  });

  it("builds kickoff and final score payloads", () => {
    const kick = buildScorePayload({ kind: "kickoff", opponent: "Georgia" });
    assert.equal(kick.type, "score_kickoff");
    assert.match(kick.url, /live-scores/);
    const fin = buildScorePayload({ kind: "final", opponent: "Georgia", ufScore: 31, oppScore: 24 });
    assert.equal(fin.type, "score_final");
    assert.match(fin.body, /31/);
  });
});

describe("gators-score-alerts window", () => {
  it("is idle outside UF windows in midsummer", () => {
    assert.equal(isUfGameLiveWindow(new Date("2026-07-16T16:00:00-04:00")), false);
  });

  it("extracts Florida from ESPN-shaped scoreboard", () => {
    const game = extractFloridaGame({
      events: [
        {
          id: "401772001",
          competitions: [
            {
              competitors: [
                { team: { id: "57", displayName: "Florida Gators" }, score: "14" },
                { team: { id: "61", displayName: "Georgia Bulldogs" }, score: "10" },
              ],
              status: { type: { name: "STATUS_IN_PROGRESS", completed: false, detail: "Q2 8:00" } },
            },
          ],
        },
      ],
    });
    assert.equal(game.eventId, "401772001");
    assert.match(game.opponent, /Georgia/i);
    assert.equal(game.ufScore, 14);
  });
});