const red = "#E53C54";
const green = "#3ebb90";
const blue = "#3e99d3";
const availableFeeds = {
    "rise": "https://explorer.rise.vision/api/getPriceTicker?",
    "cmc": "https://api.coinmarketcap.com/v1/ticker/rise/?convert=EUR"
};
const walletAPIUrl = "https://explorer.rise.vision/api/getAccount?address=";
const MINUTE = 60000;
let timer;

const { browserAction: badge, storage } = chrome;

const prepareValue = value => {
  let v = parseFloat(value);
  if (v >= 100) {
    v = v.toFixed(0);
  } else if (v >= 10){
    v = v.toFixed(1);
  } else {
    v = v.toFixed(2);
  }
  return v.toString();
};

const updateBalance = addressJSON => {
  storage.sync.set({errors: false});
  storage.sync.set({balance: addressJSON.balance});
};
const checkWallet = wallet => {
  wallet = String(wallet).toUpperCase();
  if(wallet && /\d\R/.test(wallet)) return getBalance(wallet);
  const errors = {
    "wallet": "Wallet address is not valid"
  };

  storage.sync.set({errors: errors});
};
const validateWallet = (res, wallet) => {
  if(res.success) {
    storage.sync.set({wallet: wallet});
    return res;
  } else {
    throw new Error(res.error);
  }
};
const processErrors = error => {
  const errors = {
    "wallet": error.message
  };

  storage.sync.set({errors: errors});
};

const getBalance = wallet => {
  return fetch(walletAPIUrl + wallet)
  .then(res => res.status === 200 && res.json())
  .then(res => validateWallet(res, wallet))
  .then(updateBalance)
  .catch(processErrors);
};


const getColor = (oldV, newV) =>
  newV > oldV ? green : newV === oldV ? blue : red;

const updateData = value => {
  storage.sync.get(["feed"], ({feed}) => {
    if (feed === "rise") {
      return storage.sync.set({data: value.tickers.RISE});
    }

    let tickers = {};
    for (let key in value[0]) {
      if (key.indexOf("price_") > -1) {
        tickers[key.replace("price_", "").toUpperCase()] = value[0][key];
      }
    }
    return storage.sync.set({data: tickers});
  });
};


const receiveData = ({oldValue, newValue}) => {
  storage.sync.get(['select'], ({select}) => {
    let selected = (select && !!newValue[select]) ? select : 'USD';
    if (!oldValue) {
      updateTicker(newValue, newValue, selected);
    } else {
      updateTicker(newValue, oldValue, selected);
    }
  });
};

const receiveSelect = selected => {
  storage.sync.get(['data'], ({data}) => {
    updateTicker(data, data, selected)
  });
};

const receiveFeed = feed => parseFeedData(feed);

storage.onChanged.addListener(({feed, select, data, wallet}) => {
  if (data) {
    return receiveData(data);
  }

  if(wallet) {
    return checkWallet(wallet.newValue);
  }


  if (feed) {
    return receiveFeed(feed.newValue);
  }
  if (select) {
    return receiveSelect(select.newValue);
  }
});

const updateTicker = (newData, oldData, selected) => {
  let originalValue;
  let preparedValue;
  if(newData) {
    if (selected === "BTC") {
      originalValue = (Number(newData[selected]) * 1000).toFixed(6).toString();
      preparedValue = prepareValue(newData[selected] * 1000);
    } else {
      originalValue = Number(newData[selected])
      .toFixed(6)
      .toString();
      preparedValue = prepareValue(newData[selected]);
    }
    badge.setBadgeText({text: preparedValue});
    badge.setTitle({title: originalValue });
    badge.setBadgeBackgroundColor({ color: getColor(oldData[selected], newData[selected])});
  }

};

const getData = API => {
  return fetch(API)
    .then(res => res.status === 200 && res.json())
    .then(updateData);
};

const loop = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    populateFeedData();
    loop();
  }, MINUTE);
};

const populateFeedData = () => {
  storage.sync.get(["feed", "wallet"], ({feed, wallet}) => parseFeedData(feed) && checkWallet(wallet));
};

const parseFeedData = feed => {
  if(availableFeeds.hasOwnProperty(feed)) {
    storage.sync.set({feed: feed});
    return getData(availableFeeds[feed]);
  } else {
    storage.sync.set({feed: "rise"});
    return getData(availableFeeds.rise);
  }
};

populateFeedData();
loop();
