import { request as sendHttp } from 'node:http';
import { request as sendHttps } from 'node:https';
import { GoogleGenAI } from '@google/genai';
export async function collect(url: string, client: GoogleGenAI) {
  const requester = url.startsWith('https:') ? sendHttps : sendHttp;
  requester(url);
  sendHttps('https://example.net/data');
  await client.interactions.create({ prompt: 'x' });
}
