const mysql = require('mysql2/promise');

async function testApiKeys() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  const [rows] = await conn.query('SELECT * FROM system_settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  await conn.end();

  console.log('=== TESTING FINNHUB API KEY ===');
  console.log('Finnhub Key:', settings.finnhub_api_key);
  try {
    const finnhubRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${settings.finnhub_api_key}`);
    console.log('Finnhub HTTP Status:', finnhubRes.status);
    const finnhubData = await finnhubRes.json();
    console.log('Finnhub AAPL Quote Response:', finnhubData);
  } catch (e) {
    console.error('Finnhub Fetch Error:', e);
  }

  console.log('\n=== TESTING TMDB API KEY ===');
  console.log('TMDB Key:', settings.tmdb_api_key);
  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?query=Inception&api_key=${settings.tmdb_api_key}`);
    console.log('TMDB HTTP Status:', tmdbRes.status);
    const tmdbData = await tmdbRes.json();
    console.log('TMDB Results count:', tmdbData?.results?.length);
  } catch (e) {
    console.error('TMDB Fetch Error:', e);
  }

  console.log('\n=== TESTING NEWSAPI / GNEWS API KEY ===');
  console.log('News Key:', settings.newsapi_key);
  try {
    const gnewsRes = await fetch(`https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=5&apikey=${settings.newsapi_key}`);
    console.log('GNews HTTP Status:', gnewsRes.status);
    const gnewsData = await gnewsRes.json();
    console.log('GNews Response:', gnewsData);
  } catch (e) {
    console.error('GNews Fetch Error:', e);
  }

  try {
    const newsApiRes = await fetch(`https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&apiKey=${settings.newsapi_key}`, {
      headers: { 'User-Agent': 'PersonalOS/1.0' }
    });
    console.log('NewsAPI.org HTTP Status:', newsApiRes.status);
    const newsApiData = await newsApiRes.json();
    console.log('NewsAPI.org Response Status:', newsApiData?.status, 'Total Results:', newsApiData?.totalResults, 'Articles:', newsApiData?.articles?.length);
  } catch (e) {
    console.error('NewsAPI.org Fetch Error:', e);
  }
}

testApiKeys().catch(console.error);
