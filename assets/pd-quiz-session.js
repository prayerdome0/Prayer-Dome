/*!
 * Prayer Dome — resumable quiz session (assets/pd-quiz-session.js)
 * ===========================================================================
 * A level is ten questions of work. Before this file, leaving the quiz in the
 * middle of a level — a phone call, a locked screen, a tap on the wrong link —
 * lost the score and the streak and started the level again from question one.
 * The member's completed levels survived (they are saved to `prayerdome_quiz`
 * and to Firestore), but the level in progress did not.
 *
 * This is the small, testable record of a level in progress:
 *
 *   PDQuizSession.save({ level, question, score, streak, fifty, freeze })
 *   PDQuizSession.load({ totalLevels })      -> state | null
 *   PDQuizSession.clear()
 *   PDQuizSession.describe(state)            -> "Level 3, question 4 of 10"
 *
 * Rules, deliberately conservative:
 *   • nothing is stored unless it is a real, in-progress level (a level number
 *     inside the map, a question inside the level, whole numbers only);
 *   • a session older than a week is dropped — nobody wants to resume a quiz
 *     they abandoned last month and find a stale score;
 *   • a corrupt or unreadable record (private mode, full storage, hand-edited
 *     JSON) is treated as "no session", never as an error;
 *   • the record holds no names, no answers, no questions — only numbers, so
 *     it can never leak what the member chose.
 * ===========================================================================
 */
(function (global) {
  'use strict';

  var KEY = 'prayerdome_quiz_session';
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // one week
  var MAX_SKEW_MS = 60 * 60 * 1000;           // tolerate a clock an hour ahead
  var DEFAULTS = { perLevel: 10, totalLevels: 7, powerups: 3 };

  function storage() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  function clampInt(value, min, max, fallback) {
    var n = Number(value);
    // Whole numbers only: "question 2.5" is a corrupt record, not a rounding
    // problem, so it is refused rather than silently snapped to a neighbour.
    if (!isFinite(n) || Math.floor(n) !== n) return fallback;
    if (n < min || n > max) return fallback;
    return n;
  }

  function limits(options) {
    options = options || {};
    return {
      perLevel: clampInt(options.perLevel, 1, 100, DEFAULTS.perLevel),
      totalLevels: clampInt(options.totalLevels, 1, 100, DEFAULTS.totalLevels),
      powerups: clampInt(options.powerups, 0, 99, DEFAULTS.powerups)
    };
  }

  /** True when a record describes a level the member can still carry on with. */
  function isResumable(state, options) {
    var limit = limits(options);
    if (!state || typeof state !== 'object') return false;
    if (clampInt(state.level, 1, limit.totalLevels, null) === null) return false;
    if (clampInt(state.question, 1, limit.perLevel, null) === null) return false;
    if (clampInt(state.score, 0, 100000, null) === null) return false;
    if (clampInt(state.streak, 0, 1000, null) === null) return false;
    if (clampInt(state.fifty, 0, limit.powerups, null) === null) return false;
    if (clampInt(state.freeze, 0, limit.powerups, null) === null) return false;
    var savedAt = Number(state.savedAt);
    if (!isFinite(savedAt) || savedAt <= 0) return false;
    var age = Date.now() - savedAt;
    if (age < -MAX_SKEW_MS || age > MAX_AGE_MS) return false;
    return true;
  }

  /** Normalise a record so a caller never has to re-validate what it reads. */
  function normalise(state, options) {
    if (!isResumable(state, options)) return null;
    var limit = limits(options);
    return {
      level: clampInt(state.level, 1, limit.totalLevels, 1),
      question: clampInt(state.question, 1, limit.perLevel, 1),
      score: clampInt(state.score, 0, 100000, 0),
      streak: clampInt(state.streak, 0, 1000, 0),
      fifty: clampInt(state.fifty, 0, limit.powerups, 0),
      freeze: clampInt(state.freeze, 0, limit.powerups, 0),
      savedAt: Math.floor(Number(state.savedAt))
    };
  }

  /**
   * Remember where the member is. Returns true when the record really reached
   * storage. Saving at question 1 with no score is a non-event (the level has
   * not started yet, so there is nothing to resume) — the caller gets `false`
   * and no stale record.
   */
  function save(state, options) {
    var clean = normalise(Object.assign({}, state, { savedAt: Date.now() }), options);
    var store = storage();
    if (!clean || !store) return false;
    if (clean.question <= 1 && clean.score <= 0 && clean.streak <= 0) {
      clear();
      return false;
    }
    try {
      store.setItem(KEY, JSON.stringify(clean));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** The session to offer the member, or null when there is nothing to resume. */
  function load(options) {
    var store = storage();
    if (!store) return null;
    var raw;
    try { raw = store.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { clear(); return null; }
    var clean = normalise(parsed, options);
    if (!clean) { clear(); return null; }
    return clean;
  }

  function clear() {
    var store = storage();
    if (!store) return false;
    try { store.removeItem(KEY); return true; } catch (e) { return false; }
  }

  /**
   * "Level 3, question 4 of 10" — the sentence the resume bar shows. It only
   * needs the two numbers, so it also works while a record is being built;
   * whether that record may be resumed is `isResumable()`'s decision.
   */
  function describe(state, options) {
    var limit = limits(options);
    if (!state || typeof state !== 'object') return '';
    var level = clampInt(state.level, 1, limit.totalLevels, null);
    var question = clampInt(state.question, 1, limit.perLevel, null);
    if (level === null || question === null) return '';
    return 'Level ' + level + ', question ' + question + ' of ' + limit.perLevel;
  }

  var api = {
    KEY: KEY,
    MAX_AGE_MS: MAX_AGE_MS,
    save: save,
    load: load,
    clear: clear,
    describe: describe,
    isResumable: function (state, options) { return !!normalise(state, options); }
  };

  global.PDQuizSession = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
