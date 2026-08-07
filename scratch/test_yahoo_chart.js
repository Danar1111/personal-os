const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function test() {
  try {
    console.log('Testing chart for AAPL...');
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const chartAAPL = await yahooFinance.chart('AAPL', { period1: sevenDaysAgo, interval: '1d' });
    console.log('AAPL chart quotes count:', chartAAPL.quotes.length);
    console.log('AAPL first quote:', chartAAPL.quotes[0]);

    console.log('Testing chart for BMRI.JK...');
    const chartBMRI = await yahooFinance.chart('BMRI.JK', { period1: sevenDaysAgo, interval: '1d' });
    console.log('BMRI.JK chart quotes count:', chartBMRI.quotes.length);
    console.log('BMRI.JK first quote:', chartBMRI.quotes[0]);
  } catch (err) {
    console.error('Yahoo Chart Error:', err);
  }
}

test();
