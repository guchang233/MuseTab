import {ms} from '../ui/motion';
const active=new WeakMap<HTMLElement,Animation>();
// Completed pages fade in as a whole. Geometry never moves, so note hit-testing stays exact.
export function pageArrival(node:HTMLElement|undefined){if(!node)return;active.get(node)?.cancel();const duration=ms(130);if(!duration)return;active.set(node,node.animate([{opacity:.78},{opacity:1}],{duration,easing:'ease-out'}));}
