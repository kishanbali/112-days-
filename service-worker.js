const CACHE='kemp-eye-112-pwa-v11';
const CORE=['./','./index.html','./manifest.json','./icon-192.svg','./icon-512.svg'];

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim())
));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);

  // Always fetch the app shell and JavaScript from the network first so
  // GitHub Pages cannot keep serving an older cached version.
  if(url.pathname.endsWith('/index.html') || url.pathname.endsWith('/service-worker.js')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
      const x=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,x));
      return r;
    }).catch(()=>caches.match(e.request)));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
      const x=r.clone();
      caches.open(CACHE).then(cache=>cache.put(e.request,x));
      return r;
    }).catch(()=>c))
  );
});
