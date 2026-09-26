const CACHE="vinylotheque-v6-1";
const ASSETS=["./","./index.html","./styles.css?v=6.0","./app.js?v=6.0","./features.js?v=6.0","./dashboard.js?v=6.1","./manifest.webmanifest","./icons/icon-192.png","./icons/icon.svg"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.hostname==="api.discogs.com" || u.hostname.endsWith("discogs.com")) return;
  if(e.request.method!=="GET") return;

  const networkFirst =
    e.request.mode==="navigate" ||
    e.request.destination==="script" ||
    e.request.destination==="style";

  if(networkFirst){
    e.respondWith(
      fetch(e.request)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
          return res;
        })
        .catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>
      cached ||
      fetch(e.request).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return res;
      })
    )
  );
});