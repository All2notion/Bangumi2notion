// 验证必要的环境变量
export function validateEnvironmentVariables() {
  const BANGUMI_USERNAME = process.env.BANGUMI_USERNAME;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
  
  const requiredEnvVars = [
    { name: 'BANGUMI_USERNAME', value: BANGUMI_USERNAME },
    { name: 'NOTION_API_KEY', value: NOTION_API_KEY },
    { name: 'NOTION_DATABASE_ID', value: NOTION_DATABASE_ID }
  ];

  const missingVars = requiredEnvVars.filter(v => !v.value);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach(v => console.error(`- ${v.name}`));
    process.exit(1);
  }
  
  return {
    BANGUMI_USERNAME,
    NOTION_API_KEY,
    NOTION_DATABASE_ID
  };
}
