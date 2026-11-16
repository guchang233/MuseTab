# SPDX-License-Identifier: AGPL-3.0-only
"""Prepare a pinned, UI-free homr adapter and verified offline model cache.
Does not import the upstream app's globals.py or touch score/library storage.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request
import zipfile

HERE=Path(__file__).resolve().parent


def sha(path):
    digest=hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda:stream.read(1024*1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,default=Path("D:/MuseTabSDK/omr/andromr-d800585"))
    parser.add_argument("--output",type=Path,default=Path("D:/MuseTabBuild/omr/python"))
    parser.add_argument("--models",type=Path,default=Path("D:/MuseTabSDK/omr/models"))
    parser.add_argument("--download-models",action="store_true")
    args=parser.parse_args(); manifest=json.loads((HERE/"models.json").read_text())
    revision=subprocess.check_output(["git","-C",str(args.source),"rev-parse","HEAD"],text=True).strip()
    if revision!=manifest["revision"]:raise RuntimeError("Unexpected Andromr source revision")
    if args.output.resolve()==args.source.resolve() or args.source.resolve() in args.output.resolve().parents:raise ValueError("Adapter output must be separate from upstream source")
    args.output.mkdir(parents=True,exist_ok=True)
    shutil.copytree(args.source/"homr",args.output/"homr",dirs_exist_ok=True,ignore=shutil.ignore_patterns("__pycache__","*.pyc"))
    for file in (args.output/"homr").rglob("*.py"):
        value=file.read_text(encoding="utf-8").replace("from globals import ","from musetab_runtime import ").replace("from kivy.utils import platform","from musetab_runtime import platform")
        value=value.replace("from jnius import autoclass", "from java import jclass as autoclass").replace("com.aicelen.andromr.","app.musetab.omr.")
        file.write_text(value,encoding="utf-8",newline="\n")
    shutil.copy2(HERE/"musetab_runtime.py",args.output/"musetab_runtime.py")
    shutil.copy2(args.source/"LICENSE",args.output/"ANDROMR-LICENSE.txt")
    args.models.mkdir(parents=True,exist_ok=True)
    inventory={"revision":revision,"models":[]}
    for model in manifest["models"]:
        target=args.models/model["file"]; archive=args.models/model["archive"]
        if args.download_models:
            if not archive.exists() or sha(archive)!=model["sha256"]:
                partial=archive.with_suffix(".zip.partial")
                print("Downloading "+model["archive"],flush=True)
                urllib.request.urlretrieve(manifest["release"]+model["archive"],partial)
                if sha(partial)!=model["sha256"]:raise RuntimeError("Model archive checksum mismatch: "+model["archive"])
                partial.replace(archive)
            with zipfile.ZipFile(archive) as z:
                candidates=[x for x in z.infolist() if Path(x.filename).name==model["file"] and not x.is_dir()]
                if len(candidates)!=1 or candidates[0].file_size>512*1024*1024:raise RuntimeError("Unexpected model archive contents")
                temp=target.with_suffix(target.suffix+".partial")
                with z.open(candidates[0]) as source,temp.open("wb") as out:shutil.copyfileobj(source,out)
                temp.replace(target)
        if not target.is_file():raise FileNotFoundError("Missing offline model; run prepare.py --download-models: "+str(target))
        inventory["models"].append({"file":model["file"],"bytes":target.stat().st_size,"sha256":sha(target)})
    (args.models/"verified.json").write_text(json.dumps(inventory,indent=2),encoding="utf-8")
    (args.output/"adapter.json").write_text(json.dumps({"revision":revision,"models":str(args.models.resolve())},indent=2),encoding="utf-8")
    print(json.dumps({"ready":True,"adapter":str(args.output),"models":inventory}),flush=True)


if __name__=="__main__":main()
