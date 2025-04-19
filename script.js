let cryptosData = [];
let currentLanguage = 'fr';
let usdToCurrencyRate = 1;

const adviceLabels = {
    fr: {
        buy: "📈 Renforcer",
        hold: "⏳ Conserver",
        sell: "❗ Vendre",
        lowPrice: "📉 Prix min. (7j)",
        investRanges: "💸 Tranches suggérées",
        confidence: "Confiance",
        chartLink: "Voir le graphique",
        tradingBadge: "🎯 Trading possible",
        ma200: "📊 MA200",
        rsi: "📐 RSI",
        macd: "📊 MACD",
        macdBullish: "✅ MACD haussier",
        macdBearish: "❌ MACD baissier",
        macdNeutral: "➖ MACD neutre"
    },
    en: {
        buy: "📈 Accumulate",
        hold: "⏳ Hold",
        sell: "❗ Sell",
        lowPrice: "📉 Lowest Price (7d)",
        investRanges: "💸 Suggested Ranges",
        confidence: "Confidence",
        chartLink: "View Chart",
        tradingBadge: "🎯 Trading Opportunity",
        ma200: "📊 MA200",
        rsi: "📐 RSI",
        macd: "📊 MACD",
        macdBullish: "✅ Bullish MACD",
        macdBearish: "❌ Bearish MACD",
        macdNeutral: "➖ Neutral MACD"
    }
};

function getLowestPriceLast7Days(sparkline) {
    if (!sparkline || !Array.isArray(sparkline.price) || sparkline.price.length === 0) return null;
    return Math.min(...sparkline.price);
}

function getInvestmentRanges(price, currency) {
    if (currency === 'usd') {
        if (price < 5) return ['$50', '$100', '$150'];
        if (price < 50) return ['$100', '$200', '$300'];
        if (price < 500) return ['$250', '$500', '$750'];
        return ['$500', '$1000', '$1500'];
    } else if (currency === 'btc') {
        if (price < 0.0001) return ['0.0001 BTC', '0.0005 BTC', '0.001 BTC'];
        if (price < 0.001) return ['0.001 BTC', '0.005 BTC', '0.01 BTC'];
        if (price < 0.01) return ['0.01 BTC', '0.05 BTC', '0.1 BTC'];
        return ['0.1 BTC', '0.5 BTC', '1 BTC'];
    } else {
        if (price < 5) return ['50€', '100€', '150€'];
        if (price < 50) return ['100€', '200€', '300€'];
        if (price < 500) return ['250€', '500€', '750€'];
        return ['500€', '1000€', '1500€'];
    }
}


function analyzeCrypto(coin) {
    const change1h = coin.price_change_percentage_1h_in_currency || 0;
    const change24h = coin.price_change_percentage_24h_in_currency || 0;
    const change7d = coin.price_change_percentage_7d_in_currency || 0;
    const volumeToCapRatio = coin.total_volume / coin.market_cap;
    const volatility = Math.abs(change1h) + Math.abs(change24h) + Math.abs(change7d);

    let confidence = 50;
    let label = adviceLabels[currentLanguage].hold;
    let confidenceClass = 'neutral';

    if (change7d < -10 && volumeToCapRatio < 0.02) {
        label = adviceLabels[currentLanguage].sell;
        confidence = 85;
        confidenceClass = 'negative';
    } else if (change1h > 1 && change24h > 3 && change7d > 10 && volumeToCapRatio > 0.1 && volatility < 10) {
        label = adviceLabels[currentLanguage].buy;
        confidence = 90;
        confidenceClass = 'positive';
    } else if (change7d > 5 && volumeToCapRatio > 0.05) {
        label = adviceLabels[currentLanguage].buy;
        confidence = 70;
        confidenceClass = 'positive';
    } else if (volatility > 12 || (change7d < -5 && volumeToCapRatio < 0.03)) {
        label = adviceLabels[currentLanguage].hold;
        confidence = 40;
        confidenceClass = 'neutral';
    }

    return { label, confidence, confidenceClass };
}

function isHighlyVolatile(coin) {
    return Math.abs(coin.price_change_percentage_24h_in_currency || 0) > 5;
}

function getConfidenceColor(confidence) {
    if (confidence >= 80) return 'green';
    if (confidence >= 50) return 'orange';
    return 'red';
}

function getRSIColor(rsi) {
    if (rsi < 30) return 'green';
    if (rsi > 70) return 'red';
    return 'orange';
}

function calculateRSI(sparkline, period = 14) {
    if (!sparkline || !Array.isArray(sparkline.price) || sparkline.price.length < period + 1) return null;

    const prices = sparkline.price;
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change >= 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round(100 - (100 / (1 + rs)));
}

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    const emaArray = [ema];

    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
        emaArray.push(ema);
    }

    return emaArray;
}

function calculateMACD(sparkline) {
    if (!sparkline || !Array.isArray(sparkline.price) || sparkline.price.length < 35) return null;

    const prices = sparkline.price;
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12.slice(-ema26.length).map((val, idx) => val - ema26[idx]);
    const signalLine = calculateEMA(macdLine, 9);
    const latestMACD = macdLine[macdLine.length - 1];
    const latestSignal = signalLine[signalLine.length - 1];
    const histogram = latestMACD - latestSignal;

    return {
        macd: latestMACD.toFixed(2),
        signal: latestSignal.toFixed(2),
        histo: histogram.toFixed(2),
        trend: latestMACD > latestSignal ? 'bullish' : latestMACD < latestSignal ? 'bearish' : 'neutral'
    };
}

function getMockMA200(currentPrice) {
    const variation = (Math.random() * 0.2 - 0.1);
    return currentPrice * (1 + variation);
}

async function fetchUsdToCurrencyRate(currency) {
    if (currency === 'usd') {
        usdToCurrencyRate = 1;
        return;
    }
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=${currency}`);
        const data = await res.json();
        usdToCurrencyRate = data.usd[currency] || 1;
    } catch (err) {
        console.error("Erreur conversion USD ->", currency, err);
        usdToCurrencyRate = 1;
    }
}

async function displayCryptos(data, currency) {
    const container = document.getElementById('crypto-container');
    container.innerHTML = '';

    if (data.length === 0) {
        document.getElementById('error-message').style.display = 'block';
        return;
    }

    document.getElementById('error-message').style.display = 'none';

    for (const coin of data) {
        const card = document.createElement('div');
        card.className = 'card';
        const coinChartLink = `https://www.coingecko.com/fr/pièces/${coin.id}`;

        const currentFormatted = currency === 'btc' 
            ? coin.current_price.toFixed(8) 
            : coin.current_price.toLocaleString();

        const rawLowest = getLowestPriceLast7Days(coin.sparkline_in_7d) || coin.current_price;
        const convertedLowest = rawLowest * usdToCurrencyRate;
        const lowestFormatted = currency === 'btc'
            ? `${convertedLowest.toFixed(8)} BTC`
            : `${convertedLowest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;

        const investmentText = getInvestmentRanges(convertedLowest, currency).join(', ');
        const analysis = analyzeCrypto(coin);
        const showTrading = isHighlyVolatile(coin);

        const ma200Value = getMockMA200(coin.current_price) * usdToCurrencyRate;
        const ma200Formatted = currency === 'btc'
            ? `${ma200Value.toFixed(8)} BTC`
            : `${ma200Value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;

        const rsiValue = (Math.random() * 100).toFixed(1);
        let rsiColor = getRSIColor(rsiValue);

        const macdData = calculateMACD(coin.sparkline_in_7d);
        const macdText = macdData ? `${macdData.macd} / ${macdData.signal} / ${macdData.histo}` : 'N/A';
        const macdBadge = macdData
            ? `<div class="macd-badge">${adviceLabels[currentLanguage][
                macdData.trend === 'bullish' ? 'macdBullish' :
                macdData.trend === 'bearish' ? 'macdBearish' : 'macdNeutral'
            ]}</div>`
            : '';

        card.innerHTML = `
            <div class="card-header">
                <img src="${coin.image}" alt="Logo de ${coin.name}" width="32" height="32">
                <div><div class="crypto-name">${coin.name} <span class="crypto-symbol">(${coin.symbol.toUpperCase()})</span></div></div>
            </div>
            <div class="crypto-price">💰 ${currentFormatted} ${currency.toUpperCase()}</div>
            <div class="crypto-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                ${coin.price_change_percentage_24h.toFixed(2)}% (24h)
            </div>
            <div class="crypto-lowest">${adviceLabels[currentLanguage].lowPrice} : ${lowestFormatted}</div>
            <div class="crypto-invest">${adviceLabels[currentLanguage].investRanges} : ${investmentText}</div>
            <div class="crypto-ma200">${adviceLabels[currentLanguage].ma200} : ${ma200Formatted}</div>
            <div class="crypto-rsi">${adviceLabels[currentLanguage].rsi} : <span style="color:${rsiColor};">${rsiValue}</span></div>
            <div class="crypto-macd">${adviceLabels[currentLanguage].macd} : ${macdText}</div>
            ${macdBadge}
            ${showTrading ? `<div class="trading-badge">${adviceLabels[currentLanguage].tradingBadge}</div>` : ''}
            <div class="advice-badge ${analysis.confidenceClass}">${analysis.label}</div>
            <div class="confidence-label">
                <span class="confidence-indicator" style="background-color:${getConfidenceColor(analysis.confidence)};"></span>
                ${adviceLabels[currentLanguage].confidence} : ${analysis.confidence}%
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill ${analysis.confidence >= 80 ? 'green' : analysis.confidence >= 50 ? 'orange' : 'red'}" style="width: ${analysis.confidence}%;"></div>
            </div>
            <a href="${coinChartLink}" target="_blank" class="crypto-chart-link">${adviceLabels[currentLanguage].chartLink}</a>
        `;
        container.appendChild(card);
    }
}

async function fetchTopCryptos(currency = 'usd') {
    const container = document.getElementById('crypto-container');
    container.innerHTML = "<p>Chargement des données...</p>";

    await fetchUsdToCurrencyRate(currency);

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d`);
        if (!res.ok) throw new Error(`Erreur API : ${res.status} - ${res.statusText}`);
        const data = await res.json();
        cryptosData = data;
        displayCryptos(data, currency);
    } catch (error) {
        container.innerHTML = `<p>Erreur lors du chargement des données : ${error.message}</p>`;
        console.error("Erreur détaillée:", error);
    }
}

function changeLanguage(language) {
    currentLanguage = language;
    localStorage.setItem('language', language);

    document.getElementById('page-title').innerText = 'Crypto DAC Tracker';
    document.getElementById('main-title').innerText = currentLanguage === 'fr'
        ? 'Investissement Long Terme - Stratégie DAC'
        : 'Long-Term Investment - DAC Strategy';

    document.getElementById('search').placeholder = currentLanguage === 'fr'
        ? 'Rechercher une crypto...'
        : 'Search a crypto...';

    document.getElementById('error-message-text').innerText = currentLanguage === 'fr'
        ? 'Aucune crypto trouvée. Essayez une autre recherche.'
        : 'No crypto found. Try a different search.';

    document.getElementById('toggle-language').innerText = currentLanguage === 'fr' ? 'EN' : 'FR';
    document.getElementById('toggle-theme').innerText = currentLanguage === 'fr' ? '🌙 Mode' : '🌙 Dark Mode';

    fetchTopCryptos(document.getElementById('currency').value);
}

async function fetchFearGreedIndex() {
    try {
        const res = await fetch('https://api.alternative.me/fng/');
        const data = await res.json();
        const index = data.data[0];
        displayFearGreedIndex(index);
    } catch (err) {
        console.error("Erreur Crypto Fear & Greed Index:", err);
    }
}

function displayFearGreedIndex(index) {
    const container = document.getElementById('fear-greed-container');
    const emoji = {
        Extreme_Fear: "😱",
        Fear: "😨",
        Neutral: "😐",
        Greed: "😏",
        Extreme_Greed: "🚀"
    };

    const classification = index.value_classification.replace(" ", "_");
    container.innerHTML = `
        <div class="fear-greed">
            <strong>📊 Crypto Fear & Greed Index</strong><br>
            ${emoji[classification] || ""} ${index.value}/100 - ${index.value_classification}
        </div>
    `;
}

document.getElementById('search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = cryptosData.filter(coin =>
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)
    );
    displayCryptos(filtered, document.getElementById('currency').value);
});

document.getElementById('currency').addEventListener('change', (e) => {
    fetchTopCryptos(e.target.value);
});

document.getElementById('toggle-theme').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

document.getElementById('toggle-language').addEventListener('click', () => {
    const newLang = currentLanguage === 'fr' ? 'en' : 'fr';
    changeLanguage(newLang);
});

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const savedLanguage = localStorage.getItem('language');
    if (savedTheme === 'light') document.body.classList.add('light');
    changeLanguage(savedLanguage || 'fr');
    fetchTopCryptos();
    fetchFearGreedIndex();
});

setInterval(() => {
    const currency = document.getElementById('currency').value;
    fetchTopCryptos(currency);
    fetchFearGreedIndex();
}, 60000);
