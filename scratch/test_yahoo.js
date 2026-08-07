const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test() {
  try {
    console.log('Testing AAPL...');
    const resAAPL = await yahooFinance.quote('AAPL');
    console.log('AAPL price:', resAAPL.regularMarketPrice, resAAPL.shortName);

    console.log('Testing BMRI.JK...');
    const resBMRI = await yahooFinance.quote('BMRI.JK');
    console.log('BMRI.JK price:', resBMRI.regularMarketPrice, resBMRI.shortName, resBMRI.currency);
  } catch (err) {
    console.error('Yahoo Finance Error:', err);
  }
}

test();
