'use strict';
/* Harness de regresion para Minute Cutter host (extension/host/main.jsx, perfil ES3).
   Verifica el modo sin ripple: se corta SOLO el clip seleccionado (video + audio
   vinculado), los pedazos quedan contiguos y los clips posteriores de V1/A1/V2/A2
   conservan su start absoluto (ningun TrackItem.move se ejecuta; puede quedar hueco). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HOST = path.join(ROOT, 'extension', 'host', 'main.jsx');

const TICKS = 254016000000;

let passed = 0;
let failed = 0;

function assert(cond, msg) {
	if (cond) {
		passed++;
	} else {
		failed++;
		console.error('  FAIL: ' + msg);
	}
}

function ctxTime() {
	const Time = function () { this._seconds = 0; };
	Object.defineProperty(Time.prototype, 'seconds', {
		get() { return this._seconds; },
		set(v) { this._seconds = v; }
	});
	Object.defineProperty(Time.prototype, 'ticks', {
		get() { return String(Math.round(this._seconds * TICKS)); }
	});
	return Time;
}

function buildTimeline() {
	let moveCalls = 0;

	function sec(n) { return { seconds: n }; }

	function mkClip(track, nodeId, name, start, end, inP, outP) {
		const c = {
			nodeId,
			name,
			start: sec(start),
			end: sec(end),
			inPoint: sec(inP),
			outPoint: sec(outP),
			_track: track,
			getSpeed() { return 1; },
			isSpeedReversed() { return false; },
			move() {
				moveCalls++;
				throw new Error('TrackItem.move no debe ejecutarse en este modo');
			},
			remove() {
				const arr = track.clips;
				const idx = arr.indexOf(c);
				if (idx >= 0) { arr.splice(idx, 1); arr.numItems = arr.length; }
				c.start = sec(NaN);
				c.end = sec(NaN);
				c.inPoint = sec(NaN);
				c.outPoint = sec(NaN);
			}
		};
		c.projectItem = {
			name,
			nodeId,
			createSubClip(subName, inT, outT) {
				const s = parseFloat(String(inT)) / TICKS;
				const e = parseFloat(String(outT)) / TICKS;
				return {
					name: subName,
					_dur: e - s,
					setScaleToFrameSize() { return true; }
				};
			}
		};
		return c;
	}

	function mkInsertedClip(track, sub, startSec) {
		const scaleComps = [{ displayName: 'Scale', setValue() { return true; } }];
		scaleComps.numItems = scaleComps.length;
		const c = {
			nodeId: 'piece-' + startSec,
			name: sub.name,
			start: sec(startSec),
			end: sec(startSec + sub._dur),
			inPoint: sec(0),
			outPoint: sec(sub._dur),
			_track: track,
			components: scaleComps,
			getSpeed() { return 1; },
			isSpeedReversed() { return false; },
			move() {
				moveCalls++;
				throw new Error('TrackItem.move no debe ejecutarse en este modo');
			},
			remove() {}
		};
		c.projectItem = sub;
		return c;
	}

	function makeTrack(name, clips) {
		const t = { name, clips };
		clips.numItems = clips.length;
		t.insertClip = function (sub, timeStr) {
			const at = parseFloat(String(timeStr)) / TICKS;
			const pc = mkInsertedClip(t, sub, at);
			t.clips.push(pc);
			t.clips.sort((x, y) => x.start.seconds - y.start.seconds);
			t.clips.numItems = t.clips.length;
			return pc;
		};
		return t;
	}

	function trackList(tracks) {
		tracks.numTracks = tracks.length;
		return tracks;
	}

	const v1 = makeTrack('V1', []);
	const v2 = makeTrack('V2', []);
	const a1 = makeTrack('A1', []);
	const a2 = makeTrack('A2', []);

	const c0 = mkClip(v1, 'v0', 'Prev', 0, 5, 0, 5);
	const cSel = mkClip(v1, 'v1', 'Hero', 5, 20, 0, 30);
	const c1 = mkClip(v1, 'v2', 'LaterV1', 20, 25, 0, 5);
	const c2 = mkClip(v2, 'v3', 'LaterV2', 8, 15, 0, 7);
	const a1Later = mkClip(a1, 'a2', 'LaterA1', 20, 26, 0, 6);
	const a2Later = mkClip(a2, 'a3', 'LaterA2', 9, 16, 0, 7);

	v1.clips = [c0, cSel, c1];
	v2.clips = [c2];
	a1.clips = [a1Later];
	a2.clips = [a2Later];
	for (const t of [v1, v2, a1, a2]) t.clips.numItems = t.clips.length;

	const seq = {
		getSelection() {
			const s = [cSel];
			s.numItems = s.length;
			return s;
		},
		videoTracks: trackList([v1, v2]),
		audioTracks: trackList([a1, a2])
	};

	return { moveCalls: () => moveCalls, seq, c0, cSel, c1, c2, a1Later, a2Later, v1, v2, a1, a2 };
}

function loadHost() {
	const src = fs.readFileSync(HOST, 'utf8');
	const ctx = vm.createContext({});
	ctx.Time = ctxTime();
	vm.runInContext(src, ctx);
	return ctx;
}

function runBehavior(ctx) {
	const tl = buildTimeline();
	ctx.app = { project: { activeSequence: tl.seq } };

	let result;
	try {
		result = ctx.mcCutRanges('0,5;6,11');
	} catch (e) {
		result = 'THREW|' + e.message;
	}

	assert(typeof result == 'string' && result.indexOf('OK|') == 0,
		'R1: mcCutRanges responde OK (resultado: ' + result + ')');
	assert(result.indexOf('2 pedazo(s) sin mover material posterior') >= 0,
		'R2: mensaje OK claro con conteo y "sin mover material posterior"');
	assert(result.indexOf('hueco') < 0 && result.indexOf('aviso') < 0,
		'R3: no se devuelve warning de hueco ni avisos innecesarios');
	assert(tl.moveCalls() == 0,
		'R4: TrackItem.move no se ejecuto en ningun clip');

	assert(Math.abs(tl.c1.start.seconds - 20) < 1e-9,
		'R5: clip posterior en V1 mantiene start 20');
	assert(Math.abs(tl.c2.start.seconds - 8) < 1e-9,
		'R6: clip posterior en V2 mantiene start 8');
	assert(Math.abs(tl.a1Later.start.seconds - 20) < 1e-9,
		'R7: clip posterior en A1 mantiene start 20');
	assert(Math.abs(tl.a2Later.start.seconds - 9) < 1e-9,
		'R8: clip posterior en A2 mantiene start 9');
	assert(Math.abs(tl.c0.start.seconds - 0) < 1e-9,
		'R9: clip previo (start 0) intacto');

	const byId = {};
	for (const c of tl.v1.clips) byId[c.nodeId] = c;
	assert(byId['v1'] === undefined, 'R10: el clip original de video fue removido');
	assert(byId['piece-5'] !== undefined && byId['piece-10'] !== undefined,
		'R11: se insertaron 2 pedazos (piezas del clip seleccionado)');
	if (byId['piece-5'] && byId['piece-10']) {
		assert(Math.abs(byId['piece-5'].start.seconds - 5) < 1e-9,
			'R12: primer pedazo arranca en 5 (posicion original del clip)');
		assert(Math.abs(byId['piece-10'].start.seconds - byId['piece-5'].end.seconds) < 1e-9,
			'R13: los pedazos quedan contiguos (pieza2.start == pieza1.end)');
	}

	const aById = {};
	for (const c of tl.a1.clips) aById[c.nodeId] = c;
	assert(aById['a1'] === undefined, 'R14: sin clip de audio en la posicion del corte (seleccion solo video)');
}

function stripStringsAndComments(src) {
	let out = '';
	let i = 0;
	const n = src.length;
	while (i < n) {
		const ch = src[i];
		if (ch == "'" || ch == '"') {
			const q = ch;
			i++;
			while (i < n) {
				const c = src[i];
				if (c == '\\') { i += 2; continue; }
				if (c == q) { i++; break; }
				i++;
			}
			out += ' ';
			continue;
		}
		if (ch == '/' && src[i + 1] == '/') {
			while (i < n && src[i] != '\n') i++;
			out += ' ';
			continue;
		}
		if (ch == '/' && src[i + 1] == '*') {
			i += 2;
			while (i < n && !(src[i] == '*' && src[i + 1] == '/')) i++;
			i += 2;
			out += ' ';
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

function runStatic(src) {
	const code = stripStringsAndComments(src);
	const checks = [
		['igualdad estricta ===', /===/g],
		['arrow =>', /=>/g],
		['let', /\blet\b/g],
		['const', /\bconst\b/g],
		['JSON.', /JSON\./g],
		['String(', /String\s*\(/g],
		['em-dash', /\u2014/g]
	];
	for (const [name, re] of checks) {
		const m = code.match(re);
		assert(!m, 'estatico: sin ' + name);
	}
	const regexLit = /(^|[(\[\s,:;=!?&|{+-])\/(?![/\*])[^/\r\n]*\//g;
	const m = code.match(regexLit);
	assert(!m, 'estatico: sin literales regex' + (m && m.length ? ' (encontrado: ' + m.join(' | ') + ')' : ''));

	const calls = src.match(/mcCollectAfter\s*\(/g) || [];
	assert(calls.length == 1, 'estatico: mcCollectAfter queda solo como definicion (nunca invocado)');
	assert(src.indexOf('mcCollectAfter(seq, mEnd);') < 0, 'estatico: el call site de mcCollectAfter fue eliminado');
	assert(src.indexOf('.move(') < 0, 'estatico: no queda ninguna invocacion TrackItem.move en el host');
}

const src = fs.readFileSync(HOST, 'utf8');
const ctx = loadHost();
runBehavior(ctx);
runStatic(src);

console.log('harness no-ripple: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
