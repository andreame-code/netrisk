import{n}from"./config-VUvQXQsa.js";import{c as r}from"./auth-CCLs5HSR.js";import{i as a}from"./theme-CN2ifeDr.js";function c({authPort:l}){a(),[["playBtn","./game.html"],["setupBtn","./setup.html"],["howToPlayBtn","./how-to-play.html"],["aboutBtn","./about.html"]].forEach(([e,t])=>{const i=document.getElementById(e);i&&i.addEventListener("click",()=>n(t))});const o=document.getElementById("multiplayerBtn");o&&o.addEventListener("click",async()=>{let e=null;try{e=await l.currentUser({})}catch{e=null}if(e){n("./lobby.html");return}const t=document.createElement("dialog");t.innerHTML=`
        <p>Serve un account per giocare online</p>
        <div>
          <button id="loginDialogBtn">Accedi</button>
          <button id="registerDialogBtn">Registrati</button>
        </div>
      `,document.body.appendChild(t),t.querySelector("#loginDialogBtn")?.addEventListener("click",()=>n("login.html?redirect=lobby.html")),t.querySelector("#registerDialogBtn")?.addEventListener("click",()=>n("register.html?redirect=lobby.html")),t.showModal?t.showModal():t.setAttribute("open","")})}const d=r();c({authPort:d});
