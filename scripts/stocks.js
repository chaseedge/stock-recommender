/* Stock Valuer
Author: Chase Edge
www.github.com/chaseedge


Table of Contents
1. Initiation Function
2. Pulling in Data
3. Parsing Data
4. Calculting Target Price
5. HTML Output
*/



//1. Initiation Function
//
function getData() {
	var ticker = tickerDiv().value;
	var targetPrices = {};
	var compInfo = {};
	var multiples = {};
	var headlines = [];
	loadingMessage(true);

	function quote(data){
		data = data.query.results.quote;
		parseQuote(data, compInfo);
		console.log("finished with quote data");
	}

	function stats(data){
		data = data.query.results.stats;
		parseStats(data, compInfo);
		console.log("finished with stats data");
	}

	function peers(data){
		data = data.keyValuationItems;
		parsePeers(data, multiples, compInfo);
		console.log("finished with peers data");
	}

// Using promises instead of synchronous XHR
	infoRequest(buildLink(ticker, "quote")).then(function(data){
		quote(data);
		return infoRequest(buildLink(ticker, "stats")).then(function(data){
			stats(data);
				return infoRequest(buildLink(ticker, "peers")).then(function(data){
					peers(data);
					calcTargetPrice(compInfo, multiples, targetPrices);
					htmlOutput(compInfo, multiples, targetPrices);
					loadingMessage(false);
					commentary(compInfo, targetPrices);
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

function tickerDiv() {
	var inputDiv = document.getElementById("ticker");
	var ticker = inputDiv.value.trim();
	ticker = ticker.toUpperCase();
	inputDiv.value = ticker;
	return inputDiv;
}

function loadingMessage(boolean) {
	var loadingDiv = document.getElementById("loading");
	var message = "Thinking<span>.</span><span>.</span><span>.</span>";
	var noteDiv = document.getElementById("evInfo");
	var note = "1. Formula for the implied share values from enterprise multiples is  (Enterprise Value - Net Debt) / Shares Outstanding. ";
	noteDiv.innerHTML = note;
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
		link = "http://api.capitalcube.com/companies/" + ticker + "-us/reports/peer-characteristics";
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
// Takes the data and populates the appropriate objects
function parseQuote(data, compInfo){
	var apiLabels = ["BookValue", "EBITDA", "PreviousClose", "LastTradePriceOnly", "MarketCapitalization", "Name", "OneyrTargetPrice", "symbol" ];
	var newLabels = ["bvps", "ebitdaText", "pricePrevClose", "price", "mktCapText", "name", "yahooTargetPrice", "symbol"];
	for (var i = 0; i < apiLabels.length; i++) {
		compInfo[newLabels[i]] = data[apiLabels[i]];
	}
	compInfo.mktCap = textToNum(compInfo["mktCapText"]);
	compInfo.ebitdaText = "$" + compInfo.ebitdaText;
}

function parseStats(data, compInfo){
	compInfo.ev = data["EnterpriseValue"]["content"];
	compInfo.ebitda = data["EBITDA"]["content"];
	compInfo.shares = data["SharesOutstanding"];
	compInfo.netDebt = compInfo["ev"] - compInfo["mktCap"];
}

function parsePeers(data, multiples, compInfo){
	multiples.pe = data["Price to Earnings (P/E)"];
	multiples.pb = data["Price to Book (P/B)"];
	multiples.evEbitda = data["EV / EBITDA"];
	multiples.evFcf = data["EV / FCF"];
	var evFcf = Number(multiples.evFcf.rating);
	if (!isNaN(evFcf)) {
		compInfo.fcf = Number(compInfo.ev) / evFcf;
		compInfo.fcf = compInfo.fcf.toFixed(0);
		compInfo.fcfText = "$" + numToText(compInfo.fcf);
	} else {
		compInfo.fcfText = "n/a";
	}
	var pe = Number(multiples.pe.rating);
	if (!isNaN(pe)) {
		compInfo.eps = Number(compInfo.pricePrevClose) / pe;
		compInfo.eps = compInfo.eps.toFixed(2);
	} else {
		compInfo.eps = "n/a";
	}
}

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

//4. Calculting Target Price

function calcTargetPrice(compInfo, multiples, targetPrices) {
	equityTargetPrice(compInfo, multiples, targetPrices);
	evEbitdaTargetPrice(compInfo, multiples, targetPrices);
	evFcfTargetPrice(compInfo, multiples, targetPrices);
	averagePrices(targetPrices);
}

function equityTargetPrice(compInfo, multiples, targetPrices) {
	var pe = multiples.pe.peerMedian;
	var eps = compInfo.eps;
	var pb = multiples.pb.peerMedian;
	var bvps = compInfo.bvps;
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
	var ebitdaMultiple = multiples.evEbitda.peerMedian;
	var ebitda = compInfo.ebitda;
	var shares = Number(compInfo.shares);
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
	var fcfMultiple = multiples.evFcf.peerMedian;
	var fcf = compInfo.fcf;
	var shares = Number(compInfo.shares);
	targetPrices.evFcf = "n/a";
	if (!isNaN(fcfMultiple * fcf)) {
		var evFcf = fcfMultiple * fcf;
		var mktCap = evFcf - compInfo.netDebt;
		if (mktCap > 0) {
				targetPrices.evFcf = (mktCap / shares);
		}
	}
}

function averagePrices(targetPrices){
	var sum = 0;
	var count = 0;
	var average;
	for (var key in targetPrices) {
		if (!isNaN(targetPrices[key])) {
			sum += targetPrices[key];
			count++
		}
	}
	average = sum / count;
	if (!isNaN(average)) {
		targetPrices.average = average.toFixed(2);
	} else {
		targetPrices.average = "n/a";
	}
}



//5. HTML Output

//to keep Promises clean, html output were included here
function htmlOutput(compInfo, multiples, targetPrices) {
	htmlName(compInfo);
	htmlMultiples(multiples);
	htmlData([compInfo.price],[1], "price1");
	htmlData([compInfo.price],[2], "price2");
	htmlData([compInfo.yahooTargetPrice],[2], "yahooTargetPrice");
	htmlData([compInfo.eps, multiples.pe.peerMedian, targetPrices.pe],[1, 4, 5], "peTarget");
	htmlData([compInfo.bvps, multiples.pb.peerMedian, targetPrices.pb],[1, 4, 5], "pbTarget");
	htmlData([compInfo.ebitdaText, multiples.evEbitda.peerMedian, targetPrices.evEbitda],[1, 4, 5], "evEbitdaTarget");
	htmlData([compInfo.fcfText, multiples.evFcf.peerMedian, targetPrices.evFcf],[1, 4, 5], "evFcfTarget");
	htmlData([targetPrices.average],[2], "average");
}

function htmlName(compInfo){
		var div = document.getElementById("name");
		div.innerHTML = compInfo.name;
}

// populates the multiples in the top table
function htmlMultiples(obj) {
	var columnLabels = ["labels", "rating", "empty", "peerMin", "peerMedian", "peerMax"];
	for (var x in obj) {
		for (var key in obj[x]) {
			var col = columnLabels.indexOf(key);
			var value = Number(obj[x][key]).toFixed(2);
			if (isNaN(value)){
				value = "n/a";
			} else {
				value = value + "x";
			}
			var row = document.getElementById(x);
			if (row && col > 0) {
				var cells = row.getElementsByTagName("td");
				cells[col].innerHTML = value;
			}
		}
	}
}

// populates the multiples in the bottom table
function htmlData(dataArr,colArr, htmlId) {
	var row = document.getElementById(htmlId);
	var cells = row.getElementsByTagName("td");
	for (var i = 0; i < dataArr.length; i++) {
		var col = colArr[i];
		var value = dataArr[i];
		if (col === 1 | col === 5 | col === 2) {
			if (value > 0) {
				value = "$" + Number(value).toFixed(2);
			} else if (value < 0) {
				value = "($" + Number(value).toFixed(2).replace(/-/,"") + ")";
			}
		}
		if (col === 4) {
			value = value.toFixed(2) + "x";
		}
		cells[col].innerHTML = value;
	}
}

function commentary(compInfo, targetPrices) {
	var name = compInfo.name;
	var price = compInfo.price;
	var calcPrice = targetPrices.average;
	var diff = calcPrice - price;
	var percent = calcPrice / price;
	var text;
	if (isNaN(diff)) {
		text = "Sorry, there was not enough data points for " + name + " to make a recommendation. Please try a different ticker.";
	}
	if (diff > 0) {
		text = "Based on these metrics, it appears that " + name + " may be <span>undervalued</span> by $" + diff.toFixed(2) + ". So it might be a good time to buy!";
	} else  if (diff < 0){
		text = "Based on these metrics, it appears that " + name + " may be <span>overvalued</span> by $" + Math.abs(diff.toFixed(2)) + ". So you might want to wait to buy any shares or maybe short it!";
	} else if (diff = 0) {
		text = name + " appears to be valued appropriately!";
	}
	var div = document.getElementById("commentary");
	div.innerHTML = text;
	notes(compInfo, targetPrices);
}


//Adds info on enterprise value to share price calculations to the footer.
function notes(compInfo, targetPrices) {
	if (targetPrices.evEbitda > 0 | targetPrices.evFcf > 0) {
		if (compInfo.netDebt < 0) { 		//sometimes net debt is negative (cash > debt). -123.0 -> ($123.0)
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
