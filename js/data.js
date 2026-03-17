// js/data.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js'; 
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ... (中间所有函数 fetchAllWishes, fetchUserWishes 等保持不变) ...
export async function fetchAllWishes() {
    const { data, error } = await _supabase
        .from('wishes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function fetchUserWishes(userId) {
    if (!userId) return [];
    const { data, error } = await _supabase
        .from('wishes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createWish(content, nickname, userId) {
    const { data, error } = await _supabase
        .from('wishes')
        .insert([{
            content: content,
            username: nickname,
            user_id: userId,
            created_at: new Date().toISOString()
        }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteWish(id) {
    const { error } = await _supabase.from('wishes').delete().eq('id', id);
    if (error) throw error;
}

// ⬇️⬇️⬇️ 新增这一行：导出 supabase 实例，供 app.js 上传头像使用 ⬇️⬇️⬇️
export { _supabase as supabase };


