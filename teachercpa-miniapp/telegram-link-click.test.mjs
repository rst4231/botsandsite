import assert from 'node:assert/strict';
import vm from 'node:vm';
import { injectTelegramBotLinkHandler } from './app/api/proxy/telegram-link-handler.js';

function extractScript(html){
  const match=html.match(/<script data-telegram-bot-link-handler>([\s\S]*?)<\/script>/);
  assert.ok(match,'injected script should exist');
  return match[1];
}

const html=injectTelegramBotLinkHandler('<html><head></head><body></body></html>');
const script=extractScript(html);

let clickHandler;
const document={
  addEventListener(type,handler,capture){
    assert.equal(type,'click');
    assert.equal(capture,true);
    clickHandler=handler;
  },
  querySelectorAll(){ return []; },
  documentElement:{}
};

let opened=null;
let assigned=null;
let closed=0;
let closeArg;
let disabledClosingConfirmation=0;
let queued=[];
const window={
  Telegram:{WebApp:{
    openTelegramLink(url){opened=url;},
    disableClosingConfirmation(){disabledClosingConfirmation+=1;},
    close(arg){closed+=1;closeArg=arg;}
  }},
  location:{assign(url){assigned=url;}}
};
const MutationObserver=class { observe(){} };
function setTimeoutStub(fn,delay){ queued.push({fn,delay}); return queued.length; }
vm.runInNewContext(script,{document,window,MutationObserver,setTimeout:setTimeoutStub});
assert.equal(typeof clickHandler,'function');

const href='https://t.me/teachercpa_bot?start=abc';
let prevented=false;
let stopped=false;
let immediateStopped=false;
const link={href,target:'_blank',removeAttribute(name){ if(name==='target') this.target=''; }};
const event={
  target:{closest(selector){
    assert.equal(selector,'a[href^="https://t.me/teachercpa_bot"]');
    return link;
  }},
  preventDefault(){prevented=true;},
  stopPropagation(){stopped=true;},
  stopImmediatePropagation(){immediateStopped=true;}
};
clickHandler(event);
assert.equal(opened,href);
assert.equal(closed,0,'close must not be sent in the same native bridge tick as openTelegramLink');
assert.equal(queued.length,1,'close should be queued separately');
assert.ok(queued[0].delay>=50,'close should be delayed enough for Telegram to process the deep link first');
queued[0].fn();
assert.equal(disabledClosingConfirmation,1);
assert.equal(closed,1);
assert.equal(closeArg && closeArg.return_back,true);
assert.equal(assigned,null);
assert.equal(prevented,true);
assert.equal(stopped,true);
assert.equal(immediateStopped,true);
assert.equal(link.target,'','Telegram bot link must not retain target=_blank');

opened=null;
assigned=null;
closed=0;
queued=[];
window.Telegram=undefined;
clickHandler(event);
assert.equal(opened,null);
assert.equal(closed,0);
assert.equal(queued.length,0);
assert.equal(assigned,'tg://resolve?domain=teachercpa_bot&start=abc','desktop browser should launch Telegram directly instead of visiting t.me');

prevented=false;
stopped=false;
immediateStopped=false;
const otherEvent={
  target:{closest(){return null;}},
  preventDefault(){prevented=true;},
  stopPropagation(){stopped=true;},
  stopImmediatePropagation(){immediateStopped=true;}
};
clickHandler(otherEvent);
assert.equal(prevented,false);
assert.equal(stopped,false);
assert.equal(immediateStopped,false);
