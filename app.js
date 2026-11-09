'use strict';
const $=id=>document.getElementById(id);
const ids=['base','stripe','accent','pinstripe','thickness','hook','frequency','coverage','angle','tilt','flatTilt','speed'];
const defaults={base:'#fff5e6',stripe:'#c83940',accent:'#df7b79',pinstripe:true,thickness:'34',hook:'65',frequency:'10',coverage:'36',angle:'20',tilt:'0',flatTilt:'0',speed:'25'};
let mode='2d',svg='',mesh=[],spinning=false,last=0,rotation=20,frame=0;
const mod=x=>((x%1)+1)%1;
function recipe(){return Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).type==='range'?Number($(id).value):$(id).value]));}
function centre(s,r){
 const stem=310,total=stem+Math.PI*r;
 if(s<=stem)return{x:-r,y:210-s,tx:0,ty:-1};
 const a=Math.PI-(s-stem)/r;
 return{x:r*Math.cos(a),y:-100-r*Math.sin(a),tx:Math.sin(a),ty:Math.cos(a)};
}
function colourAt(u,p){u=mod(u);return u<p.coverage/100?p.stripe:p.pinstripe&&u>.74&&u<.81?p.accent:p.base;}
function makeFlat(p){
 const total=310+Math.PI*p.hook,r=p.thickness/2,pitch=total/p.frequency;
 const point=(s,d)=>{
  const clamped=Math.max(0,Math.min(total,s)),c=centre(clamped,p.hook),extension=s-clamped;
  return [c.x+c.tx*extension-c.ty*d,c.y+c.ty*extension+c.tx*d];
 };
 // Each stripe is one continuous outline, mapped onto the bend.
 function stripe(k,lo,hi,colour){
  const polygon=[];
  const boundary=(u,d)=>[pitch*(k+u-d/p.thickness*.45),d];
  const corners=[boundary(lo,-r),boundary(hi,-r),boundary(hi,r),boundary(lo,r)];
  for(let e=0;e<4;e++){
   const a=corners[e],b=corners[(e+1)%4],steps=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5));
   for(let j=0;j<steps;j++){const t=j/steps;polygon.push(point(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}
  }
  return '<path fill="'+colour+'" d="M'+polygon.map(v=>v.map(x=>x.toFixed(3)).join(',')).join('L')+'Z"/>';
 }
 const R=p.hook;
 // Closed silhouette with exact circular hook and semicircular tips.
 const silhouette='M'+(-R-r)+',210 L'+(-R-r)+',-100 A'+(R+r)+','+(R+r)+' 0 0 1 '+(R+r)+',-100 A'+r+','+r+' 0 0 1 '+(R-r)+',-100 A'+(R-r)+','+(R-r)+' 0 0 0 '+(-R+r)+',-100 L'+(-R+r)+',210 A'+r+','+r+' 0 0 1 '+(-R-r)+',210 Z';
 let paths='';
 for(let k=-2;k<=p.frequency+2;k++){paths+=stripe(k,0,p.coverage/100,p.stripe);if(p.pinstripe)paths+=stripe(k,.74,.81,p.accent);}
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-270 -270 540 540" role="img" aria-label="Striped candy cane"><defs><clipPath id="cane-outline"><path d="'+silhouette+'"/></clipPath></defs><g transform="rotate('+p.flatTilt+')"><path d="'+silhouette+'" fill="'+p.base+'"/><g clip-path="url(#cane-outline)">'+paths+'</g></g></svg>';
}
function buildMesh(p){
 mesh=[];const total=310+Math.PI*p.hook,N=380,K=96,r=p.thickness/2;
 function pt(s,a){const c=centre(s,p.hook);return{x:c.x-c.ty*r*Math.cos(a),y:c.y+c.tx*r*Math.cos(a),z:r*Math.sin(a),nx:-c.ty*Math.cos(a),ny:c.tx*Math.cos(a),nz:Math.sin(a),tip:0,phase:s/total*p.frequency+a/(2*Math.PI)};}
 for(let j=0;j<N;j++)for(let k=0;k<K;k++){
  const s=j/N*total,t=(j+1)/N*total,a=k/K*Math.PI*2,b=(k+1)/K*Math.PI*2;
  mesh.push({v:[pt(s,a),pt(t,a),pt(t,b),pt(s,b)],colour:colourAt((j+.5)/N*p.frequency+(k+.5)/K,p)});
 }
 // Rounded closed ends, using hemispheres.
 for(const end of [0,total]){
  const c=centre(end,p.hook),direction=end===0?-1:1;
  function cap(a,b){const rr=r*Math.cos(b),along=direction*r*Math.sin(b);return{x:c.x+c.tx*along-c.ty*rr*Math.cos(a),y:c.y+c.ty*along+c.tx*rr*Math.cos(a),z:rr*Math.sin(a),nx:c.tx*direction*Math.sin(b)-c.ty*Math.cos(b)*Math.cos(a),ny:c.ty*direction*Math.sin(b)+c.tx*Math.cos(b)*Math.cos(a),nz:Math.cos(b)*Math.sin(a),tip:Math.sin(b),phase:(end+along)/total*p.frequency+a/(2*Math.PI)};}
  for(let j=0;j<24;j++)for(let k=0;k<K;k++)mesh.push({v:[cap(k/K*2*Math.PI,j/24*Math.PI/2),cap((k+1)/K*2*Math.PI,j/24*Math.PI/2),cap((k+1)/K*2*Math.PI,(j+1)/24*Math.PI/2),cap(k/K*2*Math.PI,(j+1)/24*Math.PI/2)],colour:colourAt(end/total*p.frequency+(k+.5)/K,p)});
 }
}
let gpu=null,meshUploaded=null;
function initGPU(){
 const canvas=$('solid');
 canvas.width=1800;canvas.height=2000;
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('This browser needs WebGL 2 for the smooth 3D preview.');
 const vertex=`#version 300 es
 in vec3 position; in vec3 normal; in float phase; in float tip;
 uniform float angle,tilt;
 out vec3 surfaceNormal; out float stripePhase; out float tipAmount;
 void main(){
  float c=cos(angle),s=sin(angle);
  vec3 p=vec3(position.x*c+position.z*s,position.y,-position.x*s+position.z*c);
  surfaceNormal=vec3(normal.x*c+normal.z*s,normal.y,-normal.x*s+normal.z*c);
  float ct=cos(tilt),st=sin(tilt);
  p=vec3(p.x*ct-p.y*st,p.x*st+p.y*ct,p.z);
  surfaceNormal=vec3(surfaceNormal.x*ct-surfaceNormal.y*st,surfaceNormal.x*st+surfaceNormal.y*ct,surfaceNormal.z);
  stripePhase=phase; tipAmount=tip;
  gl_Position=vec4(p.x*1.7/450.0,-(p.y*1.7+10.0)/500.0,-p.z/500.0,1.0);
 }`;
 const fragment=`#version 300 es
 precision highp float;
 in vec3 surfaceNormal; in float stripePhase; in float tipAmount;
 uniform vec3 baseColour,stripeColour,accentColour;
 uniform float coverage; uniform bool accentOn;
 out vec4 colour;
 float band(float centre,float width){
  float d=abs(fract(stripePhase-centre+0.5)-0.5);
  float aa=max(fwidth(stripePhase)*0.7,0.00001);
  return 1.0-smoothstep(width*0.5-aa,width*0.5+aa,d);
 }
 void main(){
  vec3 n=normalize(surfaceNormal);
  vec3 paint=mix(baseColour,stripeColour,band(coverage*0.5,coverage));
  if(accentOn)paint=mix(paint,accentColour,band(0.775,0.07));
  paint=mix(paint,baseColour,smoothstep(0.45,0.95,tipAmount));
  float diffuse=max(0.0,dot(n,normalize(vec3(-0.4,-0.35,0.84))));
  float shine=pow(max(0.0,dot(n,normalize(vec3(-0.25,-0.2,0.95)))),28.0)*0.255;
  colour=vec4(paint*(0.58+0.42*diffuse)+vec3(shine),1.0);
 }`;
 function shader(type,source){
  const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));
  return sh;
 }
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,size,offset]of [['position',3,0],['normal',3,12],['phase',1,24],['tip',1,28]]){
  const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);
 }
 gl.enable(gl.DEPTH_TEST);
 const uniforms=Object.fromEntries(['angle','tilt','baseColour','stripeColour','accentColour','coverage','accentOn'].map(name=>[name,gl.getUniformLocation(program,name)]));
 return {gl,uniforms,count:0};
}
function draw(){
 if(!gpu)gpu=initGPU();
 const {gl,uniforms}=gpu,p=recipe();
 if(meshUploaded!==mesh){
  const vertices=new Float32Array(mesh.length*6*8);let index=0;
  for(const face of mesh)for(const i of [0,1,2,0,2,3]){
   const v=face.v[i];for(const value of [v.x,v.y,v.z,v.nx,v.ny,v.nz,v.phase,v.tip])vertices[index++]=value;
  }
  gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gpu.count=vertices.length/8;meshUploaded=mesh;
 }
 gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(uniforms.angle,rotation*Math.PI/180);
 gl.uniform1f(uniforms.tilt,p.tilt*Math.PI/180);
 for(const id of ['base','stripe','accent'])gl.uniform3fv(uniforms[id+'Colour'],p[id].match(/\w\w/g).map(x=>parseInt(x,16)/255));
 gl.uniform1f(uniforms.coverage,p.coverage/100);gl.uniform1i(uniforms.accentOn,p.pinstripe?1:0);
 gl.drawArrays(gl.TRIANGLES,0,gpu.count);
}
function render(){
 const p=recipe();for(const id of ['thickness','hook','frequency','coverage','angle','tilt','flatTilt','speed'])$(id+'-value').textContent=p[id]+(id==='coverage'?'%':(id==='angle'||id==='tilt'||id==='flatTilt')?'°':id==='speed'?'°/s':id==='frequency'?'':' px');
 if(mode==='2d'){svg=makeFlat(p);$('flat').innerHTML=svg;}else{buildMesh(p);draw();}
 $('status').textContent='';
}
function stop(){spinning=false;cancelAnimationFrame(frame);$('spin').textContent='Start spinning ↻';$('spin').setAttribute('aria-pressed','false');last=0;}
function tick(time){if(!spinning)return;if(last)rotation=mod((rotation+(time-last)/1000*Number($('speed').value))/360)*360;last=time;$('angle').value=Math.round(rotation);$('angle-value').textContent=Math.round(rotation)+'°';draw();frame=requestAnimationFrame(tick);}
document.querySelectorAll('input[name=mode]').forEach(el=>el.addEventListener('change',()=>{
 mode=el.value;stop();$('flat').hidden=mode!=='2d';$('solid').hidden=mode!=='3d';$('spin-controls').hidden=mode!=='3d';$('flat-angle-controls').hidden=mode!=='2d';$('copy').hidden=mode!=='2d';
 $('download').textContent=mode==='2d'?'Download SVG ↗':'Download PNG ↗';$('mode-badge').textContent=mode.toUpperCase();$('format-note').textContent=mode==='2d'?'Transparent SVG. Ready for whatever you’re making.':'A rounded 3D cane. Export the current angle as a transparent PNG.';$('stage-label').textContent=mode==='2d'?'01 / THE ORIGINAL SWEET SPOT':'02 / A WHOLE NEW DIMENSION';render();
}));
for(const id of ids)$(id).addEventListener('input',()=>{if(id==='angle'){stop();rotation=Number($('angle').value);draw();$('angle-value').textContent=rotation+'°';}else if(id==='tilt'){draw();$('tilt-value').textContent=$('tilt').value+'°';}else if(id==='speed')$('speed-value').textContent=$('speed').value+'°/s';else render();});
$('spin').addEventListener('click',()=>{if(spinning)stop();else{spinning=true;$('spin').textContent='Pause spinning';$('spin').setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);}});
let drag=null;
$('solid').addEventListener('pointerdown',e=>{stop();drag={x:e.clientX,a:rotation};$('solid').setPointerCapture(e.pointerId);});
$('solid').addEventListener('pointermove',e=>{if(!drag)return;rotation=mod((drag.a+(e.clientX-drag.x)*.6)/360)*360;$('angle').value=Math.round(rotation);$('angle-value').textContent=Math.round(rotation)+'°';draw();});
for(const event of ['pointerup','pointercancel'])$('solid').addEventListener(event,()=>drag=null);
$('backdrop').addEventListener('input',()=>$('stage').style.background=$('backdrop').value);
const palettes={classic:['#fff5e6','#c83940','#df7b79'],forest:['#fff5e6','#235c4c','#b9c9a2'],sugar:['#fff0f5','#824477','#e59ab1']};
document.querySelectorAll('[data-palette]').forEach(b=>b.addEventListener('click',()=>{['base','stripe','accent'].forEach((id,i)=>$(id).value=palettes[b.dataset.palette][i]);render();}));
$('reset').addEventListener('click',()=>{stop();for(const [id,v]of Object.entries(defaults))$(id)[$(id).type==='checkbox'?'checked':'value']=v;rotation=20;render();});
function save(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('download').addEventListener('click',()=>{if(mode==='2d'){const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));save(url,'candy-cane.svg');setTimeout(()=>URL.revokeObjectURL(url),1000);}else save($('solid').toDataURL('image/png'),'candy-cane-3d.png');$('status').textContent='A little sweetness, ready to go.';});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(svg);$('status').textContent='SVG copied.';}catch{$('status').textContent='Clipboard unavailable. Download the SVG instead.';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
render();
