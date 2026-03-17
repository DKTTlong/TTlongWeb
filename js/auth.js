// js/auth.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 注意：这里必须用 const 或 let，不能用 var
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getSession() {
    const { data: { session }, error } = await _supabase.auth.getSession();
    if (error) throw error;
    return session;
}

export function onAuthStateChange(callback) {
    return _supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

export async function sendMagicLink(email) {
    const { error } = await _supabase.auth.signInWithOtp({ email });
    if (error) throw error;
}

export async function signInWithPassword(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
}

export async function signUpWithPassword(email, password) {
    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
}

export async function signOut() {
    const { error } = await _supabase.auth.signOut();
    if (error) throw error;
}

export function getCurrentUser() {
    return _supabase.auth.getUser().then(({ data: { user } }) => user);
}