import fetch from 'node-fetch';
import { Client } from '@notionhq/client';

// 从环境变量读取配置
const BANGUMI_USERNAME = process.env.BANGUMI_USERNAME;
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

// 初始化Notion客户端
const notion = new Client({
  auth: NOTION_API_KEY,
});

// Bangumi API基础URL
const BANGUMI_API_BASE = 'https://api.bgm.tv/v0';

// 获取用户的动漫列表
async function getUserAnimeList(username) {
  const statuses = ['wish', 'watching', 'watched'];
  const allAnime = [];

  for (const status of statuses) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${BANGUMI_API_BASE}/users/${username}/collections/anime?status=${status}&limit=25&offset=${(page - 1) * 25}`);
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
    }
  }

  return allAnime;
}

// 获取番剧详细信息
async function getAnimeDetails(animeId) {
  const response = await fetch(`${BANGUMI_API_BASE}/subjects/${animeId}`);
  return await response.json();
}

// 确保Notion数据库存在必要的属性
async function ensureDatabaseProperties() {
  try {
    const database = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
    
    // 检查是否存在名为'番剧名称'的title属性
    const properties = database.properties;
    let hasTitleProperty = false;
    
    for (const [name, property] of Object.entries(properties)) {
      if (property.type === 'title' && name === '番剧名称') {
        hasTitleProperty = true;
        break;
      }
    }
    
    if (!hasTitleProperty) {
      console.warn('Warning: Database does not have a title property named "番剧名称".');
      console.warn('Please ensure your database has a title property with this name.');
    }
    
    // 检查并添加必要的属性（不包括title属性，因为Notion不允许通过更新添加title属性）
    const requiredProperties = {
      '中文名': { rich_text: {} },
      '话数': { number: {} },
      '放送时间': { date: {} },
      '状态': { select: {} },
      'Bangumi ID': { number: {} },
      '评分': { number: {} },
      '类型': { multi_select: {} },
      '标签': { multi_select: {} },
      '收藏状态': { select: {} }
    };

    const propertiesToAdd = {};
    for (const [name, config] of Object.entries(requiredProperties)) {
      if (!properties[name]) {
        propertiesToAdd[name] = config;
      }
    }

    if (Object.keys(propertiesToAdd).length > 0) {
      await notion.databases.update({
        database_id: NOTION_DATABASE_ID,
        properties: propertiesToAdd
      });
    }

    // 更新数据库视图为画廊视图
    await notion.databases.update({
      database_id: NOTION_DATABASE_ID,
      views: [
        {
          id: 'gallery',
          name: '画廊视图',
          type: 'gallery',
          gallery: {
            properties: {
              cover: {
                type: 'property',
                property: '封面'
              },
              caption: {
                type: 'property',
                property: '番剧名称'
              }
            }
          }
        }
      ]
    });
  } catch (error) {
    console.error('Error ensuring database properties:', error);
    throw error;
  }
}

// 创建或更新Notion页面
async function createOrUpdateNotionPage(anime) {
  // 检查是否已存在该番剧的页面
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      property: 'Bangumi ID',
      number: {
        equals: anime.id
      }
    }
  });

  const existingPage = response.results[0];

  // 准备页面属性
  const properties = {
    '番剧名称': {
      title: [
        {
          text: {
            content: anime.name
          }
        }
      ]
    },
    '中文名': {
      rich_text: [
        {
          text: {
            content: anime.name_cn || ''
          }
        }
      ]
    },
    '话数': {
      number: anime.eps
    },
    '放送时间': {
      date: anime.air_date ? {
        start: anime.air_date
      } : null
    },
    '状态': {
      select: {
        name: anime.status
      }
    },
    'Bangumi ID': {
      number: anime.id
    },
    '评分': {
      number: anime.rating?.score || null
    },
    '类型': {
      multi_select: anime.tags?.filter(tag => tag.category === 'genre').map(tag => ({
        name: tag.name
      })) || []
    },
    '标签': {
      multi_select: anime.tags?.filter(tag => tag.category !== 'genre').map(tag => ({
        name: tag.name
      })) || []
    },
    '收藏状态': {
      select: {
        name: {
          'wish': '想看',
          'watching': '在看',
          'watched': '看过'
        }[anime.collection_status]
      }
    }
  };

  // 上传封面图片
  let cover = null;
  if (anime.images?.large) {
    try {
      cover = {
        type: 'external',
        external: {
          url: anime.images.large
        }
      };
    } catch (error) {
      console.error('Error uploading cover image:', error);
    }
  }

  if (existingPage) {
    // 更新现有页面
    await notion.pages.update({
      page_id: existingPage.id,
      properties: properties,
      cover: cover
    });
  } else {
    // 创建新页面
    await notion.pages.create({
      parent: {
        database_id: NOTION_DATABASE_ID
      },
      properties: properties,
      cover: cover
    });
  }
}

// 主同步函数
async function syncBangumiToNotion() {
  try {
    console.log('Starting sync process...');

    // 确保数据库属性正确
    await ensureDatabaseProperties();

    // 获取用户动漫列表
    const animeList = await getUserAnimeList(BANGUMI_USERNAME);
    console.log(`Found ${animeList.length} anime in user's collection`);

    // 处理每个番剧
    for (const anime of animeList) {
      console.log(`Processing ${anime.name} (${anime.id})`);
      await createOrUpdateNotionPage(anime);
    }

    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

// 执行同步
syncBangumiToNotion();