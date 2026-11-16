"""Compare OMR output against an original fixture, by measure/staff/onset/pitch/duration."""
from fractions import Fraction
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


def events(path):
    result=[]
    for part_index,part in enumerate(ET.parse(path).getroot().findall('part')):
        divisions=1
        for bar,measure in enumerate(part.findall('measure')):
            cursor=Fraction(0);last=cursor
            for item in measure:
                if item.tag=='attributes':divisions=int(item.findtext('divisions',str(divisions)))
                elif item.tag in ('backup','forward'):
                    cursor+=Fraction(int(item.findtext('duration')),divisions)*(-1 if item.tag=='backup' else 1)
                elif item.tag=='note':
                    duration=Fraction(int(item.findtext('duration','0')),divisions)
                    onset=last if item.find('chord') is not None else cursor
                    pitch=item.find('pitch')
                    if pitch is not None:
                        midi=(int(pitch.findtext('octave'))+1)*12+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[pitch.findtext('step')]+int(pitch.findtext('alter','0'))
                        result.append((part_index,bar,int(item.findtext('staff','1')),str(onset),midi,str(duration)))
                    if item.find('chord') is None:cursor+=duration;last=onset
    return sorted(result)


expected=events(sys.argv[1]);actual=events(sys.argv[2])
report={'expectedNotes':len(expected),'recognizedNotes':len(actual),'matched':len(set(expected)&set(actual)),
        'missing':sorted(set(expected)-set(actual)),'extra':sorted(set(actual)-set(expected)),'exact':expected==actual}
Path(sys.argv[2]).with_suffix('.comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
if expected!=actual:raise SystemExit(1)
