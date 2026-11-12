const $ = id => document.getElementById(id);
let allGames = [], filtered = [], genre = 'all', query = '', visible = 30;
const fallbackGenres = {action:'⚡',puzzle:'🧩',racing:'🏎️',arcade:'👾',sports:'🏆',strategy:'♟️',adventure:'🗺️'};
function text(el, value) { el.textContent = value ?? ''; }
function imageFor(g) { return g.thumbnail || g.images?.thumbnail || ''; }
function genreFor(g) { return (g.genres || g.categories || [])[0] || 'game'; }
function tierForSlug(slug){const i=[...new Set(allGames.map(g=>g.slug))].sort().indexOf(slug);return i<0?'ultimate':i<500?'starter':i<1000?'premium':'ultimate';}
function render() {
  filtered = allGames.filter(g => (genre === 'all' || (g.genres || g.categories || []).includes(genre)) && (!query || `${g.name} ${g.slug} ${(g.tags || []).join(' ')}`.toLowerCase().includes(query)));
  text($('resultCount'), `${filtered.length.toLocaleString()} games found`);
  const subset = filtered.slice(0,visible);
  $('gamesGrid').replaceChildren(...subset.map(g => {
    const card = document.createElement('button'); card.className='game-card';card.type='button';card.title=`Play ${g.name}`;
    const img = document.createElement('img'); img.className='game-image';img.src=imageFor(g);img.alt=g.name;img.loading='lazy';img.onerror=()=>{img.onerror=null;img.style.display='none';};
    const body=document.createElement('div');body.className='game-card-body';
    const name=document.createElement('strong');text(name,g.name);
    const meta=document.createElement('div');meta.className='game-card-meta';
    const category=document.createElement('span');text(category,genreFor(g));
    const play=document.createElement('span');text(play,'PLAY ↗');const tier=document.createElement('span');tier.className='tier-tag';tier.textContent=({starter:'STARTER',premium:'PREMIUM',ultimate:'ULTIMATE'})[tierForSlug(g.slug)]||'GAME';meta.append(category,tier,play);body.append(name,meta);card.append(img,body);
    card.addEventListener('click',()=>location.hash=`play/${encodeURIComponent(g.slug)}`);
    return card;
  }));
  $('status').hidden=filtered.length>0;
  if(!filtered.length)text($('status'),allGames.length?'No games found. Try a different search.':'No games available right now.');
  $('loadMore').hidden=visible>=filtered.length;
}
function setGenre(next) {
  genre=next;visible=30;
  document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===genre));
  document.querySelectorAll('[data-genre]').forEach(el=>el.classList.toggle('active',el.dataset.genre===genre));
  render();$('games').scrollIntoView({behavior:'smooth'});
}
function randomGame() { if(!allGames.length)return;const g=allGames[Math.floor(Math.random()*allGames.length)];location.hash=`play/${encodeURIComponent(g.slug)}`; }
function showHome() {$('homeView').hidden=false;$('playView').hidden=true;$('gameFrame').removeAttribute('src');document.title='Top Video Games — Your next obsession starts here';}
async function route() {
  const hash=decodeURIComponent(location.hash.slice(1));
  if(!hash.startsWith('play/')) {
    showHome();
    if (['pricing','games','categories'].includes(hash)) {
      // The homepage may have been hidden while a game was displayed.
      // Scroll only after restoring it, including on direct links and refresh.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({behavior:'auto',block:'start'});
      }));
    } else if (!hash) window.scrollTo({top:0,behavior:'auto'});
    return;
  }
  const slug=hash.slice(5);
  if(!/^[a-z0-9-]{1,120}$/.test(slug)){showHome();return;}
  $('homeView').hidden=true;$('playView').hidden=false;$('gameLoading').hidden=false;
  $('gameFrame').removeAttribute('src');text($('playTitle'),'Loading game...');text($('playDescription'),'');window.scrollTo({top:0,behavior:'instant'});
  try {
    const response=await fetch(`/api/games/${encodeURIComponent(slug)}`);
    if(!response.ok)throw new Error('This game is unavailable.');
    const g=await response.json();
    if(!g.url || new URL(g.url).hostname !== 'www.gamearter.com')throw new Error('Game URL unavailable.');
    text($('playTitle'),g.name);text($('playDescription'),g.description || 'Get ready to play!');text($('playControls'),g.controls || 'Check the game screen for controls.');
    text($('playGenre'),(g.genres||g.categories||[]).join(', ') || 'Game');
    text($('playPlatform'),[g.platforms?.desktop?'Desktop':null,g.platforms?.mobile?'Mobile':null].filter(Boolean).join(' / ') || 'Browser');
    if(!(await window.checkGameAccess(slug))){$('gameLoading').hidden=true;return;}
    $('gameFrame').title=g.name;$('gameFrame').src=g.url;document.title=`${g.name} — Top Video Games`;
  } catch(err) {text($('playTitle'),'Game unavailable');text($('playDescription'),err.message);$('gameLoading').hidden=true;}
}
$('gameFrame').addEventListener('load',()=>$('gameLoading').hidden=true);
$('searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();visible=30;render()});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setGenre(b.dataset.filter)));
document.querySelectorAll('[data-genre]').forEach(b=>b.addEventListener('click',()=>setGenre(b.dataset.genre)));
$('loadMore').addEventListener('click',()=>{visible+=30;render()});
$('randomBtn').addEventListener('click',randomGame);$('heroRandom').addEventListener('click',randomGame);
$('backBtn').addEventListener('click',()=>{location.hash='games';showHome();setTimeout(()=>$('games').scrollIntoView(),30)});
$('fullscreenBtn').addEventListener('click',()=>{const f=$('gameFrame');if(f.requestFullscreen)f.requestFullscreen().catch(()=>{});});
$('menuBtn').addEventListener('click',()=>$('menuBtn').parentElement.querySelector('nav').classList.toggle('open'));
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();showHome();$('searchInput').focus()}});
window.addEventListener('hashchange',route);text($('year'),new Date().getFullYear());
(async()=>{try{const response=await fetch('/api/games');if(!response.ok)throw new Error();const data=await response.json();allGames=Array.isArray(data.games)?data.games:[];text($('gameCount'),`${(data.total||allGames.length).toLocaleString()}+`);render();}catch{allGames=[];text($('status'),'Could not load games right now. Please refresh the page in a moment.');text($('resultCount'),'Unavailable');}route()})();

// Handle repeat clicks on the same anchor, which do not fire hashchange.
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{if(location.hash===a.getAttribute('href'))route();}));
