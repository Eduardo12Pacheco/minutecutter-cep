(function () {
	var cep = window.__adobe_cep__;
	var tbody = document.getElementById('tbody');
	var statusEl = document.getElementById('status');
	var cutBtn = document.getElementById('cutBtn');
	var addRowBtn = document.getElementById('addRow');
	var clipInfoEl = document.getElementById('clipInfo');

	var selectedInfo = null; // { name, durationSeconds }

	// --- Bootstrap automático del host (invisible, sin botón Diag) ---
	var hostReady = false;
	var booting = false;

	function hostPath() {
		var root = '';
		try {
			var base = String(window.location.href || '');
			if (base.indexOf('file://') === 0) {
				var i = base.indexOf('/client/');
				if (i > 7) root = base.substring(7, i);
				if (root.charAt(0) === '/') root = root.substring(1);
			}
		} catch (e) { }
		return root + '/host/main.jsx';
	}

	function bootstrapScript() {
		var p = hostPath();
		return "var mcR='';\n" +
			"if (typeof mcGetSelectionInfo === 'function') {\n" +
			"  mcR = 'READY';\n" +
			"} else {\n" +
			"  try {\n" +
			"    $.evalFile('" + p + "');\n" +
			"    mcR = (typeof mcGetSelectionInfo === 'function') ? 'READY' : 'ERR|HOST_LOAD|file-loaded-but-not-defined';\n" +
			"  } catch (e) {\n" +
			"    mcR = 'ERR|HOST_LOAD|' + e.name + '|' + String(e.message) + '|' + String(e.line);\n" +
			"  }\n" +
			"}\n" +
			"mcR";
	}

	function showHostError(s) {
		var bar = s.indexOf('|');
		var rest = bar >= 0 ? s.substring(bar + 1) : s;
		clipInfoEl.textContent = 'Error cargando host: ' + rest;
		clipInfoEl.className = 'clipinfo none';
		cutBtn.disabled = true;
	}

	function ensureHost(cb, showLog) {
		if (hostReady) { cb(); return; }
		if (booting) return;
		if (!cep) { log('Extensión sin host CEP', true); return; }
		booting = true;
		evalJSX(bootstrapScript(), function (res) {
			booting = false;
			var s = String(res || '').trim();
			if (s === 'READY') {
				hostReady = true;
				cb();
			} else {
				showHostError(s);
				if (showLog) log('Error cargando host: ' + (s.indexOf('|') >= 0 ? s.substring(s.indexOf('|') + 1) : s), true);
			}
		}, 10000);
	}

	function log(msg, isErr) {
		statusEl.textContent = msg;
		statusEl.className = 'status' + (isErr ? ' err' : '');
	}

	function evalJSX(script, cb, timeoutMs) {
		if (!cep) { log('Extensión sin host CEP', true); return; }
		var ms = timeoutMs || 10000;
		var done = false;
		var timer = setTimeout(function () {
			if (done) return;
			done = true;
			cb('ERR|timeout');
		}, ms);
		cep.evalScript(script, function (res) {
			if (done) return;
			done = true;
			clearTimeout(timer);
			cb(res);
		});
	}

	function parseTime(str) {
		if (typeof str !== 'string') return null;
		str = str.trim();
		if (!str) return null;
		var parts = str.split(':');
		var total = 0;
		var mult = 1;
		for (var i = parts.length - 1; i >= 0; i--) {
			var v = parseFloat(parts[i]);
			if (isNaN(v) || v < 0) return null;
			total += v * mult;
			mult *= 60;
		}
		return total; // seconds
	}

	function formatTime(sec) {
		sec = Math.round(sec);
		var m = Math.floor(sec / 60);
		var s = sec % 60;
		return m + ':' + (s < 10 ? '0' : '') + s;
	}

	function renderNumbering() {
		var rows = tbody.querySelectorAll('tr');
		for (var i = 0; i < rows.length; i++) {
			rows[i].querySelector('.num').textContent = i + 1;
		}
	}

	function addRow() {
		var tr = document.createElement('tr');

		var tdNum = document.createElement('td');
		tdNum.className = 'num';

		var tdMin = document.createElement('td');
		var minute = document.createElement('div');
		minute.className = 'minute';

		var l1 = document.createElement('label');
		l1.textContent = 'Inicio';
		var in1 = document.createElement('input');
		in1.type = 'text';
		in1.placeholder = '1:20';

		var l2 = document.createElement('label');
		l2.textContent = 'Fin';
		var in2 = document.createElement('input');
		in2.type = 'text';
		in2.placeholder = '1:55';

		minute.appendChild(l1);
		minute.appendChild(in1);
		minute.appendChild(l2);
		minute.appendChild(in2);
		tdMin.appendChild(minute);

		var tdDel = document.createElement('td');
		var delBtn = document.createElement('button');
		delBtn.className = 'delbtn';
		delBtn.textContent = 'x';
		delBtn.title = 'Borrar fila';
		delBtn.addEventListener('click', function () {
			tr.remove();
			renderNumbering();
		});
		tdDel.appendChild(delBtn);

		tr.appendChild(tdNum);
		tr.appendChild(tdMin);
		tr.appendChild(tdDel);
		tbody.appendChild(tr);
		renderNumbering();
	}

	function getRanges() {
		var rows = tbody.querySelectorAll('tr');
		var ranges = [];
		for (var i = 0; i < rows.length; i++) {
			var inputs = rows[i].querySelectorAll('input');
			var a = parseTime(inputs[0].value);
			var b = parseTime(inputs[1].value);
			inputs[0].classList.remove('invalid');
			inputs[1].classList.remove('invalid');

			if (!inputs[0].value.trim() && !inputs[1].value.trim()) continue;

			if (a === null || b === null) {
				if (a === null) inputs[0].classList.add('invalid');
				if (b === null) inputs[1].classList.add('invalid');
				return { error: 'Tiempo inválido en fila ' + (i + 1) + '. Usá formato mm:ss' };
			}
			if (a >= b) {
				inputs[0].classList.add('invalid');
				inputs[1].classList.add('invalid');
				return { error: 'En la fila ' + (i + 1) + ', Fin debe ser mayor que Inicio' };
			}
			if (selectedInfo && b > selectedInfo.durationSeconds) {
				inputs[1].classList.add('invalid');
				return { error: 'En la fila ' + (i + 1) + ', Fin supera la duración del video (' + formatTime(selectedInfo.durationSeconds) + ')' };
			}
			ranges.push(a + ',' + b);
		}
		if (ranges.length === 0) return { error: 'Completá al menos un rango' };
		return { ranges: ranges.join(';') };
	}

	function refreshClipInfo(showLog) {
		ensureHost(function () {
			evalJSX('mcGetSelectionInfo()', function (res) {
				try {
					var s = String(res || '');
					var bar = s.indexOf('|');
					var head = bar >= 0 ? s.substring(0, bar) : s;
					var rest = bar >= 0 ? s.substring(bar + 1) : '';

					if (head === 'ERR') {
						selectedInfo = null;
						clipInfoEl.textContent = rest || 'Error leyendo la selección';
						clipInfoEl.className = 'clipinfo none';
						cutBtn.disabled = true;
						if (showLog) log('Error: ' + (rest || 'sin datos'), true);
						return;
					}
					if (head !== 'OK') {
						if (bar < 0) {
							selectedInfo = null;
							clipInfoEl.textContent = 'Error del host: ' + s;
							clipInfoEl.className = 'clipinfo none';
							cutBtn.disabled = true;
							if (showLog) log('Error del host: ' + s, true);
							return;
						}
						selectedInfo = null;
						clipInfoEl.textContent = 'Sin clip seleccionado. Elegí un clip en el timeline o en el proyecto.';
						clipInfoEl.className = 'clipinfo none';
						cutBtn.disabled = true;
						if (showLog) log('Seleccioná un clip primero');
						return;
					}

					var parts = rest.split('\u0001');
					var kind = parts[0] || '';
					var name = parts[1] || '';
					var dur = parseFloat(parts[2]) || 0;

					if (kind === 'TIMELINE') {
						selectedInfo = { name: name, durationSeconds: dur };
						clipInfoEl.textContent = 'Clip: ' + name + '  —  Duración: ' + formatTime(dur);
						clipInfoEl.className = 'clipinfo';
						cutBtn.disabled = false;
						if (showLog) log('Clip listo para cortar');
					} else if (kind === 'BIN') {
						selectedInfo = null;
						clipInfoEl.textContent = 'Clip de Proyecto detectado; para cortar, primero debe existir en timeline';
						clipInfoEl.className = 'clipinfo none';
						cutBtn.disabled = true;
						if (showLog) log('Clip de Proyecto detectado; para cortar, primero debe existir en timeline');
					} else {
						selectedInfo = null;
						clipInfoEl.textContent = 'Sin clip seleccionado. Elegí un clip en el timeline o en el proyecto.';
						clipInfoEl.className = 'clipinfo none';
						cutBtn.disabled = true;
						if (showLog) log('Seleccioná un clip primero');
					}
				} catch (e) {
					if (showLog) log('Error leyendo selección', true);
				}
			}, 8000);
		}, showLog);
	}

	cutBtn.addEventListener('click', function () {
		var check = getRanges();
		if (check.error) { log(check.error, true); return; }
		if (!selectedInfo) { log('Seleccioná un clip primero', true); return; }

		ensureHost(function () {
			cutBtn.disabled = true;
			cutBtn.textContent = 'Cortando...';
			var script = 'mcCutRanges("' + check.ranges + '")';
			evalJSX(script, function (res) {
				cutBtn.textContent = 'Cortar';
				cutBtn.disabled = false;
				var s = String(res || '');
				var bar = s.indexOf('|');
				var head = bar >= 0 ? s.substring(0, bar) : s;
				var rest = bar >= 0 ? s.substring(bar + 1) : '';
				if (head === 'OK') {
					log(rest || s);
					setTimeout(function () { refreshClipInfo(false); }, 500);
				} else if (rest === 'timeout') {
					log('Error: timeout del host. El corte pudo no completarse; revisá el timeline.', true);
				} else if (bar < 0) {
					log('Error del host: ' + s, true);
				} else {
					log('Error: ' + (rest || s), true);
				}
			}, 60000);
		}, true);
	});

	addRowBtn.addEventListener('click', addRow);

	// detect selection changes periodically
	addRow();
	setInterval(function () { refreshClipInfo(false); }, 2000);
	refreshClipInfo(true);
})();
