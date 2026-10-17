import { chooseMove, type BotLevel } from '../core/bot/search';

// Runs the bot off the main thread so the board stays responsive on phones.

interface Request {
  id: number;
  fen: string;
  level: BotLevel;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, fen, level } = e.data;
  const move = chooseMove(fen, level, { random: Math.random, now: () => performance.now() });
  self.postMessage({ id, uci: move?.uci ?? null });
};
