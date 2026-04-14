import { validateEnvironmentVariables } from './src/utils/config.js';
import { getUserAnimeList } from './src/api/bangumi.js';
import { initNotionClient, ensureDatabaseProperties, createOrUpdateNotionPage } from './src/api/notion.js';

// 验证环境变量
const config = validateEnvironmentVariables();

// 初始化Notion客户端
const notion = initNotionClient(config.NOTION_API_KEY);

// 主同步函数
async function syncBangumiToNotion() {
  try {
    console.log('Starting sync process...');

    // 确保数据库属性正确
    await ensureDatabaseProperties(notion, config.NOTION_DATABASE_ID);

    // 获取用户动漫列表
    const animeList = await getUserAnimeList(config.BANGUMI_USERNAME);
    console.log(`Found ${animeList.length} anime in user's collection`);

    // 处理每个番剧
    for (const anime of animeList) {
      console.log(`Processing ${anime.name} (${anime.id})`);
      await createOrUpdateNotionPage(notion, config.NOTION_DATABASE_ID, anime);
    }

    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

// 执行同步
syncBangumiToNotion();
