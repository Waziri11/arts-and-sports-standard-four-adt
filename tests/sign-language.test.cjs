const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(host='https://waziri11.github.io/arts-and-sports-standard-four-adt/') {
  const handlers={}, videos=[];
  class Element {setAttribute(name,value){this[name]=value;}}
  class Media extends Element {
    constructor(tag){super();this.tagName=tag;this.paused=true;this.ended=false;this.handlers={};this.playbackRate=1;this.defaultPlaybackRate=1;this.plays=0;}
    get src(){return this.url||'';} set src(value){this.url=new URL(value,host).href;}
    addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
    emit(name){for(const fn of this.handlers[name]||[])fn({target:this});for(const fn of handlers[name]||[])fn({target:this,stopImmediatePropagation(){}});}
    play(){if(this.reject)return Promise.reject(new Error('blocked'));this.paused=false;this.plays++;this.emit('play');this.emit('playing');return Promise.resolve();}
    pause(){this.paused=true;this.emit('pause');}
  }
  const context={URL,Element,HTMLMediaElement:Media,location:new URL(host),WeakSet,WeakMap,Promise,setTimeout,clearTimeout,document:{querySelectorAll:()=>videos,addEventListener:(n,f)=>(handlers[n]??=[]).push(f)}};
  vm.runInNewContext(fs.readFileSync('assets/sign-language.js','utf8'),context);
  const video=new Media('VIDEO');video.src='./content/i18n/en/video/page_7.mp4';videos.push(video);
  const audio=new Media('AUDIO');audio.src='./content/i18n/en/audio/pg007_n0001.mp3';
  return {video,audio,Media,context};
}
const wait=()=>new Promise(r=>setTimeout(r,240));
test('signing plays without narration and stays muted at natural speed',async()=>{const {video}=setup();await video.play();await wait();assert.equal(video.paused,false);assert.equal(video.muted,true);assert.equal(video.volume,0);video.playbackRate=2;video.emit('ratechange');assert.equal(video.playbackRate,1);assert.match(video.src,/26cb970.*\/videos\/page_7.mp4$/);});
test('local copies use their own video folder',()=>{const {video}=setup('http://localhost:8765/book/index.html');assert.equal(video.src,'http://localhost:8765/book/videos/page_7.mp4');});
test('successful narration starts signing; pause and end stop it',async()=>{const {audio,video}=setup();await audio.play();assert.equal(video.paused,false);audio.pause();await wait();assert.equal(video.paused,true);await audio.play();assert.equal(video.paused,false);audio.ended=true;audio.emit('ended');await wait();assert.equal(video.paused,true);});
test('blocked narration and UI sounds do not start signing',async()=>{const {audio,video,Media}=setup();audio.reject=true;await assert.rejects(audio.play());assert.equal(video.plays,0);const sound=new Media('AUDIO');sound.src='./assets/sounds/click.mp3';await sound.play();assert.equal(video.plays,0);});
test('successive narration segments do not pause or restart the video',async()=>{const {audio,video,Media}=setup();await audio.play();video.currentTime=12;audio.pause();const next=new Media('AUDIO');next.src='./content/i18n/en/audio/pg007_n0002.mp3';await next.play();await wait();assert.equal(video.paused,false);assert.equal(video.currentTime,12);assert.equal(video.plays,1);});
test('transient media errors reload the same video without losing its position',async()=>{const {video}=setup();video.isConnected=true;video.currentTime=14;video.duration=100;video.error={code:2};video.load=function(){this.loads=(this.loads||0)+1;this.error=null;this.currentTime=0;this.emit('loadedmetadata');};video.emit('error');await new Promise(r=>setTimeout(r,1600));assert.equal(video.loads,1);assert.equal(video.currentTime,14);assert.equal(video.paused,false);});

test('published filename casing is preserved',()=>{const {video}=setup();video.src='./content/i18n/en/video/Page_24.mp4';assert.match(video.src,/\/videos\/Page_24.mp4$/);});
test('all reading positions use exact committed media names and current embedded manifests',()=>{
 const pages=JSON.parse(fs.readFileSync('content/pages.json'));
 const mappings=JSON.parse(fs.readFileSync('content/i18n/en/videos.json'));
 const config=JSON.parse(fs.readFileSync('assets/config.json'));
 const tracked=new Set(require('node:child_process').execFileSync('git',['ls-files','videos/'],{encoding:'utf8'}).trim().split('\n'));
 assert.equal(Object.keys(mappings).length,pages.length);
 pages.forEach((page,i)=>{assert.ok(tracked.has('videos/'+mappings['video-'+(i+1)]),'Missing exact-case media at position '+(i+1));const html=fs.readFileSync(page.href,'utf8');assert.ok(html.includes('./assets/sign-language.js?v='+config.bundleVersion));});
 const source=fs.readFileSync('assets/offline-preloader.js','utf8');
 const inline=JSON.parse(source.split('  var INLINE = ')[1].split(';\n')[0]);
 assert.deepEqual(inline['./content/i18n/en/videos.json'],mappings);
 assert.deepEqual(inline['./assets/config.json'],config);
});
