(function(){"use strict";const ze="gemini-folders-injector-host",$e="geminiFoldersData",Mt=['button[data-test-id="delete-button"]','button[aria-label*="delete"]','button:contains("Delete")',"button.delete-btn"],At=['button[data-test-id="confirm-button"]','button:contains("Delete")','button:contains("Confirm")','button[aria-label*="confirm"]',"button.confirm-btn"],Ft=['button[data-test-id="actions-menu-button"]','button[aria-label*="actions"]','button[aria-label*="menu"]',"button.menu-button","button.actions-button"],Pt=["div.cdk-overlay-container",'[role="dialog"]',".modal-container",".overlay-container"];let z=null,g=null,ke="light",ge=!1,_e,C={folders:[],chatMetadata:{},settings:{hideFolderedChats:!1},selectedItems:[],modalType:null};function Lo(){return("10000000-1000-4000-8000"+-1e11).replace(/[018]/g,e=>(e^crypto.getRandomValues(new Uint8Array(1))[0]&15>>e/4).toString(16))}function Nt(e){return new Promise(t=>setTimeout(t,e))}function qt(e,t){let o;return function(...r){const a=()=>{clearTimeout(o),e(...r)};clearTimeout(o),o=setTimeout(a,t)}}function To(e){if(!e)return e;const t=e.toString();return t.indexOf("T")!==-1?new Date(e).getTime():t.indexOf(".")!==-1&&t.split(".")[0].length===10?new Date(e*1e3).getTime():t.indexOf(".")!==-1&&t.split(".")[0].length===13?new Date(e).getTime():t.length===13?new Date(e).getTime():t.length===10?new Date(e*1e3).getTime():e}function Io(e){if(!e)return e;const t=new Date,o=new Date;o.setDate(o.getDate()-1);const n=t.getDate(),r=t.getMonth()+1,a=t.getFullYear(),i=e.getDate(),c=e.getMonth()+1,l=e.getFullYear();return n===i&&r===c&&a===l?`Today ${e.toLocaleTimeString("en-US",{hour:"numeric",minute:"numeric"})}`:o.getDate()===i&&o.getMonth()+1===c&&o.getFullYear()===l?`Yesterday ${e.toLocaleTimeString("en-US",{hour:"numeric",minute:"numeric"})}`:`${e.toLocaleDateString("en-US",{year:"2-digit",month:"2-digit",day:"2-digit"})} ${e.toLocaleTimeString("en-US",{hour:"numeric",minute:"numeric"})}`}const re=(function(){const t=new Map,o=new Set;function n(l){for(const[d,p]of t.entries())l-p>1e4&&t.delete(d)}function r(l,d){try{let p="";return d&&(d.correlationId&&(p+=`|corr:${d.correlationId}`),d.plan&&(p+=`|plan:${d.plan}`),d.feature&&(p+=`|feat:${d.feature}`),d.fromVersion&&d.toVersion&&(p+=`|ver:${d.fromVersion}->${d.toVersion}`)),p||(p=`|v:${typeof CONFIG<"u"&&CONFIG.VERSION?CONFIG.VERSION:"unknown"}`),`${l}${p}`}catch{return l}}function a(l){const d={};for(const p in l||{}){if(!Object.prototype.hasOwnProperty.call(l,p)||p.toLowerCase().includes("email")||p.toLowerCase().includes("code"))continue;const h=l[p];typeof h=="string"?d[p]=h.slice(0,200):d[p]=h}return d}async function i(){let l=null;try{l=(await chrome.storage?.local?.get("gt_install_id"))?.gt_install_id||null}catch{}let d=null;try{d=window.geminiAPI?.getUserInfo?.().userId||null}catch{}let p=null;try{p=window.geminiAPI?.getPlan?.()||null}catch{}const h=typeof CONFIG<"u"&&CONFIG.VERSION?CONFIG.VERSION:null,b=navigator.userAgentData?.brands?.[0]?.brand||navigator.userAgent||"unknown";let I="unknown";try{I=typeof xe=="function"?xe():"unknown"}catch{}return{installId:l,userId:d,plan:p,extVersion:h,schemaVersion:1,platform:b,pageTheme:I,ts:Date.now()}}async function c(l,d={}){try{if(!CONFIG?.FEATURES?.trackAnalytics||!window?.geminiAPI?.trackEvent)return;const p=r(l,d),h=Date.now();if(n(h),t.has(p)||o.has(p))return;o.add(p);const I={...await i(),...a(d)};I.eventId=typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():`${h}-${Math.random().toString(36).slice(2)}`,await window.geminiAPI.trackEvent(l,I),t.set(p,h),o.delete(p)}catch{}}return{track:c}})();function He(e,t){e&&(t?(e.classList.add("loading"),e.disabled=!0,e.dataset.originalText=e.textContent):(e.classList.remove("loading"),e.disabled=!1,e.dataset.originalText&&(e.textContent=e.dataset.originalText,delete e.dataset.originalText)))}function Mo(e,t="Success!"){if(!e)return;e.classList.remove("loading"),e.classList.add("success");const o=e.textContent;e.textContent=t,setTimeout(()=>{e.classList.remove("success"),e.textContent=o,e.disabled=!1},2e3)}function Ao(e,t="Error"){if(!e)return;e.classList.remove("loading"),e.classList.add("error");const o=e.textContent;e.textContent=t,setTimeout(()=>{e.classList.remove("error"),e.textContent=o,e.disabled=!1},2e3)}function Y(e,t="success"){document.querySelectorAll(".prompt-toast").forEach(i=>i.remove()),g&&g.querySelectorAll(".prompt-toast").forEach(c=>c.remove());const n=document.getElementById("gt-fallback-toast-container");n&&n.querySelectorAll(".prompt-toast").forEach(c=>c.remove());const r=document.createElement("div");r.className=`prompt-toast ${t}`,r.textContent=e,r.setAttribute("role","status"),r.setAttribute("aria-live","polite"),Ye().appendChild(r),requestAnimationFrame(()=>{r.classList.add("show")}),setTimeout(()=>{r.classList.remove("show"),setTimeout(()=>r.remove(),300)},3e3)}try{window.showToast=Y}catch{}function Dt(e,t,o,n="info"){document.querySelectorAll(".prompt-toast").forEach(p=>p.remove()),g&&g.querySelectorAll(".prompt-toast").forEach(h=>h.remove());const a=document.getElementById("gt-fallback-toast-container");a&&a.querySelectorAll(".prompt-toast").forEach(h=>h.remove());const i=document.createElement("div");i.className=`prompt-toast ${n}`,i.setAttribute("role","status"),i.setAttribute("aria-live","polite");const c=document.createElement("span");c.textContent=e;const l=document.createElement("button");l.className="toast-action",l.type="button",l.textContent=t||"Action",l.addEventListener("click",()=>{try{o&&o()}catch{}i.classList.remove("show"),setTimeout(()=>i.remove(),200)}),i.appendChild(c),i.appendChild(l),Ye().appendChild(i),requestAnimationFrame(()=>{i.classList.add("show")}),setTimeout(()=>{i.classList.remove("show"),setTimeout(()=>i.remove(),300)},5e3)}try{window.showToastWithAction=Dt}catch{}function j(e){Y(e,"error")}function Fo(e,t="info"){Y(e,t)}let he=null,be=null;function Ye(){if(be&&document.body.contains(be))return be;if(be=document.createElement("div"),be.id="gt-fallback-toast-container",document.body.appendChild(be),!document.getElementById("gt-fallback-toast-styles")){const e=document.createElement("style");e.id="gt-fallback-toast-styles",e.textContent=`
                /* Dark mode toast styles (default) */
                .prompt-toast { 
                    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(100px);
                    background: #131314; color: #e3e3e3; padding: 14px 20px; border-radius: 24px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
                    font-size: 14px; font-weight: 400; line-height: 20px;
                    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                    z-index: 2147483647; opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    max-width: 90vw; min-width: 200px;
                    display: inline-flex; align-items: center; gap: 12px;
                }
                .prompt-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
                .prompt-toast.success { background: #131314; color: #e3e3e3; }
                .prompt-toast.error   { background: #131314; color: #f28b82; }
                .prompt-toast.info    { background: #131314; color: #e3e3e3; }
                .prompt-toast .toast-action {
                    background: transparent;
                    color: #8ab4f8;
                    border: none;
                    border-radius: 20px;
                    padding: 6px 16px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    margin-left: 4px;
                    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                    transition: background 0.2s ease;
                }
                .prompt-toast .toast-action:hover {
                    background: rgba(138, 180, 248, 0.08);
                }
                .prompt-toast .toast-action:active {
                    background: rgba(138, 180, 248, 0.16);
                }
                
                /* Light mode toast styles */
                body.light-theme .prompt-toast,
                body[data-theme="light"] .prompt-toast,
                .light-mode .prompt-toast {
                    background: #ffffff;
                    color: #3c4043;
                    box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 1px 2px rgba(60,64,67,0.15);
                }
                body.light-theme .prompt-toast.success,
                body[data-theme="light"] .prompt-toast.success,
                .light-mode .prompt-toast.success,
                body.light-theme .prompt-toast.info,
                body[data-theme="light"] .prompt-toast.info,
                .light-mode .prompt-toast.info {
                    background: #ffffff;
                    color: #3c4043;
                }
                body.light-theme .prompt-toast.error,
                body[data-theme="light"] .prompt-toast.error,
                .light-mode .prompt-toast.error {
                    background: #ffffff;
                    color: #d33333;
                }
                body.light-theme .prompt-toast .toast-action,
                body[data-theme="light"] .prompt-toast .toast-action,
                .light-mode .prompt-toast .toast-action {
                    color: #1a73e8;
                }
                body.light-theme .prompt-toast .toast-action:hover,
                body[data-theme="light"] .prompt-toast .toast-action:hover,
                .light-mode .prompt-toast .toast-action:hover {
                    background: rgba(26, 115, 232, 0.08);
                }
                body.light-theme .prompt-toast .toast-action:active,
                body[data-theme="light"] .prompt-toast .toast-action:active,
                .light-mode .prompt-toast .toast-action:active {
                    background: rgba(26, 115, 232, 0.16);
                }
            `,document.head.appendChild(e)}return be}function nt(){if(he)return;he=document.createElement("div"),he.className="processing-overlay",he.innerHTML=`
            <div class="processing-content">
                <div class="spinner"></div>
                <div class="processing-text">Processing payment...</div>
                <div class="processing-subtext">This may take up to 30 seconds</div>
            </div>
        `;const e=document.createElement("style");e.textContent=`
            .processing-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                animation: fadeIn 0.3s ease-in;
            }
            
            .processing-content {
                background: var(--surface-color, white);
                border-radius: 12px;
                padding: 32px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }
            
            .spinner {
                width: 48px;
                height: 48px;
                border: 3px solid var(--border-color, #e0e0e0);
                border-top-color: #4285f4;
                border-radius: 50%;
                margin: 0 auto 16px;
                animation: spin 1s linear infinite;
            }
            
            .processing-text {
                color: var(--text-primary, #202124);
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 8px;
            }
            
            .processing-subtext {
                color: var(--text-secondary, #5f6368);
                font-size: 14px;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `,g.appendChild(e),g.appendChild(he)}function rt(){he&&(he.remove(),he=null)}function Po(e,t){const o=d=>{const p=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(d);return p?{r:parseInt(p[1],16),g:parseInt(p[2],16),b:parseInt(p[3],16)}:null},n=d=>{const[p,h,b]=[d.r,d.g,d.b].map(I=>(I=I/255,I<=.03928?I/12.92:Math.pow((I+.055)/1.055,2.4)));return .2126*p+.7152*h+.0722*b},r=o(e),a=o(t);if(!r||!a)return!1;const i=n(r),c=n(a);return(Math.max(i,c)+.05)/(Math.min(i,c)+.05)>=4.5}function Oe(e){return new Promise(t=>setTimeout(t,e))}function Be(e,t=document){if(!t)return null;for(const o of e)try{const n=t.querySelector(o);if(n)return n}catch{}return null}function at(e,t=document,o=7e3){return new Promise((n,r)=>{const a=Be(e,t);if(a&&a.offsetParent!==null&&!a.disabled)return n(a);let i=0;const c=150,l=setInterval(()=>{i+=c;const d=Be(e,t);d&&d.offsetParent!==null&&!d.disabled?(clearInterval(l),n(d)):i>=o&&(clearInterval(l),r(new Error(`Element not actionable within ${o}ms`)))},c)})}async function it(){try{window.geminiStorage||(window.geminiStorage=new GeminiToolboxStorage,await window.geminiStorage.initialize());const e=window.geminiStorage.getAllFolders(),t=window.geminiStorage.getSettings(),o=window.geminiStorage.state.chatMetadata||{};C.chatMetadata=o,C.folders=e.map(n=>({id:n.id,name:n.name,chatIds:n.chatIds||[],parentId:n.parentId||null,createdAt:n.createdAt,updatedAt:n.updatedAt})),C.settings=t}catch{try{const t=await chrome.storage.local.get($e);C.folders=t[$e]?.folders||[],C.settings=t[$e]?.settings||{hideFolderedChats:!1},C.folders.length>0}catch{C.folders=[],C.settings={hideFolderedChats:!1}}}}function No(){}async function Ce(){try{if(!chrome.runtime?.id)return;window.geminiStorage||(window.geminiStorage=new GeminiToolboxStorage,await window.geminiStorage.initialize()),await window.geminiStorage.updateSettings(C.settings);for(const o of C.folders)window.geminiStorage.getFolder(o.id)?await window.geminiStorage.updateFolder(o.id,{name:o.name,chatIds:o.chatIds,parentId:o.parentId}):(window.geminiStorage.state.folders[o.id]={id:o.id,name:o.name,chatIds:o.chatIds||[],parentId:o.parentId||null,createdAt:o.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()},o.chatIds&&o.chatIds.forEach(r=>{window.geminiStorage.state.chatFolderMapping[r]=o.id}));const e=new Set(C.folders.map(o=>o.id)),t=Object.keys(window.geminiStorage.state.folders);for(const o of t)e.has(o)||await window.geminiStorage.deleteFolder(o);await window.geminiStorage.saveState()}catch(e){if(e.message?.includes("Extension context invalidated"))return;try{if(!chrome.runtime?.id)return;const t={folders:C.folders,settings:C.settings};await chrome.storage.local.set({[$e]:t})}catch(t){t.message?.includes("Extension context invalidated"),g&&j("Failed to save folder data. Changes may be lost.")}}}function V(e){if(!e)return null;const t=e.getAttribute("jslog");if(t){const n=t.match(/BardVeMetadataKey:\[[^\]]*\["([^"]+)"/);if(n&&n[1])return n[1]}const o=e.getAttribute("data-test-id");return o&&o.startsWith("conversation_c_")?o.substring(13):null}function U(){return Array.from(document.querySelectorAll('conversations-list [data-test-id="conversation"]'))}function zt(e){if(!e)return!1;if(e.querySelector('mat-icon[fonticon="push_pin"], .conversation-pin-icon'))return!0;const o=e.querySelector(".cdk-visually-hidden");if(o&&o.textContent&&o.textContent.toLowerCase().includes("pinned"))return!0;const n=e.getAttribute("jslog");return!!(n&&n.match(/\["[^"]+",null,1\]/))}function qo(e){if(!e||e.length<7)return"var(--gf-text-primary)";const t=parseInt(e.slice(1,3),16),o=parseInt(e.slice(3,5),16),n=parseInt(e.slice(5,7),16);return(t*299+o*587+n*114)/1e3>155?"#000000":"#FFFFFF"}function xe(){const e=document.body,t=document.documentElement;if(e.classList.contains("dark-theme")||e.classList.contains("dark_mode_toggled")||e.classList.contains("dark-mode")||e.classList.contains("dark"))return"dark";if(e.classList.contains("light-theme")||e.classList.contains("light-mode")||e.classList.contains("light"))return"light";const o=t.getAttribute("data-theme");if(o==="dark")return"dark";if(o==="light")return"light";const n=window.getComputedStyle(e).backgroundColor;if(n&&n!=="rgba(0, 0, 0, 0)"&&n!=="transparent"){const r=n.match(/\d+/g);if(r&&r.length>=3)return(parseInt(r[0])*299+parseInt(r[1])*587+parseInt(r[2])*114)/1e3<128?"dark":"light"}return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function $t(){if(!g)return;const e=document.createElement("style");if(e.textContent=`
            :host { 
                /* Active theme variables - will be dynamically updated */
                --gf-bg-primary: #272A2C;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                --gf-bg-secondary: #1E2124;
                --gf-text-primary: #E3E3E3;
                --gf-text-secondary: #C2C2C2;
                --gf-border-color: #404040;
                --gf-hover-bg: #3A3D40;
                --gf-accent-primary: #8AB4F8;
                --gf-accent-danger: #F28B82;
                --gf-accent-success: #34A853;
                --gf-accent-warning: #FFA726;
                --gf-bg-input: #1E2124;
                
                /* Overlays and Shadows */
                --gf-overlay-bg: rgba(0, 0, 0, 0.6);
                --gf-overlay-bg-medium: rgba(0, 0, 0, 0.5);
                --gf-overlay-bg-light: rgba(0, 0, 0, 0.3);
                --gf-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
                --gf-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
                --gf-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
                --gf-shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.4);
                --gf-text-tertiary: #9CA3AF;
                --gf-white: #FFFFFF;
                
                /* ONE MODAL SHELL TO RULE THEM ALL */
                --modal-width: 560px;
                --modal-radius: 12px;
                --modal-padding: 32px;
                --modal-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
                --modal-footer-gap: 24px;
                
                /* Animation System */
                --anim-instant: 50ms;
                --anim-fast: 150ms;
                --anim-normal: 200ms;
                --anim-medium: 300ms;
                --anim-slow: 500ms;
                --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
                --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
                --ease-elastic: cubic-bezier(0.34, 1.56, 0.64, 1);
                
                /* TYPOGRAPHY & COLOR HIERARCHY */
                --title-size: 20px;
                --title-weight: 500;  /* Standardized from 600 */
                --title-top-padding: 24px;
                --body-size: 14px;
                --body-weight: 400;
                --button-size: 14px;
                --button-weight: 500;
                
                /* Typography System */
                --font-size-h2: 20px;
                --font-size-h3: 16px;
                --font-size-h4: 14px;
                --font-size-body: 14px;
                --font-size-small: 13px;
                --font-size-tiny: 12px;
                --font-size-badge: 11px;
                --font-weight-normal: 400;
                --font-weight-medium: 500;
                --font-weight-semibold: 600;
                
                /* LISTS: ONE ROW SPEC */
                --row-height: var(--space-12);
                --row-padding: var(--space-3) var(--space-4);
                --list-border: #E2E8F0;
                --hover-bg-subtle: rgba(0, 0, 0, 0.04);
                
                /* Spacing System (8-point grid) */
                --space-0: 0px;
                --space-1: 4px;   /* Minimal */
                --space-2: 8px;   /* Tight */
                --space-3: 12px;  /* Compact */
                --space-4: 16px;  /* Default */
                --space-5: 20px;  /* Medium */
                --space-6: 24px;  /* Large */
                --space-8: 32px;  /* Extra large */
                --space-10: 40px; /* Huge */
                --space-12: 48px; /* Massive */
                --space-16: 64px; /* Giant */
                
                /* Component-specific spacing */
                --modal-header-padding: var(--space-6) var(--space-6) var(--space-4) var(--space-6);
                --modal-body-padding: 0 var(--space-6) var(--space-6) var(--space-6);
                --modal-footer-padding: var(--space-4) var(--space-6) var(--space-6) var(--space-6);
                --button-padding-x: var(--space-6);
                --button-padding-y: var(--space-3);
                --button-padding-small: var(--space-2) var(--space-4);
                --input-padding: var(--space-3) var(--space-4);
                --gap-small: var(--space-2);
                --gap-medium: var(--space-3);
                --gap-large: var(--space-4);
                --gap-xl: var(--space-6);
                
                /* FOOTER GRID & BUTTONS */
                --btn-primary-min: 100px;
                --btn-secondary-min: 100px;
                --btn-gap: 8px;
                
                /* INTERACTION STATES */
                --focus-ring: 0 0 0 2px var(--gf-accent-primary);
                --animation-duration: var(--anim-fast);
                --disabled-opacity: 0.6;
                --hover-opacity: 0.9;
                
                /* CLOSE BUTTON */
                --close-btn-size: 32px;
                --close-btn-padding: 8px;
            }
            .sidebar-tab { 
                display: flex; align-items: center; gap: var(--gap-medium);
                padding: 10px; margin: 4px 0; border-radius: var(--space-2);
                cursor: pointer; font-size: 14px; color: var(--gf-text-primary);
                position: relative;
            }
            /* Full-row hover for the banner, and keep highlighted while menu is open */
            .sidebar-tab:hover,
            .sidebar-tab:has(#gemini-toolbox-btn[aria-expanded="true"]) {
                background-color: var(--gf-hover-bg);
                border-radius: var(--space-2);
            }

            /* Gemini Toolbox Button and Dropdown */
.toolbox-button {
                display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;
                width: 100%; padding: 0; border: none; background: none;
                cursor: pointer; font-size: 14px; color: var(--gf-text-primary);
            }
.toolbox-button:hover { background: transparent; }
.toolbox-button:focus {
                outline: none;
                box-shadow: inset 0 0 0 2px var(--gf-accent-primary);
            }
            /* Hide banner focus ring while menu is expanded */
            .toolbox-button[aria-expanded="true"] {
                box-shadow: none !important;
            }
            .toolbox-button:focus:not(:focus-visible) {
                box-shadow: none;
            }

            .dropdown-arrow {
                margin-left: auto;
                transition: transform var(--anim-normal) var(--ease-out);
            }
            .dropdown-arrow.rotated {
                transform: rotate(180deg);
            }

            .toolbox-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                min-width: 200px;
                background-color: var(--gf-bg-primary);
                border: 1px solid var(--gf-border-color);
                border-radius: var(--space-2);
                margin-top: 4px;
                padding: 4px 0;
                box-shadow: 
                    var(--gf-shadow-md),
                    var(--gf-shadow-sm),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
                z-index: 2147483647;
                max-height: 60vh;
                overflow-y: auto;
                opacity: 0;
                transform: translateY(-8px);
                transition: 
                    opacity var(--anim-fast) var(--ease-out),
                    transform var(--anim-fast) var(--ease-out),
                    box-shadow var(--anim-fast) var(--ease-out);
                pointer-events: none;
            }
            .toolbox-dropdown.show {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

            
            /* Responsive dropdown adjustments */
            @media (max-width: 400px) {
                .toolbox-dropdown {
                    min-width: 180px;
                    font-size: 14px;
                }
                
                .dropdown-item {
                    padding: 12px 14px;
                }
                
                .dropdown-shortcut {
                    display: none;
                }
            }

            .dropdown-group {
                padding: 0;
            }
            .dropdown-group-label {
                padding: var(--space-2) var(--space-4) 6px var(--space-4);
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--gf-text-tertiary);
                opacity: 1;
                min-height: 32px;
                display: flex;
                align-items: center;
            }
            .dropdown-divider {
                height: 1px;
                background-color: var(--gf-border-color);
                margin: 4px 0;
                opacity: 0.2;
            }
            .dropdown-item {
                display: grid;
                grid-template-columns: 16px 1fr auto auto;
                align-items: center;
                gap: 6px;
                padding: var(--space-3) var(--space-4);
                cursor: pointer;
                color: var(--gf-text-primary);
                font-size: 13px;
                transition: background-color var(--anim-fast) var(--ease-out), transform var(--anim-instant) var(--ease-out);
                position: relative;
                min-height: 48px;
                box-sizing: border-box;
            }
            .dropdown-item:hover {
                background-color: var(--gf-hover-bg);
                transition: background-color var(--anim-instant) var(--ease-out);
            }
            .dropdown-item:focus {
                outline: none;
                background-color: var(--gf-hover-bg);
                box-shadow: inset 0 0 0 2px var(--gf-accent-primary);
            }
            .dropdown-item:focus:not(:focus-visible) {
                box-shadow: none;
            }
            .dropdown-item:active {
                transform: scale(0.98);
                background-color: var(--gf-active-bg, rgba(255, 255, 255, 0.1));
                transition: transform var(--anim-instant) var(--ease-out);
            }
            .dropdown-icon {
                opacity: 0.7;
                transition: opacity var(--anim-normal) var(--ease-out);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
            }
            .dropdown-item:hover .dropdown-icon {
                opacity: 1;
            }
            .dropdown-item.destructive {
                color: var(--gf-accent-danger);
            }
            .dropdown-item.destructive .dropdown-icon {
                color: var(--gf-accent-danger);
            }
            .dropdown-item.destructive:hover {
                background-color: rgba(255, 101, 101, 0.1);
            }
            .dropdown-group:first-child .dropdown-item:first-of-type {
                padding-top: 6px;
            }
            .dropdown-badge {
                margin-left: auto;
                margin-right: var(--space-2);
                padding: 2px 6px;
                font-size: 11px;
                font-weight: 600;
                background-color: var(--gf-badge-bg, rgba(255, 255, 255, 0.1));
                color: var(--gf-text-secondary);
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
                display: none;
            }
            .dropdown-badge:not(:empty) {
                display: inline-block;
            }
            .dropdown-shortcut {
                margin-left: 8px;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: var(--font-weight-medium);
                font-family: 'SF Mono', 'Roboto Mono', 'Menlo', monospace;
                background-color: var(--gf-keycap-bg, rgba(255, 255, 255, 0.05));
                color: var(--gf-text-tertiary);
                border: 1px solid var(--gf-keycap-border, rgba(255, 255, 255, 0.06));
                border-radius: 2px;
                letter-spacing: 0.2px;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 16px;
                box-sizing: border-box;
            }
            .dropdown-badge:empty + .dropdown-shortcut {
                margin-left: auto;
            }
            
            /* Responsive adjustments for narrow sidebars */
            /* Mobile Touch Target Improvements */
            @media (hover: none) and (pointer: coarse) {
                /* Increase touch targets for mobile */
                .button, .primary, .secondary, .danger {
                    min-height: 48px;
                    min-width: 48px;
                }
                
                .icon-btn, .modal-close {
                    width: 48px;
                    height: 48px;
                }
                
                .dropdown-item {
                    min-height: 48px;
                    padding: var(--input-padding);
                }
                
                .list-item {
                    min-height: 56px;
                }
                
                input[type="text"], input[type="search"] {
                    min-height: 48px;
                    font-size: 16px; /* Prevent zoom on iOS */
                }
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .gemini-modal-content {
                    width: 95%;
                    max-width: none;
                    max-height: 90vh;
                    margin: 10px;
                }
                
                .modal-header {
                    padding: 16px 16px 12px 16px;
                }
                
                .modal-body {
                    padding: var(--space-4);
                }
                
                .modal-footer {
                    padding: 12px 16px 16px 16px;
                    flex-wrap: wrap;
                    gap: 8px;
                    min-height: 64px;
                }
                
                .modal-footer button {
                    flex: 1;
                    min-width: 100px;
                }
                
                /* Stack buttons on very small screens */
                @media (max-width: 480px) {
                    .modal-footer {
                        flex-direction: column;
                    }
                    
                    .modal-footer button {
                        width: 100%;
                    }
                }
            }
            
            @media (max-width: 320px) {
                .dropdown-shortcut {
                    display: none;
                }
                .dropdown-item span {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* Reduce font sizes on very small screens */
                .modal-header h2 {
                    font-size: var(--text-lg);
                }
                
                .button {
                    font-size: 13px;
                    padding: 10px 16px;
                    min-height: 40px;
                }
            }

            /* Modal Backdrop - Lighter opacity for better context */
            .infi-chatgpt-modal {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: var(--gf-overlay-bg-medium);
                z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(2px); /* Subtle blur for context */
                opacity: 0;
                animation: modalFadeIn 140ms ease-out forwards;
            }
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            .infi-chatgpt-modal.closing {
                animation: modalFadeOut 90ms ease-in forwards;
            }
            @keyframes modalFadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }

            /* Blocking Modal - Stronger overlay for operations in progress */
            .infi-chatgpt-modal.modal-blocking {
                background-color: var(--gf-overlay-bg);
                backdrop-filter: blur(4px);
                cursor: wait;
            }
            
            .infi-chatgpt-modal.modal-blocking .modal-content {
                pointer-events: auto;
            }

            /* Modal Content Box - ONE MODAL SHELL TO RULE THEM ALL */
            .modal-content {
                width: var(--modal-width);
                background-color: var(--gf-bg-secondary);
                border-radius: var(--modal-radius);
                border: 1px solid var(--gf-border-color);
                box-shadow: var(--modal-shadow);
                color: var(--gf-text-primary);
                display: flex; flex-direction: column;
                max-height: 80vh;
                transform: scale(0.98);
                animation: modalScaleIn 140ms ease-out forwards;
            }
            
            /* Fixed size for manage-single-folder modal for premium feel */
            #manage-single-folder-modal .modal-content,
            .modal-content.modal-manage-single-folder-modal {
                width: 640px !important;
                min-height: 480px !important;
                max-height: 72vh !important;
                display: flex !important;
                flex-direction: column !important;
            }
            
            #manage-single-folder-modal .modal-body {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                min-height: 0 !important;
            }
            
            /* Ensure non-prompt-library modals maintain their original size */
            .modal-content.modal-add-folder-modal,
            .modal-content.modal-edit-folder-modal,
            .modal-content.modal-delete-folder-modal {
                min-height: auto !important;
                height: auto !important;
            }
            
            /* Add chats modal needs more vertical space */
            .modal-content.modal-add-chats-modal {
                min-height: auto !important;
                height: auto !important;
                max-height: 90vh !important;
            }
            
            /* Reduce padding for add chats modal to maximize chat list space */
            #add-chats-modal .modal-body {
                padding: 12px 24px !important;
                gap: 8px !important;
            }
            
            .modal-content.modal-upgrade-modal {
                min-height: auto !important;
                height: auto !important;
                max-height: 90vh !important;
                max-width: 650px !important;
                background: var(--gf-bg-primary) !important;
            }
            
            .modal-upgrade-modal .button.button-ghost {
                background: transparent;
                border: none;
                color: var(--gf-text-tertiary);
                transition: opacity 0.2s;
            }
            
            .modal-upgrade-modal .button.button-ghost:hover {
                opacity: 0.7;
                background: transparent;
            }

            
            /* Specific height for manage folders to prevent expansion */
            .modal-content.modal-manage-folders-modal {
                height: 85vh !important;
                max-height: 85vh !important;
                min-height: 600px !important;
            }
            
            /* Override any prompt library styles on other modals */
            #manage-folders-modal .modal-content {
                height: 85vh !important;
                max-height: 85vh !important;
                min-height: 600px !important;
            }
            
            /* More specific override for all non-prompt-library modals (excluding manage-single-folder and manage-folders) */
            .infi-chatgpt-modal:not(#prompt-library-modal):not(#manage-single-folder-modal):not(#manage-folders-modal) .modal-content {
                min-height: auto !important;
                height: auto !important;
            }
            @keyframes modalScaleIn {
                from {
                    transform: scale(0.98);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            .modal-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 24px 24px 16px 24px; /* Standardized: 24px top, 24px sides, 16px bottom */
                border-bottom: 1px solid var(--gf-border-color);
            }
            .modal-header h2 { 
                margin: 0; 
                font-size: var(--font-size-h2); 
                font-weight: var(--font-weight-medium); 
                font-family: 'Google Sans', 'Roboto', sans-serif;
                color: var(--gf-text-primary);
                flex-grow: 1;
            }
            .modal-close {
                width: 36px; height: 36px;
                padding: var(--space-2);
                border: none; background: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: var(--gf-text-secondary);
                transition: all var(--anim-normal) var(--ease-out);
                margin-left: 16px;
                box-sizing: border-box;
            }
            .modal-close:hover {
                background-color: var(--gf-hover-bg);
                color: var(--gf-text-primary);
            }
            .modal-close:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3);
            }
            .modal-close:focus:not(:focus-visible) {
                box-shadow: none;
            }
            .modal-close svg {
                width: 20px; height: 20px;
            }
            .modal-body { 
                padding: 24px; 
                display: flex; flex-direction: column;
                flex-grow: 1;
                overflow-y: auto;
                gap: 16px; /* 8pt grid spacing */
                font-family: 'Google Sans', 'Roboto', sans-serif;
            }
            .modal-footer {
                padding: 16px 24px 24px 24px; /* Standardized: 16px top, 24px sides, 24px bottom */
                margin-top: var(--modal-footer-gap);
                border-top: 1px solid var(--gf-border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                min-height: 72px; /* Ensure consistent footer height */
                box-sizing: border-box;
            }
            .modal-actions {
                display: flex;
                gap: var(--gap-medium);
                margin-left: auto; /* Push actions to right */
                align-items: center;
            }
            
            /* Footer Grid System */
            .modal-footer.footer-grid {
                display: grid;
                grid-template-columns: 1fr auto;
                align-items: center;
            }
            
            .modal-footer.footer-center {
                justify-content: center;
            }
            
            .modal-footer.footer-spread {
                justify-content: space-between;
            }
            
            /* Footer with left-aligned content */
            .footer-left-content {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: nowrap; /* keep on one line */
            }
            
            /* Checkbox styling */
            .select-all-checkbox,
            .bulk-delete-checkbox,
            .export-chat-checkbox {
                width: 20px;
                height: 20px;
                accent-color: var(--gf-accent-primary);
                cursor: pointer;
                margin: 0;
                flex-shrink: 0;
            }
            
            .select-all-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                color: var(--gf-accent-primary);
                font-weight: 500;
                font-size: 14px;
                user-select: none;
                white-space: nowrap;    /* prevent Select + All from wrapping */
                line-height: 1;         /* align to baseline nicely */
            }
            
            .select-all-label:hover {
                opacity: 0.8;
            }
            
            .select-all-counter {
                color: var(--gf-text-secondary);
                font-size: 14px;
                margin-left: 8px;
                white-space: nowrap;   /* keep 0 selected on one line */
                line-height: 1;
            }
            
            /* Protected foldered chats styles */
            .bulk-delete-item.foldered-protected {
                opacity: 0.6;
            }
            
            .bulk-delete-item.foldered-protected .bulk-delete-checkbox {
                pointer-events: none;
                opacity: 0.5;
            }
            
            .bulk-delete-item .protected-badge {
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 10px;
                background: var(--gf-hover-bg);
                color: var(--gf-text-secondary);
                margin-left: 8px;
                font-weight: 500;
            }
             .infi-chatgpt-manageTabs-content {
                display: flex; flex-direction: column;
                height: 100%;
            }
            #folder-list-container {
                flex-grow: 1;
                overflow-y: auto;
                margin-top: var(--space-4);
            }
             .infi-chatgpt-manageTabs-buttonsContainer {
                margin-top: auto; /* Pushes to the bottom */
                padding-top: 16px;
                text-align: right;
            }
            /* Base Button System */
            .button {
                /* Reset & Core */
                border: none;
                border-radius: var(--space-2);
                cursor: pointer;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                font-size: 14px;
                font-weight: 500;
                text-decoration: none;
                white-space: nowrap;
                user-select: none;
                box-sizing: border-box;
                
                /* Layout */
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--gap-small);
                
                /* Sizing - Default large */
                padding: var(--button-padding-y) var(--button-padding-x);
                min-height: var(--space-12);
                min-width: var(--space-12);
                
                /* Animation */
                transition: all var(--anim-normal) var(--ease-out);
                position: relative;
                overflow: hidden;
                
                /* Default appearance (secondary) */
                background-color: transparent;
                color: var(--gf-text-primary);
                border: 1px solid var(--gf-border-color);
            }
            
            /* Button hover states */
            .button:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .button:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: none;
            }
            
            /* Focus states */
            .button:focus-visible {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: 2px;
            }
            
            /* Disabled state */
            .button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
                box-shadow: none !important;
            }
            
            /* Size modifiers */
            .button-small {
                padding: var(--button-padding-small);
                min-height: 36px;
                font-size: 13px;
            }
            
            .button-medium {
                padding: 10px var(--space-5);
                min-height: var(--space-10);
            }
            
            .button-icon {
                padding: var(--space-2);
                min-width: 36px;
                min-height: 36px;
                width: 36px;
                height: 36px;
            }
            
            /* Type modifiers */
            .button.primary {
                background-color: var(--gf-accent-primary);
                color: var(--gf-button-text, var(--gf-white)) !important;
                border-color: transparent;
                min-width: var(--btn-primary-min);
            }
            
            .button.primary:hover:not(:disabled) {
                background-color: var(--gf-accent-primary);
                opacity: 0.9;
            }
            
            .button.primary:focus-visible {
                box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.4);
            }
            
            .button.secondary {
                /* Already default styles */
                min-width: var(--btn-secondary-min);
            }
            
            .button.secondary:hover:not(:disabled) {
                background-color: var(--gf-hover-bg);
            }
            
            .button.secondary:focus-visible {
                box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3);
                border-color: var(--gf-accent-primary);
            }
            
            .button.danger {
                background-color: var(--gf-accent-danger);
                color: var(--gf-white);
                border-color: transparent;
            }
            
            .button.danger:hover:not(:disabled) {
                background-color: var(--gf-accent-danger);
                opacity: 0.9;
            }
            
            .button.danger:focus-visible {
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.4);
            }
            /* Icon button (extends button) */
            .icon-btn {
                /* Inherit from button */
                background: transparent;
                border: none;
                color: var(--gf-text-secondary);
                width: 36px;
                height: 36px;
                min-width: 36px;
                min-height: 36px;
                padding: var(--space-2);
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all var(--anim-normal) var(--ease-out);
                cursor: pointer;
                box-sizing: border-box;
            }
            
            .icon-btn:hover:not(:disabled) {
                background-color: var(--gf-hover-bg);
                color: var(--gf-text-primary);
                transform: none; /* Don't lift icon buttons */
            }
            
            .icon-btn:focus-visible {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: 2px;
            }

            /* Form & List Styles */
            input[type="text"], input[type="search"] {
                width: 100%;
                padding: 8px 16px;
                background-color: var(--gf-bg-input);
                border: 1px solid var(--gf-border-color);
                color: var(--gf-text-primary);
                border-radius: 6px;
                box-sizing: border-box; /* Important */
                font-size: 14px;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                transition: border-color var(--anim-normal) var(--ease-out), box-shadow var(--anim-normal) var(--ease-out);
            }
            input[type="text"]:focus, input[type="search"]:focus {
                outline: none;
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3);
            }
            
            input[type="text"]:focus:not(:focus-visible), 
            input[type="search"]:focus:not(:focus-visible) {
                box-shadow: none;
            }

            /* Select elements consistent with inputs */
            select {
                width: 100%;
                padding: 8px 16px;
                background-color: var(--gf-bg-input);
                border: 1px solid var(--gf-border-color);
                color: var(--gf-text-primary);
                border-radius: 6px;
                box-sizing: border-box;
                font-size: 14px;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                transition: border-color var(--anim-normal) var(--ease-out), box-shadow var(--anim-normal) var(--ease-out);
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: none; /* keep neutral, UI may add arrow if desired */
            }
            select:focus {
                outline: none;
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3);
            }

            /* Format selector layout */
            .format-select {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: 12px;
                white-space: nowrap;   /* keep label + control on one line */
                line-height: 1;
            }
            .format-select label {
                font-size: 13px;
                color: var(--gf-text-secondary);
                white-space: nowrap;
            }
            .format-select select {
                height: 36px;          /* normalize control height */
                line-height: 36px;
                padding: 0 12px;
            }
            .list-item {
                display: flex; align-items: center; gap: 10px;
                padding: var(--row-padding); border-radius: 6px; margin-bottom: 4px;
                min-height: var(--row-height);
            }
            .list-item:hover { background-color: var(--gf-hover-bg); }
            .list-item:focus-within {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: -2px;
            }
            .list-item .item-title {
                flex-grow: 1;
                cursor: pointer;
            }

            /* Make entire chat rows clickable in Add Chats modal */
            .chat-item {
                cursor: pointer;
            }

            .list-item .item-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--gf-text-secondary);
            }
            
            .list-item .add-subfolder-btn {
                opacity: 0;
                transition: opacity var(--anim-normal) var(--ease-in-out);
            }
            
            .list-item:hover .add-subfolder-btn {
                opacity: 1;
            }

            .icon-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--gf-text-secondary);
            }

/* --- NEW: Bulk Delete Modal Specific Styles --- */
            /* Export chat compact header/actions/footer to maximize list space */
            #export-chat-modal .premium-modal-header {
                padding: 12px 20px !important;
                min-height: 48px !important;
                flex: 0 0 auto !important;
            }
            #export-chat-modal .premium-modal-actions {
                padding: 8px 20px !important;
                min-height: 48px !important;
                gap: 12px !important;
                flex: 0 0 auto !important;
            }
            #export-chat-modal .premium-modal-footer {
                padding: 12px 20px !important;
                min-height: 56px !important;
                flex: 0 0 auto !important;
            }

            
            /* Export Chat premium layout (scoped to its modal) */
            #export-chat-modal .modal-body {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: hidden !important;
                padding: 0 !important;
                gap: 0 !important;
                min-height: 0 !important;
            }
#export-chat-modal .premium-modal-body {
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                overflow-y: hidden;
                padding: 12px 20px;
                gap: 0;
                min-height: 0;
            }
#export-chat-modal #export-chat-list {
                flex: 1 1 auto;
                overflow-y: auto;
                margin: 0;
                padding: 0 8px 0 0; /* slim scrollbar space */
                background: transparent;
                border: none;
                min-height: 0;
            }
            
            /* Compact row style for Export (mirror Bulk Delete) */
            #export-chat-modal .bulk-delete-item {
                display: flex;
                align-items: center;
                gap: 12px !important;
                padding: 12px 12px !important;
                min-height: 48px !important;
                border-radius: 8px;
                background: transparent;
                border: none;
box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--gf-border-color) 35%, transparent);
                transition: background 120ms ease, box-shadow 120ms ease;
            }
            #export-chat-modal .bulk-delete-item:hover {
                background: var(--gf-hover-bg);
            }
            #export-chat-modal .bulk-delete-item:last-child {
                box-shadow: none;
            }
            #export-chat-modal .bulk-delete-item:has(.bulk-delete-checkbox:checked) {
                background: color-mix(in srgb, var(--gf-accent-primary) 10%, transparent);
                box-shadow:
                    inset 3px 0 0 var(--gf-accent-primary),
                    inset 0 -1px 0 color-mix(in srgb, var(--gf-border-color) 20%, transparent);
            }
            
            /* Keep boxed style only if used outside export modal (legacy) */
            .legacy-export-chat-list {
                margin-top: var(--space-4);
                max-height: 400px;
                overflow-y: auto;
                padding-right: 10px; /* For scrollbar */
                scroll-behavior: smooth;
                background-color: var(--gf-bg-secondary);
                border: 1px solid var(--gf-border-color);
                border-radius: var(--space-2);
                padding: var(--space-2);
            }
            /* Bulk Delete list fills the body; only this scrolls */
            #bulk-delete-list {
                flex: 1 1 auto;
                max-height: none !important;
                overflow-y: auto;
                overflow-x: hidden;
                padding-right: 10px; /* For scrollbar */
                margin-top: var(--space-2);
                padding: 0;
                background: transparent;
                border: none;
                border-radius: 0;
                box-sizing: border-box;
            }
            /* Footer controls inside body should not shrink */
            #bulk-delete-controls {
                flex-shrink: 0;
                margin-top: var(--space-4);
            }
            .bulk-delete-item {
                display: flex;
                align-items: center;
                padding: var(--row-padding);
                border-radius: 8px;
                margin-bottom: 6px;
                min-height: var(--row-height);
                transition: all var(--anim-fast) var(--ease-out);
                gap: var(--gap-medium);
                background-color: var(--gf-bg-secondary);
                border: 1px solid transparent;
            }
            .bulk-delete-item:hover {
                background-color: var(--gf-hover-bg);
                border-color: var(--gf-border-color);
            }
            .bulk-delete-item:has(.bulk-delete-checkbox:checked) {
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.35);
                background-color: var(--gf-bg-secondary);
            }
            .bulk-delete-item:focus-within {
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.35);
            }
            #bulk-delete-search:focus {
                border-color: var(--gf-accent-primary) !important;
                box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.2) !important;
            }
            .bulk-delete-item input[type="checkbox"] {
                margin-right: 12px;
                width: 18px;
                height: 18px;
            }
            .bulk-delete-item .item-title {
                font-size: 14px;
                font-weight: 400;
                color: var(--gf-text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
             #bulk-delete-controls {
                padding-top: 16px;
                border-top: 1px solid var(--gf-border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #bulk-delete-select-all-container {
                display: flex;
                align-items: center;
            }
             #bulk-delete-status {
                font-size: 14px;
                color: var(--gf-text-secondary);
            }
            #bulk-delete-search-container {
                margin-bottom: var(--space-4);
            }
            #bulk-delete-search {
                transition: border-color var(--anim-normal) var(--ease-out), box-shadow var(--anim-normal) var(--ease-out);
            }
            
            /* Premium Modal Styles */
            .modal-content.modal-manage-folders-modal {
                width: min(800px, 92vw) !important;
                max-width: 800px !important;
                height: 85vh !important;
                min-height: 600px !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                padding: 0 !important;
                border-radius: 16px !important;
                box-shadow: 
                    0 20px 25px -5px rgba(0, 0, 0, 0.1),
                    0 10px 10px -5px rgba(0, 0, 0, 0.04),
                    0 0 0 1px rgba(0, 0, 0, 0.05) !important;
                overflow: hidden !important;
            }

            /* Fixed shell for Bulk Delete modal (same guardrails as folders) */
            .modal-content.modal-bulk-delete-modal {
                width: min(800px, 92vw) !important;
                max-width: 800px !important;
                height: 85vh !important;
                min-height: 600px !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                padding: 0 !important;
                border-radius: 16px !important;
                overflow: hidden !important;
            }

            /* Fixed shell for Export Chat modal */
            .modal-content.modal-export-chat-modal {
                width: min(800px, 92vw) !important;
                max-width: 800px !important;
                height: 85vh !important;
                min-height: 600px !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                padding: 0 !important;
                border-radius: 16px !important;
                overflow: hidden !important;
            }
            #export-chat-modal .modal-content.modal-export-chat-modal {
                height: 85vh !important;
                max-height: 85vh !important;
                min-height: 600px !important;
            }

            /* Fixed shell for Settings modal */
            .modal-content.modal-settings-modal {
                width: min(800px, 92vw) !important;
                max-width: 800px !important;
                height: 85vh !important;
                min-height: 600px !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                padding: 0 !important;
                border-radius: 16px !important;
                overflow: hidden !important;
            }
            #settings-modal .modal-header {
                padding: 16px 24px !important;
                min-height: 56px !important;
                border-bottom: 1px solid var(--gf-border-color);
                flex: 0 0 auto;
            }
            #settings-modal .modal-body {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                min-height: 0 !important;
                padding: 16px 24px !important;
            }

            /* Highest specificity to lock Bulk Delete modal size */
            #bulk-delete-modal .modal-content.modal-bulk-delete-modal {
                height: 85vh !important;
                max-height: 85vh !important;
                min-height: 600px !important;
            }

            /* Make only the list scroll within Bulk Delete */
            #bulk-delete-modal .modal-body,
            #bulk-delete-modal .premium-modal-body {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: hidden !important;
                overflow-x: hidden !important;
                min-height: 0 !important;
                padding: 16px 24px !important; /* compact vertical padding */
                gap: 12px !important;
            }

            /* Bulk Delete compact layout overrides (scoped) */
            #bulk-delete-modal .premium-modal-header {
                padding: 16px 24px !important;
                min-height: 56px !important;
            }
            #bulk-delete-modal .premium-modal-actions {
                padding: 12px 24px !important;
                min-height: 56px !important;
                gap: 12px !important;
            }
            #bulk-delete-modal .premium-modal-footer {
                padding: 16px 24px !important;
                min-height: 64px !important;
            }
            #bulk-delete-modal .premium-search-input { 
                max-width: none !important; /* allow full-width search when space allows */
            }
            #bulk-delete-modal #bulk-delete-list {
                margin-top: 0 !important;
                padding-right: 8px; /* slimmer scrollbar space */
            }
            
            /* Compact row style for Bulk Delete only */
            #bulk-delete-modal .bulk-delete-item {
                display: flex;
                align-items: center;
                gap: 12px !important;
                padding: 12px 12px !important; /* 12px vertical */
                min-height: 48px !important;       /* 48px row height */
                border-radius: 8px;
                background: transparent;
                border: none;
                box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--gf-border-color) 35%, transparent);
                transition: background 120ms ease, box-shadow 120ms ease;
            }
            #bulk-delete-modal .bulk-delete-item:hover {
                background: var(--gf-hover-bg);
            }
            #bulk-delete-modal .bulk-delete-item:last-child {
                box-shadow: none; /* no separator on last row */
            }
            
            /* Selected state: tint + left accent */
            #bulk-delete-modal .bulk-delete-item:has(.bulk-delete-checkbox:checked) {
                background: color-mix(in srgb, var(--gf-accent-primary) 10%, transparent);
                box-shadow:
                    inset 3px 0 0 var(--gf-accent-primary),
                    inset 0 -1px 0 color-mix(in srgb, var(--gf-border-color) 20%, transparent);
            }
            
            .dark-theme .modal-content.modal-manage-folders-modal {
                box-shadow: 
                    0 20px 25px -5px rgba(0, 0, 0, 0.3),
                    0 10px 10px -5px rgba(0, 0, 0, 0.2),
                    0 0 0 1px rgba(255, 255, 255, 0.1) !important;
            }
            
            /* Ensure modal maintains consistent size */
            .modal-content.modal-manage-folders-modal * {
                box-sizing: border-box;
            }
            
            /* Highest specificity to lock modal size */
            #manage-folders-modal .modal-content.modal-manage-folders-modal {
                height: 85vh !important;
                max-height: 85vh !important;
                min-height: 600px !important;
                display: flex !important;
                flex-direction: column !important;
            }
            
            /* Premium Modal Header */
            .premium-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 24px 28px;
                border-bottom: 1px solid var(--gf-border-color);
                flex: 0 0 auto;
                min-height: 72px;
            }
            
            .premium-modal-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--gf-text-primary);
                margin: 0;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .premium-modal-close {
                width: 36px;
                height: 36px;
                padding: 0;
                border: none;
                background: transparent;
                color: var(--gf-text-secondary);
                cursor: pointer;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.14s ease-out;
            }
            
            .premium-modal-close:hover {
                background: var(--gf-hover-bg);
                color: var(--gf-text-primary);
            }
            
            .premium-modal-close svg {
                width: 20px;
                height: 20px;
            }
            
            /* Premium Modal Actions Bar */
            .premium-modal-actions {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 24px 28px;
                border-bottom: 1px solid var(--gf-border-color);
                flex: 0 0 auto;
                background: var(--gf-bg-primary);
                min-height: 76px;
            }
            
            /* Premium Button Styles */
            .premium-button {
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                border: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.14s ease-out;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                white-space: nowrap;
            }
            
            .premium-button-primary {
                background: var(--gf-accent-primary);
                color: white;
            }
            
            .premium-button-primary:hover {
                opacity: 0.9;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
            }
            
            .premium-button-secondary {
                background: transparent;
                color: var(--gf-text-primary);
                border: 1px solid var(--gf-border-color);
            }
            
            .premium-button-secondary:hover {
                background: var(--gf-hover-bg);
            }
            
            /* Premium danger button */
            .premium-button-danger {
                background: var(--gf-accent-danger);
                color: #fff;
            }
            .premium-button-danger:hover:enabled {
                filter: brightness(0.95);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(234, 67, 53, 0.25);
            }
            .premium-button-danger:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Premium Search Input */
            .premium-search-input {
                flex: 1;
                max-width: 300px;
                padding: 10px 16px;
                border: 1px solid var(--gf-border-color);
                border-radius: 10px;
                background: var(--gf-bg-input);
                color: var(--gf-text-primary);
                font-size: 14px;
                transition: all 0.14s ease-out;
            }
            
            .premium-search-input:focus {
                outline: none;
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
            }
            
            /* Premium Checkbox */
            .premium-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
                font-size: 14px;
                color: var(--gf-text-secondary);
                cursor: pointer;
                user-select: none;
            }
            
            .premium-checkbox {
                width: 18px;
                height: 18px;
                accent-color: var(--gf-accent-primary);
            }
            
            /* Premium Modal Body */
            .premium-modal-body {
                flex: 1 1 auto;
                overflow-y: auto;
                overflow-x: hidden !important;
                padding: 24px 28px;
                min-height: 0;
                width: 100%;
                box-sizing: border-box;
            }
            
            /* Ensure folder list container doesn't overflow */
            #folder-list-container {
                overflow-x: hidden !important;
                width: 100%;
                max-width: 100%;
            }
            
            /* Premium Folder List */
            .premium-folder-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
                overflow-x: hidden;
                width: 100%;
            }
            
            .premium-folder-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 16px;
                border-radius: 10px;
                background: var(--gf-bg-secondary);
                transition: all 0.14s ease-out;
                min-height: 60px;
                box-sizing: border-box;
                width: 100%;
                max-width: 100%;
                overflow: hidden;
            }
            
            .subfolder-spacer {
                display: inline-block;
                flex-shrink: 0;
            }
            
            .premium-folder-item:hover {
                background: var(--gf-hover-bg);
                transform: translateX(4px);
            }
            
            .premium-folder-content {
                display: flex;
                align-items: center;
                gap: 16px;
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .premium-folder-icon {
                color: var(--gf-text-secondary);
                flex-shrink: 0;
            }
            
            .premium-folder-name {
                font-size: 15px;
                font-weight: 500;
                color: var(--gf-text-primary);
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .premium-folder-count {
                padding: 4px 10px;
                background: var(--gf-bg-primary);
                border-radius: 12px;
                font-size: 13px;
                color: var(--gf-text-secondary);
                font-weight: 500;
                margin-right: 8px;
            }
            
            .premium-folder-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                opacity: 1;
                transition: opacity 0.14s ease-out;
                flex-shrink: 0;
            }
            
            .premium-icon-btn {
                width: 44px;
                height: 44px;
                padding: 0;
                border: none;
                background: transparent;
                color: var(--gf-text-secondary);
                cursor: pointer;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                position: relative;
            }
            
            .premium-icon-btn:hover {
                background: var(--gf-bg-primary);
                color: var(--gf-text-primary);
            }
            
            .premium-icon-btn.delete-folder-btn:hover {
                background: rgba(239, 68, 68, 0.1);
                color: var(--gf-accent-danger);
            }
            
            /* Premium Modal Footer */
            .premium-modal-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 16px;
                padding: 24px 28px;
                border-top: 1px solid var(--gf-border-color);
                background: var(--gf-bg-primary);
                flex: 0 0 auto;
                min-height: 76px;
            }
            
            /* Premium Empty State */
            .premium-empty-state {
                text-align: center;
                padding: 48px 24px;
                color: var(--gf-text-secondary);
                font-size: 15px;
            }
            
            /* Premium Scrollbar */
            .premium-modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .premium-modal-body::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .premium-modal-body::-webkit-scrollbar-thumb {
                background: var(--gf-border-color);
                border-radius: 4px;
            }
            
            .premium-modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--gf-text-tertiary);
            }
            #bulk-delete-search:focus {
                outline: none;
                border-color: var(--gf-accent-primary);
            }
            #bulk-delete-counter {
                font-weight: 500;
            }
            
            /* Chat Tools Tabbed Interface */
            .chat-tools-tabs {
                display: flex;
                gap: 4px;
                padding: 8px 24px 0;
                border-bottom: 2px solid var(--gf-border-color);
                background: var(--gf-bg-secondary);
                flex-shrink: 0;
            }
            
            .chat-tools-tab {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                border: none;
                background: transparent;
                color: var(--gf-text-secondary);
                cursor: pointer;
                border-radius: 8px 8px 0 0;
                transition: all 0.2s ease;
                position: relative;
                font-size: 14px;
                font-weight: 500;
                border-bottom: 3px solid transparent;
                margin-bottom: -2px;
            }
            
            .chat-tools-tab svg {
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }
            
            .chat-tools-tab:hover {
                background: var(--gf-hover-bg);
                color: var(--gf-text-primary);
            }
            
            .chat-tools-tab:hover svg {
                opacity: 1;
            }
            
            .chat-tools-tab.active {
                background: var(--gf-bg-primary);
                color: var(--gf-accent-primary);
                border-bottom-color: var(--gf-accent-primary);
            }
            
            .chat-tools-tab.active svg {
                opacity: 1;
            }
            

            
            .premium-badge-small {
                font-size: 10px;
                padding: 2px 6px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                border-radius: 4px;
                font-weight: 600;
                margin-left: 4px;
            }
            
            .chat-tools-premium-badge {
                font-size: 10px;
                padding: 2px 8px;
                background: var(--gf-accent-primary);
                color: var(--gf-button-text);
                border: none;
                border-radius: 10px;
                font-weight: 600;
                margin-left: 6px;
                text-transform: none;
                letter-spacing: normal;
                line-height: 18px;
            }
            
            .tab-panel {
                display: none;
                animation: tabFadeIn 0.2s ease;
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }
            
            .tab-panel.active {
                display: flex;
                flex-direction: column;
            }
            
            @keyframes tabFadeIn {
                from { 
                    opacity: 0; 
                    transform: translateY(-4px); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0); 
                }
            }
            
            /* Chat Tools Modal Specific Adjustments */
            #chat-tools-modal .modal-content {
                display: flex;
                flex-direction: column;
                max-height: 80vh;
                height: auto;
            }
            
            #chat-tools-modal .premium-modal-header {
                border-bottom: none;
                flex-shrink: 0;
                padding: 16px 24px 8px;
                min-height: auto;
            }
            
            #chat-tools-modal .chat-tools-tabs {
                flex-shrink: 0;
            }
            
            #chat-tools-modal .tab-panel .premium-modal-actions {
                padding: 12px 24px 10px;
                flex-shrink: 0;
                min-height: auto;
            }
            
            #chat-tools-modal .tab-panel .premium-modal-body {
                padding: 16px 24px;
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                max-height: none;
            }
            
            /* Export tab specific: make only the list scroll, not the body */
            #chat-tools-modal #export-tab-panel {
                animation: none !important; /* Disable animation to prevent jank with many items */
            }
            
            #chat-tools-modal #export-tab-panel .premium-modal-body {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: hidden !important;
                overflow-x: hidden !important;
                min-height: 0 !important;
                padding: 16px 24px !important;
                gap: 0 !important;
            }
            
            #chat-tools-modal #export-chat-list {
                flex: 1 1 auto;
                overflow-y: auto;
                overflow-x: hidden;
                margin: 0;
                padding: 0 8px 0 0;
                background: transparent;
                border: none;
                min-height: 0;
                /* Performance optimizations for smooth scrolling with many items */
                will-change: scroll-position;
                contain: layout style paint;
                transform: translateZ(0);
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Bulk delete tab specific: make only the list scroll, not the body */
            #chat-tools-modal #bulk-delete-tab-panel {
                animation: none !important; /* Disable animation to prevent jank with many items */
            }
            
            #chat-tools-modal #bulk-delete-tab-panel .premium-modal-body {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: hidden !important;
                overflow-x: hidden !important;
                min-height: 0 !important;
                padding: 16px 24px !important;
                gap: 0 !important;
            }
            
            #chat-tools-modal #bulk-delete-tab-panel .premium-modal-footer {
                flex: 0 0 auto !important;
                min-height: 64px !important;
                padding: 12px 24px !important;
            }
            
            #chat-tools-modal #bulk-delete-tab-panel #bulk-delete-list {
                flex: 1 1 auto;
                overflow-y: auto;
                overflow-x: hidden;
                margin: 0;
                padding: 0 8px 0 0;
                background: transparent;
                border: none;
                min-height: 0;
                max-height: none !important;
                /* Performance optimizations for smooth scrolling with many items */
                will-change: scroll-position;
                contain: layout style paint;
                transform: translateZ(0);
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Optimize item hover performance - remove expensive transitions */
            #chat-tools-modal .bulk-delete-item {
                transition: background 100ms ease;
                will-change: background;
            }
            
            #chat-tools-modal .tab-panel .premium-modal-footer {
                padding: 12px 24px;
                flex-shrink: 0;
                min-height: auto;
            }
            
            /* Export status and progress sections within tabs */
            #chat-tools-modal #export-chat-status {
                flex-shrink: 0;
            }
            
            /* Compact search inputs and buttons in chat tools */
            #chat-tools-modal .premium-search-input {
                padding: 8px 12px;
                min-height: 36px;
                height: 36px;
            }
            
            #chat-tools-modal .premium-button {
                padding: 8px 16px;
                min-height: 36px;
                height: 36px;
            }
            
            #chat-tools-modal .premium-checkbox-label {
                min-height: 36px;
            }
            
            /* Responsive tab styles */
            @media (max-width: 768px) {
                .chat-tools-tab span:not(.chat-tools-premium-badge) {
                    font-size: 13px;
                }
                
                .chat-tools-tab {
                    padding: 10px 16px;
                    gap: 6px;
                }
            }
            
            @media (max-width: 480px) {
                .chat-tools-tabs {
                    padding: 12px 16px 0;
                    gap: 2px;
                }
                
                .chat-tools-tab {
                    padding: 8px 12px;
                    font-size: 12px;
                }
                
                .chat-tools-tab svg {
                    width: 14px;
                    height: 14px;
                }
            }

            /* Compact padding for pinned messages modal */
            #pinned-messages-modal .premium-modal-header {
                padding: 16px 24px;
                min-height: 56px;
            }
            
            #pinned-messages-modal .premium-modal-actions {
                padding: 12px 24px;
                min-height: 60px;
            }
            
            #pinned-messages-modal .premium-modal-body {
                padding: 16px 24px;
            }
            
            #pinned-messages-modal .premium-modal-footer {
                padding: 12px 24px;
                min-height: 56px;
            }

            /* Light theme adjustments for modals */
            :host(.light-theme) .infi-chatgpt-modal {
                background-color: var(--gf-overlay-bg-light);
            }
            :host(.light-theme) .infi-chatgpt-modal.modal-blocking {
                background-color: rgba(0, 0, 0, 0.45);
            }
            :host(.light-theme) .modal-content {
                background-color: var(--gf-white);
                box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                color: var(--gf-text-primary);
            }
            :host(.light-theme) .modal-header h2 {
                color: var(--gf-text-primary);
            }
            :host(.light-theme) .toolbox-dropdown {
                background: var(--gf-bg-primary);
                box-shadow: 
                    0 4px 6px rgba(0, 0, 0, 0.08),
                    0 1px 3px rgba(0, 0, 0, 0.04),
                    inset 0 0 0 1px rgba(0, 0, 0, 0.04);
            }
            :host(.light-theme) .gemini-modal-content {
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            }
            :host(.light-theme) #bulk-delete-search {
                background: var(--gf-white);
                border-color: var(--gf-border-color);
                color: var(--gf-text-primary);
            }
            :host(.light-theme) #bulk-delete-search:focus {
                border-color: var(--gf-accent-primary);
                box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.2);
            }
            :host(.light-theme) #bulk-delete-search::placeholder {
                color: var(--gf-text-secondary);
            }
            :host(.light-theme) .secondary:hover {
                background-color: var(--gf-border-color);
            }
            :host(.light-theme) .list-item:hover {
                background-color: var(--gf-hover-bg);
            }
:host(.light-theme) .bulk-delete-item {
                background-color: var(--gf-white);
                color: var(--gf-text-primary);
            }
            :host(.light-theme) .bulk-delete-item:hover {
                background-color: var(--gf-bg-secondary);
            }
            :host(.light-theme) .bulk-delete-item label {
                color: var(--gf-text-primary);
            }
:host(.light-theme) #bulk-delete-list {
                background-color: var(--gf-white);
                border: 1px solid #D1D5DB;
                border-radius: var(--space-2);
                padding: var(--space-3);
            }
            :host(.light-theme) #bulk-delete-controls {
                background-color: var(--gf-bg-primary);
                border-top: 1px solid #D1D5DB;
                padding: var(--space-4);
                margin: 0 -20px -20px -20px;
                border-radius: 0 0 12px 12px;
            }
            :host(.light-theme) #bulk-delete-counter {
                color: var(--gf-text-secondary);
                font-weight: 500;
            }
            :host(.light-theme) #bulk-delete-list::-webkit-scrollbar-track {
                background: #F3F4F6;
            }
            :host(.light-theme) #bulk-delete-list::-webkit-scrollbar-thumb {
                background: #D1D5DB;
            }
            :host(.light-theme) #bulk-delete-list::-webkit-scrollbar-thumb:hover {
                background: #1D4ED8;
            }

            /* Chat Exporter Styles */
            .gemini-modal-backdrop {
                position: fixed;
                z-index: 2000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .gemini-modal-content {
                background-color: var(--gf-bg-primary);
                color: var(--gf-text-primary);
                border: 1px solid var(--gf-border-color);
                width: 90%;
                max-width: 720px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                max-height: 80vh;
            }

            .gemini-modal-header {
                padding: 16px 24px;
                border-bottom: 1px solid var(--gf-border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .gemini-modal-header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 500;
            }

            .gemini-modal-close-btn {
                background: none;
                border: none;
                color: var(--gf-text-secondary);
                font-size: 28px;
                font-weight: 300;
                cursor: pointer;
                line-height: 1;
                padding: 4px;
                border-radius: 50%;
                transition: all var(--anim-normal) var(--ease-out);
            }
            .gemini-modal-close-btn:hover {
                background-color: var(--gf-hover-bg);
                color: var(--gf-text-primary);
            }

            .gemini-modal-body {
                padding: 16px 24px;
                overflow-y: auto;
                flex-grow: 1;
            }

            .gemini-modal-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .gemini-modal-list-item {
                padding: var(--input-padding);
                background-color: var(--gf-bg-secondary);
                border-radius: var(--space-2);
                cursor: pointer;
                transition: background-color var(--anim-normal) var(--ease-out);
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                min-height: 48px;
                display: flex;
                align-items: center;
                box-sizing: border-box;
            }
            .gemini-modal-list-item:hover {
                background-color: var(--gf-hover-bg);
            }
            .gemini-modal-list-item:focus-within {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: -2px;
            }

            .gemini-modal-empty-state, .gemini-modal-loader {
                text-align: center;
                padding: 40px;
                color: var(--gf-text-secondary);
                font-style: italic;
            }

            .format-selector {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: var(--gap-medium);
            }

            .format-btn {
                padding: var(--input-padding);
                font-size: 14px;
                font-weight: 500;
                border-radius: var(--space-2);
                cursor: pointer;
                background-color: var(--gf-bg-secondary);
                color: var(--gf-text-primary);
                border: 1px solid var(--gf-border-color);
                transition: all var(--anim-normal) var(--ease-out);
                min-height: 48px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
            }
            .format-btn:hover {
                background-color: var(--gf-accent-primary);
                color: var(--gf-bg-primary);
                border-color: var(--gf-accent-primary);
            }


            #exporter-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0,0,0,0.75);
                z-index: 2147483647;
                display: flex;
                justify-content: center;
                align-items: center;
                color: #fff;
                font-family: 'Google Sans', sans-serif;
            }
            .exporter-overlay-content {
                text-align: center;
            }
            .exporter-spinner {
                border: 4px solid rgba(255, 255, 255, 0.2);
                border-top: 4px solid #fff;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px auto;
            }
            .exporter-message {
                font-size: 18px;
                font-weight: 500;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Loading States */
            .loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            
            .loading::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                top: 50%;
                left: 50%;
                margin-left: -10px;
                margin-top: -10px;
                border: 2px solid transparent;
                border-top-color: currentColor;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            
            /* Button Loading State */
            .button.loading {
                color: transparent;
            }
            
            .button.loading::after {
                border-width: 2px;
                border-top-color: var(--gf-white);
            }
            
            /* Success State Animation */
            @keyframes successPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes checkmark {
                0% { 
                    stroke-dashoffset: 100;
                    opacity: 0;
                }
                50% {
                    opacity: 1;
                }
                100% { 
                    stroke-dashoffset: 0;
                    opacity: 1;
                }
            }
            
            .success {
                animation: successPulse var(--anim-medium) var(--ease-out);
            }
            
            /* Error State Animation */
            @keyframes errorShake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-4px); }
                75% { transform: translateX(4px); }
            }
            
            .error {
                animation: errorShake var(--anim-normal) var(--ease-out);
                border-color: var(--gf-accent-danger) !important;
                color: var(--gf-accent-danger) !important;
            }
            
            /* Skeleton Loading */
            @keyframes shimmer {
                0% {
                    background-position: -200% 0;
                }
                100% {
                    background-position: 200% 0;
                }
            }
            
            .skeleton {
                background: linear-gradient(
                    90deg,
                    var(--gf-bg-secondary) 25%,
                    var(--gf-hover-bg) 50%,
                    var(--gf-bg-secondary) 75%
                );
                background-size: 200% 100%;
                animation: shimmer 1.5s ease-in-out infinite;
                border-radius: 4px;
            }
            
            /* Ripple Effect */
            @keyframes ripple {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                100% {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            .ripple {
                position: relative;
                overflow: hidden;
            }
            
            .ripple::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }
            
            .ripple:active::before {
                width: 300px;
                height: 300px;
            }
            
            /* Screen reader only text */
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }
            
            /* Focus styles for keyboard navigation */
            *:focus {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: 2px;
            }
            
            button:focus-visible,
            input:focus-visible,
            select:focus-visible,
            textarea:focus-visible,
            [tabindex]:focus-visible {
                outline: 2px solid var(--gf-accent-primary);
                outline-offset: 2px;
                box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.1);
            }
            
            .dropdown-item:focus {
                background-color: var(--gf-hover-bg);
                outline: none;
                box-shadow: inset 0 0 0 2px var(--gf-accent-primary);
            }
            
            /* Smooth Progress Indicator */
            .progress-smooth {
                position: relative;
                height: 4px;
                background: var(--gf-bg-secondary);
                border-radius: 2px;
                overflow: hidden;
            }
            
            .progress-smooth::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                width: 30%;
                background: var(--gf-accent-primary);
                animation: indeterminate 1.5s ease-in-out infinite;
            }
            
            @keyframes indeterminate {
                0% {
                    left: -30%;
                    width: 30%;
                }
                50% {
                    width: 50%;
                }
                100% {
                    left: 100%;
                    width: 30%;
                }
            }
            
            /* Disabled state improvements */
            .button:disabled,
            .icon-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }
            
            .button:disabled:hover,
            .icon-btn:disabled:hover {
                background-color: initial;
                transform: none !important;
            }
            
            /* Active states for better feedback */
            .button:active:not(:disabled),
            .icon-btn:active:not(:disabled) {
                transform: scale(0.98);
            }
            
            .list-item:active {
                transform: scale(0.99);
                transition: transform var(--anim-instant) var(--ease-out);
            }
            
            /* Toast notification styles - Gemini Native Look */
            .prompt-toast {
                position: fixed;
                bottom: 32px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: var(--toast-bg, #131314);
                color: var(--toast-text, #e3e3e3);
                padding: 14px 20px;
                border-radius: 24px;
                box-shadow: var(--toast-shadow, 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08));
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                z-index: 10001;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                max-width: 90vw;
                min-width: 220px;
                display: inline-flex;
                align-items: center;
                gap: 12px;
            }

            .prompt-toast .toast-action {
                background: transparent;
                color: var(--toast-action, #8ab4f8);
                border: none;
                border-radius: 20px;
                padding: 6px 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                margin-left: 4px;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                transition: background 0.2s ease;
            }

            .prompt-toast .toast-action:hover {
                background: var(--toast-action-hover, rgba(138, 180, 248, 0.08));
            }
            
            .prompt-toast .toast-action:active {
                background: var(--toast-action-active, rgba(138, 180, 248, 0.16));
            }
            
            .prompt-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            /* All toast types use theme-aware backgrounds */
            .prompt-toast.success {
                background: var(--toast-bg, #131314);
                color: var(--toast-text, #e3e3e3);
            }
            
            .prompt-toast.error {
                background: var(--toast-bg, #131314);
                color: var(--toast-error-text, #f28b82);
            }
            
            .prompt-toast.info {
                background: var(--toast-bg, #131314);
                color: var(--toast-text, #e3e3e3);
            }
            
            /* Premium Modal Shell Styles */
            .modal-manage-folders-modal .modal-content {
                width: min(800px, 92vw) !important;
                max-height: 85vh !important;
                border-radius: 16px !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                background: var(--gf-bg-primary) !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
            }
            
            /* Premium Modal Header */
            .premium-modal-header {
                padding: 24px;
                border-bottom: 1px solid var(--gf-border-color);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }
            
            .premium-modal-title {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: var(--gf-text-primary);
                line-height: 1.2;
            }
            
            .premium-modal-close {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                color: var(--gf-text-secondary);
                transition: all 150ms ease;
            }
            
            .premium-modal-close:hover {
                background: var(--gf-hover-bg);
                color: var(--gf-text-primary);
            }
            
            .premium-modal-close svg {
                width: 18px;
                height: 18px;
            }
            
            /* Premium Modal Actions Row */
            .premium-modal-actions {
                padding: 20px 24px;
                border-bottom: 1px solid var(--gf-border-color);
                display: flex;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
            }
            
            /* Premium Buttons */
            .premium-button {
                height: 36px;
                padding: 0 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                border: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 150ms ease;
                white-space: nowrap;
                font-family: inherit;
            }
            
            .premium-button-primary {
                background: var(--gf-accent-primary);
                color: var(--gf-button-text);
            }
            
            .premium-button-primary:hover {
                opacity: 0.9;
            }
            
            .premium-button-secondary {
                background: transparent;
                color: var(--gf-text-primary);
                border: 1px solid var(--gf-border-color);
            }
            
            .premium-button-secondary:hover {
                background: var(--gf-hover-bg);
            }
            
            /* Premium Search Input */
            .premium-search-input {
                flex: 1;
                height: 36px;
                padding: 0 14px;
                border: 1px solid var(--gf-border-color);
                border-radius: 8px;
                background: var(--gf-bg-secondary);
                color: var(--gf-text-primary);
                font-size: 14px;
                transition: all 150ms ease;
            }
            
            .premium-search-input:focus {
                outline: none;
                border-color: var(--gf-accent-primary);
                background: var(--gf-bg-input);
            }
            
            .premium-search-input::placeholder {
                color: var(--gf-text-tertiary);
            }
            
            /* Premium Checkbox */
            .premium-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: var(--gf-text-primary);
                cursor: pointer;
                user-select: none;
            }
            
            .premium-checkbox {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            
            /* Premium Modal Body - Scrollable Content */
            .premium-modal-body {
                flex: 1;
                padding: 20px 24px 24px;
                overflow-y: auto;
                overflow-x: hidden;
                min-height: 0;
            }
            
            /* Premium Folder List */
            .premium-folder-list {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .premium-folder-list .list-item {
                min-height: 48px;
                padding: 8px 12px;
                border-radius: 8px;
                transition: background 150ms ease;
            }
            
            .premium-folder-list .list-item:hover {
                background: var(--gf-hover-bg);
            }
            
            /* Premium Modal Footer */
            .premium-modal-footer {
                padding: 24px;
                border-top: 1px solid var(--gf-border-color);
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                flex-shrink: 0;
            }
            
            /* Scrollbar Styling */
            .premium-modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .premium-modal-body::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .premium-modal-body::-webkit-scrollbar-thumb {
                background: var(--gf-border-color);
                border-radius: 4px;
            }
            
            .premium-modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--gf-text-tertiary);
            }
        `,g.appendChild(e),!g.getElementById("plan-chip-styles")){const t=document.createElement("style");t.id="plan-chip-styles",t.textContent=`
                /* Keep title/chip on one line without breaking layout */
#gemini-toolbox-btn #toolbox-title {
                    flex: 0 1 auto;
                    white-space: nowrap;         /* keep on one line */
                    display: inline-flex;
                    align-items: center;
                }

                .plan-chip {
                    margin-left: 8px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 18px;
                    border: 1px solid var(--gf-border-color);
                    color: var(--gf-text-secondary);
                    background: var(--gf-bg-secondary);
                    white-space: nowrap;       /* Prevent internal wrap */
                    flex: 0 0 auto;            /* Keep full chip visible */
                }
                .plan-chip--premium {
                    color: var(--gf-button-text) !important;  /* Black in dark mode, white in light mode */
                    background: var(--gf-accent-primary);
                    border-color: transparent;
                }
            `,g.appendChild(t)}setTimeout(()=>{Me()},100)}function Me(){if(!z)return;ke=xe();const e=ke==="dark";e?(z.style.setProperty("--gf-bg-primary","#272A2C"),z.style.setProperty("--gf-bg-secondary","#1E2124"),z.style.setProperty("--gf-text-primary","#E3E3E3"),z.style.setProperty("--gf-text-secondary","#C2C2C2"),z.style.setProperty("--gf-text-tertiary","#9CA3AF"),z.style.setProperty("--gf-border-color","#404040"),z.style.setProperty("--gf-hover-bg","#3A3D40"),z.style.setProperty("--gf-accent-primary","#8AB4F8"),z.style.setProperty("--gf-accent-danger","#B00020"),z.style.setProperty("--gf-success-text","#FFFFFF"),z.style.setProperty("--gf-danger-text","#FFFFFF"),z.style.setProperty("--gf-info-text","#1A1A1A"),z.style.setProperty("--gf-bg-input","#1E2124"),z.style.setProperty("--gf-white","#FFFFFF"),z.style.setProperty("--gf-button-text","#1a1a1a"),z.style.setProperty("--toast-bg","#131314"),z.style.setProperty("--toast-text","#e3e3e3"),z.style.setProperty("--toast-error-text","#f28b82"),z.style.setProperty("--toast-action","#8ab4f8"),z.style.setProperty("--toast-action-hover","rgba(138, 180, 248, 0.08)"),z.style.setProperty("--toast-action-active","rgba(138, 180, 248, 0.16)"),z.style.setProperty("--toast-shadow","0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)")):(z.style.setProperty("--gf-bg-primary","#F0F4F8"),z.style.setProperty("--gf-bg-secondary","#FFFFFF"),z.style.setProperty("--gf-text-primary","#1F2937"),z.style.setProperty("--gf-text-secondary","#5B6670"),z.style.setProperty("--gf-border-color","#D1D5DB"),z.style.setProperty("--gf-hover-bg","#E5E7EB"),z.style.setProperty("--gf-accent-primary","#1D4ED8"),z.style.setProperty("--gf-accent-danger","#DC2626"),z.style.setProperty("--gf-accent-warning","#F59E0B"),z.style.setProperty("--gf-success-text","#FFFFFF"),z.style.setProperty("--gf-danger-text","#FFFFFF"),z.style.setProperty("--gf-info-text","#FFFFFF"),z.style.setProperty("--gf-bg-input","#FFFFFF"),z.style.setProperty("--gf-white","#FFFFFF"),z.style.setProperty("--gf-button-text","#FFFFFF"),z.style.setProperty("--toast-bg","#ffffff"),z.style.setProperty("--toast-text","#3c4043"),z.style.setProperty("--toast-error-text","#d33333"),z.style.setProperty("--toast-action","#1a73e8"),z.style.setProperty("--toast-action-hover","rgba(26, 115, 232, 0.08)"),z.style.setProperty("--toast-action-active","rgba(26, 115, 232, 0.16)"),z.style.setProperty("--toast-shadow","0 1px 3px rgba(60,64,67,0.3), 0 1px 2px rgba(60,64,67,0.15)")),g&&g.host&&g.querySelectorAll("*").forEach(n=>{n.style&&(n.style.opacity="0.999",requestAnimationFrame(()=>{n.style.opacity=""}))}),g&&g.host&&(e?(g.host.classList.remove("light-theme"),g.host.classList.add("dark-theme")):(g.host.classList.add("light-theme"),g.host.classList.remove("dark-theme")));const t=g&&g.getElementById("prompt-library-modal");t&&(e?t.classList.remove("prompt-library-light"):t.classList.add("prompt-library-light")),window.geminiToolboxDebug={detectTheme:xe,applyTheme:Me,currentTheme:()=>ke}}function _t(){if(!g)return null;const e=g.getElementById("toolbox-title");if(!e)return null;let t=g.getElementById("plan-chip");return t||(t=document.createElement("span"),t.id="plan-chip",t.className="plan-chip",t.setAttribute("aria-live","polite"),e.insertAdjacentElement("afterend",t)),t}function Ge(e){const t=_t();t&&(t.className="plan-chip",e?(t.textContent="Premium",t.classList.add("plan-chip--premium"),t.setAttribute("aria-label","Premium plan active")):(t.textContent="Free",t.setAttribute("aria-label","Free plan")))}function Ht(){return`
            <div id="gemini-toolbox-container" class="sidebar-tab">
                <div id="gemini-toolbox-btn" class="toolbox-button" 
                     role="button" 
                     tabindex="0"
                     aria-label="Gemini Toolbox menu"
                     aria-expanded="false"
                     aria-controls="gemini-toolbox-dropdown">
                <svg width="24" height="24" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M270.0 139.5 L240.5 139.0 L240.5 95.0 L255.0 70.5 L270.5 94.0 L270.0 139.5 Z M49.0 190.5 L35.5 177.0 L30.5 158.0 L72.0 138.5 L104.0 103.5 L132.0 93.5 L163.0 92.5 L201.5 109.0 L169.0 109.5 L149.0 118.5 L138.5 132.0 L150.5 154.0 L116.0 174.5 L96.0 156.5 L49.0 190.5 Z M426.0 133.5 L394.5 125.0 L421.0 100.5 L442.0 92.5 L426.0 133.5 Z M374.0 213.5 L348.5 190.0 L362.5 159.0 L363.5 129.0 L444.0 145.5 L452.5 136.0 L465.0 96.5 L480.5 126.0 L479.5 148.0 L469.5 168.0 L457.0 179.5 L395.0 198.5 L374.0 213.5 Z M286.0 232.5 L225.5 232.0 L225.5 204.0 L240.5 198.0 L241.0 148.5 L270.5 149.0 L270.5 198.0 L285.5 204.0 L286.0 232.5 Z M399.5 185.0 L406.5 171.0 L393.0 156.5 L382.0 155.5 L377.5 169.0 L399.5 185.0 Z M188.0 232.5 L152.0 232.5 L119.5 182.0 L155.0 162.5 L188.0 232.5 Z M356.0 232.5 L302.5 232.0 L342.0 195.5 L366.5 220.0 L356.0 232.5 Z M431.0 282.5 L80.0 282.5 L64.5 270.0 L63.5 242.0 L447.0 241.5 L446.5 270.0 L431.0 282.5 Z M379.0 440.5 L132.0 440.5 L115.0 434.5 L94.5 406.0 L93.5 292.0 L126.5 292.0 L127.5 345.0 L138.0 358.5 L157.0 362.5 L177.5 343.0 L178.0 291.5 L333.0 291.5 L334.5 346.0 L345.0 358.5 L363.0 362.5 L383.5 345.0 L384.5 292.0 L417.0 291.5 L416.5 406.0 L400.0 431.5 L379.0 440.5 Z M156.0 353.5 L145.0 352.5 L135.5 341.0 L136.0 291.5 L168.5 292.0 L168.5 342.0 L156.0 353.5 Z M363.0 353.5 L350.0 351.5 L342.5 342.0 L343.0 291.5 L375.5 292.0 L375.5 341.0 L363.0 353.5 Z" fill="currentColor" fill-rule="evenodd"/>
                </svg>
                    <span id="toolbox-title">Gemini Toolbox</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-arrow" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div id="gemini-toolbox-dropdown" class="toolbox-dropdown" role="menu" aria-labelledby="gemini-toolbox-btn">
                    <div class="dropdown-group">
                        <div class="dropdown-group-label">Chat Management</div>
                        <div id="manage-folders-link" class="dropdown-item" role="menuitem" tabindex="-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" aria-hidden="true">
                                <path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Manage Folders</span>
                        </div>
                        <div id="chat-tools-link" class="dropdown-item" role="menuitem" tabindex="-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" aria-hidden="true">
                                <path d="M9 3H4C3.44772 3 3 3.44772 3 4V9C3 9.55228 3.44772 10 4 10H9C9.55228 10 10 9.55228 10 9V4C10 3.44772 9.55228 3 9 3Z" stroke="currentColor" stroke-width="2"/>
                                <path d="M20 3H15C14.4477 3 14 3.44772 14 4V9C14 9.55228 14.4477 10 15 10H20C20.5523 10 21 9.55228 21 9V4C21 3.44772 20.5523 3 20 3Z" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 14H4C3.44772 14 3 14.4477 3 15V20C3 20.5523 3.44772 21 4 21H9C9.55228 21 10 20.5523 10 20V15C10 14.4477 9.55228 14 9 14Z" stroke="currentColor" stroke-width="2"/>
                                <path d="M20 14H15C14.4477 14 14 14.4477 14 15V20C14 20.5523 14.4477 21 15 21H20C20.5523 21 21 20.5523 21 20V15C21 14.4477 20.5523 14 20 14Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <span>Chat Tools</span>
                        </div>
                    </div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-group">
                        <div class="dropdown-group-label">Utilities</div>
                        <div id="prompt-library-link" class="dropdown-item" role="menuitem" tabindex="-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" aria-hidden="true">
                                <path d="M4 19.5A2.5 2.5 0 0 1 1.5 17V7A2.5 2.5 0 0 1 4 4.5h16A2.5 2.5 0 0 1 22.5 7v10a2.5 2.5 0 0 1-2.5 2.5H4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Prompt Management</span>
                        </div>
                        <!--
                        <div id="image-gallery-link" class="dropdown-item" role="menuitem" tabindex="-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" aria-hidden="true">
                                <path d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Image Gallery</span>
                            <span class="dropdown-badge" style="background-color: rgba(138, 180, 248, 0.2); color: var(--gf-accent-primary);">BETA</span>
                        </div>
                        -->
                        <div id="settings-link" class="dropdown-item" role="menuitem" tabindex="-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" aria-hidden="true">
                                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <span>Settings</span>
                        </div>
                    </div>
                </div>
            </div>
        `}function st(){const e=t(null,0);function t(o,n){let r="";return C.folders.filter(i=>i.parentId===o).forEach(i=>{const c=(i.chatIds?.length||0)===0?" is-empty":"";r+=`
                    <div class="premium-folder-item${c} ${n>0?"subfolder-level-"+n:""}" data-folder-id="${i.id}">
                        <div class="premium-folder-content">
                            ${n>0?'<span class="subfolder-spacer" style="width: '+n*20+'px; flex-shrink: 0;"></span>':""}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="premium-folder-icon">
                                <path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z"/>
                            </svg>
                            <span class="premium-folder-name">${i.name}</span>
                            <span class="premium-folder-count">${i.chatIds?.length||0}</span>
                        </div>
                        <div class="premium-folder-actions">
                             <button class="premium-icon-btn add-chats-btn" data-folder-id="${i.id}" title="Add Chats">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                             </button>
                             <button class="premium-icon-btn edit-folder-btn" data-folder-id="${i.id}" title="Edit Folder">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                             </button>
                             <button class="premium-icon-btn add-subfolder-btn" data-parent-id="${i.id}" title="Add Subfolder" aria-label="Add subfolder to ${i.name}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-folder-plus"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                            </button>
                             <button class="premium-icon-btn delete-folder-btn" data-folder-id="${i.id}" title="Delete Folder" aria-label="Delete ${i.name}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `,r+=t(i.id,n+1)}),r}return`
            <div class="premium-modal-header">
                <h2 class="premium-modal-title">Manage Folders</h2>
                <button class="premium-modal-close" id="close-modal-btn" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="premium-modal-actions">
                <button class="premium-button premium-button-primary" id="add-folder-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>New Folder</span>
                </button>
                <input type="search" id="search-folders-input" 
                       class="premium-search-input"
                       placeholder="Search folders..." 
                       aria-label="Search folders">
                <label class="premium-checkbox-label">
                    <input type="checkbox" 
                           id="hide-foldered-toggle" 
                           class="premium-checkbox"
                           ${C.settings.hideFolderedChats?"checked":""} />
                    <span>Hide foldered chats</span>
                </label>
                <span class="premium-shortcut-hint" aria-label="Keyboard shortcut to open Manage Folders" title="Press G then F to open Manage Folders" style="margin-left: auto; color: var(--gf-text-secondary); font-size: 12px;">
                    Shortcut: G \u2192 F
                </span>
            </div>
            <div class="premium-modal-body">
                <div id="folder-list-container" class="premium-folder-list">
                    ${e||'<div class="premium-empty-state">No folders yet. Click "New Folder" to get started.</div>'}
                </div>
            </div>
            <div class="premium-modal-footer">
                <button type="button" id="done-manage-folders-btn" class="premium-button premium-button-secondary">Done</button>
            </div>
        `}function Ot(e){const t=C.selectedItems.includes(e.id);return`
            <div class="list-item folder-item" data-id="${e.id}">
                <input type="checkbox" class="item-checkbox" data-id="${e.id}" ${t?"checked":""}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="item-title">${e.name}</span>
                <span class="item-count" style="margin-left: auto; color: var(--gf-text-secondary);">(${e.chatIds.length})</span>
                <button class="add-chats-btn icon-btn" data-folder-id="${e.id}" title="Add chats to folder">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        `}function Bt(e=!1,t=""){const o=e?"Edit Folder Name":"Add New Folder",n=e?"Save Changes":"Create Folder";return`
            <form id="add-folder-form" autocomplete="off">
                <div style="margin-bottom: 20px;">
                    <label for="folder-name-input" class="sr-only">Folder name</label>
                    <input type="text" 
                           id="folder-name-input" 
                           name="${`gemini-folder-${Date.now()}-${Math.random().toString(36).substr(2,9)}`}"
                           value="${t}" 
                           placeholder="Enter folder name" 
                           autocomplete="new-password"
                           required 
                           aria-required="true" 
                           style="width: 100%; padding: var(--input-padding); border: 1px solid var(--gf-border-color); border-radius: var(--space-2); background: var(--gf-bg-input); color: var(--gf-text-primary); font-size: 14px; font-weight: 400; transition: all var(--anim-normal) var(--ease-out);">
                </div>
                <div class="modal-footer footer-spread" style="margin-top: var(--space-4);">
                    <button type="button" class="button secondary cancel-action">Cancel</button>
                    <button type="button" id="save-folder-btn" class="button primary">${n}</button>
                </div>
            </form>
        `}function Do(){return`
            <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: var(--gap-medium); margin-bottom: var(--space-4);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <p style="margin: 0; color: var(--gf-text-primary); font-size: 16px; font-weight: 500; line-height: 1.5;">
                        Are you sure you want to delete this folder and all its contents?
                    </p>
                </div>
                <p style="margin: 0 0 0 36px; color: var(--gf-text-secondary); font-size: 14px;">
                    This action cannot be undone.
                </p>
            </div>
            <div class="modal-footer">
                <button type="button" class="button secondary cancel-action">Cancel</button>
                    <button type="button" id="confirm-delete-btn" class="button danger" >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px; vertical-align: middle;">
                            <path d="M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1.5-1.5h9V2a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v.5zM6.5 6v5m3-5v5"/>
                        </svg>
                        Delete
                    </button>
            </div>
        `}function ye(e,t=null,o=!1,n=!1){return t||(t=new Set,C.folders.forEach(r=>{r.chatIds.forEach(a=>t.add(a))})),e.map((r,a)=>{const i=r.querySelector(".conversation-title"),c=i?i.textContent.trim():`Conversation ${a+1}`,l=V(r)||`chat-index-${a}`,d=t.has(l),p=zt(r)===!0,h=d&&!o||p&&!n;return`
                <div class="bulk-delete-item ${h?"foldered-protected":""}" data-is-foldered="${d}" data-is-pinned="${p}">
                    <input type="checkbox" id="del-check-${l}" class="bulk-delete-checkbox select-all-checkbox" data-type="chat" data-chat-id="${l}" ${h?"disabled":""}>
                    <span class="item-title" style="cursor: pointer; flex: 1;">${c}</span>
                    ${d&&!o?'<span class="protected-badge">Protected (Folder)</span>':""}
                    ${p&&!n?'<span class="protected-badge">Protected (Pinned)</span>':""}
                </div>
            `}).join("")}function Gt(e,t){let o="";return arguments.length===2&&t.length===0?o=`
                <div style="text-align: center; padding: 40px;">
                    <div style="width: 40px; height: 40px; border: 3px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                    <p style="color: var(--gf-text-secondary);">Loading all conversations...</p>
                </div>
            `:t&&t.length>0?o=t.map(n=>`
                <div class="list-item chat-item">
                    <input type="checkbox" class="chat-select-checkbox" data-chat-id="${n.id}">
                    <span class="item-title">${n.title}</span>
                </div>
            `).join(""):o='<p style="color: var(--gf-text-secondary); text-align: center; margin-top: 20px;">No available chats to add.</p>',`
            <div style="margin-bottom: 0px;">
                <p style="margin: 0 0 4px 0; color: var(--gf-text-secondary); font-size: 14px;">Select chats to add to this folder.</p>
                <div style="margin-top: 4px;">
                    <input type="text" id="add-chat-search" placeholder="Search chats..." class="search-input" style="width: 100%; padding: 8px 12px; border: 1px solid var(--gf-border-color); border-radius: 4px; background: var(--gf-bg-primary); color: var(--gf-text-primary);">
                </div>
                <div id="add-chats-search-loading" style="display: none; padding: 8px 12px; margin-top: 8px; background: var(--gf-bg-secondary); border-radius: 4px; color: var(--gf-accent-primary); font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 14px; height: 14px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span id="add-chats-search-status">Searching all conversations...</span>
                    </div>
                </div>
            </div>
            <div id="add-chats-list-container" style="max-height: 650px; overflow-y: auto; margin-bottom: 8px; margin-top: 4px; padding: 0px 4px 4px 4px;">
                ${o}
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gf-border-color);">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="select-all-chats">
                    <span>Select All</span>
                </label>
            </div>
            <div class="modal-footer">
                <div class="modal-actions">
                    <button type="button" class="button secondary cancel-action">Cancel</button>
                    <button type="button" id="save-add-chats" class="button primary">Add Selected</button>
                </div>
            </div>
        `}let We=!1;function Rt(){if(We)return;const e="gemini-toolbox-portal-styles";if(document.getElementById(e)){We=!0;return}const t=document.createElement("style");t.id=e,t.textContent=`
            /* Portal Modal Styles - Injected to document head for modals outside shadow DOM */
            .infi-chatgpt-modal.modal-portal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: wait;
                opacity: 0;
                animation: portalModalFadeIn 140ms ease-out forwards;
            }
            
            @keyframes portalModalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .infi-chatgpt-modal.modal-portal.closing {
                animation: portalModalFadeOut 90ms ease-in forwards;
            }
            
            @keyframes portalModalFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            .infi-chatgpt-modal.modal-portal .modal-content {
                pointer-events: auto;
                background: #1a1c20;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-modal-header {
                padding: 24px 28px;
                border-bottom: 1px solid #2d3139;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-modal-title {
                font-size: 20px;
                font-weight: 600;
                color: #e3e3e3;
                margin: 0;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-modal-body {
                padding: 40px;
                overflow-y: auto;
                flex: 1;
                color: #e3e3e3;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-modal-footer {
                padding: 24px 28px;
                border-top: 1px solid #2d3139;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-button {
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-button-secondary {
                background: #2d3139;
                color: #e3e3e3;
            }
            
            .infi-chatgpt-modal.modal-portal .premium-button-secondary:hover {
                background: #383c45;
            }
            
            /* Progress modal specific styles */
            .infi-chatgpt-modal.modal-portal .spinner {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `,document.head.appendChild(t),We=!0}function te(e,t,o,n=480,r={}){const{blocking:a=!1,portal:i=!1}=r,c=i?document.body:g;if(!c){console.error("[Gemini Toolbox] Modal container not available");return}i&&Rt();const l=c.querySelector(`#${e}`);if(l){try{c.appendChild(l)}catch{}const s=l.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');return s&&s.focus&&setTimeout(()=>s.focus(),50),ge=!0,C.modalType=e,l}if(i){const s=document.body.querySelector(".infi-chatgpt-modal.modal-portal");if(s&&s.id!==e)return console.warn("[Gemini Toolbox] Portal modal already exists:",s.id),null}const d=document.createElement("div");d.className="infi-chatgpt-modal",d.setAttribute("data-gemini-toolbox-modal","true"),a&&d.classList.add("modal-blocking"),i&&d.classList.add("modal-portal"),d.id=e,d._isPortal=i;let p=o;o.includes("modal-header")||(p=`
                <div class="modal-header">
                    <h2 id="${`modal-title-${e}`}">${t}</h2>
                    <button class="modal-close" id="close-modal-btn" aria-label="Close ${t}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${o}
                </div>
            `),d.innerHTML=`
            <div class="modal-content modal-${e}" style="width: ${n}px;">
               ${p}
            </div>
        `;const h=document.activeElement;c.appendChild(d);const b=d.querySelector("#close-modal-btn");if(b)b.addEventListener("click",R);else{const s=d.querySelector(".close-button, .cancel-button");s&&s.addEventListener("click",R)}a&&d.addEventListener("click",s=>{s.target===d&&(s.stopPropagation(),s.preventDefault())});const I=s=>{if(s.key==="Escape"&&ge){const E=Array.from(g.querySelectorAll(".infi-chatgpt-modal"));E[E.length-1]===d&&R()}};document.addEventListener("keydown",I),d._escKeyHandler=I,d._previouslyFocusedElement=h;const F=d.querySelector(".modal-content");if(F){F.setAttribute("role","dialog"),F.setAttribute("aria-modal","true");const s=F.querySelector("h2[id]");s?F.setAttribute("aria-labelledby",s.id):F.setAttribute("aria-label",t);const E=F.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');let m=E[0];m&&m.classList.contains("modal-close")&&E.length>1&&(m=E[1]),m&&setTimeout(()=>m.focus(),100)}d.addEventListener("keydown",s=>{if(s.key==="Escape"){const E=Array.from(g.querySelectorAll(".infi-chatgpt-modal"));E[E.length-1]===d&&R()}}),d.addEventListener("click",s=>{s.target===d&&R()});const N=s=>{if(!s.target||s.target===document||s.target===window||!document.contains(s.target))return;const E=Array.from(g.querySelectorAll(".infi-chatgpt-modal"));if(!E.length)return;const m=E[E.length-1];m&&!m.contains(s.target)&&g.contains(m)&&setTimeout(()=>{if(g.contains(m)&&!document.activeElement?.matches('input[type="text"], input[type="search"]')){const y=m.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');if(y)try{y.focus()}catch{}}},50)};document.addEventListener("focusin",N),d._focusInHandler=N,ge=!0,C.modalType=e}function lt(){if(!g)return;const e=Array.from(g.querySelectorAll(".infi-chatgpt-modal"));e.reverse().forEach(t=>{t._escKeyHandler&&document.removeEventListener("keydown",t._escKeyHandler),t._focusInHandler&&document.removeEventListener("focusin",t._focusInHandler),t.remove()}),e.length>0&&(ge=!1,C.modalType=null)}function R(){const e=g?Array.from(g.querySelectorAll(".infi-chatgpt-modal")):[],t=Array.from(document.body.querySelectorAll('.infi-chatgpt-modal[data-gemini-toolbox-modal="true"]')),o=[...e,...t];if(o.length===0){ge=!1,C.modalType=null;return}const n=o[o.length-1];n&&(n.classList.add("closing"),setTimeout(()=>{try{const a=n._isPortal?document.body:g;if(a&&a.contains(n)&&a.removeChild(n),n._escKeyHandler&&document.removeEventListener("keydown",n._escKeyHandler),n._focusInHandler&&document.removeEventListener("focusin",n._focusInHandler),n._previouslyFocusedElement&&n._previouslyFocusedElement.focus)try{n._previouslyFocusedElement.focus()}catch{}}catch(r){console.error("[Gemini Toolbox] Error closing modal:",r)}},100)),setTimeout(()=>{const r=g?Array.from(g.querySelectorAll(".infi-chatgpt-modal")):[],a=Array.from(document.body.querySelectorAll('.infi-chatgpt-modal[data-gemini-toolbox-modal="true"]')),i=[...r,...a].pop();if(i){const c=i._childOpener||i.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');try{c&&c.focus&&c.focus()}catch{}ge=!0,C.modalType=i.id||null}else ge=!1,C.modalType=null},120)}function Ke(e,t,o="Confirm",n=!1){return new Promise(r=>{const a=`confirm-dialog-${Date.now()}`,c=`
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        ${n?`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-danger, #ea4335)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                   </svg>`:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-warning, #fbbc04)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                   </svg>`}
                        <p style="margin: 0; font-size: 15px; color: var(--gf-text-primary); line-height: 1.5;">
                            ${t}
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="confirm-cancel-btn" class="btn-secondary" style="padding: 10px 20px; border-radius: 8px; border: 1px solid var(--gf-border-color); background: var(--gf-bg-secondary); color: var(--gf-text-primary); cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                        Cancel
                    </button>
                    <button id="confirm-action-btn" class="btn-primary" style="padding: 10px 20px; border-radius: 8px; border: none; background: ${n?"var(--gf-accent-danger, #ea4335)":"var(--gf-accent-primary)"}; color: white; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                        ${o}
                    </button>
                </div>
            `;te(a,e,c,480),setTimeout(()=>{const l=g.querySelector(`#${a}`);if(!l){r(!1);return}const d=l.querySelector("#confirm-action-btn"),p=l.querySelector("#confirm-cancel-btn"),h=()=>{R(),r(!0)},b=()=>{R(),r(!1)};d&&d.addEventListener("click",h),p&&p.addEventListener("click",b);const I=l.querySelector("#close-modal-btn");I&&I.addEventListener("click",b)},50)})}async function zo(){const e=g.getElementById("folder-list-container");if(!e)return;e.innerHTML="";const t=C.folders;if(t.length===0){e.innerHTML='<p>No folders yet. Click "Add Folder" to create one.</p>';return}t.forEach(o=>{const n=Ot(o);e.innerHTML+=n}),Vt()}function Vt(){g.querySelectorAll(".folder-item").forEach(e=>{e.addEventListener("click",Ut)}),g.querySelectorAll(".item-checkbox").forEach(e=>{e.addEventListener("change",dt)}),g.querySelectorAll(".add-chats-btn").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();const o=t.currentTarget.dataset.folderId;Ze(o)})})}function Ut(e){if(e.target.type==="checkbox")return;const t=e.currentTarget.dataset.id;ut(t)}function dt(e){const t=e.target.dataset.folderId;e.target.checked?C.selectedItems.includes(t)||C.selectedItems.push(t):C.selectedItems=C.selectedItems.filter(o=>o!==t),ct()}function ct(){const e=g.querySelector("#remove-selected-btn");e&&(e.disabled=C.selectedItems.length===0)}async function pt(){const e=g.querySelector("#manage-folders-modal");if(!e)return;const t=e.querySelector(".modal-content");if(!t)return;t._clickHandler&&t.removeEventListener("click",t._clickHandler),t._clickHandler=r=>{const a=r.target;if(a.closest("#close-modal-btn")||a.closest("#close-manage-folders-btn")||a.closest("#done-manage-folders-btn"))R();else if(a.closest("#add-folder-btn"))Xe();else if(a.closest(".add-subfolder-btn")){const i=a.closest(".add-subfolder-btn").dataset.parentId;Xe(!1,null,i)}else if(a.closest(".add-chats-btn")){const i=a.closest(".add-chats-btn").dataset.folderId;Ze(i)}else if(a.closest(".edit-folder-btn")){const i=a.closest(".edit-folder-btn").dataset.folderId;Xe(!0,i)}else if(a.closest(".delete-folder-btn")){const i=a.closest(".delete-folder-btn").dataset.folderId,c=C.folders.find(l=>l.id===i);c&&Xt(i,c.name)}else if(a.closest("#remove-selected-btn")){const i=e.querySelectorAll(".folder-checkbox:checked");i.length>0&&Kt(i)}else if(a.closest(".premium-folder-name")){const i=a.closest(".premium-folder-item").dataset.folderId;ut(i)}},t.addEventListener("click",t._clickHandler),t._changeHandler&&t.removeEventListener("change",t._changeHandler),t._changeHandler=r=>{r.target.classList.contains("folder-checkbox")?dt(r):r.target.matches("#hide-foldered-toggle")&&(C.settings.hideFolderedChats=r.target.checked,Ce(),Ee(),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"hideFolderedChats",enabled:r.target.checked}))},t.addEventListener("change",t._changeHandler);const o=e.querySelector("#search-folders-input"),n=e.querySelector("#folder-list-container");o&&n&&o.addEventListener("input",r=>{const a=r.target.value.toLowerCase(),i=e.querySelectorAll(".premium-folder-item");let c=0;i.forEach(d=>{const h=d.querySelector(".premium-folder-name").textContent.toLowerCase().includes(a);d.style.display=h?"flex":"none",h&&c++});const l=n.querySelector(".premium-empty-state");l&&l.remove(),c===0&&a&&n.insertAdjacentHTML("beforeend",`
                        <div class="premium-empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.4;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <p style="margin: 0; font-size: 14px;">No folders found matching "${a}"</p>
                        </div>
                    `)}),ct()}function jt(e=!1,t=null,o=null){const n=g.querySelector("#add-folder-modal");if(!n)return;const r=n.querySelector("#add-folder-form"),a=n.querySelector("#folder-name-input"),i=n.querySelector("#save-folder-btn"),c=n.querySelector(".cancel-action");if(!r||!a||!i)return;const l=()=>{n&&n.parentNode&&n.remove()},d=async p=>{p.preventDefault(),p.stopPropagation();const h=a.value.trim();if(!h)return;const b=window.geminiAPI;let I=null;if(e){const F=C.folders.find(N=>N.id===t);F&&(F.name=h)}else{if(o){let s=!1;try{b&&typeof b.getSubscriptionStatus=="function"&&(s=!!(await b.getSubscriptionStatus())?.isPremium)}catch{}if(!s){b&&CONFIG.ANALYTICS_EVENTS&&b.trackEvent(CONFIG.ANALYTICS_EVENTS.LIMIT_HIT,{feature:"subfolders",message:"Subfolders are a premium feature"}),l(),Pe("subfolders",{allowed:!1,limit:"Premium only",count:0,message:"Subfolders are a Premium feature"});return}}let F=null;try{b&&typeof b.checkFeatureLimit=="function"&&(F=await b.checkFeatureLimit("folders",!1))}catch{}if(!F){const s=typeof CONFIG<"u"&&CONFIG.FREE_LIMITS&&typeof CONFIG.FREE_LIMITS.folders=="number"?CONFIG.FREE_LIMITS.folders:2,E=Array.isArray(C.folders)?C.folders.length:0;F={allowed:E<s,limit:s,count:E,remaining:Math.max(0,s-E),unlimited:!1}}if(!F.allowed){b&&CONFIG.ANALYTICS_EVENTS&&b.trackEvent(CONFIG.ANALYTICS_EVENTS.LIMIT_HIT,{feature:"folders",currentCount:typeof F.count=="number"?F.count:C.folders.length,limit:typeof F.limit=="number"?F.limit:CONFIG.FREE_LIMITS?.folders??2}),l(),Pe("folders",F);return}window.geminiStorage||(window.geminiStorage=new GeminiToolboxStorage,await window.geminiStorage.initialize());const N=await window.geminiStorage.createFolder(h,o);I=N,C.folders.push({id:N.id,name:N.name,chatIds:N.chatIds||[],parentId:N.parentId});try{b&&CONFIG.ANALYTICS_EVENTS&&b.trackEvent(CONFIG.ANALYTICS_EVENTS.FOLDER_CREATED,{folderName:h,isSubfolder:!!o,totalFolders:C.folders.length})}catch{}}if(Ce(),l(),Ae(),!e&&I&&(!I.chatIds||I.chatIds.length===0))try{Ze(I.id)}catch{}};r.addEventListener("submit",d),i.addEventListener("click",d),c&&c.addEventListener("click",p=>{p.preventDefault(),p.stopPropagation(),l()}),a.focus()}function Yt(e){const t=g.querySelector("#add-chats-modal");if(!t)return;const o=t.querySelector("#save-add-chats"),n=t.querySelector(".cancel-action"),r=t.querySelector("#add-chat-search"),a=t.querySelector("#select-all-chats"),i=t.querySelector("#add-chats-list-container"),c=t.querySelector("#add-chats-search-loading"),l=t.querySelector("#add-chats-search-status");let d=[],p=new Set,h=!1,b=null;t.querySelectorAll(".chat-item").forEach(m=>{const y=m.querySelector(".chat-select-checkbox")?.dataset.chatId,f=m.querySelector(".item-title")?.textContent||"";y&&(d.push({id:y,title:f}),p.add(y))});async function F(){const m=document.querySelector("conversations-list")||document.querySelector('[role="navigation"]')||N(document.querySelector('[data-test-id="conversation"]'));if(m){m.scrollTop=m.scrollHeight,m.dispatchEvent(new Event("scroll",{bubbles:!0})),await new Promise(f=>setTimeout(f,50));const y=Array.from(U()).pop();if(y){y.scrollIntoView({block:"end"});const f=new WheelEvent("wheel",{deltaY:100,bubbles:!0,cancelable:!0});m.dispatchEvent(f)}await new Promise(f=>setTimeout(f,200))}}function N(m){if(!m)return null;let y=m.parentElement;for(;y&&y!==document.body;){if(y.scrollHeight>y.clientHeight)return y;y=y.parentElement}return null}async function s(){if(h)return;c&&(c.style.display="block"),l&&(l.textContent="Searching all conversations...");let m=0;const y=5;for(;m<y;){const f=d.length;await F(),await new Promise(P=>setTimeout(P,500));const v=ae(),A=new Set;C.folders.forEach(P=>{P.chatIds.forEach(L=>A.add(L))});const q=v.filter(P=>P.id&&!A.has(P.id)&&!p.has(P.id));q.length>0?(q.forEach(P=>{p.add(P.id),d.push(P)}),m=0,l&&(l.textContent=`Searching... (${d.length} found)`)):m++,await new Promise(P=>setTimeout(P,100))}for(let f=0;f<2;f++){await F();const v=ae(),A=new Set;C.folders.forEach(P=>{P.chatIds.forEach(L=>A.add(L))});const q=v.filter(P=>P.id&&!A.has(P.id)&&!p.has(P.id));q.length>0&&q.forEach(P=>{p.add(P.id),d.push(P)})}h=!0,c&&(c.style.display="none")}function E(m){const y=m.toLowerCase(),f=y?d.filter(v=>v.title.toLowerCase().includes(y)):d;if(f.length>0){const v=f.map(A=>`
                    <div class="list-item chat-item">
                        <input type="checkbox" class="chat-select-checkbox" data-chat-id="${A.id}">
                        <span class="item-title">${A.title}</span>
                    </div>
                `).join("");i.innerHTML=v}else i.innerHTML='<p style="color: var(--gf-text-secondary); text-align: center; margin-top: 20px;">No matching conversations found.</p>'}r&&r.addEventListener("input",async m=>{const y=m.target.value.trim();b&&clearTimeout(b),y&&!h?b=setTimeout(async()=>{await s(),E(y)},300):E(y)}),a&&a.addEventListener("change",async m=>{const y=m.target.checked;if(y&&!h){a.disabled=!0,await s();const v=r?r.value.trim():"";E(v),a.disabled=!1}t.querySelectorAll('.chat-item:not([style*="display: none"]) .chat-select-checkbox').forEach(v=>{v.checked=y})}),i&&i.addEventListener("click",m=>{if(m.target&&(m.target.matches('input[type="checkbox"]')||m.target.closest('input[type="checkbox"]')))return;const y=m.target&&m.target.closest?m.target.closest(".chat-item"):null;if(!y)return;const f=y.querySelector(".chat-select-checkbox");f&&(f.checked=!f.checked)}),o.addEventListener("click",async()=>{const m=t.querySelectorAll(".chat-select-checkbox:checked"),y=Array.from(m).map(f=>f.dataset.chatId);if(y.length>0){const f=C.folders.find(v=>v.id===e);if(f){const v={};Array.from(m).forEach(A=>{const q=A.dataset.chatId,P=U().find(L=>V(L)===q);if(P){let L=P.querySelector(".conversation-title, .title")?.textContent.trim();L||(L=P.textContent.trim().split(`
`)[0]);const H=P.querySelector("a[href]")?.getAttribute("href");if(L)if(v[q]={title:L},H)v[q].url=H.startsWith("http")?H:`https://gemini.google.com${H.startsWith("/")?"":"/"}${H}`;else{const B=q.startsWith("c_")?q.substring(2):q;v[q].url=`https://gemini.google.com/app/${B}`}}else{const L=A.closest(".chat-item"),$=L?L.querySelector(".item-title"):null;if($){const H=q.startsWith("c_")?q.substring(2):q;v[q]={title:$.textContent.trim(),url:`https://gemini.google.com/app/${H}`}}}});for(const A of y)f.chatIds.includes(A)||(f.chatIds.push(A),window.geminiStorage&&await window.geminiStorage.addChatToFolder(A,e,v[A]),v[A]&&(C.chatMetadata[A]={...C.chatMetadata[A]||{},...v[A],lastSeen:Date.now()}));await Ce(),window.geminiAPI&&window.geminiAPI.trackEvent&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.CHAT_ADDED_TO_FOLDER,{folderId:e,chatCount:y.length,totalChatsInFolder:f.chatIds.length})}}R(),Ae()}),n&&n.addEventListener("click",()=>{R()})}async function $o(){const t=U().map(n=>({id:V(n),title:n.textContent.trim()})),o=new Set;return C.folders.forEach(n=>{n.chatIds.forEach(r=>o.add(r))}),t.filter(n=>n.id&&!o.has(n.id))}async function _o(){const e=ae(),t=new Set;return C.folders.forEach(n=>{n.chatIds.forEach(r=>t.add(r))}),e.filter(n=>n.id&&!t.has(n.id))}function Ho(e){const t=g.querySelector("#add-chats-modal");if(!t)return;const o=t.querySelector("#add-chats-list-container");if(o)if(e.length>0){const n=e.map(r=>`
                <div class="list-item chat-item">
                    <input type="checkbox" class="chat-select-checkbox" data-chat-id="${r.id}">
                    <span class="item-title">${r.title}</span>
                </div>
            `).join("");o.innerHTML=n}else o.innerHTML='<p style="color: var(--gf-text-secondary); text-align: center; margin-top: 20px;">No available chats to add.</p>'}function Wt(e){const t=[],o=C.folders.find(r=>r.id===e);return o&&o.chatIds&&t.push(...o.chatIds),C.folders.filter(r=>r.parentId===e).forEach(r=>{t.push(...Wt(r.id))}),t}function Oo(e){const t=new Set(e);function o(n){C.folders.filter(a=>a.parentId===n).forEach(a=>{t.add(a.id),o(a.id)})}e.forEach(n=>{o(n)}),C.folders=C.folders.filter(n=>!t.has(n.id))}function Kt(e){const t=e.length,o=`
            <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: var(--gap-medium); margin-bottom: var(--space-4);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <p style="margin: 0; color: var(--gf-text-primary); font-size: 16px; font-weight: 500; line-height: 1.5;">
                        Are you sure you want to delete ${t} folder${t>1?"s":""} and all ${t>1?"their":"its"} contents?
                    </p>
                </div>
                <p style="margin: 0 0 0 36px; color: var(--gf-text-secondary); font-size: 14px;">
                    This action cannot be undone.
                </p>
            </div>
            <div class="modal-footer">
                <button type="button" class="button secondary cancel-action">Cancel</button>
                    <button type="button" id="confirm-bulk-delete" class="button danger" >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px; vertical-align: middle;">
                            <path d="M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1.5-1.5h9V2a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v.5zM6.5 6v5m3-5v5"/>
                        </svg>
                        Delete
                    </button>
            </div>
        `;te("confirm-bulk-delete-modal","Confirm Deletion",o,480),setTimeout(()=>{const n=g.querySelector("#confirm-bulk-delete"),r=g.querySelector("#confirm-bulk-delete-modal .button.secondary.cancel-action");n&&(n.onclick=()=>{const a=new Set;e.forEach(c=>{const l=c.closest(".list-item");if(l&&l.dataset.folderId){let p=function(h){C.folders.filter(I=>I.parentId===h).forEach(I=>{a.add(I.id),p(I.id)})};const d=l.dataset.folderId;a.add(d),p(d)}});const i=C.folders.filter(c=>a.has(c.id));window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&i.forEach(c=>{window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FOLDER_DELETED,{folderName:c.name,hadChildren:C.folders.some(l=>l.parentId===c.id),wasSubfolder:!!c.parentId})}),C.folders=C.folders.filter(c=>!a.has(c.id)),Ce(),R(),Ae()}),r&&(r.onclick=()=>{R()})},100)}function Xt(e,t){const o=`
            <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: var(--gap-medium); margin-bottom: var(--space-4);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <p style="margin: 0; color: var(--gf-text-primary); font-size: 16px; font-weight: 500; line-height: 1.5;">
                        Are you sure you want to delete this folder?
                    </p>
                </div>
                <p style="margin: 0 0 0 36px; color: var(--gf-text-secondary); font-size: 14px;">
                    "<strong>${t}</strong>" will be permanently deleted. Chats in this folder will not be deleted and will remain in your conversation list. This action cannot be undone.
                </p>
            </div>
            <div class="modal-footer">
                <button type="button" class="button secondary cancel-action">Cancel</button>
                    <button type="button" id="confirm-delete-single" class="button danger" >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px; vertical-align: middle;">
                            <path d="M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1.5-1.5h9V2a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v.5zM6.5 6v5m3-5v5"/>
                        </svg>
                        Delete
                    </button>
            </div>
        `;te("confirm-delete-modal","Confirm Deletion",o,480),setTimeout(()=>{const n=g.querySelector("#confirm-delete-single"),r=g.querySelector("#confirm-delete-modal .button.secondary.cancel-action");n&&(n.onclick=()=>{const a=new Set([e]);function i(l){C.folders.filter(p=>p.parentId===l).forEach(p=>{a.add(p.id),i(p.id)})}i(e);const c=C.folders.filter(l=>a.has(l.id));window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&c.forEach(l=>{window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FOLDER_DELETED,{folderName:l.name,hadChildren:C.folders.some(d=>d.parentId===l.id),wasSubfolder:!!l.parentId})}),C.folders=C.folders.filter(l=>!a.has(l.id)),Ce(),R(),Ae()}),r&&(r.onclick=()=>{R()})},100)}function Ae(){const e=g.querySelector("#manage-folders-modal");if(!e)return;const t=e.querySelector(".modal-content");if(!t)return;const o=t.querySelector("#search-folders-input"),n=o?o.value:"",r=t.querySelector("#hide-foldered-toggle"),a=r?r.checked:C.settings.hideFolderedChats,i=st(),c=document.createElement("div");c.innerHTML=i;const l=c.querySelector(".premium-modal-body"),d=t.querySelector(".premium-modal-body");if(l&&d){d.innerHTML=l.innerHTML;const p=t.querySelector("#search-folders-input");p&&n&&(p.value=n,p.dispatchEvent(new Event("input")));const h=t.querySelector("#hide-foldered-toggle");h&&(h.checked=a),pt()}}function mt(){const e=g&&g.querySelector("#manage-folders-modal");if(e){try{g.appendChild(e)}catch{}try{Ae()}catch{}const t=e.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');t&&t.focus&&setTimeout(()=>t.focus(),50),ge=!0,C.modalType="manage-folders-modal";return}te("manage-folders-modal","Manage Folders",st(),800),pt()}function Xe(e=!1,t=null,o=null){const n=e?C.folders.find(a=>a.id===t):null;te("add-folder-modal",e?"Edit Folder":o?"Add Subfolder":"Add Folder",Bt(e,n?n.name:""),480),jt(e,t,o)}async function Ze(e){const t=C.folders.find(a=>a.id===e);if(!t)return;const o=ae(),n=new Set;C.folders.forEach(a=>{a.chatIds.forEach(i=>n.add(i))});const r=o.filter(a=>a.id&&!n.has(a.id));te("add-chats-modal",`Add Chats to "${t.name}"`,Gt(t,r),720),setTimeout(()=>{const a=g.querySelector("#add-chats-modal");if(!a)return;const i=a.querySelector("#add-chats-list-container");if(!i)return;const c=new Set;r.forEach(f=>{f.id&&c.add(f.id)});let l=!1,d=0;const p=3;let h=null;async function b(){const f=document.querySelector("conversations-list")||document.querySelector('[role="navigation"]')||I(document.querySelector('[data-test-id="conversation"]'));if(f){f.scrollTop=f.scrollHeight,f.dispatchEvent(new Event("scroll",{bubbles:!0})),await new Promise(A=>setTimeout(A,50));const v=Array.from(U()).pop();if(v){v.scrollIntoView({block:"end"});const A=new WheelEvent("wheel",{deltaY:100,bubbles:!0,cancelable:!0});f.dispatchEvent(A)}await new Promise(A=>setTimeout(A,200))}}function I(f){if(!f)return null;let v=f.parentElement;for(;v&&v!==document.body;){if(v.scrollHeight>v.clientHeight)return v;v=v.parentElement}return null}async function F(){if(l||d>=p)return;l=!0;const f=document.createElement("div");f.style.cssText="text-align: center; padding: 10px; color: var(--gf-text-secondary);",f.innerHTML='<div style="display: inline-block; width: 20px; height: 20px; border: 2px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div> Loading more...',i.appendChild(f);try{await b(),await new Promise(P=>setTimeout(P,500));const v=ae(),A=new Set;C.folders.forEach(P=>{P.chatIds.forEach(L=>A.add(L))});const q=v.filter(P=>P.id&&!A.has(P.id)&&!c.has(P.id));if(q.length>0){d=0,q.forEach(L=>{c.add(L.id);const $=document.createElement("div");$.className="list-item chat-item",$.innerHTML=`
                                <input type="checkbox" class="chat-select-checkbox" data-chat-id="${L.id}">
                                <span class="item-title">${L.title}</span>
                            `,i.insertBefore($,f)});const P=a.querySelector("#add-chat-search");if(P&&P.value){const L=P.value.toLowerCase();a.querySelectorAll(".chat-item").forEach(H=>{const B=H.querySelector(".item-title").textContent.toLowerCase();H.style.display=B.includes(L)?"":"none"})}}else d++}catch{d++}finally{f.parentNode&&f.remove(),l=!1}}i.addEventListener("scroll",()=>{if(d>=p||l)return;const{scrollTop:f,scrollHeight:v,clientHeight:A}=i;v-f-A<100&&F()});function N(){if(h)return;h=new MutationObserver(v=>{let A=!1;v.forEach(q=>{q.addedNodes.forEach(P=>{P.nodeType===Node.ELEMENT_NODE&&(P.matches('[data-test-id="conversation"]')?[P]:P.querySelectorAll('[data-test-id="conversation"]')).forEach($=>{const H=V($);H&&!c.has(H)&&(A=!0)})})}),A&&setTimeout(()=>s(),50)});const f=document.querySelector("conversations-list");f&&h.observe(f,{childList:!0,subtree:!0})}function s(){const f=ae(),v=new Set;C.folders.forEach(q=>{q.chatIds.forEach(P=>v.add(P))});const A=f.filter(q=>q.id&&!v.has(q.id)&&!c.has(q.id));if(A.length>0){d=0,A.forEach(P=>{c.add(P.id);const L=document.createElement("div");L.className="list-item chat-item",L.innerHTML=`
                            <input type="checkbox" class="chat-select-checkbox" data-chat-id="${P.id}">
                            <span class="item-title">${P.title}</span>
                        `,i.appendChild(L)});const q=a.querySelector("#add-chat-search");if(q&&q.value){const P=q.value.toLowerCase();a.querySelectorAll(".chat-item").forEach($=>{const H=$.querySelector(".item-title").textContent.toLowerCase();$.style.display=H.includes(P)?"":"none"})}}}N();const E=new MutationObserver(f=>{f.forEach(v=>{v.removedNodes.forEach(A=>{(A===a||A.contains&&A.contains(a))&&(h&&(h.disconnect(),h=null),E.disconnect())})})});E.observe(document.body,{childList:!0,subtree:!0});async function m(){const f=a.querySelector("#select-all-chats");if(!f)return;const v=f.parentElement;if(v.lastChild&&v.lastChild.nodeType===Node.TEXT_NODE)v.lastChild.textContent=" Loading all conversations...";else{const L=v.querySelector("span");L&&(L.textContent="Loading all conversations...")}f.disabled=!0;let A=0;const q=5;let P=0;for(;A<q;){const L=i.querySelectorAll(".chat-item").length;await b(),await new Promise(B=>setTimeout(B,300));const $=i.querySelectorAll(".chat-item").length,H=$-L;if(H>0)if(P+=H,A=0,v.lastChild&&v.lastChild.nodeType===Node.TEXT_NODE)v.lastChild.textContent=` Loading... (${$} conversations)`;else{const B=v.querySelector("span");B&&(B.textContent=`Loading... (${$} conversations)`)}else A++}for(let L=0;L<2;L++)await b(),await new Promise($=>setTimeout($,200));if(f.disabled=!1,v.lastChild&&v.lastChild.nodeType===Node.TEXT_NODE)v.lastChild.textContent=" Select All";else{const L=v.querySelector("span");L&&(L.textContent="Select All")}d=0}const y=a.querySelector("#select-all-chats");if(y){const f=y.onchange;y.onchange=null,y.addEventListener("change",async v=>{if(v.target.checked){await m();const q=new Set;C.settings.hideFolderedChats&&C.folders.forEach(L=>{L.chatIds.forEach($=>q.add($))}),a.querySelectorAll('.chat-item:not([style*="display: none"]) .chat-select-checkbox').forEach(L=>{const $=L.dataset.chatId;(!C.settings.hideFolderedChats||!q.has($))&&(L.checked=!0)})}else a.querySelectorAll('.chat-item:not([style*="display: none"]) .chat-select-checkbox').forEach(P=>{P.checked=!1})})}Yt(e)},100)}function ut(e){const t=C.folders.find(o=>o.id===e);t&&(te("manage-single-folder-modal",`Manage "${t.name}"`,ht(t),640),ft(e))}function Zt(e){const o=new Date(e.pinnedAt).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});let n=e.messageContent;n=n.replace(/Show thinking\s*/gi,""),n=n.replace(/^\s*Thinking\.\.\.\s*/gi,"");const r=`
            <div class="modal-header" style="
                padding: 16px 24px;
                border-bottom: 1px solid var(--gf-border-color);
                background: var(--gf-bg-secondary);
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            ">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">\u{1F4CC}</span>
                        <span style="font-weight: 600; font-size: 16px; color: var(--gf-text-primary);">Pinned Message</span>
                    </div>
                    <div style="font-size: 13px; color: var(--gf-text-secondary);">
                        ${o} \xB7 ${a(e.conversationTitle||"Untitled Chat")}
                    </div>
                </div>
                <button class="modal-close" id="close-modal-btn" aria-label="Close" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; height: 100%; max-height: 70vh; padding: 0;">
                
                <div style="
                    flex: 1 1 auto;
                    overflow-y: auto;
                    padding: 24px;
                    background: var(--gf-bg-primary);
                    min-height: 0;
                ">
                    ${e.images&&e.images.length>0?`
                        <div style="
                            display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                            gap: 12px;
                            margin-bottom: 20px;
                            padding: 12px;
                            background: var(--gf-bg-secondary);
                            border-radius: 8px;
                        ">
                            ${e.images.map(i=>`
                                <div style="
                                    position: relative;
                                    border-radius: 8px;
                                    overflow: hidden;
                                    border: 1px solid var(--gf-border-color);
                                    cursor: pointer;
                                    transition: transform 0.2s ease;
                                " class="pinned-image-card">
                                    <img src="${i.src}" alt="${a(i.alt)}" style="
                                        width: 100%;
                                        height: auto;
                                        display: block;
                                    " />
                                    ${i.type==="generated"?'<div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">AI Generated</div>':""}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                    <div style="
                        font-size: 14px;
                        line-height: 1.6;
                        color: var(--gf-text-primary);
                        white-space: pre-wrap;
                        word-break: break-word;
                    ">${a(n)}</div>
                </div>
                
                <div style="
                    flex-shrink: 0;
                    padding: 16px 24px;
                    border-top: 1px solid var(--gf-border-color);
                    background: var(--gf-bg-secondary);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                ">
                    <button id="delete-this-pin-btn" class="premium-button" style="
                        background: var(--gf-accent-danger);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete Pin
                    </button>
                    <button id="show-in-chat-btn" class="premium-button premium-button-primary" style="
                        background: var(--gf-accent-primary);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                        Show in Chat
                    </button>
                </div>
            </div>
        `;te("full-pinned-message-modal","",r,700),setTimeout(()=>{const i=g.querySelector("#full-pinned-message-modal");if(!i)return;const c=i.querySelector("#close-modal-btn");c&&(c.addEventListener("mouseenter",()=>{c.style.opacity="1"}),c.addEventListener("mouseleave",()=>{c.style.opacity="0.7"})),i.querySelectorAll(".pinned-image-card").forEach((h,b)=>{h.addEventListener("click",()=>{const I=h.querySelector("img");I&&I.src&&window.open(I.src,"_blank")}),h.addEventListener("mouseenter",()=>{h.style.transform="scale(1.02)",h.style.boxShadow="0 4px 8px rgba(0,0,0,0.2)"}),h.addEventListener("mouseleave",()=>{h.style.transform="scale(1)",h.style.boxShadow="none"})});const d=i.querySelector("#delete-this-pin-btn"),p=i.querySelector("#show-in-chat-btn");d&&(d.addEventListener("mouseenter",()=>{d.style.opacity="0.9"}),d.addEventListener("mouseleave",()=>{d.style.opacity="1"}),d.addEventListener("click",async()=>{if(await Ke("Delete Pinned Message","Are you sure you want to delete this pinned message?","Delete",!0))try{const b=window.GeminiToolboxStorage?new window.GeminiToolboxStorage:null;b&&(await b.initialize(),await b.deletePinnedMessage(e.messageId),R(),g.querySelector("#pinned-messages-modal, #chat-tools-modal")&&(R(),Fe("pinned")),window.showToast&&window.showToast("Pinned message deleted","success"))}catch(b){console.error("[Pinned Messages] Delete error:",b),window.showToast&&window.showToast("Failed to delete message","error")}})),p&&(p.addEventListener("mouseenter",()=>{p.style.opacity="0.9"}),p.addEventListener("mouseleave",()=>{p.style.opacity="1"}),p.addEventListener("click",()=>{console.log("[Pinned Messages] Navigating to conversation ID:",e.conversationId),console.log("[Pinned Messages] Full message object:",e);const h=`https://gemini.google.com/app/${e.conversationId}`;console.log("[Pinned Messages] Target URL:",h),window.location.href=h}))},100);function a(i){const c=document.createElement("div");return c.textContent=i,c.innerHTML}}function Jt(){const e=g.querySelector("#pinned-messages-modal")||g.querySelector("#chat-tools-modal");if(!e)return;const t=e.querySelector("#pinned-messages-list"),o=e.querySelector("#pinned-messages-loading"),n=e.querySelector("#pinned-messages-search"),r=e.querySelector("#pinned-messages-counter"),a=e.querySelector("#clear-all-pins-btn"),i=window.GeminiToolboxStorage?new window.GeminiToolboxStorage:null;if(!i){o.innerHTML='<p style="color: var(--gf-accent-danger);">Storage not available. Please refresh the page.</p>';return}function c(h){t.innerHTML="",h.forEach(b=>{const I=document.createElement("div");I.className="pinned-message-card",I.style.cssText=`
                    background: var(--gf-bg-secondary);
                    border: 1px solid var(--gf-border-color);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                `,I.addEventListener("mouseenter",()=>{I.style.background="var(--gf-bg-tertiary)",I.style.borderColor="var(--gf-accent-primary)"}),I.addEventListener("mouseleave",()=>{I.style.background="var(--gf-bg-secondary)",I.style.borderColor="var(--gf-border-color)"});const N=new Date(b.pinnedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});let s=b.messageContent;s=s.replace(/Show thinking\s*/gi,""),s=s.replace(/^\s*Thinking\.\.\.\s*/gi,"");const E=s.length>300?s.substring(0,300)+"...":s;I.innerHTML=`
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="font-size: 12px; color: var(--gf-text-tertiary); margin-bottom: 4px;">
                                \u{1F4CC} ${N}${b.images&&b.images.length>0?` \u2022 \u{1F5BC}\uFE0F ${b.images.length} image${b.images.length!==1?"s":""}`:""}
                            </div>
                            <div style="font-size: 12px; color: var(--gf-text-secondary); margin-bottom: 8px;">
                                From: <strong>${b.conversationTitle||"Untitled Chat"}</strong>
                            </div>
                        </div>
                        <button class="delete-pin-btn" data-message-id="${b.messageId}" style="
                            background: none;
                            border: none;
                            color: var(--gf-accent-danger);
                            cursor: pointer;
                            padding: 4px 8px;
                            border-radius: 4px;
                            transition: background 0.2s ease;
                        " title="Delete pinned message">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                    ${b.images&&b.images.length>0?`
                        <div style="
                            display: flex;
                            gap: 8px;
                            margin-bottom: 12px;
                            overflow-x: auto;
                            padding: 8px 0;
                        ">
                            ${b.images.slice(0,3).map(y=>`
                                <div style="
                                    flex-shrink: 0;
                                    width: 80px;
                                    height: 80px;
                                    border-radius: 6px;
                                    overflow: hidden;
                                    border: 1px solid var(--gf-border-color);
                                    position: relative;
                                ">
                                    <img src="${y.src}" alt="${p(y.alt)}" style="
                                        width: 100%;
                                        height: 100%;
                                        object-fit: cover;
                                    " />
                                    ${y.type==="generated"?'<div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: white; padding: 1px 4px; border-radius: 3px; font-size: 8px;">AI</div>':""}
                                </div>
                            `).join("")}
                            ${b.images.length>3?`<div style="width: 80px; height: 80px; border-radius: 6px; background: var(--gf-bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--gf-text-secondary);">+${b.images.length-3}</div>`:""}
                        </div>
                    `:""}
                    <div style="
                        font-size: 14px;
                        line-height: 1.5;
                        color: var(--gf-text-primary);
                        white-space: pre-wrap;
                        word-break: break-word;
                    ">${p(E)}</div>
                `,I.addEventListener("click",y=>{y.target.closest(".delete-pin-btn")||Zt(b)});const m=I.querySelector(".delete-pin-btn");m.addEventListener("mouseenter",()=>{m.style.background="rgba(234, 67, 53, 0.1)"}),m.addEventListener("mouseleave",()=>{m.style.background="none"}),m.addEventListener("click",async y=>{if(y.stopPropagation(),await Ke("Delete Pinned Message","Are you sure you want to delete this pinned message?","Delete",!0))try{await i.deletePinnedMessage(b.messageId),I.remove();const v=t.querySelectorAll(".pinned-message-card").length;r.textContent=`${v} pinned message${v!==1?"s":""}`,v===0&&(t.innerHTML='<div style="text-align: center; padding: 60px 20px; color: var(--gf-text-secondary);"><p>No pinned messages</p></div>'),window.showToast&&window.showToast("Pinned message deleted","success")}catch(v){console.error("[Pinned Messages] Delete error:",v),window.showToast&&window.showToast("Failed to delete message","error")}}),t.appendChild(I)})}i.initialize().then(()=>{const h=i.getAllPinnedMessages();if(o.style.display="none",h.length===0){t.innerHTML='<div style="text-align: center; padding: 60px 20px; color: var(--gf-text-secondary);"><p style="font-size: 16px; margin-bottom: 8px;">No pinned messages yet</p><p style="font-size: 14px;">Pin important messages by clicking the bookmark icon next to any AI response.</p></div>',r.textContent="0 pinned messages";return}if(r.textContent=`${h.length} pinned message${h.length!==1?"s":""}`,c(h),n){let b;const I=()=>{clearTimeout(b),b=setTimeout(()=>{const F=(n.value||"").trim();try{const N=F?i.searchPinnedMessages(F):i.getAllPinnedMessages();if(!N||N.length===0){t.innerHTML='<div style="text-align: center; padding: 60px 20px; color: var(--gf-text-secondary);"><p>No matching pinned messages</p></div>',r.textContent="0 pinned messages";return}c(N),r.textContent=`${N.length} pinned message${N.length!==1?"s":""}`}catch(N){console.error("[Pinned Messages] Search error:",N)}},300)};n.addEventListener("input",I),n.addEventListener("search",I)}}).catch(h=>{console.error("[Pinned Messages] Error loading:",h),o.innerHTML='<p style="color: var(--gf-accent-danger);">Failed to load pinned messages.</p>'}),a&&a.addEventListener("click",async()=>{if(await Ke("Clear All Pinned Messages","Are you sure you want to delete ALL pinned messages? This action cannot be undone.","Delete All",!0))try{const b=i.getAllPinnedMessages();for(const I of b)await i.deletePinnedMessage(I.id);t.innerHTML='<div style="text-align: center; padding: 60px 20px; color: var(--gf-text-secondary);"><p style="font-size: 16px; margin-bottom: 8px;">No pinned messages yet</p><p style="font-size: 14px;">Pin important messages by clicking the bookmark icon next to any AI response.</p></div>',r.textContent="0 pinned messages",window.showToast&&window.showToast("All pinned messages cleared","success")}catch(b){console.error("[Pinned Messages] Clear all error:",b),window.showToast&&window.showToast("Failed to clear messages","error")}});const l=e.querySelector("#pinned-tab-panel"),d=l?l.querySelector(".cancel-action"):e.querySelector(".cancel-action");d&&d.addEventListener("click",()=>{R()});function p(h){const b=document.createElement("div");return b.textContent=h,b.innerHTML}}function Qt(){return`
            <div class="premium-modal-actions">
                <input type="search" id="export-chat-search" class="premium-search-input" placeholder="Search conversations..." aria-label="Search chats to export">
                <div id="export-chat-search-loading" style="display: none; padding: 8px 12px; margin-top: 8px; background: var(--gf-bg-secondary); border-radius: 4px; color: var(--gf-accent-primary); font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 14px; height: 14px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span id="export-chat-search-status">Searching all conversations...</span>
                    </div>
                </div>
                <label class="premium-checkbox-label">
                    <input type="checkbox" id="export-chat-select-all" class="premium-checkbox select-all-checkbox">
                    <span>Select all</span>
                </label>
                <div class="format-select" style="margin-left:auto;">
                    <label for="export-chat-format">Format</label>
                    <select id="export-chat-format">
                        <option value="pdf" selected>PDF</option>
                        <option value="html">HTML</option>
                        <option value="md">Markdown</option>
                        <option value="txt">Text</option>
                        <option value="csv">CSV</option>
                    </select>
                </div>
            </div>
            <div class="premium-modal-body">
                <div id="export-chat-list">
                    <div id="export-chat-loading" style="text-align: center; padding: 40px;" role="status" aria-live="polite">
                        <div style="width: 40px; height: 40px; border: 3px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;" aria-hidden="true"></div>
                        <p style="color: var(--gf-text-secondary);">Loading conversations...</p>
                    </div>
                    <div id="export-chat-loading-more" style="display: none; text-align: center; padding: var(--space-4); color: var(--gf-text-secondary);" role="status" aria-live="polite">
                        Loading more conversations...
                    </div>
                </div>
            </div>
            <div class="premium-modal-footer" style="flex-direction: column; align-items: stretch;">
                <div id="export-chat-status" style="display: none; padding: 0 0 12px 0;">
                    <div id="export-error-message" style="color: var(--gf-accent-danger); font-size: 14px; padding: var(--space-3); background: rgba(234, 67, 53, 0.1); border-radius: var(--space-2); display: none; margin-bottom: 12px;"></div>
                    <div id="export-progress" style="display: none;">
                        <p style="color: var(--gf-text-secondary); font-size: 14px; margin-bottom: var(--space-2);">Exporting <span id="export-current-count">0</span> of <span id="export-total-count">0</span> conversations...</p>
                        <div style="height: 4px; background: var(--gf-border-color); border-radius: 2px; overflow: hidden;">
                            <div id="export-progress-bar" style="height: 100%; background: var(--gf-accent-primary); width: 0%; transition: width var(--anim-medium) var(--ease-out);"></div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                    <span id="export-chat-counter" class="select-all-counter">0 selected</span>
                    <div style="display: flex; gap: 12px;">
                        <button class="premium-button premium-button-secondary cancel-action">Close</button>
                        <button id="start-export-btn" class="premium-button premium-button-primary" disabled>Export</button>
                    </div>
                </div>
            </div>
        `}function eo(){return`
            <div class="premium-modal-actions">
                <input type="search" id="pinned-messages-search" class="premium-search-input" placeholder="Search pinned messages..." aria-label="Search pinned messages">
                <button id="clear-all-pins-btn" class="premium-button premium-button-danger" style="margin-left: auto;">
                    Clear All
                </button>
            </div>
            <div class="premium-modal-body" style="max-height: 600px; overflow-y: auto;">
                <div id="pinned-messages-list">
                    <div id="pinned-messages-loading" style="text-align: center; padding: 40px;" role="status" aria-live="polite">
                        <div style="width: 40px; height: 40px; border: 3px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;" aria-hidden="true"></div>
                        <p style="color: var(--gf-text-secondary);">Loading pinned messages...</p>
                    </div>
                </div>
            </div>
            <div class="premium-modal-footer">
                <span id="pinned-messages-counter" class="select-all-counter">0 pinned messages</span>
                <button class="premium-button premium-button-secondary cancel-action">Close</button>
            </div>
        `}function to(){return`
            <div class="premium-modal-actions">
                <input type="search" id="bulk-delete-search" class="premium-search-input" placeholder="Search conversations..." aria-label="Search conversations to delete">
                <div id="bulk-delete-search-loading" style="display: none; padding: 8px 12px; margin-top: 8px; background: var(--gf-bg-secondary); border-radius: 4px; color: var(--gf-accent-primary); font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 14px; height: 14px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span id="bulk-delete-search-status">Searching all conversations...</span>
                    </div>
                </div>
                <label class="premium-checkbox-label">
                    <input type="checkbox" id="bulk-delete-select-all" class="premium-checkbox select-all-checkbox">
                    <span>Select all</span>
                </label>
                <label class="premium-checkbox-label" style="margin-left: 16px;">
                    <input type="checkbox" id="include-foldered-chats" class="premium-checkbox">
                    <span>Include foldered chats</span>
                </label>
                <label class="premium-checkbox-label" style="margin-left: 16px;">
                    <input type="checkbox" id="include-pinned-chats" class="premium-checkbox">
                    <span>Include pinned chats</span>
                </label>
            </div>
            <div class="premium-modal-body">
                <div id="bulk-delete-list">
                    <div id="bulk-delete-loading" style="text-align: center; padding: 40px;" role="status" aria-live="polite">
                        <div style="width: 40px; height: 40px; border: 3px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;" aria-hidden="true"></div>
                        <p style="color: var(--gf-text-secondary);">Loading conversations...</p>
                    </div>
                    <!-- Chat items will be dynamically inserted here -->
                    <div id="bulk-delete-loading-more" style="display: none; text-align: center; padding: var(--space-4); color: var(--gf-text-secondary);" role="status" aria-live="polite">
                        <div style="width: 24px; height: 24px; border: 2px solid var(--gf-border-color); border-top-color: var(--gf-accent-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 8px;" aria-hidden="true"></div>
                        <span>Loading more conversations...</span>
                    </div>
                </div>
            </div>
            <div class="premium-modal-footer" id="bulk-delete-controls">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span id="bulk-delete-counter" class="select-all-counter">0 selected</span>
                    <span id="bulk-delete-scroll-status" style="font-size: 12px; color: var(--gf-text-tertiary);"></span>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="premium-button premium-button-secondary cancel-action">Cancel</button>
                    <button id="start-bulk-delete-btn" class="premium-button premium-button-danger" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete Selected
                    </button>
                </div>
            </div>
        `}function oo(e="export"){const t=window.geminiAPI?.isPremium?.()||!1;return`
            <div class="premium-modal-header">
                <h2 class="premium-modal-title">Chat Tools</h2>
                <button class="premium-modal-close" id="close-modal-btn" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="chat-tools-tabs">
                <button class="chat-tools-tab ${e==="pinned"?"active":""}" data-tab="pinned" role="tab" aria-selected="${e==="pinned"}">
                    <svg width="16" height="16" viewBox="0 0 384 512" fill="currentColor">
                        <path d="M336 0h-288C21.49 0 0 21.49 0 48v431.9c0 24.7 26.79 40.08 48.12 27.64L192 423.6l143.9 83.93C357.2 519.1 384 504.6 384 479.9V48C384 21.49 362.5 0 336 0zM336 452L192 368l-144 84V54C48 50.63 50.63 48 53.1 48h276C333.4 48 336 50.63 336 54V452z"/>
                    </svg>
                    <span>Pinned</span>
                </button>
                
                <button class="chat-tools-tab ${e==="export"?"active":""}" data-tab="export" role="tab" aria-selected="${e==="export"}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"/>
                        <path d="M14 2V8H20"/>
                        <path d="M12 10V16M12 16L9 13M12 16L15 13"/>
                    </svg>
                    <span>Export</span>
                </button>
                
                <button class="chat-tools-tab ${e==="bulk-delete"?"active":""}" data-tab="bulk-delete" role="tab" aria-selected="${e==="bulk-delete"}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <span>Bulk Delete</span>
                    ${t?"":'<span class="chat-tools-premium-badge">Premium</span>'}
                </button>
            </div>
            
            <div class="tab-panel ${e==="pinned"?"active":""}" id="pinned-tab-panel" role="tabpanel">
                ${eo()}
            </div>
            
            <div class="tab-panel ${e==="export"?"active":""}" id="export-tab-panel" role="tabpanel">
                ${Qt()}
            </div>
            
            <div class="tab-panel ${e==="bulk-delete"?"active":""}" id="bulk-delete-tab-panel" role="tabpanel">
                ${to()}
            </div>
        `}function Fe(e="pinned"){te("chat-tools-modal","Chat Tools",oo(e),900),no(e)}async function no(e="pinned"){const t=g.querySelector("#chat-tools-modal");if(!t)return;const o=t.querySelectorAll(".chat-tools-tab"),n=t.querySelectorAll(".tab-panel");let r=e;const a=new Set;await i(r),o.forEach(c=>{c.addEventListener("click",async l=>{const d=c.dataset.tab;if(d==="bulk-delete")try{const h=await window.geminiAPI.checkFeatureLimit("bulkDelete");if(!h.allowed){window.geminiAPI&&CONFIG?.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.LIMIT_HIT,{feature:"bulkDelete",context:"chat_tools_tab"}),R(),Pe("bulkDelete",{count:h.count??0,limit:h.limit??0});return}}catch(h){console.warn("[Chat Tools] Premium check failed:",h)}window.geminiAPI&&CONFIG?.ANALYTICS_EVENTS&&r!==d&&window.geminiAPI.trackEvent("chat_tools_tab_switched",{from_tab:r,to_tab:d,method:"click"}),o.forEach(h=>{h.classList.remove("active"),h.setAttribute("aria-selected","false")}),n.forEach(h=>h.classList.remove("active")),c.classList.add("active"),c.setAttribute("aria-selected","true");const p=t.querySelector(`#${d}-tab-panel`);p&&p.classList.add("active"),a.has(d)||await i(d),r=d})});async function i(c){if(!a.has(c)){switch(c){case"export":po();break;case"pinned":Jt();break;case"bulk-delete":try{(await window.geminiAPI.checkFeatureLimit("bulkDelete")).allowed&&bt()}catch{bt()}break}a.add(c)}}window.geminiAPI&&CONFIG?.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent("chat_tools_modal_opened",{initial_tab:e,source:"dropdown"})}function ro(){return`
            <div class="settings-modal-content">
                <style>
                    
                    .settings-modal-content {
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .settings-body {
                        padding: 12px 16px 16px 16px;
                    }
                    
                    .settings-section {
                        margin-bottom: 12px;
                        padding: var(--space-3);
                        background-color: var(--gf-bg-secondary);
                        border-radius: 12px;
                        border: 2px solid var(--gf-border-color);
                    }
                    
                    .settings-section:first-child {
                        margin-top: 0;
                    }
                    
                    .dark-theme .settings-section {
                        border-color: rgba(255, 255, 255, 0.15);
                    }
                    
                    .settings-section:last-child {
                        margin-bottom: 0;
                    }
                    
                    .section-title {
                        font-size: var(--font-size-tiny);
                        font-weight: var(--font-weight-semibold);
                        color: var(--gf-text-secondary);
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    
                    .section-title svg {
                        width: 18px;
                        height: 18px;
                        opacity: 0.7;
                    }
                    
                    .toggle-setting {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: var(--space-3);
                        background-color: var(--background-primary);
                        border-radius: var(--space-2);
                        transition: all var(--anim-normal) var(--ease-out);
                        cursor: pointer;
                    }
                    
                    .toggle-setting:hover {
                        background-color: var(--background-hover);
                    }
                    
                    .toggle-content {
                        flex: 1;
                    }
                    
                    .toggle-label {
                        font-size: 15px;
                        font-weight: 500;
                        color: var(--text-primary);
                        margin-bottom: 4px;
                    }
                    
                    .toggle-description {
                        font-size: 13px;
                        color: var(--text-tertiary);
                    }
                    
                    .toggle-switch {
                        position: relative;
                        width: 48px;
                        height: 28px;
                        background-color: #dadce0;
                        border-radius: 28px;
                        cursor: pointer;
                        transition: all var(--anim-medium) var(--ease-out);
                        flex-shrink: 0;
                    }
                    
                    .dark-theme .toggle-switch {
                        background-color: #5f6368;
                    }
                    
                    .toggle-switch.active {
                        background-color: #1a73e8;
                    }
                    
                    .toggle-switch::after {
                        content: '';
                        position: absolute;
                        width: 22px;
                        height: 22px;
                        background-color: white;
                        border-radius: 50%;
                        top: 3px;
                        left: 3px;
                        transition: all var(--anim-medium) var(--ease-out);
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4);
                    }
                    
                    .toggle-switch.active::after {
                        transform: translateX(20px);
                    }
                    
                    .toggle-switch:focus {
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.3);
                    }
                    
                    .toggle-switch:focus:not(:focus-visible) {
                        box-shadow: none;
                    }
                    
                    .shortcuts-link-container:hover {
                        background-color: var(--background-hover);
                        transform: translateX(2px);
                    }
                    
                    .feedback-container {
                        position: relative;
                        margin-bottom: 4px;
                    }
                    
                    .feedback-textarea {
                        width: 100%;
                        min-height: 80px;
                        max-height: 120px;
                        padding: var(--space-3);
                        border: 2px solid #dadce0;
                        border-radius: var(--space-2);
                        background-color: var(--background-primary);
                        color: var(--text-primary);
                        font-family: 'Google Sans', 'Roboto', sans-serif;
                        font-size: 14px;
                        resize: vertical;
                        transition: all var(--anim-normal) var(--ease-out);
                        box-sizing: border-box;
                    }
                    
                    .dark-theme .feedback-textarea {
                        border-color: #5f6368;
                    }
                    
                    .feedback-textarea:focus {
                        outline: none;
                        border-color: var(--gf-accent-primary);
                        border-width: 2px;
                        background-color: var(--gf-bg-primary);
                        box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3);
                    }
                    
                    .feedback-textarea:focus:not(:focus-visible) {
                        box-shadow: none;
                    }
                    
                    .feedback-textarea::placeholder {
                        color: var(--text-tertiary);
                    }
                    
                    .char-counter {
                        position: absolute;
                        bottom: -18px;
                        right: 0;
                        font-size: 11px;
                        color: var(--text-tertiary);
                        transition: color 0.2s ease;
                        background-color: var(--background-secondary);
                        padding: 0 4px;
                        border-radius: 4px;
                    }
                    
                    .char-counter.warning {
                        color: var(--gf-accent-warning, #F59E0B);
                    }
                    
                    .char-counter.error {
                        color: var(--gf-accent-danger);
                    }
                    
                    .settings-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 16px;
                        padding: var(--input-padding);
                        background-color: var(--background-secondary);
                        border-top: 1px solid var(--border-color);
                        border-radius: 0 0 16px 16px;
                    }
                    
                    .footer-info {
                        font-size: 13px;
                        color: var(--text-tertiary);
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    
                    .footer-info svg {
                        width: 16px;
                        height: 16px;
                        opacity: 0.6;
                    }
                    
                    /* Feedback buttons container */
                    .feedback-buttons {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }
                    
                    .feedback-buttons .button {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        min-height: 44px;
                        padding: 12px 24px;
                        font-weight: 600;
                        box-sizing: border-box;
                        width: 100%;
                    }
                    
                    .feedback-buttons .button svg {
                        width: 16px;
                        height: 16px;
                    }
                    
                    /* Email button specific styles */
                    .btn-send-email {
                        border: 2px solid #5f6368 !important;
                        color: var(--text-primary);
                        background-color: transparent;
                    }
                    
                    .btn-send-email:hover:not(:disabled) {
                        background-color: rgba(95, 99, 104, 0.1);
                        border-color: #202124 !important;
                    }
                    
                    .dark-theme .btn-send-email {
                        border-color: #dadce0 !important;
                    }
                    
                    .dark-theme .btn-send-email:hover:not(:disabled) {
                        background-color: rgba(218, 220, 224, 0.1);
                        border-color: #f8f9fa !important;
                    }
                    
                    /* Anonymous feedback button styles */
                    .btn-send-feedback {
                        border: 2px solid var(--gf-accent-primary) !important;
                    }
                    
                    .btn-send-feedback:disabled {
                        border-color: var(--gf-border-color) !important;
                        opacity: 0.5;
                    }
                    
                    .btn-send-feedback:hover:not(:disabled) {
                        background-color: var(--gf-accent-primary);
                        border-color: var(--gf-accent-primary) !important;
                        color: var(--gf-button-text, white);
                        opacity: 0.9;
                        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
                    }
                    
                    /* Shared disabled styles */
                    .feedback-buttons .button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    .btn-send-email:disabled {
                        border-color: #dadce0 !important;
                    }
                    
                    .dark-theme .btn-send-email:disabled {
                        border-color: #5f6368 !important;
                    }
                    
                    /* Success animation */
                    @keyframes successPulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                    
                    .btn-send-feedback.success {
                        background-color: var(--gf-accent-success);
                        animation: successPulse var(--anim-slow) var(--ease-out);
                    }
                    
                    /* Loading spinner */
                    .spinner {
                        display: inline-block;
                        width: 14px;
                        height: 14px;
                        border: 2px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        border-top-color: white;
                        animation: spin 0.8s linear infinite;
                    }
                    
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
                
                <div class="settings-body">
                    <!-- Word Counter Section (moved to top) -->
                    <div class="settings-section">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                            </svg>
                            Preferences
                        </h3>
                        <div class="toggle-setting" id="word-counter-setting">
                            <div class="toggle-content">
                                <div class="toggle-label">Word Counter</div>
                                <div class="toggle-description">Display character and word count below input field</div>
                            </div>
                            <div class="toggle-switch ${ie?"active":""}" id="word-counter-toggle"></div>
                        </div>
                        <div class="toggle-setting" id="enhance-prompt-setting" style="margin-top: 16px;">
                            <div class="toggle-content">
                                <div class="toggle-label">Enhance Prompt</div>
                                <div class="toggle-description">Show AI-powered prompt enhancement button</div>
                            </div>
                            <div class="toggle-switch ${ce?"active":""}" id="enhance-prompt-toggle"></div>
                        </div>
                        <!-- TIMESTAMP FEATURE DISABLED -->
                        <!-- <div class="toggle-setting" id="message-timestamp-setting" style="margin-top: 16px;">
                            <div class="toggle-content">
                                <div class="toggle-label">Show Message Timestamps</div>
                                <div class="toggle-description">Show when each message was sent</div>
                            </div>
                            <div class="toggle-switch ${Co?"active":""}" id="message-timestamp-toggle"></div>
                        </div> -->
                        <div class="toggle-setting" id="pinned-messages-setting" style="margin-top: 16px;">
                            <div class="toggle-content">
                                <div class="toggle-label">Pinned Messages</div>
                                <div class="toggle-description">Show bookmark icons to pin important messages</div>
                            </div>
                            <div class="toggle-switch ${se?"active":""}" id="pinned-messages-toggle"></div>
                        </div>
                    </div>
                    
                    <!-- Feedback Section -->
                    <div class="settings-section">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Send Feedback
                        </h3>
                        <div class="feedback-settings-container">
                            <div class="feedback-info" style="margin-bottom: 12px; padding: 10px; background-color: var(--background-primary); border-radius: 8px; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                                Help improve Gemini Toolbox! Share your thoughts, report bugs, or suggest features.
                            </div>
                            <textarea 
                                class="settings-feedback-textarea" 
                                id="settings-feedback-textarea"
                                placeholder="Share your thoughts, report bugs, or suggest new features..."
                                maxlength="1000"
                                style="
                                    width: 100%;
                                    min-height: 100px;
                                    max-height: 200px;
                                    padding: 12px;
                                    background-color: var(--background-primary);
                                    color: var(--text-primary);
                                    border: 1px solid var(--border-color);
                                    border-radius: 8px;
                                    font-size: 14px;
                                    font-family: inherit;
                                    resize: vertical;
                                    box-sizing: border-box;
                                    transition: all var(--anim-fast) var(--ease-out);
                                "></textarea>
                            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; text-align: right;" id="settings-char-counter">0 / 1000</div>
                            <div class="feedback-actions" style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px;">
                                <button class="button secondary" id="settings-email-btn" disabled style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                    Send via Email
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Community Section -->
                    <div class="settings-section">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
                                <path d="M8 10h8M8 14h5"/>
                            </svg>
                            Community
                        </h3>
                        <a href="https://chat.whatsapp.com/CF7i1mw1xrnHCalMsLxs8N" target="_blank" rel="noopener noreferrer" class="button secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Join the Community
                        </a>
                    </div>
                    
                    <!-- Data Management Section -->
                    <div class="settings-section">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z"/>
                                <path d="M12 1v6m0 6v6"/>
                            </svg>
                            Data Management
                        </h3>
                        <div class="backup-restore-container">
                            <div class="backup-info" style="margin-bottom: 16px; padding: 12px; background-color: var(--background-primary); border-radius: 8px; border-left: 4px solid var(--gf-accent-primary);">
                                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                                    <strong>Your data safety net:</strong> Export your folders and settings to a backup file, or restore from a previous backup. Keep your organization safe!
                                </div>
                            </div>
                            <div class="backup-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <button class="button secondary" id="export-backup-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Export Backup
                                </button>
                                <button class="button secondary" id="import-backup-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    Import Backup
                                </button>
                            </div>
                            <div class="storage-stats" style="margin-top: 16px; padding: 12px; background-color: var(--background-primary); border-radius: 8px;">
                                <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 8px;">Storage Statistics</div>
                                <div id="storage-stats-content" style="font-size: 13px; color: var(--text-secondary);">
                                    Loading stats...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Account Linking Section (only shown for premium_device users) -->
                    <div class="settings-section" id="account-linking-section" style="display: none;">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            Link Your Purchase
                        </h3>
                        <div class="link-container">
                            <div class="link-info" style="margin-bottom: 16px; padding: 12px; background-color: var(--background-primary); border-radius: 8px; border-left: 4px solid #4285f4;">
                                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                                    Link your purchase to use Premium on any device you sign in to.
                                </div>
                            </div>
                            <div class="link-input-container" style="margin-bottom: 12px;">
                                <input type="email" 
                                       id="link-email-input" 
                                       placeholder="Enter your email address"
                                       style="
                                           width: 100%;
                                           padding: 12px;
                                           background-color: var(--background-primary);
                                           color: var(--text-primary);
                                           border: 1px solid var(--border-color);
                                           border-radius: 8px;
                                           font-size: 14px;
                                           font-family: inherit;
                                           box-sizing: border-box;
                                       ">
                            </div>
                            <button class="button primary" id="link-email-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                Send Login Link
                            </button>
                        </div>
                    </div>
                    
                    <!-- Subscription Management Section (only shown for premium users) -->
                    <div class="settings-section" id="subscription-section" style="display: none;">
                        <h3 class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                                <path d="M9 12l2 2 4-4"/>
                            </svg>
                            Subscription
                        </h3>
                        <div class="subscription-container">
                            <div class="subscription-info" style="margin-bottom: 16px; padding: 12px; background-color: var(--background-primary); border-radius: 8px; border-left: 4px solid #4285f4;">
                                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                                    <strong>Premium Member</strong> - Manage your subscription, billing, and payment methods.
                                </div>
                            </div>
                            <button class="button primary" id="manage-subscription-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                Manage Subscription
                            </button>
                        </div>
                    </div>
                    
                    <!-- Shortcuts Link Section -->
                    <div class="settings-section" style="padding: 0; background: transparent; border: none;">
                        <div class="shortcuts-link-container" id="shortcuts-link-container" style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: var(--space-4);
                            background-color: var(--background-secondary);
                            border: 1px solid var(--border-color);
                            border-radius: 12px;
                            cursor: pointer;
                            transition: all var(--anim-normal) var(--ease-out);
                        ">
                            <div style="display: flex; align-items: center; gap: var(--gap-medium);">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    <path d="M6 8h12M6 12h8M6 16h10"/>
                                </svg>
                                <div>
                                    <div style="font-size: 15px; font-weight: 500; color: var(--text-primary);">Keyboard Shortcuts</div>
                                    <div style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">View all available shortcuts</div>
                                </div>
                            </div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `}function ao(){const e=g.querySelector("#settings-modal");if(!e)return;const t=e.querySelector("#word-counter-setting"),o=e.querySelector("#word-counter-toggle");t&&o&&t.addEventListener("click",async m=>{m.stopPropagation(),ie=!ie,ie?o.classList.add("active"):o.classList.remove("active"),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"wordCounter",enabled:ie}),await xo(),await vt()});const n=e.querySelector("#enhance-prompt-setting"),r=e.querySelector("#enhance-prompt-toggle");n&&r&&n.addEventListener("click",async m=>{m.stopPropagation(),ce=!ce,ce?r.classList.add("active"):r.classList.remove("active"),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"enhancePrompt",enabled:ce}),await yo(),await kt()});const a=e.querySelector("#pinned-messages-setting"),i=e.querySelector("#pinned-messages-toggle");a&&i&&a.addEventListener("click",async m=>{m.stopPropagation(),se=!se,se?i.classList.add("active"):i.classList.remove("active"),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"pinnedMessages",enabled:se}),await wo(),await Et(),Y(se?"Pinned messages enabled":"Pinned messages disabled","success")});const c=e.querySelector("#link-email-btn"),l=e.querySelector("#link-email-input");if(c&&l){c.addEventListener("click",async()=>{const y=l.value.trim();if(!y||!y.includes("@")){Y("Please enter a valid email address","error");return}try{c.disabled=!0;const f=c.innerHTML;c.innerHTML='<span class="spinner"></span> Sending...';const v=await window.geminiAPI.requestMagicLink(y);if(v&&v.ok){if(Y("\u{1F4E7} Check your email for the 6-digit code","success"),l){l.placeholder="Enter 6-digit code from email",l.value="",l.type="text",l.maxLength=6,l.pattern="[0-9]{6}",c.innerHTML="Confirm Code",c.disabled=!1;const A=c.cloneNode(!0);c.parentNode.replaceChild(A,c),A.addEventListener("click",async()=>{const q=l.value.trim();if(q.length!==6){Y("Please enter the 6-digit code from your email","error");return}try{A.disabled=!0,A.innerHTML='<span class="spinner"></span> Confirming...';const P=await window.geminiAPI.confirmMagicCode(y,q);if(P&&P.ok){Y("\u2705 Account linked successfully!","success");const L=await window.geminiAPI.getMeStatus({force:!0});if(L.plan==="premium"||L.plan==="premium_device"){try{Ge(!0)}catch{}const $=e.querySelector("#account-linking-section"),H=e.querySelector("#subscription-section");$&&($.style.display="none"),H&&(H.style.display="block")}setTimeout(()=>{e.style.display="none"},2e3)}else Y("Invalid code. Please try again.","error"),A.innerHTML="Confirm Code",A.disabled=!1}catch{Y("Failed to confirm code. Please try again.","error"),A.innerHTML="Confirm Code",A.disabled=!1}})}}else Y("\u{1F4E7} Check your email for the login link","info"),c.innerHTML=f,c.disabled=!1}catch{Y("Failed to send login link. Please try again.","error"),c.innerHTML="Send Login Link",c.disabled=!1}});async function m(){let y=0;const f=20,v=setInterval(async()=>{y++;try{if((await window.geminiAPI.getMeStatus({force:!0})).plan==="premium"){clearInterval(v),Y("\u2705 Purchase linked successfully!","success");try{Ge(!0)}catch{}const q=e.querySelector("#account-linking-section"),P=e.querySelector("#subscription-section");q&&(q.style.display="none"),P&&(P.style.display="block")}else y>=f&&clearInterval(v)}catch{}},3e3)}}const d=e.querySelector("#manage-subscription-btn");d&&d.addEventListener("click",async()=>{try{d.disabled=!0;const m=d.innerHTML;d.innerHTML='<span class="spinner"></span> Loading...';let f=(await chrome.storage.local.get("gt_install_id")).gt_install_id;f||(f="gt_"+Math.random().toString(36).substr(2)+Date.now().toString(36),await chrome.storage.local.set({gt_install_id:f}));const v=await chrome.runtime.sendMessage({type:"API_REQUEST",data:{method:"GET",endpoint:"/billing/portal",headers:{"X-Install-ID":f,"X-From":"GeminiToolbox"}}});if(!v||v.success!==!0)throw new Error(v&&v.error?v.error:"Failed to get portal URL");const A=v.result||{};if(A.portal_url)chrome&&chrome.tabs?chrome.tabs.create({url:A.portal_url}):window.open(A.portal_url,"_blank"),d.innerHTML=`
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                            Opening...
                        `;else throw new Error("No portal URL received");setTimeout(()=>{d.innerHTML=m,d.disabled=!1},2e3)}catch{j("Failed to open billing portal. Please try again."),d.innerHTML="Manage Subscription",d.disabled=!1}});const p=e.querySelector("#shortcuts-link-container");p&&p.addEventListener("click",()=>{e._childOpener=document.activeElement||p,lo()});const h=e.querySelector("#export-backup-btn"),b=e.querySelector("#import-backup-btn"),I=e.querySelector("#storage-stats-content");window.geminiStorage||(window.geminiStorage=new GeminiToolboxStorage,window.geminiStorage.initialize().catch(m=>{}));const F=async()=>{try{if(window.geminiStorage&&window.geminiStorage.initialized){const m=window.geminiStorage.getStats();I&&(I.innerHTML=`
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                                <div><strong>${m.folders}</strong> folders</div>
                                <div><strong>${m.chats}</strong> chats</div>
                            </div>
                            <div style="margin-top: 8px; font-size: 11px; color: var(--text-tertiary);">
                                Last backup: ${m.lastBackup?new Date(m.lastBackup).toLocaleDateString():"Never"}
                            </div>
                        `)}else I&&(I.textContent="Storage system initializing...")}catch{I&&(I.textContent="Error loading stats")}};setTimeout(F,100),h&&h.addEventListener("click",async()=>{try{h.disabled=!0;const m=h.innerHTML;if(h.innerHTML='<span class="spinner"></span> Exporting...',window.geminiStorage)await window.geminiStorage.exportBackup(),h.innerHTML=`
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                            Exported!
                        `,setTimeout(()=>{h.innerHTML=m,h.disabled=!1,F()},3e3);else throw new Error("Storage system not initialized")}catch{h.innerHTML=`
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Failed
                    `,setTimeout(()=>{h.innerHTML=originalContent,h.disabled=!1},3e3),j("Failed to export backup. Please try again.")}}),b&&b.addEventListener("click",async()=>{try{const m=document.createElement("input");m.type="file",m.accept=".json",m.style.display="none",m.addEventListener("change",async y=>{const f=y.target.files[0];if(f)try{b.disabled=!0;const v=b.innerHTML;b.innerHTML='<span class="spinner"></span> Importing...';const A=await f.text(),q=JSON.parse(A),L=`
                                <div style="margin-bottom: 24px;">
                                    <div style="display: flex; align-items: center; gap: var(--gap-medium); margin-bottom: var(--space-4);">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-warning, #fbbc04)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="12" y1="8" x2="12" y2="12"/>
                                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <p style="margin: 0; color: var(--gf-text-primary); font-size: 16px; font-weight: 500; line-height: 1.5;">
                                            Import backup from ${q.exportedAt?new Date(q.exportedAt).toLocaleDateString():"unknown date"}?
                                        </p>
                                    </div>
                                    <p style="margin: 0 0 0 36px; color: var(--gf-text-secondary); font-size: 14px;">
                                        This will replace all your current folders and settings. This action cannot be undone.
                                    </p>
                                </div>
                                <div class="modal-footer">
                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                        <button type="button" class="button secondary cancel-action">Cancel</button>
                                        <button type="button" class="button primary" id="confirm-import-backup">
                                            Import Backup
                                        </button>
                                    </div>
                                </div>
                            `;if(te("confirm-import-modal","Confirm Import",L,480),!await new Promise(H=>{setTimeout(()=>{const B=g.querySelector("#confirm-import-backup"),J=g.querySelector("#confirm-import-modal .button.secondary.cancel-action");B&&(B.onclick=()=>{R(),H(!0)}),J&&(J.onclick=()=>{R(),H(!1)})},100)})){b.innerHTML=v,b.disabled=!1;return}if(window.geminiStorage)await window.geminiStorage.importBackup(q),b.innerHTML=`
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                    </svg>
                                    Imported!
                                `,setTimeout(async()=>{b.innerHTML=v,b.disabled=!1,F(),await it(),Ee(),Y("Backup imported successfully! Your data has been restored.","success")},2e3);else throw new Error("Storage system not initialized")}catch{b.innerHTML=`
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                Failed
                            `,setTimeout(()=>{b.innerHTML=originalContent,b.disabled=!1},3e3),j("Failed to import backup. Please check the file format and try again.")}finally{document.body.removeChild(m)}}),document.body.appendChild(m),m.click()}catch{j("Failed to set up file import. Please try again.")}});const N=e.querySelector("#settings-feedback-textarea"),s=e.querySelector("#settings-char-counter"),E=e.querySelector("#settings-email-btn");if(N&&s){const m=()=>{const y=N.value.length;s.textContent=`${y} / 1000`;const f=N.value.trim().length>0;E&&(E.disabled=!f)};N.addEventListener("input",m),E&&E.addEventListener("click",()=>{const y=N.value.trim();if(!y)return;const f=`Gemini Toolbox Feedback - Version ${CONFIG.VERSION}`,v=`Hi there!

Here's my feedback for Gemini Toolbox:

${y}

Extension Details:
- Version: ${chrome.runtime.getManifest().version}
- Browser: ${navigator.userAgent}
- Timestamp: ${new Date().toLocaleString()}
- User ID: ${window.geminiAPI?.userId||"Unknown"}

Best regards`,A=`mailto:${CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent(f)}&body=${encodeURIComponent(v)}`;window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent("feedback_email_clicked",{source:"settings_modal",length:y.length}),window.open(A,"_blank")})}}async function Bo(){window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent("feedback_modal_opened",{source:"dropdown_menu",timestamp:Date.now()}),te("feedback-modal","Send Feedback",`
            <style>
                #feedback-modal .infi-chatgpt-modal-content {
                    max-width: 400px !important;
                    width: 90vw !important;
                    overflow-x: hidden !important;
                }
                
                .feedback-container {
                    position: relative;
                    margin-bottom: 4px;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .feedback-textarea {
                    width: 100%;
                    min-height: 120px;
                    max-height: 300px;
                    padding: 12px;
                    background-color: var(--gf-bg-input);
                    color: var(--gf-text-primary);
                    border: 1px solid var(--gf-border-color);
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    transition: all var(--anim-fast) var(--ease-out);
                    box-sizing: border-box;
                }
                
                .dark-theme .feedback-textarea {
                    border-color: #5f6368;
                }
                
                .feedback-textarea:focus {
                    outline: none;
                    border-color: var(--gf-accent-primary);
                    box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.1);
                    background-color: var(--gf-bg-secondary);
                }
                
                .feedback-textarea:focus:not(:focus-visible) {
                    box-shadow: none;
                }
                
                .feedback-textarea::placeholder {
                    color: var(--text-tertiary);
                }
                
                .char-counter {
                    position: absolute;
                    bottom: 8px;
                    right: 12px;
                    font-size: 11px;
                    color: var(--text-tertiary);
                    background-color: var(--gf-bg-primary);
                    padding: 2px 6px;
                    border-radius: 4px;
                    pointer-events: none;
                    transition: color var(--anim-fast) var(--ease-out);
                }
                
                .char-counter.warning {
                    color: var(--gf-accent-warning);
                }
                
                .char-counter.error {
                    color: var(--gf-accent-danger);
                }
                
                .feedback-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-top: 20px;
                }
                
                .feedback-buttons .button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px 16px;
                    font-size: 14px;
                    font-weight: 500;
                    min-height: 40px;
                }
                
                .feedback-buttons .button svg {
                    width: 16px;
                    height: 16px;
                }
                
                .feedback-info {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 12px;
                    padding: 10px;
                    background-color: var(--background-primary);
                    border-radius: 6px;
                    font-size: 12px;
                    color: var(--text-tertiary);
                }
                
                .feedback-info svg {
                    width: 14px;
                    height: 14px;
                    opacity: 0.6;
                    flex-shrink: 0;
                }
                
                /* Button specific styles */
                .btn-send-feedback {
                    border: 2px solid var(--gf-accent-primary) !important;
                }
                
                .btn-send-feedback:disabled {
                    border-color: var(--gf-border-color) !important;
                    opacity: 0.5;
                }
                
                .btn-send-feedback:hover:not(:disabled) {
                    background-color: var(--gf-accent-primary);
                    border-color: var(--gf-accent-primary) !important;
                    color: var(--gf-button-text, white);
                    opacity: 0.9;
                }
                
                .btn-send-feedback.success {
                    background-color: var(--gf-accent-success);
                    animation: successPulse var(--anim-slow) var(--ease-out);
                }
                
                @keyframes successPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                /* Community section styles */
                .community-section {
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--gf-border-color);
                    width: 100%;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                
                .community-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--gf-text-primary);
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                
                .community-benefits {
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin-bottom: 16px;
                    line-height: 1.6;
                }
                
                .community-benefits li {
                    margin: 6px 0;
                    padding-left: 20px;
                    position: relative;
                }
                
                .community-benefits li::before {
                    content: "\u2713";
                    position: absolute;
                    left: 0;
                    color: var(--gf-accent-success);
                    font-weight: bold;
                }
                
                .whatsapp-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: calc(100% - 4px);
                    padding: 10px 16px;
                    background-color: #25D366;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all var(--anim-fast) var(--ease-out);
                    text-decoration: none;
                    box-sizing: border-box;
                    margin: 0 2px;
                }
                
                .whatsapp-button:hover {
                    background-color: #20BA5C;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
                }
                
                .whatsapp-button:active {
                    transform: translateY(0);
                }
                
                .limited-time-badge {
                    display: inline-block;
                    background: linear-gradient(135deg, #FF6B6B, #FF8E53);
                    color: white;
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                .community-footer {
                    font-size: 12px;
                    color: var(--text-tertiary);
                    text-align: center;
                    margin-top: 12px;
                    font-style: italic;
                }
            </style>
            
            <div class="feedback-container">
                <textarea 
                    class="feedback-textarea" 
                    id="feedback-textarea"
                    placeholder="Share your thoughts, report bugs, or suggest new features..."
                    maxlength="1000"
                ></textarea>
                <div class="char-counter" id="char-counter">0 / 1000</div>
            </div>
            
            <div class="feedback-buttons">
                <button class="button secondary btn-send-email" id="send-email-btn" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Send via Email
                </button>
                <button class="button primary btn-send-feedback" id="send-feedback-btn" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Send Anonymous
                </button>
            </div>
            
            <div class="feedback-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>Email: You'll get a response \u2022 Anonymous: Completely private</span>
            </div>
        `,null);const e=g.querySelector("#feedback-modal"),t=e.querySelector("#feedback-textarea"),o=e.querySelector("#send-feedback-btn"),n=e.querySelector("#send-email-btn"),r=e.querySelector("#char-counter");if(t&&r){const a=()=>{const i=t.value.length;r.textContent=`${i} / 1000`,r.classList.remove("warning","error"),i>900?r.classList.add("error"):i>800&&r.classList.add("warning");const c=t.value.trim().length>0;o&&(o.disabled=!c),n&&(n.disabled=!c)};t.addEventListener("input",a),a()}o&&t&&o.addEventListener("click",async()=>{const a=t.value.trim();if(!a){t.focus();return}o.disabled=!0;const i=o.innerHTML;o.innerHTML='<span class="spinner"></span> Sending...';try{const c={content:a,timestamp:new Date().toISOString(),version:chrome.runtime.getManifest().version,userAgent:navigator.userAgent};window.geminiAPI&&typeof CONFIG<"u"&&CONFIG.ANALYTICS_EVENTS&&(await window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEEDBACK_SUBMITTED,{feedbackLength:a.length,feedbackType:"anonymous",version:c.version,timestamp:c.timestamp}),await window.geminiAPI.sendFeedback(a));const d=(await chrome.storage.local.get("userFeedback")||{}).userFeedback||[];d.push(c),await chrome.storage.local.set({userFeedback:d}),o.classList.add("success"),o.innerHTML=`
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        <span>Sent Successfully!</span>
                    `,t.value="",r&&(r.textContent="0 / 1000",r.classList.remove("warning","error")),setTimeout(()=>{o.classList.remove("success"),o.innerHTML=i,o.disabled=!0},2e3)}catch{o.classList.remove("success"),o.innerHTML=`
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                        <span>Error - Try Email</span>
                    `,setTimeout(()=>{o.innerHTML=i,o.disabled=t.value.trim().length===0},3e3)}}),n&&t&&n.addEventListener("click",()=>{const a=t.value.trim();if(!a){t.focus();return}const i=`Gemini Toolbox Feedback - Version ${CONFIG.VERSION}`,c=`Hi there!

Here's my feedback for Gemini Toolbox:

${a}

Extension Details:
- Version: ${chrome.runtime.getManifest().version}
- Browser: ${navigator.userAgent}
- Timestamp: ${new Date().toLocaleString()}
- User ID: ${window.geminiAPI?.userId||"Unknown"} (for analytics correlation)

Please feel free to reply if you need more details!

Best regards`,l=`mailto:${CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent(i)}&body=${encodeURIComponent(c)}`;window.geminiAPI&&typeof CONFIG<"u"&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEEDBACK_SUBMITTED,{feedbackLength:a.length,feedbackType:"email",version:CONFIG.VERSION,timestamp:new Date().toISOString()});try{window.open(l,"_blank"),n.innerHTML=`
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        <span>Email Opened!</span>
                    `,t.value="",r&&(r.textContent="0 / 1000",r.classList.remove("warning","error")),setTimeout(()=>{n.innerHTML=`
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                            </svg>
                            Send via Email
                        `,n.disabled=!0},2e3)}catch{j("Unable to open email client. Please copy the feedback and email it manually to: "+CONFIG.SUPPORT_EMAIL)}})}async function io(e={}){await yt(),await wt(),await Ct(),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.SETTINGS_OPENED,{wordCounterEnabled:ie,totalFolders:C.folders.length,hideFolderedChats:C.settings.hideFolderedChats}),te("settings-modal","Settings",ro(),800);try{const t=await window.geminiAPI.getMeStatus(),o=g.querySelector("#subscription-section"),n=g.querySelector("#account-linking-section"),r=CONFIG.FEATURES?.accountLinking!==!1;t.plan==="premium"?(o&&(o.style.display="block"),n&&(n.style.display="none")):(n&&r&&(n.style.display="block"),o&&(o.style.display=t.plan==="premium_device"?"block":"none"))}catch{const o=g.querySelector("#account-linking-section");o&&CONFIG.FEATURES?.accountLinking!==!1&&(o.style.display="block")}e&&e.focusSection==="linking"&&setTimeout(()=>{const t=g.querySelector("#account-linking-section"),o=g.querySelector("#link-email-input");if(t&&t.scrollIntoView({behavior:"smooth",block:"start"}),o)try{o.focus()}catch{}},150),ao()}function so(){return`
            <div class="shortcuts-modal-content">
                <style>
                    .shortcuts-modal-content {
                        padding: 20px;
                    }
                    
                    .shortcuts-intro {
                        font-size: 13px;
                        color: var(--gf-text-secondary);
                        margin-bottom: var(--space-4);
                        line-height: 1.5;
                    }
                    
                    .shortcuts-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 8px;
                    }
                    
                    .shortcut-item {
                        display: flex;
                        align-items: center;
                        gap: var(--gap-medium);
                        padding: var(--input-padding);
                        background-color: var(--gf-bg-secondary);
                        border-radius: 10px;
                        transition: all var(--anim-normal) var(--ease-out);
                        min-height: 48px;
                        box-sizing: border-box;
                    }
                    
                    .shortcut-item:hover {
                        background-color: var(--gf-hover-bg);
                        transform: translateX(2px);
                    }
                    
                    .shortcut-icon {
                        font-size: 20px;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background-color: var(--gf-bg-primary);
                        border-radius: var(--space-2);
                        flex-shrink: 0;
                    }
                    
                    .shortcut-content {
                        flex: 1;
                        min-width: 0;
                    }
                    
                    .shortcut-key {
                        font-family: 'SF Mono', 'Monaco', 'Roboto Mono', monospace;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--gf-accent-primary);
                        background-color: var(--gf-bg-primary);
                        padding: 4px 8px;
                        border-radius: 4px;
                        border: 1px solid var(--gf-border-color);
                        display: inline-block;
                        letter-spacing: 0.3px;
                    }
                    
                    .shortcut-desc {
                        font-size: 13px;
                        color: var(--gf-text-secondary);
                        margin-top: 2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .shortcuts-footer {
                        margin-top: var(--space-4);
                        padding-top: 16px;
                        border-top: 1px solid var(--gf-border-color);
                        font-size: 12px;
                        color: var(--gf-text-tertiary);
                        text-align: center;
                    }
                    
                    /* Responsive adjustments */
                    @media (max-width: 768px) {
                        .shortcuts-modal-content {
                            width: 95%;
                            max-width: none;
                            height: auto;
                            max-height: 90vh;
                        }
                        
                        .shortcuts-grid {
                            gap: var(--gap-medium);
                        }
                        
                        .shortcut-item {
                            padding: var(--space-3);
                        }
                    }
                    
                    @media (max-width: 540px) {
                        .shortcuts-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .shortcuts-intro {
                            padding: var(--space-3);
                            font-size: 13px;
                        }
                    }
                </style>
                
                <div class="shortcuts-intro">
                    Press <strong>G</strong> first, then the action key. Shortcuts work when not focused on input fields.
                </div>
                
                <div class="shortcuts-grid">
                    ${[{key:"G \u2192 F",description:"Manage Folders",icon:"\u{1F4C1}"},{key:"G \u2192 M",description:"Chat Tools (Pinned)",icon:"\u{1F527}"},{key:"G \u2192 E",description:"Chat Tools (Export)",icon:"\u{1F4C4}"},{key:"G \u2192 D",description:"Chat Tools (Bulk Delete)",icon:"\u{1F5D1}\uFE0F"},{key:"G \u2192 P",description:"Prompt Management",icon:"\u{1F4DD}"},{key:"Ctrl+Shift+P",description:"Enhance Prompt (AI)",icon:"\u2728"},{key:"G \u2192 S",description:"Settings",icon:"\u2699\uFE0F"},{key:"ESC",description:"Close any modal",icon:"\u274C"}].map(t=>`
                        <div class="shortcut-item">
                            <div class="shortcut-icon">${t.icon}</div>
                            <div class="shortcut-content">
                                <span class="shortcut-key">${t.key}</span>
                                <div class="shortcut-desc">${t.description}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
                
                <div class="shortcuts-footer">
                    <strong>Tip:</strong> Use ESC to close any open modal quickly.
                </div>
            </div>
        `}function lo(){te("shortcuts-modal","Keyboard Shortcuts",so(),560)}function ae(){const e=[];let t=U();if(t.length===0){const o=Array.from(document.querySelectorAll('[role="navigation"] [role="listitem"], nav li, .conversation-item'));t=t.concat(o)}return t.forEach((o,n)=>{const r=V(o)||`chat-${n}`,a=o.querySelector(".conversation-title");let i=a?a.textContent.trim():o.textContent.trim();i=i.replace(/\s+/g," ").trim();let c=o;const l=o.querySelector("a");l&&(c=l),i&&i!==""&&!i.toLowerCase().includes("new chat")&&e.push({id:r,title:i,lastUpdated:"Recently",element:c})}),t.length>0,e.length===0&&document.querySelectorAll("a").forEach((n,r)=>{const a=n.textContent.trim();a&&a.length>0&&a.length<100&&!a.includes("New chat")&&e.push({id:`fallback-${r}`,title:a,lastUpdated:"Recently",element:n})}),e}async function co(e=10){for(let t=0;t<e;t++){if(document.querySelectorAll('.conversation-container, [class*="conversation"], user-query').length>0)return!0;await new Promise(n=>setTimeout(n,500))}return!1}function po(){const e=g.querySelector("#export-chat-modal")||g.querySelector("#chat-tools-modal");if(!e)return;const t=e.querySelector("#export-chat-select-all"),o=e.querySelector("#start-export-btn"),n=e.querySelector("#export-tab-panel"),r=n?n.querySelector(".cancel-action"):e.querySelector(".cancel-action"),a=e.querySelector("#export-chat-search"),i=e.querySelector("#export-chat-list"),c=e.querySelector("#export-chat-loading"),l=e.querySelector("#export-chat-counter"),d=e.querySelector("#export-error-message"),p=e.querySelector("#export-progress"),h=e.querySelector("#export-chat-status"),b=e.querySelector("#export-chat-loading-more"),I=e.querySelector("#export-chat-format");let F=[],N=[],s=new Set,E=new Set,m=!1,y=0;const f=3;let v=null,A=!1,q=null;const P=e.querySelector("#export-chat-search-loading"),L=e.querySelector("#export-chat-search-status");c.style.display="block",setTimeout(()=>{F=ae(),N=[...F],F.forEach(D=>{D.id&&E.add(D.id)}),c.style.display="none",oe(N),H()},500);async function $(){if(!m){m=!0,b.style.display="block",b.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: var(--space-4); color: var(--gf-text-secondary);">
                    <div style="width: 16px; height: 16px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>Loading more conversations...</span>
                </div>
            `;try{const D=ae().length,_=[document.querySelector("conversations-list"),document.querySelector('[role="navigation"]'),document.querySelector(".conversation-list"),document.querySelector('[data-testid="conversation-list"]')];let u=null;for(const x of _)if(x&&(x.scrollHeight>x.clientHeight||x.querySelector('[data-test-id="conversation"]'))){u=x;break}if(!u){const x=document.querySelector('[data-test-id="conversation"]');if(x){let k=x.parentElement;for(;k&&k!==document.body;){if(k.scrollHeight>k.clientHeight){u=k;break}k=k.parentElement}}}if(u){const x=u.scrollTop;u.scrollTop=u.scrollHeight,u.dispatchEvent(new Event("scroll",{bubbles:!0,composed:!0}));const k=U();if(k.length>0){const O=k[k.length-1];O.scrollIntoView({block:"end",inline:"nearest"});const X=new WheelEvent("wheel",{deltaY:300,bubbles:!0,cancelable:!0,view:window});O.dispatchEvent(X),u.dispatchEvent(X)}let M=0;const T=3;for(;M<T&&(await new Promise(X=>setTimeout(X,100)),!(U().length>D));)M++;if(!(U().length>D)){const O=u.querySelector('.loading-indicator, .spinner, [aria-label*="loading"]')}u.scrollTop=x}const w=ae().filter(x=>x.id&&!E.has(x.id));w.length>0?(y=0,w.forEach(x=>{E.add(x.id),F.push(x)}),N=a.value?F.filter(x=>x.title.toLowerCase().includes(a.value.toLowerCase())):[...F],oe(N),b.innerHTML=`
                        <div style="text-align: center; color: var(--gf-accent-success); padding: var(--space-3); font-size: 14px;">
                            \u2713 Added ${w.length} more conversation${w.length===1?"":"s"}
                        </div>
                    `):(y++,b.style.display="none")}catch{b.innerHTML=`
                    <div style="text-align: center; color: var(--gf-accent-danger); padding: var(--space-3); font-size: 14px;">
                        Error loading conversations. Please try again.
                    </div>
                `}finally{m=!1,b.innerHTML.includes("\u2713 Added")?setTimeout(()=>{b.style.display="none"},400):b.innerHTML.includes("Error")&&setTimeout(()=>{b.style.display="none"},1e3)}}}function H(){if(v)return;v=new MutationObserver(_=>{let u=!1;_.forEach(S=>{S.addedNodes.forEach(w=>{w.nodeType===Node.ELEMENT_NODE&&(w.matches?.('[data-test-id="conversation"]')?[w]:w.querySelectorAll?.('[data-test-id="conversation"]')||[]).forEach(k=>{const M=V(k);M&&!E.has(M)&&(u=!0)})})}),u&&setTimeout(()=>B(),50)});const D=document.querySelector("conversations-list");D&&v.observe(D,{childList:!0,subtree:!0})}function B(){const _=ae().filter(u=>u.id&&!E.has(u.id));_.length>0&&(y=0,_.forEach(u=>{E.add(u.id),F.push(u)}),N=a.value?F.filter(u=>u.title.toLowerCase().includes(a.value.toLowerCase())):[...F],oe(N))}function J(){v&&(v.disconnect(),v=null)}i.addEventListener("scroll",()=>{if(y>=f||m)return;const{scrollTop:D,scrollHeight:_,clientHeight:u}=i;_-D-u<100&&$()}),I&&I.addEventListener("change",()=>ve());function oe(D){i.querySelectorAll(".bulk-delete-item").forEach(w=>w.remove());const u=i.querySelector(".no-conversations-message");if(u&&u.remove(),D.length===0){const w=document.createElement("div");w.className="no-conversations-message empty-state";const x=a.value.trim();x&&F.length>0?w.innerHTML=`
                        <div style="text-align: center; padding: 40px 20px; color: var(--gf-text-secondary);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.4;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <p style="margin: 0; font-size: 14px;">No conversations found matching "${x}"</p>
                        </div>
                    `:F.length===0&&(w.innerHTML=`
                        <div style="text-align: center; padding: 40px; color: var(--gf-text-secondary);">
                            <p style="font-size: 16px; margin-bottom: var(--space-2);">No conversations found</p>
                            <p style="font-size: 14px;">Make sure you have some conversations in your Gemini history.</p>
                            <p style="font-size: 12px; margin-top: var(--space-4);">If you have conversations but they're not showing, try refreshing the page.</p>
                        </div>
                    `),i.insertBefore(w,b);return}const S=document.createDocumentFragment();D.forEach(w=>{const x=document.createElement("div");x.className="bulk-delete-item";const k=s.has(w.id);x.innerHTML=`
                    <input type="checkbox" class="bulk-delete-checkbox export-chat-checkbox" data-chat-id="${w.id}" ${k?"checked":""}>
                    <span class="item-title" style="cursor: pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${w.title}</span>
                `,x.style.cursor="pointer",x.addEventListener("click",M=>{if(M.target.type==="checkbox")return;const T=x.querySelector('input[type="checkbox"]');T&&(T.checked=!T.checked,T.dispatchEvent(new Event("change")))}),S.appendChild(x)}),b&&b.parentNode===i?i.insertBefore(S,b):i.appendChild(S),W(),ve()}function W(){e.querySelectorAll(".bulk-delete-checkbox").forEach(_=>{_.addEventListener("change",u=>{const S=u.target.getAttribute("data-chat-id");u.target.checked?s.add(S):(s.delete(S),t.checked=!1),ve()})})}function ve(){l&&(l.textContent=`${s.size} selected`),o.disabled=s.size===0,o.textContent=s.size>0?`Export ${s.size} Chat${s.size>1?"s":""}`:"Export";const D=e.querySelectorAll(".bulk-delete-checkbox"),_=e.querySelectorAll(".bulk-delete-checkbox:checked").length;t.checked=D.length>0&&_===D.length,t.indeterminate=_>0&&_<D.length}function Ve(D){if(!D)return null;let _=D.parentElement;for(;_&&_!==document.body;){if(_.scrollHeight>_.clientHeight)return _;_=_.parentElement}return null}async function Le(){const D=document.querySelector("conversations-list")||document.querySelector('[role="navigation"]')||Ve(document.querySelector('[data-test-id="conversation"]'));if(D){D.scrollTop=D.scrollHeight,D.dispatchEvent(new Event("scroll",{bubbles:!0})),await new Promise(u=>setTimeout(u,50));const _=Array.from(U()).pop();if(_){_.scrollIntoView({block:"end"});const u=new WheelEvent("wheel",{deltaY:100,bubbles:!0,cancelable:!0});D.dispatchEvent(u)}await new Promise(u=>setTimeout(u,200))}}async function et(){const D=t.parentElement,_=D.textContent.trim();if(D.lastChild&&D.lastChild.nodeType===Node.TEXT_NODE)D.lastChild.textContent="Loading all conversations...";else{const x=Array.from(D.childNodes).filter(k=>k.nodeType===Node.TEXT_NODE);x.length>0&&(x[x.length-1].textContent="Loading all conversations...")}t.disabled=!0,b.style.display="block",b.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: var(--space-4); color: var(--gf-accent-primary);">
                    <div style="width: 16px; height: 16px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>Loading all conversations...</span>
                </div>
            `;let u=0;const S=5;let w=0;for(;u<S;){const x=F.length;await Le();const M=ae().filter(T=>T.id&&!E.has(T.id));M.length>0?(M.forEach(T=>{E.add(T.id),F.push(T)}),w+=M.length,u=0,b.innerHTML=`
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: var(--space-4); color: var(--gf-accent-primary);">
                            <div style="width: 16px; height: 16px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                            <span>Loading conversations... (${F.length} found)</span>
                        </div>
                    `):u++,await new Promise(T=>setTimeout(T,100))}for(let x=0;x<2;x++){await Le();const k=ae().filter(M=>M.id&&!E.has(M.id));k.length>0&&(k.forEach(M=>{E.add(M.id),F.push(M)}),w+=k.length)}if(b.style.display="none",t.disabled=!1,D.lastChild&&D.lastChild.nodeType===Node.TEXT_NODE)D.lastChild.textContent="Select All";else{const x=Array.from(D.childNodes).filter(k=>k.nodeType===Node.TEXT_NODE);x.length>0&&(x[x.length-1].textContent="Select All")}}async function De(){if(A)return;P&&(P.style.display="block"),L&&(L.textContent="Searching all conversations...");let D=0;const _=5;for(;D<_;){const u=F.length;await Le(),await new Promise(x=>setTimeout(x,500));const w=ae().filter(x=>x.id&&!E.has(x.id));w.length>0?(w.forEach(x=>{E.add(x.id),F.push(x)}),D=0,L&&(L.textContent=`Searching... (${F.length} found)`)):D++,await new Promise(x=>setTimeout(x,100))}for(let u=0;u<2;u++){await Le();const S=ae().filter(w=>w.id&&!E.has(w.id));S.length>0&&S.forEach(w=>{E.add(w.id),F.push(w)})}A=!0,P&&(P.style.display="none")}t.addEventListener("change",async function(D){this.checked?(await et(),N=a.value?F.filter(u=>u.title.toLowerCase().includes(a.value.toLowerCase())):[...F],N.forEach(u=>{s.add(u.id)}),oe(N)):(s.clear(),e.querySelectorAll(".bulk-delete-checkbox").forEach(S=>{S.checked=!1}),ve())}),a.addEventListener("input",async D=>{const _=D.target.value.trim();if(q&&clearTimeout(q),_&&!A)q=setTimeout(async()=>{await De();const u=_.toLowerCase();N=u?F.filter(S=>S.title.toLowerCase().includes(u)):[...F],oe(N)},300);else{const u=_.toLowerCase();N=u?F.filter(S=>S.title.toLowerCase().includes(u)):[...F],oe(N)}}),r.addEventListener("click",()=>{J(),R()});const Ue=new MutationObserver(D=>{document.body.contains(e)||(J(),Ue.disconnect())});Ue.observe(document.body,{childList:!0,subtree:!0}),o.addEventListener("click",async()=>{await tt()});async function tt(){const D=Array.from(s);if(D.length===0)return;const _=I&&I.value?I.value:"pdf";o.disabled=!0,o.innerHTML='<span style="display: inline-flex; align-items: center; gap: 8px;">Exporting... <svg width="16" height="16" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10.5" stroke-linecap="round"></circle></svg></span>',h.style.display="block",p.style.display="block",d.style.display="none";const u=D.length,S=e.querySelector("#export-current-count"),w=e.querySelector("#export-total-count"),x=e.querySelector("#export-progress-bar");w.textContent=u;try{for(let k=0;k<D.length;k++){S.textContent=k+1,x.style.width=`${(k+1)/u*100}%`;const M=D[k],T=F.find(G=>G.id===M);try{if(T&&T.element){let G=T.element;if(T.element.tagName!=="A"&&(G=T.element.querySelector("a")||T.element),G)if(G.click(),await new Promise(O=>setTimeout(O,2e3)),await co(),typeof window.exportCurrentChat=="function")await window.exportCurrentChat(_,T.title),k<D.length-1&&await new Promise(O=>setTimeout(O,800));else if(_==="pdf"&&typeof window.exportCurrentChatToPDF=="function")await window.exportCurrentChatToPDF(T.title),k<D.length-1&&await new Promise(O=>setTimeout(O,800));else if(_==="pdf"&&typeof window.triggerGeminiToolboxExport=="function")window.triggerGeminiToolboxExport(),await new Promise(O=>setTimeout(O,1200));else throw new Error("Export function not available for format: "+_+". Please refresh the page.");else throw new Error(`Could not navigate to chat: ${T.title}`)}}catch{}}p.style.display="none",h.innerHTML=`
                    <div style="color: var(--gf-accent-success); font-size: 16px; text-align: center; padding: 20px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        Successfully exported ${u} conversation${u>1?"s":""}
                    </div>
                `,setTimeout(()=>{R()},2e3)}catch(k){d.style.display="block",d.textContent=`Export failed: ${k.message}`,p.style.display="none",o.disabled=!1,o.textContent=s.size>0?`Export ${s.size} Chat${s.size>1?"s":""}`:"Export"}}}async function mo(e,t){try{if(t?.aborted)throw new Error("Operation aborted by user.");const o=e.nextElementSibling;if(!o)throw new Error("Actions wrapper (sibling to conversation item) not found.");let n=Be(Ft,o);if(n||(n=o.querySelector("button")),!n)throw new Error("Three-dot button not found in actions wrapper.");if(n.click(),await Oe(150),t?.aborted)throw new Error("Operation aborted by user.");const r=Be(Pt);if(!r)throw new Error("Overlay container for delete menu not found.");const a=await at(Mt,r,7e3);if(!a)throw new Error("Delete button not found in menu");if(a.click(),await Oe(150),t?.aborted)throw new Error("Operation aborted by user.");const i=await at(At,r,7e3);if(!i)throw new Error("Confirm button not found in dialog");return i.click(),await uo(e,15e3),{status:"success"}}catch(o){o.message.includes("aborted");const n=new KeyboardEvent("keydown",{key:"Escape",code:"Escape",keyCode:27,bubbles:!0,cancelable:!0});return document.body.dispatchEvent(n),await Oe(100),{status:"error",error:o.message}}}function uo(e,t=15e3){return new Promise((o,n)=>{if(!e||!document.body.contains(e))return o();let r=0;const a=100,i=setInterval(()=>{r+=a,!document.body.contains(e)||e.offsetParent===null?(clearInterval(i),o()):r>=t&&(clearInterval(i),n(new Error("Element did not disappear within timeout.")))},a)})}function gt(){const e=U(),t={};let o=!1;e.forEach(n=>{const r=V(n);if(r){let a=n.querySelector(".conversation-title, .title")?.textContent.trim();a||(a=n.textContent.trim().split(`
`)[0]);const c=n.querySelector("a[href]")?.getAttribute("href");let l;c?l=c.startsWith("http")?c:`https://gemini.google.com${c.startsWith("/")?"":"/"}${c}`:l=`https://gemini.google.com/app/${r.startsWith("c_")?r.substring(2):r}`;const d=C.chatMetadata?C.chatMetadata[r]:null;(!d||d.title!==a||d.url!==l)&&(t[r]={title:a,url:l},o=!0,C.chatMetadata||(C.chatMetadata={}),C.chatMetadata[r]={...C.chatMetadata[r]||{},title:a,url:l,lastSeen:Date.now()})}}),o&&window.geminiStorage&&Object.entries(t).forEach(([n,r])=>{window.geminiStorage.updateChatMetadata(n,r)})}let Je=null;function go(){if(Je)return;const e=document.querySelector("conversations-list");e&&(gt(),C.settings.hideFolderedChats&&Ee(),Je=new MutationObserver(qt(()=>{gt(),C.settings.hideFolderedChats&&Ee()},200)),Je.observe(e,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["href","class"]}))}function Ee(){const e=U(),t=new Set;C.settings.hideFolderedChats&&C.folders.forEach(o=>{o.chatIds.forEach(n=>t.add(n))}),e.forEach(o=>{const n=V(o);n&&t.has(n)?o.style.display="none":o.style.display=""})}function ht(e){const t=e.chatIds.map(o=>{const n=U().find(a=>V(a)===o);let r=n?n.textContent.trim():null;return!r&&C.chatMetadata&&C.chatMetadata[o]&&(r=C.chatMetadata[o].title),r||(r="Chat not found"),r=r.split(`
`)[0].trim(),`
                <div class="list-item chat-item" data-chat-id="${o}">
                    <span class="item-title">${r}</span>
                    <button class="icon-btn remove-from-folder-btn" data-chat-id="${o}" title="Remove from folder">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `}).join("");return`
            <div class="modal-header" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px;">
                <button class="icon-btn" id="back-to-folders-btn" style="display: flex; align-items: center; gap: 4px; font-family: 'Google Sans', 'Roboto', sans-serif;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <span>Back</span>
                </button>
                <h2 style="text-align: center; margin: 0; font-family: 'Google Sans', 'Roboto', sans-serif;">${e.name}</h2>
                <button class="modal-close" id="close-modal-btn" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                </div>
            <div class="modal-body">
                ${t||"<p>No chats in this folder yet.</p>"}
            </div>
        `}function ft(e){const t=g.querySelector("#manage-single-folder-modal");if(!t)return;const o=t.querySelector(".modal-content");o&&o.addEventListener("click",n=>{if(n.target.closest("#back-to-folders-btn"))R();else if(n.target.closest("#close-modal-btn"))R();else if(n.target.closest(".remove-from-folder-btn")){const r=n.target.closest(".remove-from-folder-btn").dataset.chatId,a=C.folders.find(i=>i.id===e);if(a){a.chatIds=a.chatIds.filter(c=>c!==r),Ce(),Ee();const i=g.querySelector("#manage-single-folder-modal");if(i){const c=i.querySelector(".modal-body");if(c){const l=ht(a),d=document.createElement("div");d.innerHTML=l;const p=d.querySelector(".modal-body");p&&(c.innerHTML=p.innerHTML)}ft(e)}}}else if(n.target.closest(".chat-item")){const r=n.target.closest(".chat-item").dataset.chatId,a=U().find(i=>V(i)===r);if(a)a.click(),lt();else{const i=C.chatMetadata?C.chatMetadata[r]:null;let c;i&&i.url?c=i.url:c=`https://gemini.google.com/app/${r.startsWith("c_")?r.substring(2):r}`,lt(),window.location.href=c}}})}function bt(){const e=g.getElementById("bulk-delete-modal")||g.getElementById("chat-tools-modal");if(!e)return;const t=e.querySelector("#bulk-delete-select-all");let o=e.querySelectorAll(".bulk-delete-checkbox");const n=e.querySelector("#start-bulk-delete-btn"),r=e.querySelector("#bulk-delete-status"),a=e.querySelector("#bulk-delete-search"),i=e.querySelector("#bulk-delete-counter"),c=e.querySelector("#bulk-delete-breakdown"),l=e.querySelector("#bulk-delete-list"),d=e.querySelector("#bulk-delete-loading");let p=e.querySelector("#bulk-delete-loading-more");const h=e.querySelector("#include-foldered-chats"),b=e.querySelector("#include-pinned-chats"),I=e.querySelector("#bulk-delete-search-loading"),F=e.querySelector("#bulk-delete-search-status");if(!l||!t||!n||!i||!a)return;let N=new Set,s=!1,E=0;const m=3;let y=!1,f=!1,v=!1,A=null;const q=new Set;C.folders.forEach(u=>{u.chatIds.forEach(S=>q.add(S))}),P();async function P(){try{let u=U();if(C.settings.hideFolderedChats){const x=new Set;C.folders.forEach(k=>{k.chatIds.forEach(M=>x.add(M))}),u=u.filter(k=>{const M=V(k);return!x.has(M)})}const S=ye(u,q,y,f);d&&(d.style.display="none"),p=e.querySelector("#bulk-delete-loading-more"),l.querySelectorAll(".bulk-delete-item").forEach(x=>x.remove()),S?p?p.insertAdjacentHTML("beforebegin",S):l.insertAdjacentHTML("beforeend",S):l.insertAdjacentHTML("afterbegin",'<p style="text-align: center; color: var(--gf-text-secondary); padding: 40px 0;">No conversations found.</p>'),o=e.querySelectorAll(".bulk-delete-checkbox"),N.clear(),Array.from(o).forEach(x=>{const k=x.dataset.chatId;k&&N.add(k)}),W()}catch{d&&(d.style.display="none"),l.innerHTML='<p style="text-align: center; color: var(--gf-text-secondary); padding: 40px 0;">Error loading conversations. Please refresh and try again.</p>'}}async function L(){if(!s){s=!0,p&&(p.style.display="block");try{const u=U().length,S=[document.querySelector("conversations-list"),document.querySelector('[role="navigation"]'),document.querySelector(".conversation-list"),document.querySelector('[data-testid="conversation-list"]')];let w=null;for(const M of S)if(M&&(M.scrollHeight>M.clientHeight||M.querySelector('[data-test-id="conversation"]'))){w=M;break}if(!w){const M=document.querySelector('[data-test-id="conversation"]');if(M){let T=M.parentElement;for(;T&&T!==document.body;){if(T.scrollHeight>T.clientHeight){w=T;break}T=T.parentElement}}}if(w){const M=w.scrollTop;w.scrollTop=w.scrollHeight,w.dispatchEvent(new Event("scroll",{bubbles:!0,composed:!0}));const T=U();if(T.length>0){const Z=T[T.length-1];Z.scrollIntoView({block:"end",inline:"nearest"});const Q=new WheelEvent("wheel",{deltaY:300,bubbles:!0,cancelable:!0,view:window});Z.dispatchEvent(Q),w.dispatchEvent(Q)}let G=0;const O=3;for(;G<O&&(await new Promise(Q=>setTimeout(Q,100)),!(U().length>u));)G++;if(!(U().length>u)){const Z=w.querySelector('.loading-indicator, .spinner, [aria-label*="loading"]')}w.scrollTop=M}const k=U().filter(M=>{const T=V(M);return T&&!N.has(T)});if(k.length>0){E=0;const M=ye(k,q,y,f),T=document.createElement("div");for(T.innerHTML=M;T.firstChild;)p&&p.parentNode===l?l.insertBefore(T.firstChild,p):l.appendChild(T.firstChild);k.forEach(O=>{const X=V(O);X&&N.add(X)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-k.length).forEach(O=>{O.addEventListener("change",W)}),d.innerHTML=`
                        <div style="text-align: center; color: var(--gf-accent-success); padding: var(--space-3); font-size: 14px;">
                            \u2713 Added ${k.length} more conversation${k.length===1?"":"s"}
                        </div>
                    `}else E++,p&&(p.style.display="none")}catch{p&&(p.style.display="none")}finally{s=!1}}}let $=null;function H(){if($)return;$=new MutationObserver(S=>{let w=!1;S.forEach(x=>{x.addedNodes.forEach(k=>{k.nodeType===Node.ELEMENT_NODE&&(k.matches?.('[data-test-id="conversation"]')?[k]:k.querySelectorAll?.('[data-test-id="conversation"]')||[]).forEach(T=>{const G=V(T);G&&!N.has(G)&&(w=!0)})})}),w&&setTimeout(()=>B(),50)});const u=document.querySelector("conversations-list");u&&$.observe(u,{childList:!0,subtree:!0})}function B(){let S=U().filter(w=>{const x=V(w);return x&&!N.has(x)});if(C.settings.hideFolderedChats){const w=new Set;C.folders.forEach(x=>{x.chatIds.forEach(k=>w.add(k))}),S=S.filter(x=>{const k=V(x);return!w.has(k)})}if(S.length>0){E=0;const w=ye(S,q,y,f),x=document.createElement("div");for(x.innerHTML=w;x.firstChild;)p&&p.parentNode===l?l.insertBefore(x.firstChild,p):l.appendChild(x.firstChild);S.forEach(M=>{const T=V(M);T&&N.add(T)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-S.length).forEach(M=>{M.addEventListener("change",W)})}}function J(){$&&($.disconnect(),$=null)}H();const oe=new MutationObserver(u=>{u.forEach(S=>{S.type==="childList"&&S.removedNodes.forEach(w=>{(w===e||w.nodeType===Node.ELEMENT_NODE&&w.contains(e))&&(J(),oe.disconnect())})})});oe.observe(document.body,{childList:!0,subtree:!0}),l.addEventListener("scroll",()=>{if(E>=m||s)return;const{scrollTop:u,scrollHeight:S,clientHeight:w}=l;S-u-w<100&&L()});function W(){if(!i||!n)return;const u=Array.from(o).filter(M=>{const T=M.closest(".bulk-delete-item");return T&&T.style.display!=="none"});let S=0,w=0,x=0;u.forEach(M=>{if(M.checked){const T=M.closest(".bulk-delete-item"),G=T&&T.dataset.isFoldered==="true",O=T&&T.dataset.isPinned==="true";G?S++:O?w++:x++}});const k=S+w+x;if(i.textContent=`${k} selected`,c)if(k>0){const M=[];x>0&&M.push(`Regular: ${x}`),S>0&&M.push(`Foldered: ${S}`),w>0&&M.push(`Pinned: ${w}`),M.length>1?(c.textContent=`(${M.join(", ")})`,c.style.display="block"):(c.textContent="",c.style.display="none")}else c.textContent="",c.style.display="none";k>0?(n.textContent=`Delete ${k} Chat${k===1?"":"s"}`,n.disabled=!1):(n.textContent="Delete 0 Chats",n.disabled=!0)}function ve(u){const S=e.querySelectorAll(".bulk-delete-item"),w=u.toLowerCase().trim();let x=0;S.forEach(M=>{const T=M.querySelector(".item-title"),G=T?T.textContent.toLowerCase():M.textContent.toLowerCase();w===""||G.includes(w)?(M.style.display="",x++):M.style.display="none"});const k=l.querySelector(".empty-state");k&&k.remove(),x===0&&w&&l.insertAdjacentHTML("beforeend",`
                    <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--gf-text-secondary);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.4;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <p style="margin: 0; font-size: 14px;">No conversations found matching "${w}"</p>
                    </div>
                `),W()}a.addEventListener("input",async u=>{const S=u.target.value.trim();A&&clearTimeout(A),S&&!v?A=setTimeout(async()=>{await tt(),ve(S)},300):ve(S)}),a.addEventListener("focus",()=>{a.style.borderColor="var(--gf-accent-primary)",a.style.boxShadow="0 0 0 2px rgba(138, 180, 248, 0.2)"}),a.addEventListener("blur",()=>{a.style.borderColor="var(--gf-border-color)",a.style.boxShadow="none"}),h&&h.addEventListener("change",u=>{y=u.target.checked,Ve(),W(),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"includeFolderedChats",enabled:y})}),b&&b.addEventListener("change",u=>{f=u.target.checked,Ve(),W(),window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.FEATURE_TOGGLED,{feature:"includePinnedChats",enabled:f})});function Ve(){e.querySelectorAll(".bulk-delete-item").forEach(S=>{const w=S.querySelector(".bulk-delete-checkbox"),x=S.dataset.isFoldered==="true",k=S.dataset.isPinned==="true";if(x&&!y||k&&!f){S.classList.add("foldered-protected"),w.disabled=!0,w.checked=!1;const T=S.querySelector(".protected-badge");T&&T.remove();const G=S.querySelector(".item-title");G&&(x&&!y?G.insertAdjacentHTML("afterend",'<span class="protected-badge">Protected (Folder)</span>'):k&&!f&&G.insertAdjacentHTML("afterend",'<span class="protected-badge">Protected (Pinned)</span>'))}else{S.classList.remove("foldered-protected"),w.disabled=!1;const T=S.querySelector(".protected-badge");T&&T.remove()}})}if(o.forEach(u=>{u.addEventListener("change",W)}),!t)return;t.addEventListener("change",async function(){this.checked?(await Le(),o=e.querySelectorAll(".bulk-delete-checkbox"),o.forEach(S=>{const w=S.closest(".bulk-delete-item"),x=w&&w.dataset.isFoldered==="true",k=w&&w.dataset.isPinned==="true";!(x&&!y||k&&!f)&&!S.disabled&&(S.checked=!0)})):o.forEach(S=>{S.checked=!1}),W()});async function Le(){const u=document.querySelector('[data-test-id="side-nav-menu-button"]'),S=document.querySelector("mat-sidenav");u&&S&&(S.classList.contains("mat-drawer-opened")||S.getAttribute("aria-hidden")==="false"||(console.log("[Bulk Delete] Opening sidebar..."),u.click(),await new Promise(ee=>setTimeout(ee,500))));const w=document.querySelector("infinite-scroller");if(!w){console.warn("[Bulk Delete] Could not find infinite-scroller, using fallback method"),await et();return}const k=t.parentElement.querySelector("span"),M=k?k.textContent:"Select all";k&&(k.textContent="Loading all conversations..."),t.disabled=!0,d.style.display="block",d.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: var(--space-4); color: var(--gf-accent-primary);">
                    <div style="width: 16px; height: 16px; border: 2px solid var(--gf-accent-primary); border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>Loading all conversations...</span>
                </div>
            `;let T=0,G=0,O=0;const X=300;let Z=0,Q=0;for(console.log("[Bulk Delete] Starting aggressive conversation loading...");O<X;){O++;const ne=U().length,ee=w.scrollHeight;w.scrollTop=ee+1e5,k&&(k.textContent=`Loading... (${ne} conversations)`),await new Promise(le=>setTimeout(le,400));const Te=document.querySelector('[data-test-id="loading-history-spinner"]');if(Te&&Te.offsetParent!==null){G=0,Q=0,await new Promise(le=>setTimeout(le,800));continue}const ue=ne===T,pe=ee===Z;if(ue&&pe){if(G++,Q++,G>=8){console.log(`[Bulk Delete] All conversations loaded! Total: ${ne}`);break}}else G=0,Q=0,T=ne,Z=ee;if(Q>=5&&ne>0){console.log(`[Bulk Delete] Early exit after ${O} attempts`);break}const je=ue&&pe?150:100;await new Promise(le=>setTimeout(le,je))}const me=U().filter(ne=>{const ee=V(ne);return ee&&!N.has(ee)});if(me.length>0){const ne=ye(me,q,y,f),ee=document.createElement("div");for(ee.innerHTML=ne;ee.firstChild;)p&&p.parentNode===l?l.insertBefore(ee.firstChild,p):l.appendChild(ee.firstChild);me.forEach(ue=>{const pe=V(ue);pe&&N.add(pe)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-me.length).forEach(ue=>{ue.addEventListener("change",W)})}k&&(k.textContent=M),t.disabled=!1,d.style.display="none",E=0,console.log(`[Bulk Delete] Finished! Total in list: ${e.querySelectorAll(".bulk-delete-item").length}`)}async function et(){console.log("[Bulk Delete] Using fallback loading method...");let u=0;const S=5;for(;u<S;){await De();const x=U().filter(k=>{const M=V(k);return M&&!N.has(M)});if(x.length>0){const k=ye(x,q,y,f),M=document.createElement("div");for(M.innerHTML=k;M.firstChild;)p&&p.parentNode===l?l.insertBefore(M.firstChild,p):l.appendChild(M.firstChild);x.forEach(G=>{const O=V(G);O&&N.add(O)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-x.length).forEach(G=>{G.addEventListener("change",W)}),u=0}else u++;await new Promise(k=>setTimeout(k,150))}}async function De(){const u=document.querySelector("conversations-list")||document.querySelector('[role="navigation"]')||Ue(document.querySelector('[data-test-id="conversation"]'));if(u){u.scrollTop=u.scrollHeight,u.dispatchEvent(new Event("scroll",{bubbles:!0})),await new Promise(w=>setTimeout(w,50));const S=Array.from(U()).pop();if(S){S.scrollIntoView({block:"end"});const w=new WheelEvent("wheel",{deltaY:100,bubbles:!0,cancelable:!0});u.dispatchEvent(w)}await new Promise(w=>setTimeout(w,200))}}function Ue(u){if(!u)return null;let S=u.parentElement;for(;S&&S!==document.body;){if(S.scrollHeight>S.clientHeight)return S;S=S.parentElement}return null}async function tt(){if(v)return;I&&(I.style.display="block"),F&&(F.textContent="Searching all conversations...");let u=0;const S=5;for(;u<S;){const w=N.size;await De(),await new Promise(M=>setTimeout(M,500));const k=U().filter(M=>{const T=V(M);return T&&!N.has(T)});if(k.length>0){const M=ye(k,q,y,f),T=document.createElement("div");for(T.innerHTML=M;T.firstChild;)p&&p.parentNode===l?l.insertBefore(T.firstChild,p):l.appendChild(T.firstChild);k.forEach(O=>{const X=V(O);X&&N.add(X)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-k.length).forEach(O=>{O.addEventListener("change",W)}),u=0,F&&(F.textContent=`Searching... (${N.size} found)`)}else u++;await new Promise(M=>setTimeout(M,100))}for(let w=0;w<2;w++){await De();const k=U().filter(M=>{const T=V(M);return T&&!N.has(T)});if(k.length>0){const M=ye(k,q,y,f),T=document.createElement("div");for(T.innerHTML=M;T.firstChild;)p&&p.parentNode===l?l.insertBefore(T.firstChild,p):l.appendChild(T.firstChild);k.forEach(O=>{const X=V(O);X&&N.add(X)}),o=e.querySelectorAll(".bulk-delete-checkbox"),Array.from(o).slice(-k.length).forEach(O=>{O.addEventListener("change",W)})}}v=!0,I&&(I.style.display="none")}W();const D=e.querySelector("#bulk-delete-tab-panel"),_=D?D.querySelector(".cancel-action"):e.querySelector(".cancel-action");_&&_.addEventListener("click",()=>{R()}),n.addEventListener("click",async()=>{const u=Array.from(o).filter(K=>K.checked);if(u.length===0){r.textContent="No items selected.";return}const S=[];u.forEach(K=>{K.dataset.chatId&&S.push(K.dataset.chatId)});const w=new Set(S),x=w.size;if(x===0){r.textContent="No chats to delete.";return}const M=`
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: var(--gap-medium); margin-bottom: var(--space-4);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gf-accent-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        <p style="margin: 0; color: var(--gf-text-primary); font-size: 16px; font-weight: 500; line-height: 1.5;">
                            ${`Are you sure you want to delete ${x} conversation${x>1?"s":""}? This action cannot be undone.`}
                        </p>
                    </div>
                    <p style="margin: 0 0 0 36px; color: var(--gf-text-secondary); font-size: 14px;">
                        All selected conversations will be permanently deleted.
                    </p>
                </div>
                <div class="modal-footer">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <button type="button" class="button secondary" id="cancel-bulk-delete-confirm" >Cancel</button>
                        <button type="button" class="button danger" id="confirm-bulk-delete-action" >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px; vertical-align: middle;">
                                <path d="M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1.5-1.5h9V2a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v.5zM6.5 6v5m3-5v5"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;if(te("bulk-delete-confirm-modal","Confirm Bulk Deletion",M,480),!await new Promise(K=>{setTimeout(()=>{const de=g.querySelector("#confirm-bulk-delete-action"),we=g.querySelector("#cancel-bulk-delete-confirm");de&&(de.onclick=()=>{R(),K(!0)}),we&&(we.onclick=()=>{R(),K(!1)})},100)}))return;const G=U();w.forEach(K=>{const de=G.find(we=>V(we)===K);de&&de.style.display==="none"&&(de.style.display="")}),R(),fo();const O=document.createElement("style");O.id="bulk-delete-hide-dialogs",O.textContent=`
                .cdk-overlay-container,
                [role="dialog"],
                .modal-container,
                .overlay-container {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `,document.head.appendChild(O);const X=document.createElement("div");X.innerHTML=ho(),g.appendChild(X);const Z=g.getElementById("gemini-delete-all-overlay");if(!Z)return;const Q=Z.querySelector(".message"),ot=Z.querySelector("#progress-status"),me=Z.querySelector("#progress-counter"),ne=Z.querySelector(".progress-bar-inner"),ee=Z.querySelector(".cancel-button"),Te=Z.querySelector(".spinner"),ue=Z.querySelector(".completion-tick");let pe=!1;const je=new AbortController;ee&&ee.addEventListener("click",()=>{pe=!0,je.abort(),Q&&(Q.textContent="Cancelling..."),setTimeout(()=>{const K=document.getElementById("bulk-delete-hide-dialogs");K&&K.remove()},1e3)});let le=0,Ie=0;const Tt=Array.from(w);try{for(let K=0;K<Tt.length&&!pe;K++){const de=Tt[K];ot&&(ot.textContent=`Deleting chat ${K+1} of ${x}...`),me&&(me.textContent=`${K+1} / ${x}`),ne&&(ne.style.width=`${(K+1)/x*100}%`);const we=G.find(It=>V(It)===de);we&&(await mo(we,je.signal)).status==="success"?le++:Ie++,await Oe(250)}}catch{Ie++}Te&&(Te.style.display="none"),ue&&(ue.style.display="block"),ne&&(ne.style.width="100%"),me&&(me.textContent=`${le} / ${x}`),Q&&(pe?Q.textContent="Deletion cancelled.":Ie>0?Q.textContent=`Finished. Deleted ${le}, failed ${Ie}.`:Q.textContent="All selected items deleted!"),!pe&&window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.BULK_DELETE_USED,{action:"completed",deletedCount:le,errorCount:Ie,totalSelected:x,successRate:x>0?(le/x*100).toFixed(1):0}),setTimeout(()=>{Z.classList.add("hidden");const K=()=>{X&&X.parentNode&&X.remove();const de=document.getElementById("bulk-delete-hide-dialogs");de&&de.remove(),R()};Z.addEventListener("transitionend",K,{once:!0}),setTimeout(K,500)},3e3)})}function ho(){return`
            <div id="gemini-delete-all-overlay" class="visible">
                <div class="spinner"></div>
                <svg class="completion-tick" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="tick-circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="tick-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
                <div class="message">Deleting...</div>
                <div class="progress-container">
                    <div class="progress-text">
                        <span id="progress-status">Starting...</span>
                        <span id="progress-counter">0 / 0</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-inner"></div>
                    </div>
                </div>
                <button class="cancel-button">Cancel</button>
            </div>
        `}function fo(){if(g.getElementById("gemini-delete-all-overlay-styles"))return;const e={isDark:document.body.classList.contains("dark-theme"),backgroundColor:"var(--gf-bg-primary)",textColor:"var(--gf-text-primary)",secondaryTextColor:"var(--gf-text-secondary)",accentColor:"var(--gf-accent-primary)",progressTrackColor:"rgba(128, 128, 128, 0.2)",successColor:"#34a853"},t=`
          #gemini-delete-all-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--gf-bg-primary);
            z-index: 2147483647; display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            font-family: 'Google Sans', Roboto, Arial, sans-serif; color: ${e.textColor}; text-align: center;
            opacity: 1; transition: opacity 0.3s ease-in-out;
          }
          #gemini-delete-all-overlay.hidden { opacity: 0; pointer-events: none; }
          #gemini-delete-all-overlay .spinner {
            display: block;
            border: 3px solid ${e.progressTrackColor}; border-top: 3px solid ${e.accentColor};
            border-radius: 50%; width: 50px; height: 50px;
            animation: spin 0.8s linear infinite; margin-bottom: 25px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          
          #gemini-delete-all-overlay .completion-tick {
            display: none; width: 60px; height: 60px;
            border-radius: 50%;
            stroke-width: 5; stroke: ${e.successColor};
            stroke-miterlimit: 10;
            animation: draw-tick-container 0.5s ease-out forwards;
            margin-bottom: 20px;
          }
          #gemini-delete-all-overlay .completion-tick .tick-path {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw-tick-path 0.5s 0.2s ease-out forwards;
          }
          @keyframes draw-tick-container {
            0% { opacity: 0; transform: scale(0.5); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes draw-tick-path {
            to { stroke-dashoffset: 0; }
          }
          #gemini-delete-all-overlay .message { font-size: 20px; font-weight: 500; margin-bottom: var(--space-2); }
          
          #gemini-delete-all-overlay .progress-container {
            display: flex; flex-direction: column; align-items: center;
            width: 300px; margin: 10px 0;
          }
          #gemini-delete-all-overlay .progress-text { 
            font-size: 14px; color: ${e.secondaryTextColor}; 
            margin-bottom: var(--space-2); width: 100%;
            display: flex; justify-content: space-between;
          }
          
          #gemini-delete-all-overlay .progress-bar {
            width: 100%; height: 4px; background-color: ${e.progressTrackColor};
            border-radius: 4px; overflow: hidden;
          }
          #gemini-delete-all-overlay .progress-bar-inner {
            height: 100%; width: 0%;
            background-color: ${e.accentColor};
            transition: width var(--anim-normal) var(--ease-out);
            border-radius: 4px;
          }
          
          #gemini-delete-all-overlay .cancel-button {
            margin-top: var(--space-4); color: ${e.secondaryTextColor};
            font-size: 14px; background: none; border: 1px solid ${e.secondaryTextColor};
            padding: 8px 16px; cursor: pointer;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            border-radius: 4px; transition: background-color 0.15s;
          }
          #gemini-delete-all-overlay .cancel-button:hover {
            background-color: rgba(128, 128, 128, 0.2);
          }
        `,o=document.createElement("style");o.id="gemini-delete-all-overlay-styles",o.textContent=t,g.appendChild(o)}async function xt(e){try{if(!chrome.runtime||!chrome.runtime.getURL)throw new Error("Extension context invalidated - please refresh the page");const t=chrome.runtime.getURL(e);console.log(`[Prompt Library] Fetching resource: ${e} from ${t}`);const o=await fetch(t);if(!o.ok)throw new Error(`Failed to fetch ${e}: HTTP ${o.status} ${o.statusText}`);const n=await o.text();return console.log(`[Prompt Library] Successfully loaded ${e} (${n.length} bytes)`),n}catch(t){throw console.error(`[Prompt Library] Error fetching ${e}:`,t),t.message&&t.message.includes("Extension context invalidated")?j("Extension was updated or reloaded. Please refresh the page to continue."):j(`Failed to load ${e}. Please refresh the page and try again.`),t}}async function bo(){if(!g.getElementById("prompt-library-modal"))try{if(!chrome.runtime||!chrome.runtime.getURL)throw new Error("Extension context invalidated - please refresh the page");const[e,t]=await Promise.all([xt("prompt_library.html"),xt("prompt_library.css")]),o=document.createElement("div");o.innerHTML=e;const n=o.firstElementChild;if(g.appendChild(n),t&&!g.querySelector("#prompt-library-styles")){const a=document.createElement("style");a.id="prompt-library-styles",a.textContent=t,g.appendChild(a);const i=document.createElement("style");i.id="modal-size-overrides",i.textContent=`
                        /* Override ALL modal heights except prompt library with higher specificity */
                        #gemini-folders-injector-host .infi-chatgpt-modal:not(#prompt-library-modal) .modal-content {
                            min-height: auto !important;
                            height: auto !important;
                        }
                        
                        /* Even more specific for manage folders */
                        #gemini-folders-injector-host #manage-folders-modal .modal-content {
                            min-height: auto !important;
                            height: auto !important;
                        }
                    `,g.appendChild(i)}}catch(e){throw console.error("[Prompt Library] Resource injection failed:",e),e}}function Se(){try{return chrome&&chrome.storage&&chrome.storage.local&&typeof chrome.storage.local.get=="function"}catch{return!1}}let Re=null,ie=!0,fe=null,ce=!0;async function yt(){try{if(!Se()){ie=CONFIG.FEATURES.wordCounterDefault||!0;return}const e=await chrome.storage.local.get("wordCounterEnabled");ie=e.wordCounterEnabled!==void 0?e.wordCounterEnabled:CONFIG.FEATURES.wordCounterDefault||!0}catch(e){!e.message||e.message.includes("Extension context invalidated"),ie=CONFIG.FEATURES.wordCounterDefault||!0}}async function xo(){try{if(!Se()){j("Extension was updated. Please refresh the page to save settings.");return}await chrome.storage.local.set({wordCounterEnabled:ie})}catch(e){e.message&&e.message.includes("Extension context invalidated")?j("Extension was updated. Please refresh the page to save settings."):j("Failed to save word counter settings.")}}async function vt(){if(await yt(),Re&&(Re.destroy(),Re=null),ie)try{typeof WordCounter<"u"&&(Re=new WordCounter)}catch{j("Failed to initialize word counter. Please refresh the page.")}}async function wt(){try{if(!Se()){ce=CONFIG.FEATURES?.enhancePrompt!==!1;return}const e=await chrome.storage.sync.get("enhancePromptEnabled");ce=e.enhancePromptEnabled!==void 0?e.enhancePromptEnabled:CONFIG.FEATURES?.enhancePrompt!==!1}catch(e){!e.message||e.message.includes("Extension context invalidated"),ce=CONFIG.FEATURES?.enhancePrompt!==!1}}async function yo(){try{if(!Se()){j("Extension was updated. Please refresh the page to save settings.");return}await chrome.storage.sync.set({enhancePromptEnabled:ce})}catch(e){e.message&&e.message.includes("Extension context invalidated")?j("Extension was updated. Please refresh the page to save settings."):j("Failed to save enhance prompt settings.")}}async function kt(){if(await wt(),fe&&fe.destroy&&(fe.destroy(),fe=null),!!ce&&!(typeof window.EnhancePromptModule>"u"))try{const t=(await window.geminiAPI.getSubscriptionStatus())?.isPremium||!1;window.EnhancePromptModule.initialize(g,{isPremium:t}),fe=window.EnhancePromptModule}catch{}}async function vo(){if(fe&&fe.updatePremiumStatus)try{const e=await window.geminiAPI.getSubscriptionStatus();fe.updatePremiumStatus(e?.isPremium||!1)}catch{}}let se=!0;async function Ct(){try{if(!Se()){se=!0;return}const e=await chrome.storage.sync.get("pinnedMessagesEnabled");se=e.pinnedMessagesEnabled!==void 0?e.pinnedMessagesEnabled:!0}catch(e){!e.message||e.message.includes("Extension context invalidated"),se=!0}}async function wo(){try{if(!Se()){j("Extension was updated. Please refresh the page to save settings.");return}await chrome.storage.sync.set({pinnedMessagesEnabled:se})}catch(e){e.message&&e.message.includes("Extension context invalidated")?j("Extension was updated. Please refresh the page to save settings."):j("Failed to save pinned messages settings.")}}async function Et(){if(await Ct(),!se){window.PinnedMessages&&window.PinnedMessages.removePinButtons&&window.PinnedMessages.removePinButtons();return}if(window.PinnedMessages&&window.PinnedMessages.initialize)try{window.PinnedMessages.initialize()}catch{}}function Pe(e,t,o){const n=o||(typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"corr_"+Math.random().toString(36).slice(2));if(t&&Number.isFinite(t.count)&&Number.isFinite(t.limit))try{re.track(CONFIG.ANALYTICS_EVENTS.LIMIT_HIT,{feature:e,count:t.count,limit:t.limit,correlationId:n})}catch{}try{if(g&&g.querySelector("#upgrade-modal"))return}catch{}const r=Number.isFinite(t?.count)?t.count:0,a={folders:CONFIG.FREE_LIMITS?.folders??2,customPrompts:CONFIG.FREE_LIMITS?.customPrompts??2,pinnedMessages:CONFIG.FREE_LIMITS?.pinnedMessages??2,promptChains:CONFIG.FREE_LIMITS?.promptChains??1},i=typeof t?.limit=="number"&&e==="folders"?t.limit:a.folders,c=typeof t?.limit=="number"&&e==="customPrompts"?t.limit:a.customPrompts,l=typeof t?.limit=="number"&&e==="pinnedMessages"?t.limit:a.pinnedMessages,d=typeof t?.limit=="number"&&e==="promptChains"?t.limit:a.promptChains;try{const L=e==="folders"?i:e==="customPrompts"?c:e==="pinnedMessages"?l:e==="promptChains"?d:Number.isFinite(t?.limit)?t.limit:0;re.track(CONFIG.ANALYTICS_EVENTS.PAYWALL_SHOWN,{feature:e,currentUsage:r,limit:L,correlationId:n})}catch{}const p={folders:`You've used ${r}/${i} folders. Upgrade for unlimited.`,customPrompts:`You've used ${r}/${c} custom prompts. Upgrade for unlimited.`,bulkDelete:"Bulk Delete lets you select and remove multiple conversations at once \u2014 perfect for quickly cleaning up your chat history.",subfolders:"Subfolders are a Premium feature. Upgrade to organize your chats with nested folders.",enhancePrompt:`You've used ${r}/${CONFIG.FREE_LIMITS?.dailyEnhancePrompts||3} daily enhancements. Upgrade for unlimited.`,pinnedMessages:`You've pinned ${r}/${l} messages. Upgrade for unlimited.`,promptChains:`You've created ${r}/${d} prompt chain. Upgrade for unlimited.`},h=typeof CONFIG<"u"&&CONFIG.FREE_LIMITS?CONFIG.FREE_LIMITS:{folders:2,customPrompts:2},b=[{key:"folders",label:"Folders",free:`${h.folders}`,premium:"Unlimited"},{key:"customPrompts",label:"Custom prompts",free:`${h.customPrompts}`,premium:"Unlimited"},{key:"pinnedMessages",label:"Pinned messages",free:`${h.pinnedMessages||2}`,premium:"Unlimited"},{key:"promptChains",label:"Prompt chains",free:`${h.promptChains||1}`,premium:"Unlimited"},{key:"enhancePrompt",label:"AI Prompt Enhancement",free:`${h.dailyEnhancePrompts||3} per day`,premium:"Unlimited daily"},{key:"bulkDelete",label:"Bulk delete chats",free:"Not available",premium:"\u2713 Included"}],I=["folders","customPrompts","bulkDelete","enhancePrompt","pinnedMessages","promptChains"].includes(e)?e:null,F=b.slice().sort((L,$)=>L.key===I&&$.key!==I?-1:$.key===I&&L.key!==I?1:0),N=!!(CONFIG?.PREMIUM?.INCLUDES_FUTURE_FEATURES||CONFIG?.PRICING?.INCLUDES_FUTURE_FEATURES||CONFIG?.BILLING?.INCLUDES_FUTURE_FEATURES),s=N?"All future features included*":"Early access to new features",E=F.map(L=>{const $=L.key===I;let H=L.label,B="";return L.key==="folders"?t&&typeof t.count<"u"&&typeof t.limit<"u"&&t.count>=t.limit?(H="Folders \u2014 Limit reached",B="(Premium: Unlimited)"):B=`(Free: ${L.free} \u2192 Premium: ${L.premium})`:L.key==="customPrompts"?B=`(Free: ${L.free} \u2192 Premium: ${L.premium})`:L.key==="pinnedMessages"?t&&e==="pinnedMessages"&&typeof t.count<"u"&&typeof t.limit<"u"&&t.count>=t.limit?(H="Pinned messages \u2014 Limit reached",B="(Premium: Unlimited)"):B=`(Free: ${L.free} \u2192 Premium: ${L.premium})`:L.key==="promptChains"?t&&e==="promptChains"&&typeof t.count<"u"&&typeof t.limit<"u"&&t.count>=t.limit?(H="Prompt chains \u2014 Limit reached",B="(Premium: Unlimited)"):B=`(Free: ${L.free} \u2192 Premium: ${L.premium})`:L.key==="enhancePrompt"?B=`(Free: ${L.free} \u2192 Premium: ${L.premium})`:L.key==="bulkDelete"?(H="Bulk delete conversations",B="(Select & delete multiple chats at once)"):L.key==="prioritySupport"?(H="Priority support",B="(Skip the line)"):L.key==="export"?(H="Export chats (PDF)",B="(Included in Free)"):L.key==="futureFeatures"&&(H=L.label,B=""),`
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 6px; ${$?"background: rgba(138, 180, 248, 0.08); outline: 1px solid var(--gf-border-color);":""}">
                    <svg width="14" height="14" fill="var(--gf-accent-success)" viewBox="0 0 20 20" style="flex-shrink: 0;" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path>
                    </svg>
                    <div style="min-width: 0;">
                        <span style="font-size: 12px; color: var(--gf-text-primary); font-weight: 500;">${H}</span>
                        ${B?`<span style="font-size: 12px; color: var(--gf-text-secondary);"> ${B}</span>`:""}
                    </div>
                </div>
            `}).join(""),m=parseFloat((CONFIG?.PRICING?.monthly?.price||"$0").replace("$","")),y=parseFloat((CONFIG?.PRICING?.yearly?.price||"$0").replace("$","")),f=m*12,v=y,A=Math.round((f-v)/f*100),q=(v/365).toFixed(2),P=`
            <div style="padding: 16px;">
                <!-- Limit Reached Notice -->
                <div style="background: var(--gf-bg-secondary); border: 1px solid var(--gf-border-color); border-radius: 6px; padding: 8px; margin-bottom: 12px; text-align: center;">
                    <p style="font-size: 13px; color: var(--gf-text-primary); margin: 0; font-weight: 500;">
                        ${p[e]||"You've reached a free tier limit"}
                    </p>
                </div>

                <!-- Title -->
                <div style="text-align: center; margin-bottom: 10px;">
                    <h3 style="font-size: 18px; margin-bottom: 2px; color: var(--gf-text-primary); font-weight: 600;">Upgrade to Premium</h3>
                    <p style="font-size: 12px; color: var(--gf-text-secondary); margin: 0;">Remove all limits and unlock advanced features</p>
                </div>

                <!-- Premium Features -->
                <div style="background: var(--gf-bg-secondary); border-radius: 6px; padding: 8px; margin-bottom: 8px; border: 1px solid var(--gf-border-color);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                        ${E}
                    </div>
                </div>

                <!-- Pricing Options -->
                <div style="display: flex; gap: 10px; margin-bottom: 12px; padding-top: 8px;">
                    <div style="flex: 1; position: relative;">
                        ${A>0?`<div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: var(--gf-accent-danger); color: white; padding: 2px 10px; border-radius: 10px; font-size: 9px; font-weight: 600; text-transform: uppercase; white-space: nowrap; z-index: 10;">Save ${A}%</div>`:""}
<button id="upgrade-yearly-btn" class="button primary" aria-label="Choose annual plan \u2014 ${CONFIG?.PRICING?.yearly?.price||"$0"} per year, billed annually" style="width: 100%; min-height: 80px; padding: 12px; border: none; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 10px; text-transform: uppercase; opacity: 0.9; letter-spacing: 0.3px;">Best Value</div>
<div style="font-size: 20px; font-weight: 700; line-height: 1.2;">${CONFIG?.PRICING?.yearly?.display||(CONFIG?.PRICING?.yearly?.price||"$0")+"/year"}</div>
                            <div style="font-size: 11px; opacity: 0.9;">Billed annually \u2022 \u2248 $${(v/12).toFixed(2)}/mo</div>
<div style="background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; white-space: normal;">Choose Annual \u2014 ${CONFIG?.PRICING?.yearly?.display||(CONFIG?.PRICING?.yearly?.price||"$0")+"/year"}</div>
                        </button>
                    </div>

                    <div style="flex: 1; position: relative;">
<button id="upgrade-monthly-btn" class="button secondary" aria-label="Choose monthly plan \u2014 ${CONFIG?.PRICING?.monthly?.price||"$0"} per month, billed monthly" style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid var(--gf-border-color); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 10px; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.3px;">Monthly</div>
<div style="font-size: 20px; font-weight: 700; color: var(--gf-text-primary); line-height: 1.2;">${CONFIG?.PRICING?.monthly?.display||(CONFIG?.PRICING?.monthly?.price||"$0")+"/mo"}</div>
                            <div style="font-size: 11px; opacity: 0.7;">Billed monthly</div>
<div style="background: var(--gf-bg-primary); border: 1px solid var(--gf-border-color); padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--gf-text-primary); margin-top: 4px; white-space: normal;">Choose Monthly \u2014 ${CONFIG?.PRICING?.monthly?.display||(CONFIG?.PRICING?.monthly?.price||"$0")+"/mo"}</div>
                        </button>
                    </div>
                </div>

                <!-- Trust & Legal -->
                <div style="text-align: center; margin-bottom: 10px; padding: 8px 0; border-top: 1px solid var(--gf-border-color);">
                    <p style="font-size: 11px; color: var(--gf-text-secondary); margin: 0 0 6px 0;">Secure checkout via Lemon Squeezy \u2022 30-day money-back \u2022 Cancel anytime</p>
                    <div style="display: flex; justify-content: center; gap: 6px; opacity: 0.6; align-items: center;" aria-label="Accepted payment methods">
                        <svg width="28" height="16" viewBox="0 0 32 20" fill="var(--gf-text-secondary)" role="img" aria-label="Visa"><title>Visa</title><rect width="32" height="20" rx="2" fill="white" opacity="0.1"/><text x="16" y="13" font-size="7" text-anchor="middle" fill="currentColor">VISA</text></svg>
                        <svg width="28" height="16" viewBox="0 0 32 20" fill="var(--gf-text-secondary)" role="img" aria-label="Mastercard"><title>Mastercard</title><rect width="32" height="20" rx="2" fill="white" opacity="0.1"/><circle cx="12" cy="10" r="4" fill="currentColor" opacity="0.5"/><circle cx="20" cy="10" r="4" fill="currentColor" opacity="0.3"/></svg>
                        <svg width="28" height="16" viewBox="0 0 32 20" fill="var(--gf-text-secondary)" role="img" aria-label="American Express"><title>American Express</title><rect width="32" height="20" rx="2" fill="white" opacity="0.1"/><text x="16" y="13" font-size="7" text-anchor="middle" fill="currentColor">AMEX</text></svg>
                        <svg width="28" height="16" viewBox="0 0 32 20" fill="var(--gf-text-secondary)" role="img" aria-label="PayPal"><title>PayPal</title><rect width="32" height="20" rx="2" fill="white" opacity="0.1"/><text x="16" y="13" font-size="7" text-anchor="middle" fill="currentColor">PayPal</text></svg>
                    </div>
                    ${CONFIG?.LEGAL_URLS?.terms||CONFIG?.LEGAL_URLS?.privacy||CONFIG?.LEGAL_URLS?.refund?`
                    <div style="margin-top: 6px; font-size: 11px;">
                        ${CONFIG?.LEGAL_URLS?.terms?`<a href="${CONFIG.LEGAL_URLS.terms}" target="_blank" rel="noopener noreferrer" style="color: var(--gf-text-secondary); text-decoration: underline; margin: 0 6px;">Terms</a>`:""}
                        ${CONFIG?.LEGAL_URLS?.privacy?`<a href="${CONFIG.LEGAL_URLS.privacy}" target="_blank" rel="noopener noreferrer" style="color: var(--gf-text-secondary); text-decoration: underline; margin: 0 6px;">Privacy</a>`:""}
                        ${CONFIG?.LEGAL_URLS?.refund?`<a href="${CONFIG.LEGAL_URLS.refund}" target="_blank" rel="noopener noreferrer" style="color: var(--gf-text-secondary); text-decoration: underline; margin: 0 6px;">Refund Policy</a>`:""}
                    </div>
                    `:""}
                </div>

                ${N?'<div style="font-size: 10px; color: var(--gf-text-secondary); text-align: center; margin: -4px 0 8px 0;">\u201CAll future features\u201D = features released into the Premium plan; excludes third-party services and usage-based fees.</div>':""}

                <button id="cancel-upgrade-btn" class="button secondary" style="width: 100%; padding: 10px; font-size: 13px;">Continue on Free Plan</button>
            </div>
        `;te("upgrade-modal","Upgrade to Premium",P,640),setTimeout(()=>{const L=g.querySelector("#upgrade-monthly-btn"),$=g.querySelector("#upgrade-yearly-btn"),H=g.querySelector("#cancel-upgrade-btn");L&&L.addEventListener("click",async()=>{try{He(L,!0);try{re.track(CONFIG.ANALYTICS_EVENTS.PAYWALL_CTA_CLICK_MONTHLY,{plan:"monthly",feature:e,correlationId:n})}catch{}Y("Opening checkout...","info");const B=Date.now(),J=window.geminiAPI.startUpgrade("monthly");try{re.track(CONFIG.ANALYTICS_EVENTS.CHECKOUT_OPENED,{plan:"monthly",correlationId:n})}catch{}setTimeout(()=>{nt()},2e3);const oe=await J;if(rt(),oe.success){try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_SUCCESS,{plan:"monthly",activationTimeMs:Math.max(0,Date.now()-B),correlationId:n})}catch{}Y("\u{1F389} Premium activated!","success"),R(),window.location.reload()}else if(oe.timeout){try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_TIMEOUT,{plan:"monthly",timeoutMs:Math.max(0,Date.now()-B),correlationId:n})}catch{}Y("Still processing... Premium will activate shortly.","info"),R()}}catch{try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_FAILED,{plan:"monthly",reason:"unknown",correlationId:n})}catch{}Y("Failed to start upgrade. Please try again.","error"),He(L,!1)}}),$&&$.addEventListener("click",async()=>{try{He($,!0);try{re.track(CONFIG.ANALYTICS_EVENTS.PAYWALL_CTA_CLICK_ANNUAL,{plan:"yearly",feature:e,correlationId:n})}catch{}Y("Opening checkout...","info");const B=Date.now(),J=window.geminiAPI.startUpgrade("yearly");try{re.track(CONFIG.ANALYTICS_EVENTS.CHECKOUT_OPENED,{plan:"yearly",correlationId:n})}catch{}setTimeout(()=>{nt()},2e3);const oe=await J;if(rt(),oe.success){try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_SUCCESS,{plan:"yearly",activationTimeMs:Math.max(0,Date.now()-B),correlationId:n})}catch{}Y("\u{1F389} Premium activated!","success"),R(),window.location.reload()}else if(oe.timeout){try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_TIMEOUT,{plan:"yearly",timeoutMs:Math.max(0,Date.now()-B),correlationId:n})}catch{}Y("Still processing... Premium will activate shortly.","info"),R()}}catch{try{re.track(CONFIG.ANALYTICS_EVENTS.PREMIUM_ACTIVATION_FAILED,{plan:"yearly",reason:"unknown",correlationId:n})}catch{}Y("Failed to start upgrade. Please try again.","error"),He($,!1)}}),H&&H.addEventListener("click",()=>{R()})},100)}async function ko(){console.log("[Gemini Toolbox] Attempting to open sidebar...");const e=document.querySelector('[data-test-id="side-nav-menu-button"]')||document.querySelector('button[aria-label*="menu" i]')||document.querySelector('button[aria-label*="navigation" i]'),t=document.querySelector("mat-sidenav")||document.querySelector('[role="navigation"]');if(console.log("[Gemini Toolbox] Found menuButton:",!!e),console.log("[Gemini Toolbox] Found sideNav:",!!t),!e){console.warn("[Gemini Toolbox] Menu button not found - cannot open sidebar");return}if(!t){console.warn("[Gemini Toolbox] Sidebar element not found");return}const o=t.classList.contains("mat-drawer-closed"),n=t.getAttribute("aria-hidden")==="true",r=t.offsetWidth>100,a=o||n||!r;console.log("[Gemini Toolbox] Detection details:",{hasClosedClass:o,isHidden:n,hasWidth:r,offsetWidth:t.offsetWidth,isClosed:a}),a?(console.log("[Gemini Toolbox] Sidebar is closed, clicking menu button to open..."),e.click(),await new Promise(i=>setTimeout(i,600)),console.log("[Gemini Toolbox] Sidebar should be open now")):console.log("[Gemini Toolbox] Sidebar is already open, no action needed")}let Co=!1,Go=null,Ro=null;async function Eo(){try{await window.geminiAPI.initialize();try{await re.track(CONFIG.ANALYTICS_EVENTS.APP_INITIALIZED)}catch{}try{const n=(await chrome.storage?.local?.get("gt_last_version"))?.gt_last_version||null,r=CONFIG?.VERSION||null;r&&n!==r&&(n&&await re.track(CONFIG.ANALYTICS_EVENTS.VERSION_UPDATED,{fromVersion:n,toVersion:r}),await chrome.storage?.local?.set({gt_last_version:r}))}catch{}const e=window.geminiAPI.getUserInfo(),t=await window.geminiAPI.getSubscriptionStatus()}catch{}}async function St(){if(document.getElementById(ze))return;await Nt(500),Ye();try{try{await Eo()}catch{}}catch{}const e=document.querySelector("conversations-list");if(e&&!document.getElementById(ze)){let d=function(){if(n.classList.contains("show"))try{const s=o.getBoundingClientRect();n.style.position="fixed",n.style.right="auto",n.style.visibility="hidden",n.style.opacity="0",n.style.transform="none";const E=Math.max(220,Math.ceil(s.width));n.style.minWidth=E+"px";const m=n.getBoundingClientRect(),y=Math.max(E,Math.ceil(m.width||E)),f=Math.ceil(m.height||240),v=Math.max(8,Math.min(window.innerWidth-y-8,Math.floor(s.left)));n.style.left=v+"px";let A=Math.floor(s.bottom)+8;A+f>window.innerHeight-8&&(A=Math.max(8,Math.floor(s.top)-f-8)),n.style.top=A+"px",n.style.visibility="",n.style.opacity="",n.style.transform=""}catch{}},p=function(){let s=!1;const E=()=>{s||(s=!0,requestAnimationFrame(()=>{s=!1,d()}))};n._repositionHandler=E,window.addEventListener("resize",E,{passive:!0}),window.addEventListener("scroll",E,{passive:!0,capture:!0})},h=function(){n.style.position="",n.style.top="",n.style.left="",n.style.right="",n.style.minWidth="",n._repositionHandler&&(window.removeEventListener("resize",n._repositionHandler),window.removeEventListener("scroll",n._repositionHandler,{capture:!0}),delete n._repositionHandler)},b=function(){try{n.classList.remove("show"),l.classList.remove("rotated"),o.setAttribute("aria-expanded","false"),h();try{o.blur&&o.blur()}catch{}}catch{}},I=function(){try{const s=g&&g.activeElement?g.activeElement:null;if(s&&s===o){const E=o.getAttribute("tabindex");o.setAttribute("tabindex","-1");try{o.blur&&o.blur()}catch{}setTimeout(()=>{E!==null?o.setAttribute("tabindex",E):o.removeAttribute("tabindex")},0)}}catch{}};z=document.createElement("div"),z.id=ze,g=z.attachShadow({mode:"open"}),$t();const t=Ht();g.innerHTML+=t,e.prepend(z),go();const o=g.getElementById("gemini-toolbox-btn"),n=g.getElementById("gemini-toolbox-dropdown"),r=g.getElementById("manage-folders-link"),a=g.getElementById("chat-tools-link"),i=g.getElementById("prompt-library-link"),c=g.getElementById("settings-link"),l=g.querySelector(".dropdown-arrow");o.addEventListener("click",s=>{s.stopPropagation();const E=n.classList.contains("show");n.classList.toggle("show",!E),l.classList.toggle("rotated",!E),o.setAttribute("aria-expanded",!E),E?h():(requestAnimationFrame(()=>d()),p(),setTimeout(()=>{const m=n.querySelector('.dropdown-item[role="menuitem"]');m&&m.focus()},50))}),o.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),o.click())});let F=0;document.addEventListener("keydown",s=>{if(s.target.tagName==="INPUT"||s.target.tagName==="TEXTAREA"||s.target.isContentEditable)return;try{const y=!!(g&&g.querySelector(".infi-chatgpt-modal")),f=document.querySelector(".cdk-overlay-container"),v=!!(f&&f.children&&f.children.length>0),A=!!document.querySelector('[aria-modal="true"], [role="dialog"]');if(y||v||A)return}catch{}const E=Date.now(),m=E-F;if(s.key.toLowerCase()==="g"&&!s.ctrlKey&&!s.metaKey&&!s.altKey)F=E;else if(m<500&&!s.ctrlKey&&!s.metaKey&&!s.altKey){let y=null;switch(s.key.toLowerCase()){case"f":s.preventDefault(),I(),mt(),y="manage_folders";break;case"m":s.preventDefault(),I(),Fe("pinned"),y="chat_tools";break;case"d":s.preventDefault(),I(),Fe("bulk-delete"),y="chat_tools_bulk_delete";break;case"e":s.preventDefault(),I(),Fe("export"),y="chat_tools_export";break;case"p":s.preventDefault(),I(),i.click(),y="prompt_library";break;case"s":s.preventDefault(),I(),c.click(),y="settings";break}y&&window.geminiAPI&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent("keyboard_shortcut_used",{shortcut:`g+${s.key.toLowerCase()}`,feature:y}),F=0}}),r.addEventListener("click",s=>{s.stopPropagation(),b(),mt()}),a.addEventListener("click",s=>{s.stopPropagation(),b(),Fe("pinned")}),i.addEventListener("click",async s=>{s.stopPropagation(),b();try{if(typeof PromptLibrary>"u"&&typeof window.PromptLibrary>"u")throw new Error("PromptLibrary class not found. The extension may not have loaded properly. Please refresh the page.");if(await bo(),!g.getElementById("prompt-library-modal"))throw new Error("Prompt library HTML failed to load. Please refresh the page.");if(!_e){const E=typeof PromptLibrary<"u"?PromptLibrary:window.PromptLibrary;_e=new E(g),_e.initializeEventListeners()}_e.show()}catch(E){j(`Failed to open Prompt Library: ${E.message}`)}}),c.addEventListener("click",s=>{s.stopPropagation(),b(),io()}),n.addEventListener("mousedown",s=>{const E=s.target&&s.target.closest?s.target.closest('.dropdown-item[role="menuitem"]'):null;if(E&&E.focus)try{E.focus({preventScroll:!0})}catch{}});const N=n.querySelectorAll('.dropdown-item[role="menuitem"]');N.forEach((s,E)=>{s.addEventListener("keydown",m=>{switch(m.key){case"ArrowDown":m.preventDefault();const y=(E+1)%N.length;N[y].focus();break;case"ArrowUp":m.preventDefault();const f=(E-1+N.length)%N.length;N[f].focus();break;case"Enter":case" ":m.preventDefault(),I(),s.click();break;case"Escape":m.preventDefault(),n.classList.remove("show"),l.classList.remove("rotated"),o.setAttribute("aria-expanded","false"),h(),o.focus();break;case"Tab":n.classList.remove("show"),l.classList.remove("rotated"),o.setAttribute("aria-expanded","false"),h();break}})}),g.addEventListener("click",s=>{n.contains(s.target)||o.contains(s.target)||g.querySelector(".infi-chatgpt-modal")||s.target.closest(".infi-chatgpt-modal")||(n.classList.remove("show"),l.classList.remove("rotated"),h())}),document.addEventListener("click",s=>{const E=g.host;if(E&&!E.contains(s.target)){if(g.querySelector(".infi-chatgpt-modal"))return;n.classList.remove("show"),l.classList.remove("rotated"),h()}}),await it(),C.settings.hideFolderedChats&&Ee(),vt(),kt(),Et(),window.addEventListener("message",async s=>{if(!(s.source!==window||!s.data||s.data.from!=="GeminiToolbox")&&s.data.type==="enhancePromptRequest"&&s.data.prompt){const E=s.data.id;try{const m=await fetch(`${CONFIG.API_URL}/api/prompt/enhance`,{method:"POST",headers:{"Content-Type":"application/json","X-From":"GeminiToolbox"},body:JSON.stringify({prompt:s.data.prompt})});if(!m.ok){const f=await m.text().catch(()=>"");throw new Error(`API error ${m.status}: ${f}`)}const y=await m.json();window.postMessage({type:"enhancePromptResponse",id:E,success:!0,data:y},"*")}catch(m){window.postMessage({type:"enhancePromptResponse",id:E,success:!1,error:m.message||"Failed to enhance prompt"},"*")}}});try{const s=await window.geminiAPI.getSubscriptionStatus();Ge(!!s?.isPremium),vo()}catch{Ge(!1)}window.showUpgradeModal=Pe,window.ensureSidebarOpen=ko,window.addEventListener("showUpgradeModal",s=>{s.detail&&s.detail.feature&&s.detail.limitInfo&&Pe(s.detail.feature,s.detail.limitInfo)})}}let Ne=null,qe=null;Ne=new MutationObserver(e=>{for(const t of e)t.type==="childList"&&document.querySelector("conversations-list")&&!document.getElementById(ze)&&St(),xe()!==ke&&Me()}),Ne.observe(document.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class"]}),qe=new MutationObserver(()=>{xe()!==ke&&Me()}),qe.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme","class"]});function Qe(){Ne&&(Ne.disconnect(),Ne=null),qe&&(qe.disconnect(),qe=null),window.wordCounterInstance&&typeof window.wordCounterInstance.destroy=="function"&&window.wordCounterInstance.destroy(),window.EnhancePromptModule&&typeof window.EnhancePromptModule.destroy=="function"&&window.EnhancePromptModule.destroy()}window.addEventListener("beforeunload",Qe),window.addEventListener("pagehide",Qe),chrome.runtime&&chrome.runtime.onSuspend&&chrome.runtime.onSuspend.addListener(Qe),setInterval(()=>{xe()!==ke&&Me()},3e3),window.addEventListener("error",e=>{e.error&&e.error.message&&(e.error.message.includes("Extension context invalidated")||e.error.message.includes("Cannot access a chrome:// URL"))&&(window._geminiToolboxInvalidatedErrorShown||(window._geminiToolboxInvalidatedErrorShown=!0,j("Extension was updated. Please refresh the page to continue using Gemini Toolbox.")),e.preventDefault())}),St();function So(e,t=50,o=20){let n=0;const r=setInterval(()=>{n++,(document.querySelector('rich-textarea, .ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"]')||n>=o)&&(clearInterval(r),e())},t)}chrome.runtime.onMessage.addListener((e,t,o)=>{if(e.action==="insertText"){const n=e.text,r=document.querySelector('button[aria-label="New chat"]');return r?(r.click(),So(()=>{Lt(n)},50,20)):Lt(n),o({success:!0}),!0}});function Lt(e){const t=document.querySelector('rich-textarea[placeholder*="Enter"], rich-textarea, .ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea[placeholder*="Enter"]');if(t&&console.log("[Context Menu] Found input element:",t.tagName),!t){console.error("[Context Menu] Could not find input element"),typeof j=="function"?j("Could not find Gemini input field"):window.showToast&&window.showToast("Could not find Gemini input field","error");return}try{if(t.tagName==="RICH-TEXTAREA"){const o=t.querySelector('.ql-editor[contenteditable="true"]');if(o){console.log("[Context Menu] Found editable div inside rich-textarea"),o.textContent=e,o.focus(),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}));const n=document.createRange(),r=window.getSelection();n.selectNodeContents(o),n.collapse(!1),r.removeAllRanges(),r.addRange(n)}else console.log("[Context Menu] Setting value on rich-textarea"),t.value=e,t.dispatchEvent(new Event("input",{bubbles:!0})),t.focus()}else if(t.isContentEditable||t.contentEditable==="true"){console.log("[Context Menu] Setting textContent on contenteditable"),t.textContent=e,t.focus(),t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0}));const o=document.createRange(),n=window.getSelection();o.selectNodeContents(t),o.collapse(!1),n.removeAllRanges(),n.addRange(o)}else(t.tagName==="TEXTAREA"||t.tagName==="INPUT")&&(console.log("[Context Menu] Setting value on input/textarea"),t.value=e,t.focus(),t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0})));console.log("[Context Menu] Text inserted successfully"),window.geminiAPI&&window.geminiAPI.trackEvent&&CONFIG.ANALYTICS_EVENTS&&window.geminiAPI.trackEvent(CONFIG.ANALYTICS_EVENTS.CONTEXT_MENU_USED,{textLength:e.length,source:"context_menu"}),typeof showSuccess=="function"?showSuccess("Text sent to Gemini!"):window.showToast&&window.showToast("Text sent to Gemini!","success")}catch(o){console.error("[Context Menu] Error inserting text:",o),typeof j=="function"?j("Failed to insert text"):window.showToast&&window.showToast("Failed to insert text","error")}}})();
