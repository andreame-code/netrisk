function n(){try{const r=document.referrer;if(!r)return null;const e=new URL(r,window.location.href);if(e.origin===window.location.origin)return e.href}catch{}return null}export{n as g};
