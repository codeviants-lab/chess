import { localTransport } from './local';
import { supabaseTransport } from './supabase';
import type { Transport } from './transport';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase when configured (production), otherwise same-browser tabs (local development). */
export const transport: Transport = url && key ? supabaseTransport(url, key) : localTransport;

/**
 * Online modes need Supabase to reach another device. In development the same-browser transport stands in;
 * a production build without Supabase keys shows the online modes as "coming soon" instead.
 */
export const onlineAvailable: boolean = transport.kind === 'supabase' || import.meta.env.DEV;
