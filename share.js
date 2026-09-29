(() => {
  const ENDPOINT="https://yjudyoihvmfvunvkmbtu.supabase.co/functions/v1/collection-share";
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  let rows=[];

  function stars(v){const n=Math.max(0,Math.min(5,Number(v)||0));return n?"★".repeat(n)+"☆".repeat(5-n):"";}
  function period(){
    const ys=rows.map(r=>Number(r.year)).filter(y=>y>1800&&y<2200).sort((a,b)=>a-b);
    return ys.length?(ys[0]===ys.at(-1)?String(ys[0]):ys[0]+"–"+ys.at(-1)):"—";
  }
  function updateStats(){
    $("#shareStatTotal").textContent=rows.length;
    $("#shareStatArtists").textContent=new Set(rows.map(r=>norm(r.artist)).filter(Boolean)).size;
    $("#shareStatPeriod").textContent=period();
  }
  function openDetail(r){
    const d=$("#shareDetail");
    const meta=[r.year,r.format,r.country].filter(Boolean).join(" · ");
    $("#shareDetailCover").innerHTML=r.coverUrl?'<img src="'+esc(r.coverUrl)+'" alt="">':'<div class="placeholder"><div class="mini-record"></div></div>';
    $("#shareDetailTitle").textContent=r.title||"Sans titre";
    $("#shareDetailArtist").textContent=r.artist||"Artiste inconnu";
    $("#shareDetailMeta").textContent=meta;
    $("#shareDetailInfo").innerHTML=[
      r.genre?'<div><strong>Genre</strong><span>'+esc(r.genre)+'</span></div>':"",
      r.style?'<div><strong>Style</strong><span>'+esc(r.style)+'</span></div>':"",
      r.label?'<div><strong>Label</strong><span>'+esc([r.label,r.catno].filter(Boolean).join(" — "))+'</span></div>':"",
      r.personalRating?'<div><strong>Note</strong><span class="share-rating">'+stars(r.personalRating)+'</span></div>':"",
      r.personalStatus?'<div><strong>Statut</strong><span>'+esc(r.personalStatus)+'</span></div>':""
    ].join("");
    d.showModal();
  }
  function render(){
    const q=norm($("#shareSearch").value);
    const sort=$("#shareSort").value;
    let view=rows.filter(r=>!q||norm([r.artist,r.title,r.year,r.genre,r.style,r.label,r.catno].join(" ")).includes(q));
    view.sort((a,b)=>{
      if(sort==="title")return String(a.title||"").localeCompare(String(b.title||""),"fr");
      if(sort==="year-desc")return Number(b.year||0)-Number(a.year||0);
      if(sort==="rating-desc")return Number(b.personalRating||0)-Number(a.personalRating||0);
      return String(a.artist||"").localeCompare(String(b.artist||""),"fr");
    });
    $("#shareGrid").innerHTML=view.map((r,i)=>{
      const meta=[r.year,r.format,r.country].filter(Boolean).join(" · ");
      const label=[r.label,r.catno].filter(Boolean).join(" — ");
      const rating=stars(r.personalRating);
      return '<article class="record-card public-record" data-i="'+i+'" tabindex="0">'+
        '<div class="cover">'+(r.coverUrl?'<img src="'+esc(r.coverUrl)+'" alt="Pochette de '+esc(r.title)+'" loading="lazy">':'<div class="placeholder"><div class="mini-record"></div></div>')+'</div>'+
        '<div class="record-body"><h3>'+esc(r.title||"Sans titre")+'</h3><div class="artist">'+esc(r.artist||"Artiste inconnu")+'</div>'+
        '<div class="meta">'+esc(meta)+(meta&&label?"<br>":"")+esc(label)+'</div>'+
        (rating?'<div class="share-rating">'+rating+'</div>':'')+
        (r.personalStatus?'<span class="share-status">'+esc(r.personalStatus)+'</span>':'')+
        '</div></article>';
    }).join("");
    $("#shareEmpty").hidden=view.length>0;
    $("#shareGrid").hidden=view.length===0;
    Array.from($("#shareGrid").querySelectorAll(".public-record")).forEach((card,i)=>{
      const r=view[i];
      const open=()=>openDetail(r);
      card.addEventListener("click",open);
      card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    });
  }
  async function load(){
    const id=new URL(location.href).searchParams.get("id")||"";
    if(!id){$("#shareLoading").textContent="Lien de partage invalide.";return;}
    try{
      const res=await fetch(ENDPOINT+"?id="+encodeURIComponent(id),{headers:{Accept:"application/json"}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Partage indisponible");
      rows=Array.isArray(data.collection)?data.collection:[];
      const p=data.profile&&typeof data.profile==="object"?data.profile:{};
      $("#shareCollectionName").textContent=p.collectionName||"Collection de vinyles";
      $("#shareOwner").textContent=p.displayName?("Collection de "+p.displayName):"Collection partagée";
      $("#shareUpdated").textContent=data.updated_at?("Actualisée le "+new Date(data.updated_at).toLocaleDateString("fr-FR",{dateStyle:"medium"})):"";
      document.title=(p.collectionName||"Vinylothèque")+" — lecture seule";
      $("#shareLoading").hidden=true;$("#shareContent").hidden=false;
      updateStats();render();
    }catch(err){
      $("#shareLoading").innerHTML="<strong>Ce partage n’est pas disponible.</strong><br><span>"+esc(err.message)+"</span>";
    }
  }
  $("#shareSearch").addEventListener("input",render);
  $("#shareSort").addEventListener("change",render);
  $("#shareDetailClose").addEventListener("click",()=>$("#shareDetail").close());
  load();
})();