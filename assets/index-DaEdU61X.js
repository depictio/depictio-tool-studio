import{r as v,j as C,k}from"./index-1SwK6hm7.js";import{t as b,v as w,x,C as R,cf as S,cg as $,hF as U,hG as M,hC as c,hs as u}from"./JBrowseRenderer-CRbQaNa2.js";import"./unzip-BwD_z9LH.js";import"./index-FiHv7a3v.js";import"./pendingLocus-jNIi0tQw.js";import"./trackLegend-DYRKoIXN.js";import"./chromeStyle-BPqPliLI.js";import"./pickedColour-C5zI1wVy.js";import"./AdvancedVizExtras-CT7jwgre.js";import"./browser-CEjXmdT6.js";import"./quantize-C4n_zP_f.js";import"./defaultLocale-XbQHfxZG.js";import"./AbortablePromiseCache-Bzbqdtb1.js";function A(t){return b("MuiSkeleton",t)}const H=w("MuiSkeleton",["root","text","rectangular","rounded","circular","pulse","wave","withChildren","fitContent","heightAuto"]),X=t=>{const{classes:e,variant:a,animation:o,hasChildren:s,width:n,height:i}=t;return R({root:["root",a,o,s&&"withChildren",s&&!n&&"fitContent",s&&!i&&"heightAuto"]},A,e)},r=u`
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
`,l=u`
  0% {
    transform: translateX(-100%);
  }

  50% {
    /* +0.5s of delay between each loop */
    transform: translateX(100%);
  }

  100% {
    transform: translateX(100%);
  }
`,j=typeof r!="string"?c`
        animation: ${r} 2s ease-in-out 0.5s infinite;
      `:null,B=typeof l!="string"?c`
        &::after {
          animation: ${l} 2s linear 0.5s infinite;
        }
      `:null,E=S("span",{name:"MuiSkeleton",slot:"Root",overridesResolver:(t,e)=>{const{ownerState:a}=t;return[e.root,e[a.variant],a.animation!==!1&&e[a.animation],a.hasChildren&&e.withChildren,a.hasChildren&&!a.width&&e.fitContent,a.hasChildren&&!a.height&&e.heightAuto]}})($(({theme:t})=>{const e=U(t.shape.borderRadius)||"px",a=M(t.shape.borderRadius);return{display:"block",backgroundColor:t.vars?t.vars.palette.Skeleton.bg:t.alpha(t.palette.text.primary,t.palette.mode==="light"?.11:.13),height:"1.2em",variants:[{props:{variant:"text"},style:{marginTop:0,marginBottom:0,height:"auto",transformOrigin:"0 55%",transform:"scale(1, 0.60)",borderRadius:`${a}${e}/${Math.round(a/.6*10)/10}${e}`,"&:empty:before":{content:'"\\00a0"'}}},{props:{variant:"circular"},style:{borderRadius:"50%"}},{props:{variant:"rounded"},style:{borderRadius:(t.vars||t).shape.borderRadius}},{props:({ownerState:o})=>o.hasChildren,style:{"& > *":{visibility:"hidden"}}},{props:({ownerState:o})=>o.hasChildren&&!o.width,style:{maxWidth:"fit-content"}},{props:({ownerState:o})=>o.hasChildren&&!o.height,style:{height:"auto"}},{props:{animation:"pulse"},style:j||{animation:`${r} 2s ease-in-out 0.5s infinite`}},{props:{animation:"wave"},style:{position:"relative",overflow:"hidden",WebkitMaskImage:"-webkit-radial-gradient(white, black)","&::after":{background:`linear-gradient(
                90deg,
                transparent,
                ${(t.vars||t).palette.action.hover},
                transparent
              )`,content:'""',position:"absolute",transform:"translateX(-100%)",bottom:0,left:0,right:0,top:0}}},{props:{animation:"wave"},style:B||{"&::after":{animation:`${l} 2s linear 0.5s infinite`}}}]}})),J=v.forwardRef(function(e,a){const o=x({props:e,name:"MuiSkeleton"}),{animation:s="pulse",className:n,component:i="span",height:p,style:m,variant:f="text",width:g,...h}=o,d={...o,animation:s,component:i,variant:f,hasChildren:!!h.children},y=X(d);return C.jsx(E,{as:i,ref:a,className:k(y.root,n),ownerState:d,...h,style:{width:g,height:p,...m}})});export{J as default,A as getSkeletonUtilityClass,H as skeletonClasses};
