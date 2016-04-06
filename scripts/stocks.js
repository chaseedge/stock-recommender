/* Stock Valuer
Author: Chase Edge
www.github.com/chaseedge

App uses data from capitalCube and Yahoo. It takes industry financial multiples and applies them to the Company to get a stock price.

Table of Contents
1. Initiation Function
2. Pulling in Data
3. Parsing Data
4. Calculating Peer Summary Stats
5. Calculting Target Price
6. HTML Output
*/



//1. Initiation Function
function tickerDiv() {
  var inputDiv = document.getElementById("ticker");
  var ticker = inputDiv.value.trim();
  ticker = ticker.toUpperCase();
  inputDiv.value = ticker;
  return inputDiv;
}

//main function
function getData() {
  var ticker = tickerDiv().value;
  var targetPrices = {};
  var compInfo = {};
  var multiples = {};
  var headlines = [];
  loadingMessage(true);

// Using promises instead of synchronous XHR
  infoRequest(buildLink(ticker, "quote")).then(function(data){
		parseQuote(data, compInfo);
    return infoRequest(buildLink(ticker, "stats")).then(function(data){
      parseStats(data, compInfo);
      return infoRequest(buildLink(ticker, "peers")).then(function(data){
        parsePeers(data, multiples, compInfo);
        return infoRequest(buildLink(ticker, "news")).then(function(data){
          parseNews(data, compInfo);
          calcTargetPrice(compInfo, multiples, targetPrices);
          htmlOutput(compInfo, multiples, targetPrices);
          loadingMessage(false);
          commentary(compInfo, targetPrices);
          console.log("FINISHED!");
        })
      })
    })
  }).catch(function(error) {
    alert("Error - Please try another ticker");
    console.log(error);
    loadingMessage(false);
    tickerDiv().focus();
    tickerDiv().select();
  });
}


//adds the "thinking...." to show while getting the data.
function loadingMessage(boolean) {
  var loadingDiv = document.getElementById("loading");
  var message = "Thinking<span>.</span><span>.</span><span>.</span>";
  if (boolean) {
    loadingDiv.innerHTML = message;
  } else {
    loadingDiv.innerHTML = "";
  }
}

//2. Pulling data
//functions that pull data in from two sources, yahoo and capitalCube
function buildLink(ticker, database){
  var link;
  if (database === "stats")
    link = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.keystats%20where%20symbol%20in%20('" + ticker + "')&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
  if (database === "quote")
    link = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20('" + ticker + "')&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
  if (database === "peers")
    link = "http://api.capitalcube.com/companies/" + ticker + "-us/reports/competition";
  if (database === "news") {
    link = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%27http%3A%2F%2Ffinance.yahoo.com%2Fq%3Fs%3D" + ticker +"%27%20and%20xpath%3D%27%2F%2Fdiv[%40id%3D%22yfi_headlines%22]%2Fdiv[2]%2Ful%2Fli%2Fa%27&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
  }
  return link;
}

function infoRequest (url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject({statusText: xhr.statusText});
      }
    };
    xhr.onerror = function () {
      reject({statusText: xhr.statusText});
    };
    xhr.send();
  });
}


//3. Parsing Data
// Takes the data from the different XHRs and populates the appropriate objects

//some data is returned in text like 640.23B, this converts it to a digit
function textToNum(num){
  var len = num.length - 1;
  var unit = num.charAt(len).toUpperCase();
  var newNum = Number(num.slice(0, len));
  if(unit === "B")
    newNum = newNum * 1000000000;
  if(unit === "M")
    newNum = newNum * 1000000;
  return newNum;
}

//converts numbers into text with units  12343334 -> 12.34M
function numToText(num){
  var len = String(num).length;
  var textNum;
  if (len > 9) {
    textNum = (num / 1000000000).toFixed(2);
    textNum += "B";
  } else {
    textNum = (num / 1000000).toFixed(2);
    textNum += "M";
  }
  return textNum;
}


function parseQuote(data, compInfo) {
	data = data.query.results.quote;
  var apiLabels = ["BookValue", "EBITDA", "PreviousClose", "LastTradePriceOnly", "MarketCapitalization", "Name", "OneyrTargetPrice", "symbol" ];
  var newLabels = ["bvps", "ebitdaText", "pricePrevClose", "price", "mktCapText", "name", "yahooTargetPrice", "symbol"];

  //replacing api labels with camelCase labels
  for (var i = 0; i < apiLabels.length; i++) {
    compInfo[newLabels[i]] = data[apiLabels[i]];
  }

  compInfo.mktCap = textToNum(compInfo["mktCapText"]);
  compInfo.ebitdaText = "$" + compInfo.ebitdaText;
	console.log("finished with quote data");
}

function parseStats(data, compInfo) {
	data = data.query.results.stats;
  compInfo.ev = data["EnterpriseValue"]["content"];
  compInfo.ebitda = data["EBITDA"]["content"];
  compInfo.shares = data["SharesOutstanding"];
  compInfo.netDebt = compInfo["ev"] - compInfo["mktCap"];
	console.log("finished with stats data");
}

function parsePeers(data, multiples, compInfo) {
  data = data.keyValuationItems;

  //remove the company's info from data which is in array[0];
  var company = data.shift();
  var evFcf = Number(company.evToFreeCashFlow);
  var pe = Number(company.priceToEarnings);

  //replaces the existing name with this one which has a better format
  compInfo.name = company.company;

  //extracting the implied free cash flow number from the multiple
  if (!isNaN(evFcf)) {
    compInfo.fcf = Number(compInfo.ev) / evFcf;
    compInfo.fcf = compInfo.fcf.toFixed(0);
    compInfo.fcfText = "$" + numToText(compInfo.fcf);
  } else {
    compInfo.fcfText = "n/a";
  }

  //extracting the implied free cash flow number from the multiple
  if (!isNaN(pe)) {
    compInfo.eps = Number(compInfo.pricePrevClose) / pe;
    compInfo.eps = compInfo.eps.toFixed(2);
  } else {
    compInfo.eps = "n/a";
  }
  data = data.filter(function(x){
    // removes existing stats which have x.company = "peerMedian" and x.symbol = "peerMedian"
    return (x.company !== x.symbol);
  });

  //removing elements that are not going to be used
  removeElements(data);

  // looping through to build an array to calc summary stats
  for (var i = 0; i < data.length; i++) {
    var obj = data[i];
    for (var key in obj) {
      if (!multiples.hasOwnProperty(key)) {
        multiples[key] = [];
      }
      multiples[key].push(obj[key]);
    }
  }

  // looping through and replacing the existing info with just the summary stats and adding back the company's
  for (var prop in multiples) {
    var arr = multiples[prop];
    multiples[prop] = {};
    multiples[prop]["min"] = sortAndCalc(arr, calcMin);
    multiples[prop]["max"] = sortAndCalc(arr, calcMax);
    multiples[prop]["median"] = sortAndCalc(arr, calcMedian);
    multiples[prop]["company"] = company[prop];
  }
  console.log("finished with peer data");
}

function sortAndCalc(arr, callback) {
  var newArr = arr.filter(function(x) {
    return !isNaN(x);
  });
  newArr.sort(function(a, b){return a - b;});
  return callback(newArr);
};

function calcMax(sortedArr) {
  var n = sortedArr.length - 1;
  return sortedArr[n];
}

function calcMin(sortedArr) {
  return sortedArr[0];
}

function calcMedian(sortedArr) {
  var n = sortedArr.length;
  var i = ((n + 1) / 2);

  //set index position
  i--;
  if (n < 1) {
    return "n/a";
  }
  if (n % 2 === 1) {
    return sortedArr[i];
  } else {
    return (sortedArr[i - 0.5] + sortedArr[i + 0.5]) / 2;
  }
}

//function to remove certain elements in parsePeers
function removeElements(data) {
  var propsArr = ["evToEbitda", "evToFreeCashFlow", "priceToBook", "priceToEarnings"];
  for (var i = 0; i < data.length; i++) {
    var obj = data[i];
    for (var key in obj) {
      if (propsArr.indexOf(key) < 0) {
        delete obj[key];
      }
    }
  }
}

function parseNews(data, compInfo) {
	data = data.query.results.a;
  var parentDiv = document.getElementById("news");
  var header = document.createElement("H6");
  parentDiv.innerHTML = "";
  header.innerHTML = compInfo.name + " in the news";
  parentDiv.appendChild(header);

	//yahoo brings in a lot of data, just limiting it to 4
  for (var i = 0; i < data.length && i < 4; i++) {
    var entry = document.createElement("A");
    entry.setAttribute("href", data[i]["href"]);
    entry.innerHTML = data[i].content + "</br>";
    parentDiv.appendChild(entry);
  }
	console.log("finished with news data");
}



//5. Calculting Target Price
//Target prices are calculated by taking the company's earnings and applying to to the industry's multiples
function calcTargetPrice(compInfo, multiples, targetPrices) {
  equityTargetPrice(compInfo, multiples, targetPrices);
  evEbitdaTargetPrice(compInfo, multiples, targetPrices);
  evFcfTargetPrice(compInfo, multiples, targetPrices);
  averagePrices(targetPrices);
}

function equityTargetPrice(compInfo, multiples, targetPrices) {
  var pe = multiples.priceToEarnings.median;
  var eps = compInfo.eps;
  var pb = multiples.priceToBook.median;
  var bvps = compInfo.bvps;

	//sets the default values
  targetPrices.pe = "n/a";
  targetPrices.pb = "n/a";
  if (!isNaN(pe * eps) && eps > 0) {
    targetPrices.pe = pe * eps;
  }
  if (!isNaN(pb * bvps) && bvps > 0) {
    targetPrices.pb = pb * bvps;
  }
}

function evEbitdaTargetPrice(compInfo, multiples, targetPrices) {
  var ebitdaMultiple = multiples.evToEbitda.median;
  var ebitda = compInfo.ebitda;
  var shares = Number(compInfo.shares);

  // setting default EV value
	targetPrices.evEbitda = "n/a";
  if (!isNaN(ebitdaMultiple * ebitda) && ebitda > 0) {
    var evEbitda = ebitdaMultiple * ebitda;
    var mktCap = evEbitda - compInfo.netDebt;
    if (mktCap > 0) {
      targetPrices.evEbitda = (mktCap / shares);
    }
  }
}

function evFcfTargetPrice(compInfo, multiples, targetPrices) {
  var fcfMultiple = multiples.evToFreeCashFlow.median;
  var fcf = compInfo.fcf;
  var shares = Number(compInfo.shares);

  //setting default value
  targetPrices.evFcf = "n/a";
  if (!isNaN(fcfMultiple * fcf)) {
    var evFcf = fcfMultiple * fcf;
    var mktCap = evFcf - compInfo.netDebt;
    if (mktCap > 0) {
        targetPrices.evFcf = (mktCap / shares);
    }
  }
}

//takes all of the target prices and calcs the average
function averagePrices(targetPrices){
  var sum = 0;
  var count = 0;
  var average;
  for (var key in targetPrices) {
    if (!isNaN(targetPrices[key])) {
      sum += targetPrices[key];
      count++;
    }
  }
  average = sum / count;
  if (!isNaN(average)) {
    targetPrices.average = average.toFixed(2);
  } else {
    targetPrices.average = "n/a";
  }
}


//6. HTML Output
//to keep Promises clean, html output were included here
function htmlOutput(compInfo, multiples, targetPrices) {
  htmlName(compInfo);
  htmlMultiples(multiples);
  htmlData([compInfo.price],[1], "price1");
  htmlData([compInfo.price],[2], "price2");
  htmlData([compInfo.yahooTargetPrice],[2], "yahooTargetPrice");
  htmlData([compInfo.eps, multiples.priceToEarnings.median, targetPrices.pe],[1, 4, 5], "peTarget");
  htmlData([compInfo.bvps, multiples.priceToBook.median, targetPrices.pb],[1, 4, 5], "pbTarget");
  htmlData([compInfo.ebitdaText, multiples.evToEbitda.median, targetPrices.evEbitda],[1, 4, 5], "evEbitdaTarget");
  htmlData([compInfo.fcfText, multiples.evToFreeCashFlow.median, targetPrices.evFcf],[1, 4, 5], "evFcfTarget");
  htmlData([targetPrices.average],[2], "average");
}

//adds the Company's name to the top of the table
function htmlName(compInfo){
    var div = document.getElementById("name");
    div.innerHTML = compInfo.name;
}

// populates the multiples in the top table
function htmlMultiples(multiples) {
  var columnLabels = ["label", "company", "empty", "min", "median", "max"];
  for (var x in multiples) {
    for (var key in multiples[x]) {
      var col = columnLabels.indexOf(key);
      var value = Number(multiples[x][key]).toFixed(2);
      if (isNaN(value)){
        value = "n/a";
      } else {
        //just a formatting thing, making the multiples display "2.34x"
        value = value + "x";
      }
			// HTML elements are set to match key values of the object;
      var row = document.getElementById(x);
      if (row && col > 0) {
        var cells = row.getElementsByTagName("td");
        cells[col].innerHTML = value;
      }
    }
  }
}

// populates the bottom table
function htmlData(dataArr, colArr, htmlId) {
  var row = document.getElementById(htmlId);
  var cells = row.getElementsByTagName("td");
  for (var i = 0; i < dataArr.length; i++) {
    var col = colArr[i];
    var value = dataArr[i];

    //columns representing dollars
    if (col === 1 || col === 5 || col === 2) {
      if (value > 0) {
        value = "$" + Number(value).toFixed(2);
      } else if (value < 0) {
        value = "($" + Number(value).toFixed(2).replace(/-/,"") + ")";
      }
    }

    //column with multiples
    if (col === 4) {
      value = value.toFixed(2) + "x";
    }
    cells[col].innerHTML = value;
  }
}

//adds the stock commentary to the bottom of page
function commentary(compInfo, targetPrices) {
  var name = compInfo.name;
  var price = compInfo.price;
  var calcPrice = targetPrices.average;
  var diff = calcPrice - price;
  var percent = calcPrice / price - 1;
  var text;
  if (isNaN(diff)) {
    text = "Sorry, there was not enough data points for " + name + " to make a recommendation. Please try a different ticker.";
  }
  if (diff > 0) {
    text = "Based on these metrics, it appears that " + name + " may be <span>undervalued</span> by $" + diff.toFixed(2) + ". So it might be a good time to buy!";
  } else  if (diff < 0){
    text = "Based on these metrics, it appears that " + name + " may be <span>overvalued</span> by $" + Math.abs(diff.toFixed(2)) + ". So you might want to hold off on buying any shares and maybe even sell any shares that you do own!";
  } else if (diff = 0) {
    text = name + " appears to be valued appropriately!";
  }

	//checks to see if the calculated target price is similiar to the analyst estimate
  if (Math.abs(percent) <= 0.05) {
    text += "</br>Also, the implied price is close to analysts' one year target price for " + name + ".";
  }
  var div = document.getElementById("commentary");
  div.innerHTML = text;
  notes(compInfo, targetPrices);
}



//Adds info on enterprise value to share price calculations to the footer.
function notes(compInfo, targetPrices) {
  if (targetPrices.evEbitda > 0 || targetPrices.evFcf > 0) {

		//formats negative net debt numbers
		if (compInfo.netDebt < 0) {
      netDebt = numToText(compInfo.netDebt);
      netDebt = netDebt.replace(/-/,"");
      netDebt = "($" + netDebt +")";
    } else {
      netDebt = "$" + numToText(compInfo.netDebt);
    }
    var text = "The company's net debt is " + netDebt + " and it has " + numToText(compInfo.shares) + " shares outstanding.";
    var parentDiv = document.getElementById("evInfo");
    var tNode = document.createTextNode(text);
    parentDiv.appendChild(tNode);
  }
}
