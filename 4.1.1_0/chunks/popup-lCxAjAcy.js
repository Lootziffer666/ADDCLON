import{c as U,r as n,z as C,d as i,j as e,i as x,a as E,g as he,s as re,e as O,G as be,h as me,k as Ce}from"./index-C__N9jYl.js";import{s as B,a as $,b as j,U as ke,D as K,g as Ie}from"./index-KwNU04-P.js";import{c as ye,A as Z,a as ee,g as te,b as w,B as Se,S as ve}from"./siteIcons-GwIoynsc.js";import{C as se}from"./search-Cje9FHhQ.js";import{C as je}from"./copy-BlrV42sO.js";import{u as we,T as Ae,N as Ne,S as Me,L as $e,I as De,a as Ee}from"./hooks-CmUjZwwe.js";const We=[["path",{d:"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",key:"k3hazp"}]],ze=U("book",We);const Be=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],Te=U("message-circle-warning",Be);const Le=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M15 3v18",key:"14nvp0"}]],Fe=U("panel-right",Le),Pe=()=>{const[t,r]=n.useState(""),[l,d]=n.useState(""),[s,p]=n.useState(!1),c=n.useCallback(async()=>{const u=await ye();p(!u.isSupported),r(u.currentSiteName),d(u.connectionStatus)},[]);return n.useEffect(()=>{c()},[c]),{currentSiteName:t,connectionStatus:l,isUnsupportedSite:s,checkTabSupport:c}},_e=()=>{const[t,r]=n.useState([]);n.useEffect(()=>{(async()=>{const p=await Z.getSettings(),c=[],u=new Set;p.sortedNames.forEach(o=>{const a=ee.find(h=>h.name===o);a&&!p.hiddenNames.includes(o)&&(c.push({...a,icon:te(a.name)}),u.add(o))}),ee.forEach(o=>{!u.has(o.name)&&!p.hiddenNames.includes(o.name)&&c.push({...o,icon:te(o.name)})}),r(c)})()},[]);const l=n.useCallback(async s=>{await B("navigation",{name:s.name}),window.open(s.linkUrl||s.url,"_blank")},[]),d=n.useCallback(async s=>{try{const c=(await Z.getSettings()).hiddenNames,u=[...s,...c.filter(o=>!s.includes(o))];await Z.updateSettings({sortedNames:u,hiddenNames:c})}catch{}},[]);return{displaySites:t,setDisplaySites:r,handleSiteClick:l,handleReorder:d}},ae=()=>{const t=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a||"当前页面不支持此操作");return}$("custom"),j("captureSelect")},[]),r=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}$("text"),j("exportFullText")},[]),l=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}j("captureAllToImage")},[]),d=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}$("pdf"),j("exportFullPDF")},[]),s=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}$("markdown"),j("exportFullMarkdown")},[]),p=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}$("copy-markdown"),j("copyFullMarkdown")},[]),c=n.useCallback(async()=>{const{canPerform:o,errorMessage:a}=await w();if(!o){C(a);return}$("json"),j("exportFullJSON")},[]),u=n.useCallback(async()=>{console.log("[Word Export] exportFullWordClick called");const{canPerform:o,errorMessage:a}=await w();if(!o){console.log("[Word Export] checkCanPerformAction failed:",a),C(a);return}console.log("[Word Export] sending exportFullWord to active tab"),$("word"),j("exportFullWord")},[]);return{customExportClick:t,exportFullTextClick:r,exportFullImageClick:l,exportFullPDFClick:d,exportFullMarkdownClick:s,copyClick:p,exportFullJSONClick:c,exportFullWordClick:u}},Re=i.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  position: relative;
`,Oe=()=>e.jsxs(Re,{children:[e.jsx(Se,{size:"medium"}),e.jsx(ke,{mode:"popup",hideStatus:!0})]}),Ze="_horizontalScrollContainer_imct0_1",He="_scrollContent_imct0_9",Je="_scrollInner_imct0_24",Ue="_centered_imct0_31",Ge="_scrollBtn_imct0_35",Qe="_scrollLeft_imct0_66",Ye="_scrollRight_imct0_71",M={horizontalScrollContainer:Ze,scrollContent:He,scrollInner:Je,centered:Ue,scrollBtn:Ge,scrollLeft:Qe,scrollRight:Ye},Ve=({children:t,scrollAmount:r=120,leftLabel:l="Scroll left",rightLabel:d="Scroll right",autoHide:s=!0,gap:p=8,visibleItems:c=4,itemWidth:u=36,leftIcon:o,rightIcon:a,initialScrollIndex:h})=>{const[k,g]=n.useState(!1),[f,b]=n.useState(!1),[y,A]=n.useState(!1),[D,N]=n.useState(!1),v=n.useRef(null),T=n.useRef(null),ie=`${c*u+(c-1)*p}px`,L=n.useCallback(()=>{if(!v.current||!T.current)return;const I=v.current,W=T.current;b(I.scrollLeft>0),A(I.scrollLeft<W.scrollWidth-I.clientWidth);const Q=W.scrollWidth<=I.clientWidth;N(Q)},[]),ce=n.useCallback(()=>{v.current&&v.current.scrollBy({left:-r,behavior:"smooth"})},[r]),le=n.useCallback(()=>{v.current&&v.current.scrollBy({left:r,behavior:"smooth"})},[r]),F=n.useCallback(()=>{setTimeout(()=>{L()},0)},[L]);n.useEffect(()=>{F();const I=()=>L();return window.addEventListener("resize",I),()=>{window.removeEventListener("resize",I)}},[F,L]);const G=n.useCallback(I=>{if(!v.current||!T.current)return;const W=v.current,Y=T.current.children;if(I<0||I>=Y.length)return;const _=Y[I];if(!_)return;const R=_.offsetLeft,V=_.offsetWidth,X=W.clientWidth,q=W.scrollLeft,ue=R+V,ge=q,fe=q+X;if(R>=ge&&ue<=fe)return;const xe=R-(X-V)/2;W.scrollLeft=Math.max(0,xe)},[]);n.useEffect(()=>{F()},[t,F]),n.useLayoutEffect(()=>{h!==void 0&&h>=0&&G(h)},[h,G]);const de=e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:e.jsx("polyline",{points:"15,18 9,12 15,6"})}),pe=e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:e.jsx("polyline",{points:"9,18 15,12 9,6"})});return e.jsxs("div",{className:M.horizontalScrollContainer,onMouseEnter:()=>g(!0),onMouseLeave:()=>g(!1),children:[k&&f&&e.jsx("button",{className:`${M.scrollBtn} ${M.scrollLeft}`,onClick:ce,"aria-label":l,children:o||de}),e.jsx("div",{ref:v,className:M.scrollContent,onScroll:L,style:{maxWidth:ie},children:e.jsx("div",{ref:T,className:`${M.scrollInner} ${D?M.centered:""}`,style:{gap:`${p}px`},children:t})}),k&&y&&e.jsx("button",{className:`${M.scrollBtn} ${M.scrollRight}`,onClick:le,"aria-label":d,children:a||pe})]})},Xe=(t,r,l)=>{const d=n.useRef(null),s=n.useRef(null),[p,c]=n.useState(null),u=n.useCallback((k,g)=>{d.current=g,c(g)},[]),o=n.useCallback((k,g)=>{s.current=g,k.preventDefault()},[]),a=n.useCallback(k=>{k.preventDefault()},[]),h=n.useCallback(async k=>{const g=d.current,f=s.current;if(g!==null&&f!==null&&g!==f){const b=[...t],y=b[g];b.splice(g,1),b.splice(f,0,y),r(b);const A=b.map(D=>D.name);await l(A)}d.current=null,s.current=null,c(null)},[t,r,l]);return{handleDragStart:u,handleDragEnter:o,handleDragOver:a,handleDragEnd:h,draggingIndex:p}},qe=i.div`
  background: #ffffff;
  padding: 10px 12px;
  border-bottom: 1px solid #f8fafc;
`,Ke=i.a`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #e5e7eb;
  flex-shrink: 0;
  text-decoration: none;
  position: relative;

  &:hover {
    transform: scale(1.05);
    border-color: #3b82f6;
    background: #f0f9ff;
  }

  ${t=>t.$active&&`
    border-color: #3b82f6;
    background: #f0f9ff;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  `}

  ${t=>t.$connected&&`
    position: relative;
  `}

  ${t=>t.$dragging&&`
    opacity: 0.5;
    background: #f1f5f9;
    border-style: dashed;
    transform: scale(0.95);
  `}

  img {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }
`,et=i.div`
  position: absolute;
  top: 2px;
  right: 2px;
  width: 4px;
  height: 4px;
  border: 1px solid #ffffff;
  border-radius: 50%;
  background: ${t=>t.$status==="chat"?"#10b981":"#f59e0b"};
`,H=x.t.bind(x),tt=({sites:t,currentSiteName:r,connectionStatus:l,isUnsupportedSite:d,onSiteClick:s,onReorder:p,setDisplaySites:c})=>{const{handleDragStart:u,handleDragEnter:o,handleDragOver:a,handleDragEnd:h,draggingIndex:k}=Xe(t,c,p),g=t.findIndex(f=>f.name===r);return e.jsx(qe,{children:e.jsx(Ve,{scrollAmount:200,gap:8,visibleItems:7,itemWidth:28,leftLabel:"向左滚动",rightLabel:"向右滚动",initialScrollIndex:g>=0?g:void 0,children:t.map((f,b)=>{const y=r===f.name,A=!d&&y,D=!d&&y?`${f.name} - ${l==="chat"?H("nav.chatPage","聊天页面"):H("nav.homePage","主页面")}`:`${H("nav.clickToVisit","点击跳转到")} ${f.name}`;return e.jsxs(Ke,{draggable:!0,onDragStart:N=>u(N,b),onDragEnter:N=>o(N,b),onDragOver:a,onDragEnd:h,$active:y,$connected:A,$dragging:k===b,title:D,onClick:N=>{N.preventDefault(),s(f)},children:[e.jsx("img",{src:f.icon,alt:f.name}),A&&e.jsx(et,{$status:l==="chat"?"chat":"home"})]},f.name)})})})},nt="/assets/magic-D_xyIQjt.png",ot=x.t.bind(x),rt=({type:t="recommended",text:r})=>{const d={position:"absolute",top:"-2px",right:"6px",fontSize:"9px",padding:"2px 6px",borderRadius:"8px",fontWeight:"500",zIndex:10,...(()=>{switch(t){case"recommended":return{background:"#ef4444",color:"white"};case"hot":return{background:"#f59e0b",color:"white"};case"new":return{background:"#10b981",color:"white"};default:return{background:"#ef4444",color:"white"}}})()},s=r||ot("ui.recommended","推荐");return e.jsx("div",{style:d,children:s})},ne=x.t.bind(x),st=i.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 6px;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: background 0.25s ease, border-color 0.25s ease;
  cursor: pointer !important;

  &:hover {
    background: #e0f2fe;
    border-color: #bfdbfe;
  }

  ${t=>t.$featured&&`
    padding: 4px 14px;
    flex: 1;
    flex-direction: row;
    text-align: left;
    align-items: center;
    position: relative;
    border: 1px solid #dbeafe;
    border-radius: 14px;
    background: #f4f8ff;
    transition: all 0.25s ease;

    &:hover {
      background: #ebf1ff;
    }

    &:active {
      background: #e0eaff;
    }
  `}
`,at=i.div`
  margin-bottom: 0;
  margin-right: ${t=>t.$featured?"4px":"0"};
  width: ${t=>t.$featured?"64px":"auto"};
  height: ${t=>t.$featured?"64px":"auto"};
  flex-shrink: 0;
  border-radius: ${t=>t.$featured?"10px":"0"};
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  img {
    width: ${t=>t.$featured?"62px":"23px"};
    height: ${t=>t.$featured?"auto":"23px"};
    object-fit: contain;
  }
`,it=i.div`
  flex: 1;
  margin-top: 0;

  ${t=>t.$featured&&`
    margin-top: 0;
    flex: 1;
    text-align: left;
    z-index: 1;
  `}

  h3 {
    margin: ${t=>t.$featured?"0 0 2px 0":"0 0 1px 0"};
    font-size: ${t=>t.$featured?"15px":"12px"};
    color: ${t=>t.$featured?"#1e293b":"#374151"};
    line-height: ${t=>t.$featured?"1.2":"1.1"};
    font-weight: ${t=>t.$featured?700:"normal"};
  }

  p {
    margin: 0;
    font-size: ${t=>t.$featured?"12px":"10px"};
    color: ${t=>t.$featured?"#64748b":"#6b7280"};
    line-height: ${t=>t.$featured?"1.4":"1.2"};
  }
`,ct=({onClick:t})=>e.jsxs(st,{$featured:!0,onClick:t,children:[e.jsx(at,{$featured:!0,children:e.jsx("img",{src:nt,alt:"Custom Export"})}),e.jsxs(it,{$featured:!0,children:[e.jsx("h3",{children:ne("popup.customExport")}),e.jsx("p",{children:ne("popup.customExportDesc")})]}),e.jsx(rt,{type:"recommended"})]}),lt=i.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 4px 8px;
  background: #ffffff;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  cursor: pointer !important;

  &:hover {
    background: #e8f0f7ff;
    border-color: #d4dfedff;
  }
`,dt=i.div`
  width: auto;
  height: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 2px;

  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
`,pt=i.div`
  flex: 1;
  margin-top: 6px;

  h3 {
    margin: 0;
    font-size: 13px;
    color: #475569;
    font-weight: 500;
    line-height: 1.2;
  }
`,z=({icon:t,title:r,alt:l,onClick:d})=>e.jsxs(lt,{onClick:d,children:[e.jsx(dt,{children:e.jsx("img",{src:t,alt:l})}),e.jsx(pt,{children:e.jsx("h3",{children:r})})]}),ut="/assets/md-B8nF0Nu1.png",gt="/assets/pdf-CMPbJ9aZ.png",ft="/assets/image-JY_E3rsp.png",xt="/assets/txt-CB7qOyB7.png",ht="/assets/json-wgKw7CF_.png",bt="data:image/svg+xml;base64,PHN2ZyBpZD0iaWNvbi1wcmV2aWV3LXN2ZyIgdmlld0JveD0iNjUuNSA0OC41IDM4MSA0MTUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9InctZnVsbCBoLWZ1bGwiPjxwYXRoIGQ9Ik0gMTYwIDY0JiMxMDsgICAgICAgICAgICBMIDI4OCA2NCYjMTA7ICAgICAgICAgICAgTCA0MDAgMTc2JiMxMDsgICAgICAgICAgICBMIDQwMCA0MDAmIzEwOyAgICAgICAgICAgIEEgNDggNDggMCAwIDEgMzUyIDQ0OCYjMTA7ICAgICAgICAgICAgTCAxNjAgNDQ4JiMxMDsgICAgICAgICAgICBBIDQ4IDQ4IDAgMCAxIDExMiA0MDAmIzEwOyAgICAgICAgICAgIEwgMTEyIDExMiYjMTA7ICAgICAgICAgICAgQSA0OCA0OCAwIDAgMSAxNjAgNjQgWiIgZmlsbD0iI2JmZDlmOCIgc3Ryb2tlPSIjMkI2Q0M0IiBzdHJva2Utd2lkdGg9IjI3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTSAyODggNjQmIzEwOyAgICAgICAgICAgIEwgMjg4IDEyOCYjMTA7ICAgICAgICAgICAgQSA0OCA0OCAwIDAgMCAzMzYgMTc2JiMxMDsgICAgICAgICAgICBMIDQwMCAxNzYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzJCNkNDNCIgc3Ryb2tlLXdpZHRoPSIyNyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHRleHQgeD0iMjU2IiB5PSIyNzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJjZW50cmFsIiBmb250LXNpemU9IjE3NyIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzFBNDM4MCIgZm9udC1mYW1pbHk9InVpLXNhbnMtc2VyaWYsIHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sICdIZWx2ZXRpY2EgTmV1ZScsIEFyaWFsLCBzYW5zLXNlcmlmIiBzdHlsZT0ibGV0dGVyLXNwYWNpbmc6IC0wLjAyZW07Ij5XPC90ZXh0Pjwvc3ZnPg==",mt=i.div`
  margin-top: 8px;
`,Ct=i.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`,kt=i.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  letter-spacing: 0.3px;
  padding-left: 4px;
`,It=i.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f8fafc;
  border: none;
  border-radius: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    color: #475569;
  }

  &:active {
    background: #cbd5e1;
  }
`,yt=i.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  > * {
    flex: 0 0 calc((100% - 20px) / 3);
    min-width: 0;
    max-width: calc((100% - 20px) / 3);
    box-sizing: border-box;
  }
`;i.div`
  margin-top: 8px;
`;const St=i.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`,vt=i.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 14px 15px 14px;
  background: #ffffff;
`,S=x.t.bind(x),jt=()=>{const{exportFullPDFClick:t,exportFullMarkdownClick:r,exportFullTextClick:l,exportFullImageClick:d,exportFullJSONClick:s,exportFullWordClick:p,copyClick:c}=ae();return e.jsxs(mt,{children:[e.jsxs(Ct,{children:[e.jsxs(kt,{children:[S("popup.quickExports"),e.jsx(E,{content:S("tooltip.quickExports"),delay:[100,0],children:e.jsx(se,{style:{cursor:"pointer"},color:"#999",size:12})})]}),e.jsx(E,{content:S("popup.copyFullActionDesc"),delay:[800,0],children:e.jsxs(It,{onClick:c,children:[e.jsx(je,{size:14}),S("popup.copyFullAction")]})})]}),e.jsxs(yt,{children:[e.jsx(z,{icon:gt,title:S("popup.exportPdfShort"),alt:"Export as PDF",onClick:t}),e.jsx(z,{icon:ut,title:S("popup.exportMarkdownShort"),alt:"Export as markdown",onClick:r}),e.jsx(z,{icon:xt,title:S("popup.exportTextShort"),alt:"Export as Text",onClick:l}),e.jsx(z,{icon:bt,title:S("popup.exportWordShort"),alt:"Export as Word",onClick:p}),e.jsx(z,{icon:ft,title:S("popup.exportImageShort"),alt:"Export as Image",onClick:d}),e.jsx(z,{icon:ht,title:S("popup.exportJSONShort"),alt:"Export as JSON",onClick:s})]})]})},m=x.t.bind(x),wt=i.div`
  margin-top: 8px;
`,At=i.div`
  display: flex;
  padding-left: 4px;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
`,Nt=i.div`
  display: flex;
  gap: 8px;
  align-items: center;
`,Mt=i.div`
  position: relative;
  flex: 1;
  min-width: 0;
`,$t=i.button`
  padding: 10px 16px;
  line-height: 18px;
  background: #ffffff; 
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: 600;
  
  &:hover {
    background: #e0f2fe;
    border-color: #bfdbfe;
    color: #1e293b;
  }

  &:active {
    background: #dbeafe;
    border-color: #93c5fd;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  ${t=>t.$saving&&`
    opacity: 0.7;
    background: #f1f5f9;
    border-color: #e5e7eb;
  `}
`,Dt=()=>{const t=we(),{selectedBlock:r,isLoading:l,selectedSpaceId:d,handleBlockSelect:s}=t,[p,c]=n.useState(!1),[u,o]=n.useState(!1),a=()=>{o(!0),t.resetSearchState()},k={...t,handleBlockSelect:async y=>{await s(y),o(!1)}},g=async()=>{if(p)return;if(!await Ee.isAuthenticated()){B("notion_click",{result:"not_login"}),o(!0);return}const{canPerform:A,errorMessage:D}=await w();if(!A){C(D||m("notion.unsupportedOperation"));return}if(!r){C(m("notion.selectFirst")),o(!0);return}c(!0),C.loading(m("notion.savingProgress"),{id:"saving"});try{await $("full-notion"),await j("saveFullChatsToNotion",{block:r,blockId:r.record.id,blockName:r.record.name,blockType:r.record.type,spaceId:d}),B("notion_click",{result:"sended"}),C.success(m("notion.saveSuccessToast"),{id:"saving"})}catch{C(m("notion.saveFailedToast"),{id:"saving"})}finally{c(!1)}},f=()=>r?r.record.name||m("notion.unnamed"):m(l?"notion.loading":"notion.selectDatabaseOrPage"),b=()=>l?e.jsx($e,{size:14,className:"animate-spin"}):r?.record.iconEmoji?De({emoji:r.record.iconEmoji}):r?.record.type==="collection_view"?e.jsx(K,{size:14}):e.jsx(K,{size:14});return e.jsxs(wt,{children:[e.jsxs(At,{children:[m("popup.notionSync"),e.jsx(E,{content:m("popup.notionSyncDesc"),placement:"top",children:e.jsx(se,{style:{cursor:"pointer"},size:12,color:"#999"})})]}),e.jsxs(Nt,{children:[e.jsxs(Mt,{className:"flex-1",children:[e.jsx(Ae,{trigger:a,isLoading:l,displayIcon:b(),displayText:f()||""}),u&&e.jsx(Ne,{notionData:k,onClose:()=>o(!1)})]}),e.jsxs($t,{$saving:p,onClick:g,disabled:p,title:m("notion.save"),children:[e.jsx(Me,{size:14}),m(p?"notion.saving":"notion.save")]})]})]})},Et=i.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 5px 14px;
  border-top: 1px solid #f1f5f9;
`,Wt=i.div`
  display: flex;
  align-items: center;
  gap: 4px;
`,zt=i.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
`,J=i.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  color: #64748b;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
`,Bt=i.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: #64748b;
  border: none;
  border-radius: 8px;
  padding: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  svg {
    color: inherit;
  }
`,P=x.t.bind(x),Tt=()=>{const t=n.useCallback(async()=>{await B("tutorial",{name:"tutorial"}),window.open(`${he("/docs")}?utm_source=popup`,"_blank")},[]),r=n.useCallback(async()=>{re("to-feedback-page",{})},[]),l=n.useCallback(async()=>{await B("settings",{name:"settings"});try{const s=O.runtime.getURL("/options.html");await O.tabs.create({url:s})}catch{}},[]),d=n.useCallback(async()=>{const s=await Ie();if(s)try{await O.sidePanel.open({tabId:s}),window.close()}catch{}},[]);return e.jsxs(Et,{children:[e.jsx(Wt,{}),e.jsxs(zt,{children:[e.jsx(E,{content:P("popup.sidepanelTip"),children:e.jsx(Bt,{onClick:d,children:e.jsx(Fe,{size:18})})}),e.jsx(E,{content:P("ui.viewTutorial"),children:e.jsx(J,{onClick:t,children:e.jsx(ze,{size:18})})}),e.jsx(E,{content:P("ui.feedbackIssue"),children:e.jsx(J,{onClick:r,children:e.jsx(Te,{size:18})})}),e.jsx(E,{content:P("ui.toSettingPage"),children:e.jsx(J,{onClick:l,children:e.jsx(ve,{size:18})})})]})]})};x.t.bind(x);const Lt=i.div`
  user-select: none;
  width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  color: #333;
  padding: 0;
  background: #ffffff;
  overflow: hidden;
`,Ft=()=>{const{currentSiteName:t,connectionStatus:r,isUnsupportedSite:l}=Pe(),{displaySites:d,setDisplaySites:s,handleSiteClick:p,handleReorder:c}=_e(),{customExportClick:u}=ae(),[o,a]=n.useState(!0);return n.useEffect(()=>{re("popup-active",{})},[]),n.useEffect(()=>{B("open_popup",{})},[]),n.useEffect(()=>{(async()=>{try{const h=await be.enabledNotionExport();a(!!h)}catch{a(!0)}})()},[]),e.jsxs(e.Fragment,{children:[e.jsxs(Lt,{children:[e.jsx(Oe,{}),e.jsx(tt,{sites:d,currentSiteName:t,connectionStatus:r,isUnsupportedSite:l,onSiteClick:p,onReorder:c,setDisplaySites:s}),e.jsxs(vt,{children:[e.jsx(St,{children:e.jsx(ct,{onClick:u})}),e.jsx(jt,{}),o&&e.jsx(Dt,{})]}),e.jsx(Tt,{})]}),e.jsx(me,{position:"top-center",reverseOrder:!0,containerStyle:{inset:"10px"},toastOptions:{duration:2e3,style:{background:"rgba(0,0,0,0.8)",color:"#fff"},success:{duration:1e3}}})]})},oe=document.getElementById("app");oe&&Ce.createRoot(oe).render(e.jsx(Ft,{}));
