import { fetchWithRetry } from '../utils/request.js';

// Bangumi API基础URL
const BANGUMI_API_BASE = 'https://api.bgm.tv/v0';

// 获取用户的动漫列表
export async function getUserAnimeList(username) {
  const statuses = ['wish', 'watching', 'watched'];
  const allAnime = [];

  for (const status of statuses) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await fetchWithRetry(`${BANGUMI_API_BASE}/users/${username}/collections/anime?status=${status}&limit=25&offset=${(page - 1) * 25}`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          allAnime.push(...data.data.map(item => ({
            ...item.subject,
            collection_status: status,
            collection_episodes: item.ep_status
          })));
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching anime list for status ${status}:`, error);
        hasMore = false;
      }
    }
  }

  return allAnime;
}

// 获取番剧详细信息
export async function getAnimeDetails(animeId) {
  try {
    const response = await fetchWithRetry(`${BANGUMI_API_BASE}/subjects/${animeId}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching anime details for ID ${animeId}:`, error);
    throw error;
  }
}
