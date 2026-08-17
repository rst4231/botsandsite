const zlib=require('node:zlib');
const urls=Array.from({length:7},(_,i)=>`https://raw.githubusercontent.com/rst4231/botsandsite/main/rudi-runtime-20260817/chunk${i}.txt`);
let runtimePromise;
async function runtime(){
  if(!runtimePromise){
    runtimePromise=Promise.all(urls.map(async u=>{
      const r=await fetch(u,{cache:'no-store'});
      if(!r.ok) throw new Error(`runtime chunk HTTP ${r.status}: ${u}`);
      return (await r.text()).trim();
    })).then(parts=>{
      const code=zlib.gunzipSync(Buffer.from(parts.join(''),'base64')).toString('utf8');
      const m={exports:{}};
      new Function('require','module','exports',code)(require,m,m.exports);
      if(typeof m.exports!=='function') throw new Error('RUDI runtime did not export a handler');
      return m.exports;
    });
  }
  return runtimePromise;
}
module.exports=async(req,res)=>{
  try{return await (await runtime())(req,res)}
  catch(e){console.error('RUDI_LOADER_ERROR',e); if(!res.headersSent) return res.status(500).json({ok:false,error:String(e?.message||e)});}
};
