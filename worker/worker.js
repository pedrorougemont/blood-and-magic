// Cloudflare Worker & Durable Object entry point for Blood & Magic Web Port
// Supports static asset hosting via Cloudflare Workers Assets + Durable Object room state/lockstep relay

export class BamGameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, server);

      server.addEventListener('message', async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SAVE_STATE') {
            await this.ctx.storage.put('latestState', msg.state);
            server.send(JSON.stringify({ type: 'SAVED', ts: Date.now() }));
          } else if (msg.type === 'ACTION_PACKET') {
            // Relay lockstep action packet (BAMActionPacket) to peers in room
            for (const [id, peer] of this.sessions.entries()) {
              if (id !== sessionId) {
                peer.send(JSON.stringify({ type: 'ACTION_PACKET', packet: msg.packet }));
              }
            }
          }
        } catch (err) {
          server.send(JSON.stringify({ type: 'ERROR', message: String(err) }));
        }
      });

      server.addEventListener('close', () => {
        this.sessions.delete(sessionId);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/api/room/state') {
      if (request.method === 'POST') {
        const body = await request.json();
        await this.ctx.storage.put('latestState', body);
        return Response.json({ ok: true, savedAt: Date.now() });
      }
      const state = (await this.ctx.storage.get('latestState')) || null;
      return Response.json({ ok: true, state });
    }

    return Response.json({
      ok: true,
      room: 'BamGameRoom Durable Object active',
      connectedPeers: this.sessions.size,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/room')) {
      const roomName = url.searchParams.get('room') || 'default-9110';
      const id = env.BAM_GAME_ROOM.idFromName(roomName);
      const stub = env.BAM_GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        game: 'Blood & Magic (1996) Browser-Native Prototype',
        maps: [9110, 9155],
      });
    }

    return env.ASSETS.fetch(request);
  },
};
