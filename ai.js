javascript:(function(){const t=8,o=16,n=4,i=new Array(t).fill(0).map(()=>new Array(o).fill(0)),r=new Array(o).fill(0),e=new Array(o).fill(0).map(()=>new Array(n).fill(0)),l=new Array(n).fill(0);for(let n=0;n<t;n++)for(let t=0;t<o;t++)i[n][t]=Math.random()-.5;for(let t=0;t<o;t++)for(let o=0;o<n;o++)e[t][o]=Math.random()-.5;for(let t=0;t<o;t++)r[t]=Math.random()-.5;for(let t=0;t<n;t++)l[t]=Math.random()-.5;function p(t){return 1/(1+Math.exp(-t))}function a(a,f,s,y,m,u){const c=function(a){const f=new Array(o).fill(0);for(let n=0;n<o;n++){for(let o=0;o<t;o++)f[n]+=a[o]*i[o][n];f[n]=p(f[n]+r[n])}const s=new Array(n).fill(0);for(let t=0;t<n;t++){for(let n=0;n<o;n++)s[t]+=f[n]*e[n][t];s[t]=p(s[t]+l[t])}return s}(function(t,o,n,i,r,e){const l=JSON.parse(i),p=l.map(t=>t.x),a=l.map(t=>t.y),f=JSON.parse(r),s=f.map(t=>t.x),y=f.map(t=>t.y),m=JSON.parse(e),u=m.map(t=>t.x),c=m.map(t=>t.y);return[t.position.x,t.position.y,o-t.position.x,n-t.position.y,...p,...a,...s,...y,...u,...c]}(a,f,s,y,m,u)),[x,h,d,w,A,g]=c;console.log(c),input.up=x>.5,input.down=h>.5,input.left=d>.5,input.right=w>.5,input.field=A>.5,input.fire=g>.5}!function t(){const o=[];for(let t=0;t<mob.length;t++)o.push({x:mob[t].position.x,y:mob[t].position.y});const n=[];for(let t=0;t<map.length;t++)n.push({x:map[t].position.x,y:map[t].position.y});const i=[];for(let t=0;t<body.length;t++)i.push({x:body[t].position.x,y:body[t].position.y});a(player,level.exit.x,level.exit.y,JSON.stringify(o),JSON.stringify(n),JSON.stringify(i)),requestAnimationFrame(t)}()})();
