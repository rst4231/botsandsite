const MARKER = 'data-telegram-bot-link-handler';

const SCRIPT = `<script ${MARKER}>(function(){
  document.addEventListener('click',function(event){
    var origin=event.target;
    var link=origin&&origin.closest?origin.closest('a[href^="https://t.me/teachercpa_bot"]'):null;
    if(!link)return;
    var href=link.href;
    link.removeAttribute('target');
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    var telegram=window.Telegram&&window.Telegram.WebApp;
    if(telegram&&typeof telegram.openTelegramLink==='function'){
      telegram.openTelegramLink(href);
      setTimeout(function(){
        try{
          if(typeof telegram.disableClosingConfirmation==='function')telegram.disableClosingConfirmation();
          if(typeof telegram.close==='function'){
            try{telegram.close({return_back:true});}
            catch(_closeOptionsError){telegram.close();}
          }
        }catch(_closeError){}
      },100);
      return;
    }
    var queryIndex=href.indexOf('?');
    var query=queryIndex>=0?href.slice(queryIndex+1).split('#')[0]:'';
    var direct='tg://resolve?domain=teachercpa_bot'+(query?'&'+query:'');
    window.location.assign(direct);
  },true);
})();</script>`;

export function injectTelegramBotLinkHandler(html){
  if(typeof html!=='string'||!html.includes('</head>')||html.includes(MARKER)) return html;
  return html.replace('</head>',`${SCRIPT}</head>`);
}
