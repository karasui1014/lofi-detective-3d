export const ANOMALIES = Object.freeze([
  { id:'cat_double', title:'ふたりのシャム', target:'cat', description:'シャムの隣に、もう１匹。いつもの廊下にいる猫は１匹だけ。', easy:true },
  { id:'cat_missing', title:'いなくなった相棒', target:'cat', description:'窓のそばに座っていたシャムが、姿を消している。' },
  { id:'cat_shadow', title:'持ち主のない影', target:'cat', description:'シャムから離れた場所に、もうひとつの猫の影が伸びている。' },
  { id:'clock_upside', title:'ひっくり返った時間', target:'clock', description:'壁の時計が上下逆さまに。数字も針も、いつもと逆だ。', easy:true },
  { id:'clock_missing', title:'時間の空白', target:'clock', description:'テーブルの上の壁にあった、丸い時計が消えている。' },
  { id:'cup_giant', title:'大きすぎる一杯', target:'cup', description:'コーヒーカップが、いつもの倍近くの大きさになっている。', easy:true },
  { id:'cup_floating', title:'冷めないコーヒー', target:'cup', description:'カップとソーサーが、テーブルを離れて宙に浮いている。' },
  { id:'record_floating', title:'宙に浮く音楽', target:'record', description:'重たいレコードプレイヤーが、テーブルの上空に浮いている。' },
  { id:'window_red', title:'赤い雨の街', target:'window', description:'窓の外が、夜の青から不自然な赤色に変わっている。', easy:true },
  { id:'portrait_upside', title:'逆さまの探偵', target:'portrait', description:'探偵のポスターが、上下逆さまに貼られている。', easy:true },
  { id:'sign_changed', title:'探偵失踪所', target:'door', description:'ドアの「月悠探偵事務所」が「月悠探偵失踪所」に変わっている。' },
  { id:'mirror_visitor', title:'鏡の中の来訪者', target:'mirror', description:'誰もいないはずの鏡の中に、探偵にそっくりな後ろ姿が映っている。' }
]);

export class Investigation {
  constructor(random = Math.random) {
    this.random = random;
    this.discovered = new Set();
    this.pool = [];
    this.phase = 'start';
    this.progress = 0;
    this.mistakes = 0;
    this.rounds = 0;
    this.current = null;
    this.lastResult = null;
    this.previousNormal = false;
  }
  briefing() {
    if (!['start','escaped'].includes(this.phase)) return false;
    this.phase = 'briefing';
    this.progress = 0;
    this.mistakes = 0;
    this.rounds = 0;
    this.current = null;
    this.lastResult = null;
    this.previousNormal = false;
    return true;
  }
  pick(list) { return list[Math.min(list.length-1,Math.floor(this.random()*list.length))]; }
  drawRound() {
    const normal = this.rounds > 0 && !this.previousNormal && this.random() < .38;
    this.previousNormal = normal;
    if (normal) this.current = null;
    else {
      if (!this.pool.length) this.pool = ANOMALIES.map(a=>a.id);
      let candidates = ANOMALIES.filter(a=>this.pool.includes(a.id));
      if (this.rounds === 0 && candidates.some(a=>a.easy)) candidates = candidates.filter(a=>a.easy);
      this.current = this.pick(candidates);
      this.pool = this.pool.filter(id=>id !== this.current.id);
    }
    this.rounds += 1;
    this.phase = 'playing';
    this.lastResult = null;
  }
  start() {
    if (this.phase !== 'briefing') return false;
    this.drawRound();
    return true;
  }
  answer(choice) {
    if (this.phase !== 'playing' || !['back','forward'].includes(choice)) return null;
    const correct = choice === (this.current ? 'back' : 'forward');
    if (this.current) this.discovered.add(this.current.id);
    this.progress = correct ? this.progress + 1 : 0;
    if (!correct) this.mistakes += 1;
    this.phase = this.progress === 6 ? 'escaped' : 'result';
    this.lastResult = { correct, anomaly:this.current, progress:this.progress, escaped:this.phase === 'escaped' };
    return this.lastResult;
  }
  next() {
    if (this.phase !== 'result') return false;
    this.drawRound();
    return true;
  }
}
