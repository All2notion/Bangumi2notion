import { Client } from '@notionhq/client';

// 带重试机制的Notion API调用
async function notionApiWithRetry(apiCall, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i < retries - 1) {
        console.warn(`Notion API error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// 确保Notion数据库存在必要的属性
export async function ensureDatabaseProperties(notion, databaseId) {
  try {
    const database = await notionApiWithRetry(() => notion.databases.retrieve({ database_id: databaseId }));
    
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
      try {
        await notionApiWithRetry(() => notion.databases.update({
          database_id: databaseId,
          properties: propertiesToAdd
        }));
        console.log(`Added ${Object.keys(propertiesToAdd).length} properties to the database`);
      } catch (error) {
        console.error('Error updating database properties:', error);
        // 继续执行，不中断整个同步过程
      }
    }

    // 检查是否已存在画廊视图
    const existingGalleryView = database.views.find(view => 
      view.type === 'gallery' && view.name === '画廊视图'
    );

    // 只有在不存在画廊视图时才添加
    if (!existingGalleryView) {
      try {
        await notionApiWithRetry(() => notion.databases.update({
          database_id: databaseId,
          views: [
            ...database.views,
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
        }));
        console.log('Added gallery view to the database');
      } catch (error) {
        console.error('Error updating database views:', error);
        // 继续执行，不中断整个同步过程
      }
    }
  } catch (error) {
    console.error('Error ensuring database properties:', error);
    // 不抛出错误，允许同步过程继续
  }
}

// 创建或更新Notion页面
export async function createOrUpdateNotionPage(notion, databaseId, anime) {
  try {
    // 检查是否已存在该番剧的页面
    const response = await notionApiWithRetry(() => notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Bangumi ID',
        number: {
          equals: anime.id
        }
      }
    }));

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
      await notionApiWithRetry(() => notion.pages.update({
        page_id: existingPage.id,
        properties: properties,
        cover: cover
      }));
      console.log(`Updated page for ${anime.name}`);
    } else {
      // 创建新页面
      await notionApiWithRetry(() => notion.pages.create({
        parent: {
          database_id: databaseId
        },
        properties: properties,
        cover: cover
      }));
      console.log(`Created page for ${anime.name}`);
    }
  } catch (error) {
    console.error(`Error creating/updating page for ${anime.name}:`, error);
    // 继续执行，不中断整个同步过程
  }
}

// 初始化Notion客户端
export function initNotionClient(apiKey) {
  return new Client({
    auth: apiKey,
  });
}
