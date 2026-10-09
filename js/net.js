/* Grok Blocks - online co-op (PeerJS via grok-net, host-authoritative) */
(function () {
'use strict';
const GB = window.GB, GN = window.GrokNet, G = GB.G, GS = G.GS, Sim = GB.Sim, Snd = GB.Snd, $ = (id) => document.getElementById(id);
const N = G.N = { room: null, sendT: 0, fromHub: false };
N.isHost = () => !N.room || N.room.isHost;
function msg(t, ok) { const e = $('onlineMsg'); if (e) { e.textContent = t || ''; e.className = 'msg' + (ok ? ' ok' : ''); } }
function syncPlayers() {
  if (!N.room) return; const ids = {};
  N.room.players().forEach((p) => { if (p.pid === GS.pid) return; ids[p.pid] = 1; const o = GS.others[p.pid] = GS.others[p.pid] || {}; o.name = p.name; o.color = p.color; });
  for (const k in GS.others) if (!ids[k]) { delete GS.others[k]; if (N.room.isHost) Sim.removePlayer(k); }
  G.UI && G.UI.hud();
}
function common(room) {
  room.on('players', () => { if (N.room === room) syncPlayers(); });
  room.on('join', (p) => { if (N.room !== room) return; G.toast(p.name + (G.isPoach() ? ' joined your crew! \uD83D\uDCE6' : ' joined the rescue! \uD83E\uDD81')); Snd.fx('join'); if (room.isHost) { Sim.addPlayer(p.pid); room.sendTo(p.pid, { t: 'map', map: Sim.W().map, o: { caseId: Sim.W().caseId, night: Sim.W().night ? 1 : 0, seed: Sim.W().seed }, snap: Sim.pack() }); } });
  room.on('leave', (p) => { if (N.room !== room) return; G.toast(p.name + (G.isPoach() ? ' left. The job goes on!' : ' left. The rescue goes on!')); Snd.fx('leave'); delete GS.others[p.pid]; if (room.isHost) Sim.removePlayer(p.pid); });
}
function startUI() { GS.ui = 'game'; G.UI.show(); G.loop(); }
N.host = function (code) {
  N.leave(true); msg('Opening a room\u2026', true);
  const room = N.room = GN.createRoom({ role: 'host', code: code || undefined, name: G.myName(), color: G.save().color, autoCode: !code, rejoin: !!code, max: 3, pid: GS.pid });
  common(room);
  room.on('status', (t) => { if (!room.opened) msg(t, true); });
  room.on('open', () => {
    if (N.room !== room) return; GN.saveProfile(G.myName(), G.save().color); GS.role = 'host'; Snd.fx('join');
    G.UI.codeBadge(room.code);
    if (GS.ui !== 'game') { G.startMode(GS.mode === 'poacher' ? 'poacher' : 'ranger'); }
    syncPlayers();
  });
  room.on('message', (d, from) => {
    if (!d || N.room !== room || from === GS.pid) return;
    if (d.t === 'in') { Sim.input(from, d); }
    else if (d.t === 'pos') { const pl = Sim.W().players[from]; if (pl && pl.onFoot) { pl.x = +d.x || 0; pl.z = +d.z || 0; pl.ang = +d.a || 0; pl.crouch = !!d.c; pl.y = Sim.W().M.h(pl.x, pl.z); } }
    else if (d.t === 'act') { if (d.a === 'interact') G.interact(from); else { Sim.act(from, String(d.a), { ang: +d.ang || 0 }); const ev = Sim.takeEvents(); if (ev.length) { G.onEvents(ev); N.bcast({ t: 'ev', l: ev }); } } }
  });
  room.on('error', (e) => { if (N.room !== room) return; if (!room.opened) { N.room = null; msg(e.title + ': ' + e.message); } else G.toast(e.title, true); });
  room.start();
};
N.join = function (code) {
  code = GN.normalizeCode(code); if (!GN.validCode(code)) { msg('Enter the 5-letter room code.'); return; }
  N.leave(true); msg('Joining room ' + code + '\u2026', true);
  const room = N.room = GN.createRoom({ role: 'join', code, name: G.myName(), color: G.save().color, pid: GS.pid, rejoin: !!N.fromHub });
  common(room);
  room.on('status', (t) => { if (!room.opened) msg(t, true); });
  room.on('open', () => { if (N.room !== room) return; GN.saveProfile(G.myName(), G.save().color); GS.role = 'client'; msg('Connected! Waiting for the host\u2026', true); Snd.fx('join'); G.UI.codeBadge(room.code); });
  room.on('message', (d) => {
    if (!d || N.room !== room) return;
    if (d.t === 'map') { if (GS.ui !== 'game') G.resetSession(); G.applySnap(d.snap); Sim.resetPlayers(); GS.me = Sim.addPlayer(GS.pid); G.enterLocal(Sim.W()); startUI(); G.UI.closeAll(); }
    else if (d.t === 's') { G.applySnap(d.s); if (d.pl) for (const k in d.pl) { if (k === GS.pid) { const p = Sim.W().players[GS.pid]; if (p && d.pl[k]) { const q = d.pl[k], far = Math.hypot(q.x - p.x, q.z - p.z) > 6; p.farN = far ? (p.farN || 0) + 1 : 0; if (!q.f || !p.onFoot || p.farN > 4) { p.x = q.x; p.z = q.z; p.ang = q.a; } p.onFoot = !!q.f; p.crouch = !!q.c; } continue; } const o = GS.others[k] = GS.others[k] || { name: 'Ranger', color: '#3ff0ff' }; o.s = d.pl[k]; } }
    else if (d.t === 'ev') G.onEvents(d.l || []);
  });
  room.on('reconnecting', () => G.toast('Lost the host \u2014 reconnecting\u2026', true));
  room.on('error', (e) => {
    if (N.room !== room) return;
    if (!room.opened) { N.room = null; msg(e.title + ': ' + e.message); return; }
    N.room = null; try { room.leave(); } catch (er) { /* ignore */ }
    for (const k in GS.others) delete GS.others[k]; G.UI.codeBadge(null);
    G.toast(G.isPoach() ? 'The host left \u2014 you keep the job going solo.' : 'The host left \u2014 you keep the case going solo.', true); GS.role = 'solo';
    if (Sim.W().M) {
      const s = Sim.pack(), me0 = Sim.W().players[GS.pid];
      Sim.load(s.map, { caseId: s.caseId, night: s.night, seed: s.seed, mode: s.mode, jobId: s.jobId || null, heat: s.heat });
      Sim.unpack(s); GS.mode = Sim.W().mode;
      // the host's truck seats are gone with the host: everyone is on foot, the truck stays put
      if (Sim.W().truck) Sim.W().truck.seats = [null, null, null];
      Sim.resetPlayers(); const me = Sim.addPlayer(GS.pid);
      if (me0) { me.x = me0.x; me.z = me0.z; me.ang = me0.ang; me.y = Sim.W().M.h(me.x, me.z); }
      GS.me = me; if (Sim.W().mode === 'poacher') GS.jobId = Sim.W().jobId; else GS.caseId = Sim.W().caseId;
      G.UI.hud();
    }
  });
  room.start();
};
N.leave = function (silent) { const r = N.room; N.room = null; if (r) try { r.leave(); } catch (e) { /* ignore */ } for (const k in GS.others) delete GS.others[k]; GS.role = 'solo'; G.UI && G.UI.codeBadge(null); if (!silent) msg(''); };
N.tick = function (dt) {
  if (!N.room || !N.room.opened || !N.room.isHost) return;
  N.sendT -= dt; if (N.sendT > 0) return; N.sendT = 1 / 12;
  const W = Sim.W(), pl = {};
  for (const id in W.players) { const p = W.players[id]; if (String(id).indexOf('crew') === 0) continue; pl[id] = { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, a: Math.round(p.ang * 100) / 100, f: p.onFoot ? 1 : 0, c: p.crouch ? 1 : 0 }; }
  N.room.broadcast({ t: 's', s: Sim.pack(), pl });
};
N.send = (m) => { if (N.room) N.room.send(m); };
N.bcast = (m) => { if (N.room && N.room.isHost) N.room.broadcast(m); };
N.hubCheck = function () {
  const prm = GN.params(); if (!prm) return false;
  N.fromHub = true; const sv = G.save(); sv.name = prm.name; sv.color = prm.color; G.persist();
  if (prm.mode === 'host') N.host(prm.code); else N.join(prm.code);
  GS.ui = 'online'; G.UI.show(); return true;
};
N.bind = function () {};
})();
