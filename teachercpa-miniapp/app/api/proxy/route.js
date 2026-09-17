import {injectTelegramBotLinkHandler} from './telegram-link-handler.js';
import {getVercelOidcToken} from '@vercel/oidc';
const TARGET='https://teachercpa-miniapp-1ygj2f14d-cpateammail-4892s-projects.vercel.app';
async function proxy(request){
  const url=new URL(request.url);
  const path=url.searchParams.get('__proxy_path')||'';
  url.searchParams.delete('__proxy_path');
  const target=new URL('/'+path,TARGET);
  url.searchParams.forEach((value,key)=>target.searchParams.append(key,value));
  const headers=new Headers(request.headers);
  headers.delete('host');
  const oidc=await getVercelOidcToken();
  if(oidc) headers.set('x-vercel-trusted-oidc-idp-token',oidc);
  const init={method:request.method,headers,redirect:'manual'};
  if(request.method!=='GET'&&request.method!=='HEAD') init.body=await request.arrayBuffer();
  const upstream=await fetch(target,init);
  const responseHeaders=new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  const contentType=upstream.headers.get('content-type')||'';
  if(request.method==='GET'&&contentType.includes('text/html')){
    const html=await upstream.text();
    return new Response(injectTelegramBotLinkHandler(html),{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
  }
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
}
export const GET=proxy;export const POST=proxy;export const PUT=proxy;export const PATCH=proxy;export const DELETE=proxy;export const OPTIONS=proxy;export const HEAD=proxy;
