'use strict';
// Library folder tools: save another version of the folder under a name you choose, and rename it
// (Chrome cannot rename a folder in place, so renaming writes a fresh copy under the new name
// and connects to it).
(()=>{
 const $=id=>document.getElementById(id);
 const stamp=()=>{const d=new Date();return String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');};
 const clean=t=>(t||'').replace(/[\\/:*?"<>|]+/g,'').trim();

 // ---- copying ----
 // Unsynced edits live only in memory, so they must reach disk before anything is copied.
 async function settle(){
  if(typeof commit==='function')commit();
  if(dirty&&sync){tell('Syncing before copying\u2026');await flush();}
  if(dirty)throw Error('Changes could not be synced; nothing was copied.');
  if(sync?.conflicts.length)throw Error('Resolve the conflicting entries first.');
 }
 // Connect to the copy and prove the entries came across before reporting success.
 async function switchTo(r,note='',prefix=''){
  const before=data?.rows.length||0;
  // Point "Reconnect saved folder" at the copy before connecting, so it sticks
  // even if connecting fails partway.
  remembered=r.copy;await remember(r.copy);
  await connect(r.copy);
  const after=data?.rows.length||0;
  const head=prefix||`Now working in \u201c${r.name}\u201d (${r.files} file${r.files===1?'':'s'} copied)${note}.`;
  tell(after===before
   ? head+` ${after} entr${after===1?'y':'ies'} carried over.`
   : head+` Warning: the original had ${before} entr${before===1?'y':'ies'} but the copy loaded ${after}. Reconnect the original folder before changing anything.`);
 }

 async function freeName(parent,base){
  let name=base,n=2;
  for(;;){
   try{await parent.getDirectoryHandle(name);}catch(e){if(e.name==='NotFoundError')return name;throw e;}
   name=base+'-'+n++;
  }
 }
 async function copyDir(from,to,count){
  for await(const [name,handle] of from.entries()){
   if(handle.kind==='directory')await copyDir(handle,await to.getDirectoryHandle(name,{create:true}),count);
   else{
    const file=await handle.getFile();
    const w=await (await to.getFileHandle(name,{create:true})).createWritable();
    await w.write(file);await w.close();count.files++;
   }
  }
 }
 async function pickTarget(){
  let target;
  try{target=await window.showDirectoryPicker({id:'library-copy',mode:'readwrite'});}
  catch(e){if(e.name!=='AbortError')tell('Folder error: '+e.message);return null;}
  if((await target.queryPermission({mode:'readwrite'}))!=='granted'
   &&(await target.requestPermission({mode:'readwrite'}))!=='granted'){tell('No permission to write to that folder.');return null;}
  if(await target.isSameEntry?.(dir)){tell('Choose a folder other than the library itself.');return null;}
  return target;
 }
 async function copyInto(target,base){
  await settle();
  tell('Copying the library\u2026');
  const name=await freeName(target,base);
  const copy=await target.getDirectoryHandle(name,{create:true});
  const count={files:0};
  await copyDir(dir,copy,count);
  return {target,copy,name,files:count.files};
 }

 // The folder picker needs a live user gesture, so it opens first — before any prompt or sync.
 async function startCopy(defaultName){
  if(!dir){tell('Choose a library folder first.');return;}
  const target=await pickTarget();if(!target)return;
  const wanted=clean(prompt('Name for the new folder in “'+target.name+'”:',defaultName)||'');
  if(!wanted){tell('Cancelled. Nothing was copied.');return;}
  const r=await copyInto(target,wanted);
  await switchTo(r,r.name===wanted?'':` (“${wanted}” already existed there)`);
 }

 $('copy-folder').onclick=()=>startCopy(clean(dir?.name||'library')+'-'+stamp())
  .catch(e=>tell(e.name==='AbortError'?'Cancelled.':'Copy failed: '+e.message));

 $('rename-folder').onclick=()=>{
  if(!dir){tell('Choose a library folder first.');return;}
  const oldName=dir.name;
  startCopy(oldName)
   .then(()=>{if(dir&&dir.name!==oldName)tell($('status').textContent+` Delete the old “${oldName}” folder yourself once you have checked it.`);})
   .catch(e=>tell(e.name==='AbortError'?'Cancelled.':'Rename failed: '+e.message));
 };

})();
