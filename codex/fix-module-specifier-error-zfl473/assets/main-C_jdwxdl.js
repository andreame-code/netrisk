import{n}from"./navigation-Cu4ZKSea.js";import{s as l}from"./auth-BlUyWSm1.js";import{i as a}from"./theme-CN2ifeDr.js";function r(){a(),[["playBtn","./game.html"],["setupBtn","./setup.html"],["howToPlayBtn","./how-to-play.html"],["aboutBtn","./about.html"]].forEach(([e,t])=>{const o=document.getElementById(e);o&&o.addEventListener("click",()=>n(t))});const i=document.getElementById("multiplayerBtn");i&&i.addEventListener("click",async()=>{let e=null;try{({data:{user:e}={}}=await l.auth.getUser())}catch{e=null}if(e){n("./lobby.html");return}const t=document.createElement("dialog");t.innerHTML=`
        <p>Serve un account per giocare online</p>
        <div>
          <button id="loginDialogBtn">Accedi</button>
          <button id="registerDialogBtn">Registrati</button>
        </div>
      `,document.body.appendChild(t),t.querySelector("#loginDialogBtn")?.addEventListener("click",()=>n("login.html?redirect=lobby.html")),t.querySelector("#registerDialogBtn")?.addEventListener("click",()=>n("register.html?redirect=lobby.html")),t.showModal?t.showModal():t.setAttribute("open","")})}r();
