'use strict';
/* Harness de regresion para Minute Cutter host (extension/host/main.jsx, perfil ES3).
   Verifica que el ripple post-corte solo alcanza las pistas del clip seleccionado
   (video master + audio vinculado) y que se mantienen las restricciones estaticas. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HOST = path.join(ROOT, 'extension', 'host', 'main.jsx');

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

function clip(sec) {
	return { start: { seconds: sec } };
}

function makeTrack(starts) {
	const t = { clips: [] };
	for (let i = 0; i < starts.length; i++) t.clips[i] = clip(starts[i]);
	t.clips.numItems = starts.length;
	return t;
}

function snap(track, isVideo) {
	return { item: {}, track: track, start: 5, inPoint: 0, projectItem: {}, isVideo: isVideo };
}

function loadHost() {
	const src = fs.readFileSync(HOST, 'utf8');
	const ctx = vm.createContext({});
	vm.runInContext(src, ctx);
	return ctx;
}

function runBehavior(ctx) {
	const collect = ctx.mcCollectAfterSelectedTracks;

	assert(typeof collect == 'function', 'mcCollectAfterSelectedTracks es funcion top-level');
	assert(ctx.mcCollectAfter === undefined, 'la logica antigua mcCollectAfter fue eliminada');

	{
		const v1 = makeTrack([5, 15]);
		const out = collect([snap(v1, true)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 15) < 1e-9,
			'T1: clip posterior en la pista seleccionada se recopila (se movera)');
	}

	{
		const v1 = makeTrack([5, 15]);
		const v2 = makeTrack([20]);
		const out = collect([snap(v1, true)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 15) < 1e-9,
			'T2: clip posterior en V2 NO se recopila (solo se escanea V1)');
	}

	{
		const v1 = makeTrack([5]);
		const a1 = makeTrack([5, 12]);
		const out = collect([snap(v1, true), snap(a1, false)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 12) < 1e-9,
			'T3: clip posterior en audio vinculado seleccionado se recopila');
	}

	{
		const a1 = makeTrack([5]);
		const a2 = makeTrack([18]);
		const out = collect([snap(a1, false)], 10);
		assert(out.length == 0,
			'T4: clip posterior en A2 NO se recopila');
	}

	{
		const a1 = makeTrack([5, 12]);
		const out = collect([snap(a1, false), snap(a1, false)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 12) < 1e-9,
			'T5: misma pista repetida en groupSnap se dedupe (se escanea una vez)');
	}

	{
		const v1 = makeTrack([5, 15]);
		const a1 = makeTrack([12]);
		const out = collect([snap(v1, true)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 15) < 1e-9,
			'T6: sin audio vinculado, solo rippea la pista de video');
	}

	{
		const v1 = makeTrack([9.99, 9.98]);
		const out = collect([snap(v1, true)], 10);
		assert(out.length == 1 && Math.abs(out[0].start - 9.99) < 1e-9,
			'T7: limite mEnd - 0.01 incluido; clips debajo excluidos');
	}

	{
		const v1 = makeTrack([5, 15]);
		const out = collect([snap(v1, true)], 10);
		assert(out.length == 1,
			'T8: el clip master (start < mEnd) no se recopila');
	}
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
}

const src = fs.readFileSync(HOST, 'utf8');
const ctx = loadHost();
runBehavior(ctx);
runStatic(src);

console.log('host ES3/static: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
