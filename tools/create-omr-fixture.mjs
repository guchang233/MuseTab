// Synthetic notation only: render an original MusicXML score to an actual PDF.
import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const out='tests/results/pdf-omr';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:800}});
const upper=['C','D','E','F','G','A','B','C','E','G','F','D','C','E','D','C'];
const lower=['C','G','C','G','C','G','C','G','C','G','C','G','C','G','C','C'];
function notes(steps,staff){return steps.map(step=>`<note><pitch><step>${step}</step><octave>${staff===1?4:3}</octave></pitch><duration>1</duration><voice>${staff===1?1:5}</voice><type>quarter</type><staff>${staff}</staff></note>`).join('');}
const xml=`<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Offline Recognition Test</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name><score-instrument id="I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1">${Array.from({length:4},(_,i)=>`<measure number="${i+1}">${i===0?'<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>':''}${notes(upper.slice(i*4,i*4+4),1)}<backup><duration>4</duration></backup>${notes(lower.slice(i*4,i*4+4),2)}</measure>`).join('')}</part></score-partwise>`;
try{
 await p.goto('http://127.0.0.1:5183/engine/host.html');await p.waitForFunction(()=>window.musetabEngine?.ready,{},{timeout:90000});
 await p.evaluate(async text=>musetabEngine.open(new TextEncoder().encode(text),'musicxml'),xml);
 const src=await p.evaluate(()=>musetabEngine.renderPage(0,2000));
 await fs.writeFile(out+'/source.musicxml',xml);
 await fs.writeFile(out+'/source.png',Buffer.from(src.split(',')[1],'base64'));
 const printable=await b.newPage();await printable.setContent('<style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}</style><img src="'+src+'">');await printable.locator('img').evaluate(im=>im.decode());await printable.pdf({path:out+'/source.pdf',format:'A4',margin:{top:0,left:0,right:0,bottom:0},printBackground:true});
 console.log('Created original 32-note, 4-bar piano fixture:',out+'/source.pdf');
}finally{await b.close();}
