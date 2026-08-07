const mysql = require('mysql2/promise');

async function testTrending() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  const [rows] = await conn.query("SELECT value FROM system_settings WHERE key = 'tmdb_api_key'");
  const apiKey = rows[0]?.value;
  await conn.end();

  console.log('TMDB Key:', apiKey);
  const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`);
  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('Trending movies count:', data?.results?.length);
  if (data?.results?.[0]) {
    console.log('Sample movie:', {
      id: data.results[0].id,
      title: data.results[0].title,
      vote_average: data.results[0].vote_average,
      poster_path: data.results[0].poster_path,
    });
  }
}

testTrending().catch(console.error);
