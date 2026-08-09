/* Minute Cutter - host (ExtendScript ES3, CEP PPRO). Solo funciones top-level. */

function mcSec(v) {
	try {
		if (!v) return NaN;
		if (typeof v == 'number') return v;
		if (typeof v == 'string') {
			var p = parseFloat(v);
			return isNaN(p) ? NaN : p;
		}
		var s = parseFloat(v.seconds);
		if (typeof s == 'number' && !isNaN(s)) return s;
		return NaN;
	} catch (e) { return NaN; }
}

function mcStr(v) {
	try {
		if (v == null) return '';
		return '' + v;
	} catch (e) { return ''; }
}

function mcTicks(sec) {
	var t = new Time();
	t.seconds = sec;
	return mcStr(t.ticks);
}

function mcItemSpeed(item) {
	try { return item.getSpeed ? item.getSpeed() : 1; } catch (e) { return 1; }
}

function mcIsReversed(item) {
	try {
		if (typeof item.isSpeedReversed == 'function' && item.isSpeedReversed()) return true;
	} catch (e) { }
	try { if (mcItemSpeed(item) < 0) return true; } catch (e) { }
	return false;
}

function mcIsBinClipItem(pi) {
	var t = null;
	try { t = pi.type; } catch (e) { t = null; }
	if (t == 1 || t == 4) return true;
	if (t == 'CLIP') return true;
	if (t == 'BIN' || t == 'SEQUENCE' || t == 'FOLDER' || t == 'ROOT') return false;
	try { return typeof pi.getDuration == 'function'; } catch (e) { return false; }
}

function mcSelectedItems(seq) {
	var out = [];
	var i, j, track, clips, c;
	for (i = 0; i < seq.videoTracks.numTracks; i++) {
		track = seq.videoTracks[i];
		clips = track.clips;
		for (j = 0; j < clips.numItems; j++) {
			c = clips[j];
			try {
				if (typeof c.isSelected == 'function' && c.isSelected()) out.push({ item: c, track: track, isVideo: true });
			} catch (e) { }
		}
	}
	for (i = 0; i < seq.audioTracks.numTracks; i++) {
		track = seq.audioTracks[i];
		clips = track.clips;
		for (j = 0; j < clips.numItems; j++) {
			c = clips[j];
			try {
				if (typeof c.isSelected == 'function' && c.isSelected()) out.push({ item: c, track: track, isVideo: false });
			} catch (e) { }
		}
	}
	return out;
}

function mcClipMatches(clip, nid, s, e, nm) {
	var cn = null, cnm = null;
	if (nid) {
		try { cn = clip.nodeId; } catch (e) { cn = null; }
		if (cn && mcStr(cn) == mcStr(nid)) return true;
	}
	var cs = mcSec(clip.start);
	var ce = mcSec(clip.end);
	if (!isNaN(s) && !isNaN(e) && !isNaN(cs) && !isNaN(ce)) {
		if (Math.abs(cs - s) < 0.05 && Math.abs(ce - e) < 0.05) return true;
	}
	if (nm) {
		try { cnm = clip.name; } catch (e2) { cnm = null; }
		if (cnm && mcStr(cnm) == mcStr(nm)) return true;
	}
	return false;
}

function mcTrackForItem(seq, nid, s, e, nm, isVideo) {
	var tracks = isVideo ? seq.videoTracks : seq.audioTracks;
	var i, j, track, clips, c;
	for (i = 0; i < tracks.numTracks; i++) {
		track = tracks[i];
		clips = track.clips;
		for (j = 0; j < clips.numItems; j++) {
			c = clips[j];
			try {
				if (mcClipMatches(c, nid, s, e, nm)) return track;
			} catch (e2) { }
		}
	}
	return null;
}

function mcEntryFromTrackItem(item, seq) {
	if (!item || !seq) return null;
	var nid = null, s = mcSec(item.start), e = mcSec(item.end), nm = null;
	try { nid = item.nodeId; } catch (e) { nid = null; }
	try { nm = item.name; } catch (e2) { nm = null; }
	var vTrack = mcTrackForItem(seq, nid, s, e, nm, true);
	if (vTrack) return { item: item, track: vTrack, isVideo: true };
	var aTrack = mcTrackForItem(seq, nid, s, e, nm, false);
	if (aTrack) return { item: item, track: aTrack, isVideo: false };
	var isV = true;
	try { isV = (mcStr(item.mediaType) == '0'); } catch (e3) { isV = true; }
	return { item: item, track: null, isVideo: isV };
}

function mcTimelineSelection(seq) {
	try {
		if (typeof seq.getSelection == 'function') {
			var sel = seq.getSelection();
			if (sel && sel.numItems > 0) {
				var out = [];
				for (var i = 0; i < sel.numItems; i++) {
					var rec = mcEntryFromTrackItem(sel[i], seq);
					if (rec) out.push(rec);
				}
				if (out.length > 0) return out;
			}
		}
	} catch (e) { }
	return mcSelectedItems(seq);
}

function mcProjectItemOf(item) {
	try { return item.projectItem; } catch (e) { return null; }
}

function mcClipName(item) {
	try {
		var pi = mcProjectItemOf(item);
		if (pi && pi.name) return mcStr(pi.name);
		if (item.name) return mcStr(item.name);
	} catch (e) { }
	return 'clip';
}

function mcGroupLinkedAudio(seq, masterEntry, vIn) {
	var group = [masterEntry];
	var mStart = mcSec(masterEntry.item.start);
	var mEnd = mcSec(masterEntry.item.end);
	var at, aci, a;
	for (at = 0; at < seq.audioTracks.numTracks; at++) {
		var atk = seq.audioTracks[at];
		for (aci = 0; aci < atk.clips.numItems; aci++) {
			a = atk.clips[aci];
			if (Math.abs(mcSec(a.start) - mStart) < 0.05 && Math.abs(mcSec(a.end) - mEnd) < 0.05 && Math.abs(mcSec(a.inPoint) - vIn) < 0.05) {
				group.push({ item: a, track: atk, isVideo: false });
			}
		}
	}
	return group;
}

function mcFindBinInstance(seq, pi) {
	if (!seq || !pi) return null;
	var piName = '', piNode = '', pjName, pjNode, nameCount = 0;
	try { piName = mcStr(pi.name); } catch (e) { }
	try { piNode = mcStr(pi.nodeId); } catch (e) { }
	var t, j, clip, pj, track;
	for (t = 0; t < seq.videoTracks.numTracks; t++) {
		track = seq.videoTracks[t];
		for (j = 0; j < track.clips.numItems; j++) {
			clip = track.clips[j];
			pj = mcProjectItemOf(clip);
			if (!pj) continue;
			pjNode = '';
			pjName = '';
			try { pjNode = mcStr(pj.nodeId); } catch (e2) { }
			try { pjName = mcStr(pj.name); } catch (e3) { }
			if (piNode && pjNode && pjNode == piNode) return { item: clip, track: track, isVideo: true };
			if (piName && pjName && pjName == piName) nameCount++;
		}
	}
	if (nameCount == 1 && piName) {
		for (t = 0; t < seq.videoTracks.numTracks; t++) {
			track = seq.videoTracks[t];
			for (j = 0; j < track.clips.numItems; j++) {
				clip = track.clips[j];
				pj = mcProjectItemOf(clip);
				if (!pj) continue;
				pjName = '';
				try { pjName = mcStr(pj.name); } catch (e4) { }
				if (pjName && pjName == piName) return { item: clip, track: track, isVideo: true };
			}
		}
	}
	return null;
}

function mcResolveSelection() {
	var seq = null;
	try { seq = app.project.activeSequence; } catch (e) { seq = null; }
	if (seq) {
		var all = mcTimelineSelection(seq);
		var master = null;
		for (var i = 0; i < all.length; i++) {
			if (all[i].isVideo) { master = all[i]; break; }
		}
		if (master) {
			var mStart = mcSec(master.item.start);
			var group = [];
			for (var g0 = 0; g0 < all.length; g0++) {
				if (Math.abs(mcSec(all[g0].item.start) - mStart) < 0.05) group.push(all[g0]);
			}
			if (group.length == 0) group.push(master);
			return { kind: 'TIMELINE', seq: seq, master: master.item, mStart: mStart, mEnd: mcSec(master.item.end), group: group, fromFallback: false };
		}
	}
	var psel = null;
	try { psel = app.project.getSelection ? app.project.getSelection() : null; } catch (e) { psel = null; }
	if (psel && psel.length > 0) {
		for (var j = 0; j < psel.length; j++) {
			var pi = psel[j];
			if (pi && mcIsBinClipItem(pi)) return { kind: 'BIN', seq: seq, pi: pi };
		}
	}
	if (seq && typeof seq.getPlayerPosition == 'function') {
		var ph = mcSec(seq.getPlayerPosition());
		if (!isNaN(ph)) {
			var vEntry = null;
			for (var v = 0; v < seq.videoTracks.numTracks && !vEntry; v++) {
				var vtr = seq.videoTracks[v];
				for (var vc = 0; vc < vtr.clips.numItems; vc++) {
					var vcl = vtr.clips[vc];
					var vs = mcSec(vcl.start);
					var ve = mcSec(vcl.end);
					if (!isNaN(vs) && !isNaN(ve) && vs <= ph + 0.001 && ph <= ve + 0.001) {
						vEntry = { item: vcl, track: vtr, isVideo: true };
						break;
					}
				}
			}
			if (vEntry) {
				return { kind: 'PLAYHEAD', seq: seq, master: vEntry.item, mStart: mcSec(vEntry.item.start), mEnd: mcSec(vEntry.item.end), group: mcGroupLinkedAudio(seq, vEntry, mcSec(vEntry.item.inPoint)), fromFallback: true };
			}
		}
	}
	return { kind: 'NONE', seq: seq };
}

function mcFindByStart(track, sec) {
	var clips = track.clips;
	for (var i = 0; i < clips.numItems; i++) {
		var c = clips[i];
		try {
			if (Math.abs(mcSec(c.start) - sec) < 0.05) return c;
		} catch (e) { }
	}
	return null;
}

function mcParseRanges(str) {
	if (typeof str != 'string' || !str) return { error: 'Sin rangos' };
	var parts = str.split(';');
	var ranges = [];
	for (var i = 0; i < parts.length; i++) {
		var p = parts[i];
		if (!p) continue;
		var kv = p.split(',');
		if (kv.length != 2) return { error: 'Rango invalido' };
		var a = parseFloat(kv[0]);
		var b = parseFloat(kv[1]);
		if (isNaN(a) || isNaN(b)) return { error: 'Rango invalido' };
		ranges.push([a, b]);
	}
	if (ranges.length == 0) return { error: 'Sin rangos' };
	return ranges;
}

function mcNormalizeRanges(ranges, dur) {
	ranges.sort(function (x, y) { return x[0] - y[0]; });
	var merged = [];
	for (var i = 0; i < ranges.length; i++) {
		var a = ranges[i][0], b = ranges[i][1];
		if (a < 0) return { error: 'Inicio no puede ser negativo' };
		if (b > dur + 0.001) return { error: 'El rango supera la duracion de la fuente (' + dur.toFixed(2) + 's)' };
		if (a >= b) return { error: 'Fin debe ser mayor a Inicio' };
		if (merged.length && a <= merged[merged.length - 1][1]) {
			merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b);
		} else {
			merged.push([a, b]);
		}
	}
	return { ranges: merged };
}

function mcSanitizeName(name) {
	var s = mcStr(name);
	var out = '';
	for (var i = 0; i < s.length; i++) {
		var ch = s.charAt(i);
		if (ch == '\\' || ch == '/' || ch == ':' || ch == '*' || ch == '?' || ch == '"' || ch == '<' || ch == '>' || ch == '|') out += '_';
		else out += ch;
	}
	return out;
}

function mcUnselectedLinkedAudio(seq, mStart, mEnd, mIn, group) {
	var k, kc, ac, aStart, aEnd, aIn, inGroup, gg;
	for (k = 0; k < seq.audioTracks.numTracks; k++) {
		var atk = seq.audioTracks[k];
		for (kc = 0; kc < atk.clips.numItems; kc++) {
			ac = atk.clips[kc];
			aStart = mcSec(ac.start);
			if (isNaN(aStart) || Math.abs(aStart - mStart) >= 0.05) continue;
			aEnd = mcSec(ac.end);
			aIn = mcSec(ac.inPoint);
			if (Math.abs(aEnd - mEnd) < 0.05 && Math.abs(aIn - mIn) < 0.05) {
				inGroup = false;
				for (gg = 0; gg < group.length; gg++) {
					if (group[gg].isVideo) continue;
					if (Math.abs(mcSec(group[gg].item.start) - aStart) < 0.05) { inGroup = true; break; }
				}
				if (!inGroup) return true;
			}
		}
	}
	return false;
}

function mcCollectAfterSelectedTracks(groupSnap, mEnd) {
	var out = [];
	var seen = [];
	var i, j, k, found, track, c, s;
	for (i = 0; i < groupSnap.length; i++) {
		track = groupSnap[i].track;
		found = false;
		for (k = 0; k < seen.length; k++) {
			if (seen[k] == track) { found = true; break; }
		}
		if (found) continue;
		seen.push(track);
		for (j = 0; j < track.clips.numItems; j++) {
			c = track.clips[j];
			s = mcSec(c.start);
			if (!isNaN(s) && s >= mEnd - 0.01) out.push({ item: c, start: s });
		}
	}
	return out;
}

function mcScaleToFrame(sub) {
	try {
		if (typeof sub.setScaleToFrameSize == 'function') {
			sub.setScaleToFrameSize();
			return true;
		}
	} catch (e) { }
	return false;
}

function mcScalePropOf(comp) {
	var props = null;
	try { props = comp.properties; } catch (e) { props = null; }
	if (!props) return null;
	for (var i = 0; i < props.numItems; i++) {
		var pr = null;
		try { pr = props[i]; } catch (e) { pr = null; }
		if (!pr) continue;
		try {
			if (pr.displayName == 'Scale' || pr.displayName == 'Escala') return pr;
		} catch (e2) { }
	}
	return null;
}

function mcScaleParam(item) {
	var comps = null;
	try { comps = item.components; } catch (e) { comps = null; }
	if (!comps) return null;
	for (var i = 0; i < comps.numItems; i++) {
		var c = null;
		try { c = comps[i]; } catch (e) { c = null; }
		if (!c) continue;
		var dn = null;
		try { dn = c.displayName; } catch (e) { dn = null; }
		if (dn && (dn == 'Scale' || dn == 'Escala') && typeof c.setValue == 'function') return c;
		var pr = mcScalePropOf(c);
		if (pr) return pr;
	}
	return null;
}

function mcApplyScale(item) {
	var pr = mcScaleParam(item);
	if (!pr) return false;
	try {
		pr.setValue(140, 1);
		return true;
	} catch (e) { return false; }
}

function mcGetSelectionInfo() {
	try {
		if (!app.project) return 'ERR|No hay proyecto abierto';
		var sel = mcResolveSelection();
		if (sel.kind == 'BIN') {
			var d = 0;
			try { d = sel.pi.getDuration().seconds; } catch (e) { d = 0; }
			return 'OK|BIN\u0001' + mcStr(sel.pi.name) + '\u0001' + mcStr(d);
		}
		if (sel.kind == 'NONE') return 'OK|NONE';
		var mIn = mcSec(sel.master.inPoint);
		var mOut = mcSec(sel.master.outPoint);
		if (!(mOut > mIn)) return 'ERR|No se pudo leer el rango fuente del clip';
		return 'OK|TIMELINE\u0001' + mcClipName(sel.master) + '\u0001' + (mOut - mIn).toFixed(3);
	} catch (e) {
		return 'ERR|' + mcStr(e);
	}
}

function mcCutRanges(rangesStr) {
	try {
		if (!app.project) return 'ERR|No hay proyecto abierto';
		var seq = app.project.activeSequence;
		if (!seq) return 'ERR|No hay secuencia activa';
		var sel = mcResolveSelection();
		if (sel.kind == 'NONE') return 'ERR|Seleccioná un clip de video en el timeline (no en el proyecto)';
		if (sel.kind == 'BIN') {
			var inst = mcFindBinInstance(seq, sel.pi);
			if (!inst) return 'ERR|Seleccion de Proyecto detectada; primero inserta el clip en el timeline';
			sel.master = inst.item;
			sel.mStart = mcSec(inst.item.start);
			sel.mEnd = mcSec(inst.item.end);
			sel.group = mcGroupLinkedAudio(seq, inst, mcSec(inst.item.inPoint));
			sel.fromFallback = true;
		}
		var parsed = mcParseRanges(rangesStr);
		if (parsed.error) return 'ERR|' + parsed.error;
		var master = sel.master;
		var mStart = sel.mStart;
		var mEnd = sel.mEnd;
		var mIn = mcSec(master.inPoint);
		var mOut = mcSec(master.outPoint);
		if (!(mEnd > mStart)) return 'ERR|No se pudo leer la posicion del clip en el timeline';
		if (!(mOut > mIn)) return 'ERR|No se pudo leer el rango fuente del clip (inPoint/outPoint)';
		var speed = mcItemSpeed(master);
		if (!(speed > 0)) return 'ERR|No se admite velocidad 0 o inversa para cortar';
		if (Math.abs(speed - 1) > 0.001) return 'ERR|Este build corta solo clips a 1x. Velocidad actual: ' + speed.toFixed(2) + 'x. Cambiala a 100% y reintenta.';
		if (mcIsReversed(master)) return 'ERR|No se admiten clips en reversa para cortar';
		var sourceDur = mOut - mIn;
		var norm = mcNormalizeRanges(parsed, sourceDur);
		if (norm.error) return 'ERR|' + norm.error;
		var ranges = norm.ranges;
		var group = sel.group;
		if (!sel.fromFallback && mcUnselectedLinkedAudio(seq, mStart, mEnd, mIn, group)) {
			return 'ERR|Hay audio sincronizado no seleccionado en la posicion del clip. Seleccioná video+audio juntos y reintenta.';
		}
		var groupSnap = [];
		var gs, git, gpi, gIn, gOut, gStart, rg;
		for (gs = 0; gs < group.length; gs++) {
			git = group[gs].item;
			gpi = mcProjectItemOf(git);
			if (!gpi) return 'ERR|El clip seleccionado no tiene ProjectItem accesible';
			if (typeof gpi.createSubClip != 'function') return 'ERR|Este build no expone ProjectItem.createSubClip; no se puede cortar sin corromper el timeline';
			if (typeof git.remove != 'function') return 'ERR|Este build no expone TrackItem.remove';
			if (typeof group[gs].track.insertClip != 'function') return 'ERR|Este build no expone Track.insertClip';
			if (Math.abs(mcItemSpeed(git) - 1) > 0.001) return 'ERR|Todos los clips del grupo deben estar a 1x para cortar';
			if (mcIsReversed(git)) return 'ERR|No se admiten clips del grupo en reversa';
			gIn = mcSec(git.inPoint);
			gOut = mcSec(git.outPoint);
			gStart = mcSec(git.start);
			if (!(gOut > gIn)) return 'ERR|No se pudo leer el rango fuente de un clip del grupo';
			if (isNaN(gStart)) return 'ERR|No se pudo leer la posicion de un clip del grupo';
			for (rg = 0; rg < ranges.length; rg++) {
				if (ranges[rg][1] > (gOut - gIn) + 0.02) {
					return 'ERR|El rango ' + ranges[rg][0] + '-' + ranges[rg][1] + 's supera el material de un clip vinculado del grupo';
				}
			}
			groupSnap.push({ item: git, track: group[gs].track, start: gStart, inPoint: gIn, projectItem: gpi, isVideo: group[gs].isVideo });
		}
		var shiftSnap = mcCollectAfterSelectedTracks(groupSnap, mEnd);
		if (shiftSnap.length > 0 && typeof shiftSnap[0].item.move != 'function') {
			return 'ERR|Este build no expone TrackItem.move; no se puede cerrar el hueco de forma segura';
		}
		var keptTimeline = 0;
		for (var kt = 0; kt < ranges.length; kt++) keptTimeline += (ranges[kt][1] - ranges[kt][0]) / speed;
		var removedTimeline = (mEnd - mStart) - keptTimeline;
		if (removedTimeline < -0.001) return 'ERR|Error interno: el material conservado excede el hueco disponible';
		var baseName = mcSanitizeName(mcClipName(master));
		var stamp = Math.floor(Math.random() * 1000000);
		var gHasVideo = false, gHasAudio = false, videoSnap = null;
		for (var gf = 0; gf < groupSnap.length; gf++) {
			if (groupSnap[gf].isVideo) { gHasVideo = true; videoSnap = groupSnap[gf]; }
			else gHasAudio = true;
		}
		if (!videoSnap) return 'ERR|No se encontro el snapshot de video del clip master';
		var pieces = [];
		var runPos = mStart;
		var r, a, b, sIn, subName, sub;
		for (r = 0; r < ranges.length; r++) {
			a = ranges[r][0];
			b = ranges[r][1];
			sIn = videoSnap.inPoint;
			subName = baseName + '_' + Math.round(a) + '-' + Math.round(b) + '_' + (r + 1) + '_' + stamp;
			sub = null;
			try {
				sub = videoSnap.projectItem.createSubClip(subName, mcTicks(sIn + a), mcTicks(sIn + b), 1, 1, gHasAudio ? 1 : 0);
			} catch (e) {
				return 'ERR|Fallo al crear subclip (' + subName + '): ' + mcStr(e);
			}
			if (!sub) return 'ERR|createSubClip devolvio 0 para ' + subName;
			pieces.push({ sub: sub, track: videoSnap.track, time: mcTicks(runPos), timeSec: runPos });
			runPos += (b - a) / speed;
		}
		var scaleWarn = 0;
		var pS, sItem, sf;
		for (pS = 0; pS < pieces.length; pS++) {
			sf = mcScaleToFrame(pieces[pS].sub);
			pieces[pS].scaleOk = sf;
		}
		var removedGone = [];
		var removeFail = false;
		var d, threw, gone;
		for (d = 0; d < groupSnap.length; d++) {
			threw = false;
			try { groupSnap[d].item.remove(false, false); } catch (e) { threw = true; }
			gone = isNaN(mcSec(groupSnap[d].item.start));
			removedGone.push(gone);
			if (threw && !gone) removeFail = true;
		}
		if (removeFail) {
			var rb1 = [];
			for (var rf = 0; rf < groupSnap.length; rf++) {
				if (removedGone[rf]) {
					try { groupSnap[rf].track.insertClip(groupSnap[rf].projectItem, mcTicks(groupSnap[rf].start)); } catch (e) { rb1.push('restaurar'); }
				}
			}
			return 'ERR|No se pudo eliminar un clip original; se intento restaurar' + (rb1.length ? ' (restauracion incompleta; usa Ctrl+Z)' : '');
		}
		var insertFail = null;
		for (var p = 0; p < pieces.length && !insertFail; p++) {
			try { pieces[p].track.insertClip(pieces[p].sub, pieces[p].time); }
			catch (e) { insertFail = e; }
		}
		if (insertFail) {
			var rb2 = [];
			var hit;
			for (var p2 = 0; p2 < pieces.length; p2++) {
				hit = mcFindByStart(pieces[p2].track, pieces[p2].timeSec);
				if (hit) { try { hit.remove(false, false); } catch (e) { rb2.push('quitar pedazo'); } }
			}
			for (var rr = 0; rr < groupSnap.length; rr++) {
				try { groupSnap[rr].track.insertClip(groupSnap[rr].projectItem, mcTicks(groupSnap[rr].start)); } catch (e) { rb2.push('restaurar'); }
			}
			return 'ERR|Fallo al insertar pedazos: ' + mcStr(insertFail) + (rb2.length ? ' (rollback incompleto: ' + rb2.join('; ') + '; usa Ctrl+Z)' : ' (rollback completo)');
		}
		var shiftFail = 0;
		var pI, itm, okSc;
		for (pI = 0; pI < pieces.length; pI++) {
			itm = mcFindByStart(pieces[pI].track, pieces[pI].timeSec);
			okSc = pieces[pI].scaleOk && mcApplyScale(itm);
			if (!okSc) scaleWarn++;
		}
		var sh, sit, target, before, mt, vf, expect, actual;
		if (removedTimeline > 0.001) {
			for (sh = 0; sh < shiftSnap.length; sh++) {
				sit = shiftSnap[sh].item;
				target = shiftSnap[sh].start - removedTimeline;
				try {
					before = mcSec(sit.start);
					if (isNaN(before) || Math.abs(before - target) > 0.05) {
						mt = new Time();
						mt.seconds = -removedTimeline;
						sit.move(mt);
					}
				} catch (e) { shiftFail++; }
			}
			for (vf = 0; vf < shiftSnap.length; vf++) {
				expect = shiftSnap[vf].start - removedTimeline;
				actual = mcSec(shiftSnap[vf].item.start);
				if (isNaN(actual) || Math.abs(actual - expect) > 0.05) shiftFail++;
			}
		}
		var msg = 'OK|Corte realizado en ' + ranges.length + ' pedazo(s)';
		if (scaleWarn > 0) msg += ' | aviso: no se pudo aplicar escala 140 en ' + scaleWarn + ' pedazo(s)';
		if (shiftFail > 0) msg += ' | ' + shiftFail + ' clip(s) posteriores no quedaron alineados; revisa el hueco';
		return msg;
	} catch (e) {
		return 'ERR|' + mcStr(e);
	}
}

function mcPing() {
	try { return 'PONG|host-loaded'; } catch (e) { return 'ERR|ping'; }
}
