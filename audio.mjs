// A quiet, original procedural score for the playable prototype.
export class MidnightAudio {
  constructor(){ this.ctx=null; this.timer=null; this.enabled=false; this.step=0; this.mode='night'; this.nextBird=0; }
  async setEnabled(value){
    this.enabled=value;
    if(!value){if(this.ctx) await this.ctx.suspend();return;}
    // iPhone: play through the silent switch once the player turns sound on.
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    if(!this.ctx) this.build();
    await this.ctx.resume();
    this.nextTime=this.ctx.currentTime+.08;
    if(!this.timer) this.timer=setInterval(()=>this.schedule(),80);
  }
  build(){
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context) throw new Error('audio-unavailable');
    this.ctx=new Context();
    const c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=.5;
    const compressor=c.createDynamicsCompressor(); compressor.threshold.value=-18; compressor.ratio.value=4;
    this.master.connect(compressor);compressor.connect(c.destination);
    // The score sits on its own quiet bus, well under the footsteps and rain.
    this.bgm=c.createGain();this.bgm.gain.value=.5;this.bgm.connect(this.master);
    this.music=c.createBiquadFilter();this.music.type='lowpass';this.music.frequency.value=2500;this.music.Q.value=.4;this.music.connect(this.bgm);
    this.reverb=c.createConvolver();
    const impulse=c.createBuffer(2,c.sampleRate*1.8,c.sampleRate);
    for(let channel=0;channel<2;channel++){const d=impulse.getChannelData(channel);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)*.45;}
    this.reverb.buffer=impulse;
    const wet=c.createGain();wet.gain.value=.2;this.reverb.connect(wet);wet.connect(this.bgm);
    // Footsteps: their own bus, with a short corridor echo.
    this.sfx=c.createGain();this.sfx.gain.value=.75;this.sfx.connect(this.master);
    this.hall=c.createConvolver();this.hall.buffer=impulse;
    const hallWet=c.createGain();hallWet.gain.value=.1;this.hall.connect(hallWet);hallWet.connect(this.master);
    this.stepSide=1;
    const noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=noise.getChannelData(0);
    let last=0;for(let i=0;i<d.length;i++){last=(last+(Math.random()*2-1)*.06)/1.02;d[i]=last*.45;}
    this.noise=noise;
    const rain=c.createBufferSource();rain.buffer=noise;rain.loop=true;
    const rainFilter=c.createBiquadFilter();rainFilter.type='highpass';rainFilter.frequency.value=700;
    const rainGain=c.createGain();rainGain.gain.value=this.mode==='morning'?0:.06;this.rainGain=rainGain;rain.connect(rainFilter);rainFilter.connect(rainGain);rainGain.connect(this.master);rain.start();
  }
  note(midi,time,duration,volume=.2,type='sine'){
    const c=this.ctx,osc=c.createOscillator(),harm=c.createOscillator(),gain=c.createGain();
    const freq=440*Math.pow(2,(midi-69)/12);osc.type=type;osc.frequency.value=freq;harm.type='sine';harm.frequency.value=freq*2;harm.detune.value=3;
    const hg=c.createGain();hg.gain.value=.16;harm.connect(hg);hg.connect(gain);osc.connect(gain);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.018);gain.gain.exponentialRampToValueAtTime(volume*.32,time+.27);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    gain.connect(this.music);gain.connect(this.reverb);osc.start(time);harm.start(time);osc.stop(time+duration+.05);harm.stop(time+duration+.05);
    osc.onended=()=>{osc.disconnect();harm.disconnect();hg.disconnect();gain.disconnect();};
  }
  kick(time){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(105,time);o.frequency.exponentialRampToValueAtTime(43,time+.18);g.gain.setValueAtTime(.3,time);g.gain.exponentialRampToValueAtTime(.0001,time+.24);o.connect(g);g.connect(this.bgm);o.start(time);o.stop(time+.26);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  brush(time,volume=.15){
    const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=2400;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+.1);s.connect(f);f.connect(g);g.connect(this.bgm);s.start(time,Math.random());s.stop(time+.12);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  // One loafer step on the corridor floor: a hard heel click and a soft
  // body, panned a little to the stepping foot (side -1 left / 1 right,
  // alternating when not given). run: slightly firmer.
  footstep(run=false,side=0){
    if(!this.ctx||this.ctx.state!=='running'||!this.enabled)return;
    const c=this.ctx,t=c.currentTime+.01,level=(run?1.15:1)*(.9+Math.random()*.2);
    this.stepSide=side||-this.stepSide;
    const pan=c.createStereoPanner?c.createStereoPanner():null;
    const out=pan||c.createGain();if(pan)pan.pan.value=.14*this.stepSide;out.connect(this.sfx);out.connect(this.hall);
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.noise;f.type='bandpass';f.frequency.value=1700+Math.random()*700;f.Q.value=1.3;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.55*level,t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+.075);
    s.connect(f);f.connect(g);g.connect(out);s.start(t,Math.random()*2);s.stop(t+.09);
    const o=c.createOscillator(),og=c.createGain();
    o.frequency.setValueAtTime(115+Math.random()*15,t);o.frequency.exponentialRampToValueAtTime(58,t+.07);
    og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.32*level,t+.004);og.gain.exponentialRampToValueAtTime(.0001,t+.1);
    o.connect(og);og.connect(out);o.start(t);o.stop(t+.12);
    o.onended=()=>{s.disconnect();f.disconnect();g.disconnect();o.disconnect();og.disconnect();out.disconnect();};
  }
  // The ending: the rain fades out and a slower, brighter tune with birds
  // outside takes over; night() puts the corridor back.
  ending(){this.mode='morning';this.step=0;if(this.ctx){const g=this.rainGain.gain,t=this.ctx.currentTime;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+3.5);this.nextBird=t+2;}}
  night(){this.mode='night';this.step=0;if(this.ctx){const g=this.rainGain.gain,t=this.ctx.currentTime;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(.06,t+1.5);}}
  chirp(time){
    const c=this.ctx,pan=c.createStereoPanner?c.createStereoPanner():c.createGain();if(pan.pan)pan.pan.value=-.6+Math.random()*.4;pan.connect(this.sfx);
    const base=2600+Math.random()*900,count=2+Math.floor(Math.random()*3);
    for(let i=0;i<count;i++){
      const t=time+i*(.09+Math.random()*.05),o=c.createOscillator(),g=c.createGain();
      o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*1.35,t+.05);o.frequency.exponentialRampToValueAtTime(base*.9,t+.08);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.05,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.085);
      o.connect(g);g.connect(pan);o.start(t);o.stop(t+.1);o.onended=()=>{o.disconnect();g.disconnect();};
    }
    setTimeout(()=>pan.disconnect(),1500);
  }
  meow(){
    if(!this.ctx||this.ctx.state!=='running'||!this.enabled)return;
    const c=this.ctx,t=c.currentTime+.02,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(480,t);o.frequency.linearRampToValueAtTime(760,t+.18);o.frequency.linearRampToValueAtTime(420,t+.6);
    f.type='bandpass';f.Q.value=3;f.frequency.setValueAtTime(900,t);f.frequency.linearRampToValueAtTime(1600,t+.2);f.frequency.linearRampToValueAtTime(800,t+.6);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.06);g.gain.setValueAtTime(.12,t+.35);g.gain.exponentialRampToValueAtTime(.0001,t+.65);
    o.connect(f);f.connect(g);g.connect(this.sfx);g.connect(this.hall);o.start(t);o.stop(t+.7);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};
  }
  morning(){
    const c=this.ctx,beat=60/64;
    const chords=[[48,55,64,67,71],[53,57,64,69,72],[50,57,62,65,69],[55,59,62,67,71]];
    while(this.nextTime<c.currentTime+.35){
      const s=this.step,t=this.nextTime,chord=chords[Math.floor(s/8)%chords.length],b=s%8;
      if(b===0){this.note(chord[0]-12,t,4,.16);chord.slice(1).forEach((n,i)=>this.note(n,t+i*.03,5,.07));}
      if(b%2===1)this.note(chord[1+((s>>1)%4)]+12,t,1.6,.045);
      this.step++;this.nextTime+=beat/2;
    }
    if(c.currentTime>this.nextBird){this.chirp(c.currentTime+.05);if(Math.random()<.5)this.chirp(c.currentTime+.6);this.nextBird=c.currentTime+2.5+Math.random()*4;}
  }
  schedule(){
    if(!this.ctx||this.ctx.state!=='running'||!this.enabled)return;
    if(this.nextTime<this.ctx.currentTime-.3)this.nextTime=this.ctx.currentTime+.05;
    if(this.mode==='morning'){this.morning();return;}
    const eighth=60/74/2;
    if(this.nextTime<this.ctx.currentTime-.3)this.nextTime=this.ctx.currentTime+.05;
    const chords=[[52,55,59,62,66],[45,55,59,61,66],[50,57,61,64,69],[43,54,57,59,62]];
    while(this.nextTime<this.ctx.currentTime+.35){
      const s=this.step,t=this.nextTime+(s%2?.027:0),chord=chords[Math.floor(s/16)%chords.length],b=s%8;
      if(s%16===0)chord.slice(1).forEach((n,i)=>this.note(n,t+i*.014,5.2,.13));
      if(b===0||b===4){this.kick(t);this.note(chord[0]-12,t,.8,.27);}
      if(b===2||b===6)this.brush(t,.48);else if(b%2===1)this.brush(t,.16);
      if(s%16===11)this.note(chord[3]+12,t,1.5,.1);
      if(s%16===14)this.note(chord[2]+12,t,1.3,.075);
      this.step++;this.nextTime+=eighth;
    }
  }
  async pause(){if(this.ctx?.state==='running')await this.ctx.suspend();}
  async resume(){if(this.enabled&&this.ctx){await this.ctx.resume();this.nextTime=this.ctx.currentTime+.08;}}
}
