# SPDX-License-Identifier: AGPL-3.0-only
"""Offline, sequential PDF/image -> MusicXML prototype. No cloud upload.
Original documents stay untouched; all rendering and recognition use a new job
directory. Each page is a separate result until part alignment is validated.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
from time import perf_counter
from uuid import uuid4
import xml.etree.ElementTree as ET


def main():
    p=argparse.ArgumentParser();p.add_argument("input",type=Path)
    p.add_argument("--adapter",type=Path,default=Path("D:/MuseTabBuild/omr/python"))
    p.add_argument("--output",type=Path,default=Path("D:/MuseTabBuild/omr/jobs"))
    p.add_argument("--pages",default="1",help="1-based comma-separated pages; start with one page for review")
    p.add_argument("--cancel-file",type=Path)
    args=p.parse_args();config=json.loads((args.adapter/"adapter.json").read_text());models=Path(config["models"])
    inventory=json.loads((models/"verified.json").read_text())
    for model in inventory["models"]:
        if hashlib.sha256((models/model["file"]).read_bytes()).hexdigest()!=model["sha256"]:raise RuntimeError("Offline model verification failed: "+model["file"])
    os.environ["MUSETAB_OMR_MODELS"]=str(models)
    if args.cancel_file:os.environ["MUSETAB_OMR_CANCEL_FILE"]=str(args.cancel_file)
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL","2")
    sys.path.insert(0,str(args.adapter.resolve()))
    from PIL import Image
    from homr.main import process_image, ProcessingConfig
    from homr.music_xml_generator import XmlGeneratorArguments
    job=args.output/uuid4().hex;job.mkdir(parents=True)
    pages=sorted(set(int(n) for n in args.pages.split(",")))
    if not pages or min(pages)<1:raise ValueError("Page numbers must start at one")
    results=[];started=perf_counter();pdf=None
    try:
        if args.input.suffix.lower()==".pdf":
            import pypdfium2 as pdfium
            pdf=pdfium.PdfDocument(args.input)
            if max(pages)>len(pdf):raise ValueError("Requested page does not exist")
        elif pages!=[1]:raise ValueError("Images have one page")
        for page in pages:
            source=job/f"page-{page:04d}.png";xml=source.with_suffix(".musicxml")
            if pdf:
                pdf_page=pdf[page-1]
                try:
                    width,height=pdf_page.get_size();scale=min(300/72,2400/max(width,height))
                    bitmap=pdf_page.render(scale=scale)
                    try:im=bitmap.to_pil().convert("RGB");im.save(source)
                    finally:bitmap.close()
                finally:pdf_page.close()
            else:
                with Image.open(args.input) as image:
                    image=image.convert("RGBA");im=Image.new("RGB",image.size,"white");im.paste(image,mask=image.getchannel("A"));im.save(source)
            print(json.dumps({"type":"page","page":page,"total":len(pages)}),flush=True)
            process_image(str(source),ProcessingConfig(False,False,False,False,-1,False),XmlGeneratorArguments(),str(xml))
            root=ET.parse(xml).getroot();notes=[note for note in root.iter("note") if note.find("pitch") is not None]
            if not notes:raise RuntimeError("No pitched notes recognized; result requires review")
            results.append({"page":page,"musicxml":str(xml),"notes":len(notes),"measures":len(list(root.iter("measure"))),"reviewRequired":True})
        report={"input":str(args.input.resolve()),"revision":config["revision"],"elapsedSeconds":round(perf_counter()-started,3),"pages":results,"status":"needs-review"}
        (job/"result.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps({"type":"result",**report},ensure_ascii=False),flush=True)
    finally:
        if pdf:pdf.close()


if __name__=="__main__":main()
