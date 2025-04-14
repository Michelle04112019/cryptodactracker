let cryptosData = [];
let currentLanguage = 'fr';
let usdToCurrencyRate = 1; // Taux de conversion USD -> Devise choisie
let currencySymbol = "$"; // Symbole de la devise

const adviceLabels = {
    fr: {
        buy: "📈 Renforcer",
        hold: "⏳ Conserver",
        sell: "❗ Vendre",
        lowPrice: "📉 Prix min. (7j)",
        investRanges: "💸 Tranches suggérées",
        confidence: "Confiance",
        chartLink: "Voir le graphique",
        tradingBadge: "🎯 Trading possible"
    },
    en: {
        buy: "📈 Accumulate",
        hold: "⏳ Hold",
        sell: "❗ Sell",
        lowPrice: "📉 Lowest Price (7d)",
        investRanges: "💸 Suggested Ranges",
        confidence: "Confidence",
        chartLink: "View Chart",
        tradingBadge: "🎯 Trading Opportunity"
    }
};

// Fonction pour obtenir le prix le plus bas des 7 derniers jours
function getLowestPriceLast7Days(sparkline) {
    if (!sparkline || !Array.isArray(sparkline.price) || sparkline.price.length === 0) return null;
    return Math.min(...sparkline.price);
}

// Fonction pour obtenir les tranches d'investissement suggérées
function getInvestmentRanges(price, currency) {
    const isBtc = currency === 'btc';
    if (isBtc) {
        if (price < 0.0001) return ['0.00001 BTC', '0.00005 BTC', '0.0001 BTC'];
        if (price < 0.001) return ['0.0001 BTC', '0.0005 BTC', '0.001 BTC'];
        if (price < 0.01) return ['0.001 BTC', '0.005 BTC', '0.01 BTC'];
        return ['0.01 BTC', '0.05 BTC', '0.1 BTC'];
    } else {
        // Ajuster les tranches en fonction de la devise (USD ou EUR)
        const currencySymbol = currency === 'usd' ? '$' : '€';
        if (price < 5) return [`${currencySymbol}50`, `${currencySymbol}100`, `${currencySymbol}150`];
        if (price < 50) return [`${currencySymbol}100`, `${currencySymbol}200`, `${currencySymbol}300`];
        if (price < 500) return [`${currencySymbol}250`, `${currencySymbol}500`, `${currencySymbol}750`];
        return [`${currencySymbol}500`, `${currencySymbol}1000`, `${currencySymbol}1500`];
    }
}

// Fonction pour analyser les cryptos
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

// Fonction pour vérifier si une crypto est hautement volatile
function isHighlyVolatile(coin) {
    return Math.abs(coin.price_change_percentage_24h_in_currency || 0) > 5;
}

// Fonction pour obtenir la couleur de confiance
function getConfidenceColor(confidence) {
    if (confidence >= 80) return 'green';
    if (confidence >= 50) return 'orange';
    return 'red';
}

// Fonction pour récupérer le taux de conversion USD -> Devise choisie (ex: EUR, BTC, etc.)
async function fetchUsdToCurrencyRate(currency) {
    if (currency === 'usd') {
        usdToCurrencyRate = 1;
        currencySymbol = '$';
        return;
    }
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=${currency}`);
        const data = await res.json();
        usdToCurrencyRate = data.usd[currency] || 1;
        currencySymbol = currency === 'eur' ? '€' : '$'; // Ajuste le symbole en fonction de la devise
    } catch (err) {
        console.error("Erreur conversion USD ->", currency, err);
        usdToCurrencyRate = 1;
        currencySymbol = '$';
    }
}

// Fonction pour changer la langue de l'interface
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

// Fonction pour récupérer les cryptos
async function fetchTopCryptos(currency = 'usd') {
    const container = document.getElementById('crypto-container');
    container.innerHTML = "<p>Chargement des données...</p>";
    await fetchUsdToCurrencyRate(currency); // Ajout du taux de conversion

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d`);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        cryptosData = data;
        displayCryptos(data, currency);
    } catch (error) {
        container.innerHTML = "<p>Erreur lors du chargement des données.</p>";
        console.error("API fetch error:", error);
    }
}

// Fonction pour afficher les cryptos
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
        const convertedLowest = rawLowest * usdToCurrencyRate; // Appliquer le taux de conversion
        const lowestFormatted = currency === 'btc'
            ? `${convertedLowest.toFixed(8)} BTC`
            : `${convertedLowest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`;

        const investmentText = getInvestmentRanges(convertedLowest, currency).join(', ');

        const analysis = analyzeCrypto(coin);
        const showTrading = isHighlyVolatile(coin);

        card.innerHTML = `
            <div class="card-header">
                <img src="${coin.image}" alt="Logo de ${coin.name}" width="32" height="32">
                <div>
                    <div class="crypto-name">${coin.name} <span class="crypto-symbol">(${coin.symbol.toUpperCase()})</span></div>
                </div>
            </div>
            <div class="crypto-price">💰 ${currentFormatted} ${currency.toUpperCase()}</div>
            <div class="crypto-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                ${coin.price_change_percentage_24h.toFixed(2)}% (24h)
            </div>
            <div class="crypto-lowest" title="${adviceLabels[currentLanguage].lowPrice}">${adviceLabels[currentLanguage].lowPrice} : ${lowestFormatted}</div>
            <div class="crypto-invest">${adviceLabels[currentLanguage].investRanges} : ${investmentText}</div>
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

// Fonction de recherche
document.getElementById('search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = cryptosData.filter(coin =>
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)
    );
    displayCryptos(filtered, document.getElementById('currency').value);
});

// Gestion de la devise sélectionnée
document.getElementById('currency').addEventListener('change', (e) => {
    fetchTopCryptos(e.target.value);
});

// Changement de thème
document.getElementById('toggle-theme').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

// Changement de langue
document.getElementById('toggle-language').addEventListener('click', () => {
    const newLang = currentLanguage === 'fr' ? 'en' : 'fr';
    changeLanguage(newLang);
});

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const savedLanguage = localStorage.getItem('language');
    if (savedTheme === 'light') {
        document.body.classList.add('light');
    }
    changeLanguage(savedLanguage || 'fr');
    fetchTopCryptos();
});

// Actualisation régulière des cryptos
setInterval(() => {
    const currency = document.getElementById('currency').value;
    fetchTopCryptos(currency);
}, 60000);
